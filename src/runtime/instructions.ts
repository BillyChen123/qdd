import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import type { InstructionsJson, StudyRecord, TaskRecord } from '../types.js';
import { readMarkdownFrontmatter } from './store.js';
import { PATHS } from './constants.js';
import { getStudyArtifactCandidatesPath } from './evidence.js';

// 当前版本只支持两类 instructions target：study 和 task。
// 这里先用简单正则校验 id 格式，避免 CLI 传进来任意字符串。
const STUDY_ID_PATTERN = /^STUDY-\d{3}$/;
const TASK_ID_PATTERN = /^TASK-\d{3}$/;

// 读取某个 study 的结构化记录。
// 输入是项目根目录 + studyId，输出是 study.md frontmatter 解析后的对象。
async function readStudyRecord(projectRoot: string, studyId: string): Promise<StudyRecord> {
  return readMarkdownFrontmatter<StudyRecord>(projectRoot, `studies/${studyId}/study.md`);
}

// 读取某个 task 的结构化记录。
// 因为 taskId 本身不带 studyId，所以这里要遍历所有 studies，
// 找到“这个任务文件到底挂在哪个 study 下面”。
//
// 返回值除了 task 本身，还会额外返回它所属的 studyId，
// 因为后面生成 instructions 时需要一起带上 study 上下文。
async function findTaskRecord(projectRoot: string, taskId: string): Promise<{ task: TaskRecord; studyId: string }> {
  const studiesDir = path.join(projectRoot, 'studies');
  const studies = await FileSystemUtils.directoryExists(studiesDir)
    ? await (await import('node:fs/promises')).readdir(studiesDir, { withFileTypes: true })
    : [];

  for (const studyEntry of studies) {
    if (!studyEntry.isDirectory()) continue;
    const taskPath = path.join(studiesDir, studyEntry.name, 'tasks', `${taskId}.md`);
    if (await FileSystemUtils.fileExists(taskPath)) {
      const task = await readMarkdownFrontmatter<TaskRecord>(projectRoot, `studies/${studyEntry.name}/tasks/${taskId}.md`);
      return {
        task: {
          ...task,
          task_id: task.task_id ?? taskId,
          study_id: task.study_id ?? studyEntry.name,
        },
        studyId: studyEntry.name,
      };
    }
  }

  throw new Error(`Task '${taskId}' not found.`);
}

// 收集 context/ 目录下所有上下文文件的相对路径。
//
// 注意这里的设计是“开放上下文目录”：
// runtime 不要求上下文只能是 YAML。
// 当前默认更偏向可读性，所以 `context/*.md` 和 `context/*.yaml`
// 都会被纳入 instructions 的 read 列表。
async function collectContextReadPaths(projectRoot: string): Promise<string[]> {
  const contextDir = path.join(projectRoot, PATHS.contextDir);
  if (!(await FileSystemUtils.directoryExists(contextDir))) {
    return [];
  }

  const entries = await (await import('node:fs/promises')).readdir(contextDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.md')))
    .map((entry) => `${PATHS.contextDir}/${entry.name}`)
    .sort();
}

// 收集某个 study 下所有 task Markdown 文件路径。
// 这个函数主要给 study instructions 用：
// 当 target 是一个 study 时，agent 应该把该 study 下的所有任务一起读进去。
async function collectStudyTaskPaths(projectRoot: string, studyId: string): Promise<string[]> {
  const tasksDir = path.join(projectRoot, 'studies', studyId, 'tasks');
  if (!(await FileSystemUtils.directoryExists(tasksDir))) {
    return [];
  }

  const entries = await (await import('node:fs/promises')).readdir(tasksDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `studies/${studyId}/tasks/${entry.name}`)
    .sort();
}

// 生成某个 target 的 instructions JSON。
//
// 这个函数的职责不是“执行任务”，而是回答下面这几个问题：
// 1. 这个 target 是 study 还是 task？
// 2. agent 在动手前应该读哪些文件？
// 3. agent 允许把输出写到哪些地方？
// 4. 执行时要遵守哪些最基本的规则？
//
// 所以你可以把它理解成：
// “把磁盘上的 QDD 项目状态，翻译成一份 agent 可消费的操作说明书”。
export async function buildInstructions(projectRoot: string, id: string): Promise<InstructionsJson> {
  // 第一版先故意收窄：只给磁盘上已经存在的 study/task 生成 instructions。
  // 也就是说，现在它还不负责“规划阶段的自动生成”，只负责“已有记录的读取与指令拼装”。
  if (STUDY_ID_PATTERN.test(id)) {
    // 先读取一次 study，目的是验证它真实存在；
    // 如果不存在，readStudyRecord 会直接抛错。
    await readStudyRecord(projectRoot, id);
    const contextReadPaths = await collectContextReadPaths(projectRoot);
    const taskPaths = await collectStudyTaskPaths(projectRoot, id);
    return {
      target: {
        kind: 'study',
        id,
      },
      read: [
        PATHS.contract,
        PATHS.evolution,
        PATHS.instructions,
        ...contextReadPaths,
        `studies/${id}/study.md`,
        ...taskPaths,
        PATHS.artifactIndex,
      ],
      write: [
        `studies/${id}/study.md`,
        `studies/${id}/tasks/`,
        `studies/${id}/output/`,
        getStudyArtifactCandidatesPath(id),
        PATHS.artifactIndex,
      ],
      required_skills: [],
      optional_skills: [],
      rules: [
        'Do not redefine the project theme.',
        'Keep one bounded question per study.',
        'Use the current mode contract from .qdd/instructions.md before reshaping the study or task set.',
        'qdd-propose owns the first-pass study and initial task creation.',
        'In human or assist mode, qdd-explore must discuss and confirm before modifying study/task artifacts.',
        'Record blockers explicitly.',
        'Update study and task Markdown records directly as work progresses.',
        'Treat the study as the execution unit until it reaches a decision point, explicit blocker, or boundary change.',
        'Write study outputs into the study output directory.',
        'Preserve readable scripts in studies/STUDY-XXX/output/code for substantive analyses.',
        'Save key figures in studies/STUDY-XXX/output/figures when the claim depends on visual evidence, or record why no figure was needed.',
        'Use studies/STUDY-XXX/output/artifact-candidates.yaml as the explicit promotion boundary for reusable study outputs.',
      ],
    };
  }

  if (TASK_ID_PATTERN.test(id)) {
    // task 指令需要先反查它属于哪个 study，
    // 因为任务执行时通常还要读 study 上下文。
    const { studyId } = await findTaskRecord(projectRoot, id);
    const contextReadPaths = await collectContextReadPaths(projectRoot);
    return {
      target: {
        kind: 'task',
        id,
      },
      read: [
        PATHS.contract,
        PATHS.evolution,
        PATHS.instructions,
        ...contextReadPaths,
        `studies/${studyId}/study.md`,
        `studies/${studyId}/tasks/${id}.md`,
        PATHS.artifactIndex,
      ],
      write: [
        `studies/${studyId}/tasks/${id}.md`,
        `studies/${studyId}/output/`,
        getStudyArtifactCandidatesPath(studyId),
        PATHS.artifactIndex,
      ],
      required_skills: [],
      optional_skills: [],
      rules: [
        'Do not redefine the study question.',
        'Keep the task minimal and evidence-producing.',
        'Produce explicit outputs or blockers.',
        'Rewrite the weak checklist scaffold into task-specific executable steps before or during execution.',
        'Keep task checklist progress in the task Markdown body.',
        'Escalate to study-level updates when the task changes the study boundary or evidence plan.',
        'Preserve readable scripts in studies/STUDY-XXX/output/code for substantive analyses.',
        'Save key figures in studies/STUDY-XXX/output/figures when the claim depends on visual evidence, or record why no figure was needed.',
        'Add only promotion-worthy outputs to studies/STUDY-XXX/output/artifact-candidates.yaml; do not treat all local outputs as artifacts.',
        'Register reusable outputs in artifacts/index.yaml.',
      ],
    };
  }

  // 目前只支持 STUDY-XXX / TASK-XXX，其他 id 先明确拒绝。
  throw new Error(`Unsupported instructions target '${id}'. Expected STUDY-XXX or TASK-XXX.`);
}
