import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import type { InstructionsJson, QddCommand, QddLayer, StudyRecord, TaskRecord } from '../types.js';
import { readMarkdownFrontmatter } from './store.js';
import { PATHS } from './constants.js';
import { getStudyArtifactCandidatesPath } from './evidence.js';
import { getClaudeLocalSkillPath, listLocalSkills, resolveLocalSkills } from './local-skills.js';
import { getRoleForLayer, readLayerPolicy, resolveCommandDecisionLayer, isQddCommand } from './layer-policy.js';

const PROJECT_TARGET_ID = 'PROJECT';
const STUDY_ID_PATTERN = /^STUDY-\d{3}$/;
const TASK_ID_PATTERN = /^TASK-\d{3}$/;

export interface BuildInstructionsOptions {
  command?: QddCommand;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueSortedValues(values: string[]): string[] {
  return uniqueValues(values).sort((left, right) => left.localeCompare(right));
}

async function readStudyRecord(projectRoot: string, studyId: string): Promise<StudyRecord> {
  return readMarkdownFrontmatter<StudyRecord>(projectRoot, `studies/${studyId}/study.md`);
}

async function findTaskRecord(projectRoot: string, taskId: string): Promise<{ task: TaskRecord; studyId: string }> {
  const studiesDir = path.join(projectRoot, PATHS.studiesDir);
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

async function collectSharedDataReadPaths(projectRoot: string): Promise<string[]> {
  const dataDir = path.join(projectRoot, PATHS.artifactDataDir);
  if (!(await FileSystemUtils.directoryExists(dataDir))) {
    return [];
  }

  const entries = await (await import('node:fs/promises')).readdir(dataDir, { withFileTypes: true });
  return entries.map((entry) => `${PATHS.artifactDataDir}/${entry.name}`).sort();
}

async function collectStudyTaskPaths(projectRoot: string, studyId: string): Promise<string[]> {
  const tasksDir = path.join(projectRoot, PATHS.studiesDir, studyId, 'tasks');
  if (!(await FileSystemUtils.directoryExists(tasksDir))) {
    return [];
  }

  const entries = await (await import('node:fs/promises')).readdir(tasksDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `${PATHS.studiesDir}/${studyId}/tasks/${entry.name}`)
    .sort();
}

async function collectTaskSkillIds(projectRoot: string, taskPaths: string[]): Promise<string[]> {
  const skillIds = new Set<string>();

  for (const relativePath of taskPaths) {
    const task = await readMarkdownFrontmatter<TaskRecord>(projectRoot, relativePath);
    for (const skillId of task.skills ?? []) {
      if (skillId.trim().length > 0) {
        skillIds.add(skillId);
      }
    }
  }

  return [...skillIds].sort();
}

async function resolveSkillSet(projectRoot: string, skillIds: string[]): Promise<{
  matchedPaths: string[];
  missing: string[];
  disallowedWorkflow: string[];
  matchedIds: string[];
}> {
  const localSkills = await resolveLocalSkills(projectRoot, skillIds);
  const matchedPaths = [...localSkills.matched.map((entry) => entry.path)];

  for (const entry of localSkills.matched) {
    const claudeMirrorPath = getClaudeLocalSkillPath(entry.id);
    if (await FileSystemUtils.fileExists(path.join(projectRoot, claudeMirrorPath))) {
      matchedPaths.push(claudeMirrorPath);
    }
  }

  return {
    matchedPaths: uniqueSortedValues(matchedPaths),
    missing: uniqueSortedValues(localSkills.missing),
    disallowedWorkflow: uniqueSortedValues(localSkills.disallowedWorkflow),
    matchedIds: uniqueSortedValues(localSkills.matched.map((entry) => entry.id)),
  };
}

async function collectAvailableSkillReadPaths(projectRoot: string): Promise<string[]> {
  const availableSkills = await listLocalSkills(projectRoot);
  const readPaths = [...availableSkills.map((entry) => entry.path)];

  for (const entry of availableSkills) {
    const claudeMirrorPath = getClaudeLocalSkillPath(entry.id);
    if (await FileSystemUtils.fileExists(path.join(projectRoot, claudeMirrorPath))) {
      readPaths.push(claudeMirrorPath);
    }
  }

  return uniqueSortedValues(readPaths);
}

function validateCommandForTarget(targetKind: 'project' | 'study' | 'task', command: QddCommand | null): void {
  if (!command) {
    return;
  }

  if (targetKind === 'project' && command !== 'qdd-start') {
    throw new Error(`Command '${command}' is not valid for PROJECT instructions.`);
  }

  if (targetKind === 'study' && !['qdd-propose', 'qdd-explore', 'qdd-apply', 'qdd-close'].includes(command)) {
    throw new Error(`Command '${command}' is not valid for STUDY instructions.`);
  }

  if (targetKind === 'task' && command !== 'qdd-apply') {
    throw new Error(`Command '${command}' is not valid for TASK instructions.`);
  }
}

function appendSkillIssues(
  rules: string[],
  subject: string,
  requiredSkills: { missing: string[]; disallowedWorkflow: string[] },
  optionalSkills: { missing: string[]; disallowedWorkflow: string[] }
): void {
  const missingRequired = requiredSkills.missing;
  const missingOptional = optionalSkills.missing;
  const disallowed = uniqueSortedValues([...requiredSkills.disallowedWorkflow, ...optionalSkills.disallowedWorkflow]);

  if (disallowed.length > 0) {
    rules.push(`${subject} layer policy must not include workflow skills: ${disallowed.join(', ')}.`);
  }

  if (missingRequired.length > 0) {
    rules.push(`${subject} required local skills are missing from .codex/skills/: ${missingRequired.join(', ')}.`);
  }

  if (missingOptional.length > 0) {
    rules.push(`${subject} optional local skills are missing from .codex/skills/: ${missingOptional.join(', ')}.`);
  }
}

function buildInstructionHeader(command: QddCommand | null, decisionLayer: QddLayer, role: InstructionsJson['role']): Pick<
  InstructionsJson,
  'command' | 'decision_layer' | 'role'
> {
  return {
    command,
    decision_layer: decisionLayer,
    role,
  };
}

// 生成某个 target 的 instructions JSON。
// 这里除了 target 本身，还会把命令上下文映射到 decision layer / role / skill defaults，
// 让 agent 不再只看到“读写哪些文件”，而是也知道“现在是谁在判断”。
export async function buildInstructions(
  projectRoot: string,
  id: string,
  options: BuildInstructionsOptions = {}
): Promise<InstructionsJson> {
  const command = options.command ?? null;
  if (command !== null && !isQddCommand(command)) {
    throw new Error(`Unsupported command '${command}'.`);
  }

  if (id === PROJECT_TARGET_ID) {
    validateCommandForTarget('project', command);

    const policy = await readLayerPolicy(projectRoot);
    const contextReadPaths = await collectContextReadPaths(projectRoot);
    const dataReadPaths = await collectSharedDataReadPaths(projectRoot);
    const localSkillReadPaths = await collectAvailableSkillReadPaths(projectRoot);
    const decisionLayer = resolveCommandDecisionLayer(policy, command, 'project');
    const role = getRoleForLayer(policy, decisionLayer);
    const requiredSkillDefaults = await resolveSkillSet(projectRoot, policy.layers[decisionLayer].required_skills);
    const optionalSkillDefaults = await resolveSkillSet(projectRoot, policy.layers[decisionLayer].optional_skills);
    const rules = [
      'Do not invent project facts that are not grounded in user input or existing files.',
      'Use qdd-start to fill shared project context before the first study is proposed.',
      'Keep contract.yaml concise and machine-readable.',
      'Keep richer project context in context/resources.md and optional context sidecars.',
      'Create dataset entrypoints under artifacts/data/ as symlinks rather than copying raw data by default.',
      'Treat .qdd/layer-policy.yaml as the editable source for layer roles and command mapping.',
      'Treat .codex/skills/ as the local skill validation inventory and .claude/skills/ as the mirrored tool surface when present.',
    ];

    appendSkillIssues(rules, 'Project', requiredSkillDefaults, optionalSkillDefaults);

    return {
      ...buildInstructionHeader(command, decisionLayer, role),
      target: {
        kind: 'project',
        id,
      },
      read: uniqueSortedValues([
        PATHS.contract,
        PATHS.evolution,
        PATHS.instructions,
        PATHS.bootstrapConfig,
        PATHS.layerPolicy,
        `${PATHS.artifactDataDir}/`,
        `${PATHS.codexSkillsDir}/`,
        `${PATHS.claudeSkillsDir}/`,
        ...contextReadPaths,
        ...dataReadPaths,
        ...localSkillReadPaths,
        ...requiredSkillDefaults.matchedPaths,
        ...optionalSkillDefaults.matchedPaths,
      ]),
      write: [
        PATHS.contract,
        PATHS.contextResources,
        `${PATHS.contextDir}/`,
        `${PATHS.artifactDataDir}/`,
        PATHS.layerPolicy,
        `${PATHS.codexSkillsDir}/`,
        `${PATHS.claudeSkillsDir}/`,
      ],
      required_skills: requiredSkillDefaults.matchedIds,
      optional_skills: optionalSkillDefaults.matchedIds,
      rules,
    };
  }

  if (STUDY_ID_PATTERN.test(id)) {
    validateCommandForTarget('study', command);

    await readStudyRecord(projectRoot, id);
    const policy = await readLayerPolicy(projectRoot);
    const contextReadPaths = await collectContextReadPaths(projectRoot);
    const dataReadPaths = await collectSharedDataReadPaths(projectRoot);
    const taskPaths = await collectStudyTaskPaths(projectRoot, id);
    const studyTaskSkillIds = await collectTaskSkillIds(projectRoot, taskPaths);
    const studyTaskSkills = await resolveSkillSet(projectRoot, studyTaskSkillIds);
    const decisionLayer = resolveCommandDecisionLayer(policy, command, 'study');
    const role = getRoleForLayer(policy, decisionLayer);
    const requiredSkillDefaults = await resolveSkillSet(projectRoot, policy.layers[decisionLayer].required_skills);
    const optionalSkillDefaults = await resolveSkillSet(projectRoot, policy.layers[decisionLayer].optional_skills);
    const requiredSkillIds = uniqueSortedValues([...requiredSkillDefaults.matchedIds, ...studyTaskSkills.matchedIds]);
    const readPaths = [
      PATHS.contract,
      PATHS.evolution,
      PATHS.instructions,
      PATHS.layerPolicy,
      ...contextReadPaths,
      ...dataReadPaths,
      `${PATHS.studiesDir}/${id}/study.md`,
      ...taskPaths,
      PATHS.artifactIndex,
      ...studyTaskSkills.matchedPaths,
      ...requiredSkillDefaults.matchedPaths,
      ...optionalSkillDefaults.matchedPaths,
    ];
    const writePaths = [
      `${PATHS.studiesDir}/${id}/study.md`,
      `${PATHS.studiesDir}/${id}/tasks/`,
      `${PATHS.studiesDir}/${id}/output/`,
      getStudyArtifactCandidatesPath(id),
      PATHS.artifactIndex,
    ];

    if (command === 'qdd-close') {
      writePaths.push(PATHS.evolution, PATHS.contextResources, `${PATHS.contextDir}/`);
    }

    const rules = [
      'Do not redefine the project theme.',
      'Keep one bounded question per study.',
      'Use the current mode contract from .qdd/instructions.md before reshaping the study or task set.',
      'Treat .qdd/layer-policy.yaml as the command-to-role contract for this instruction surface.',
      'Only rely on domain task skills that exist under .codex/skills/.',
      'qdd-propose owns the first-pass study and task-graph creation.',
      'In human or assist mode, qdd-explore must discuss and confirm before modifying study/task artifacts.',
      'Record blockers explicitly.',
      'Update study and task Markdown records directly as work progresses.',
      'Treat the study as the execution unit until it reaches a decision point, explicit blocker, or true study-level replanning need.',
      'Do not return to qdd-explore just because one task finished; keep moving while the next planned study-local task is clear.',
      'Write study outputs into the study output directory.',
      'Preserve readable scripts in studies/STUDY-XXX/output/code for substantive analyses.',
      'Save key figures in studies/STUDY-XXX/output/figures when the claim depends on visual evidence, or record why no figure was needed.',
      'Use studies/STUDY-XXX/output/artifact-candidates.yaml as the explicit promotion boundary for reusable study outputs.',
      'Include task_id in artifact candidates whenever one task clearly produced the reusable output.',
    ];

    if (command === 'qdd-close') {
      rules.push('For qdd-close, the target is the study but the final promotion and carry-forward judgment belongs to the project decision layer.');
      rules.push('Prefer candidate-driven promotion through qdd-close over ad hoc direct registration.');
    }

    appendSkillIssues(rules, 'Study', requiredSkillDefaults, optionalSkillDefaults);

    if (studyTaskSkills.disallowedWorkflow.length > 0) {
      rules.push(
        `Task skill lists must not include workflow skills: ${studyTaskSkills.disallowedWorkflow.join(', ')}. Replace them with concrete domain skills or remove them.`
      );
    }

    if (studyTaskSkills.missing.length > 0) {
      rules.push(
        `Missing local skills referenced by this study's tasks: ${studyTaskSkills.missing.join(', ')}. Treat this as a blocker until the skill is installed locally under .codex/skills/ or the task is rewritten.`
      );
    }

    return {
      ...buildInstructionHeader(command, decisionLayer, role),
      target: {
        kind: 'study',
        id,
      },
      read: uniqueSortedValues(readPaths),
      write: uniqueSortedValues(writePaths),
      required_skills: requiredSkillIds,
      optional_skills: optionalSkillDefaults.matchedIds,
      rules,
    };
  }

  if (TASK_ID_PATTERN.test(id)) {
    validateCommandForTarget('task', command);

    const { studyId, task } = await findTaskRecord(projectRoot, id);
    const policy = await readLayerPolicy(projectRoot);
    const contextReadPaths = await collectContextReadPaths(projectRoot);
    const dataReadPaths = await collectSharedDataReadPaths(projectRoot);
    const taskSkillSet = await resolveSkillSet(projectRoot, task.skills ?? []);
    const decisionLayer = resolveCommandDecisionLayer(policy, command, 'task');
    const role = getRoleForLayer(policy, decisionLayer);
    const requiredSkillDefaults = await resolveSkillSet(projectRoot, policy.layers[decisionLayer].required_skills);
    const optionalSkillDefaults = await resolveSkillSet(projectRoot, policy.layers[decisionLayer].optional_skills);
    const requiredSkillIds = uniqueSortedValues([...requiredSkillDefaults.matchedIds, ...taskSkillSet.matchedIds]);
    const rules = [
      'Do not redefine the study question.',
      'Keep the task minimal and evidence-producing.',
      'Produce explicit outputs or blockers.',
      'Treat .qdd/layer-policy.yaml as the command-to-role contract for this instruction surface.',
      'Only rely on domain task skills that exist under .codex/skills/.',
      'Do not add qdd/* workflow skills to task skill lists.',
      'Rewrite the weak checklist scaffold into task-specific executable steps before or during execution.',
      'Keep task checklist progress in the task Markdown body.',
      'Escalate to study-level updates when the task changes the study boundary or evidence plan.',
      'Preserve readable scripts in studies/STUDY-XXX/output/code for substantive analyses.',
      'Save key figures in studies/STUDY-XXX/output/figures when the claim depends on visual evidence, or record why no figure was needed.',
      'Add only promotion-worthy outputs to studies/STUDY-XXX/output/artifact-candidates.yaml; do not treat all local outputs as artifacts.',
      'Include task_id in artifact candidates whenever this task clearly produced the reusable output.',
      'Treat qdd register-artifact as an exception path; prefer candidate-driven promotion unless immediate registration is truly needed.',
      'Register reusable outputs in artifacts/index.yaml only through canonical artifact paths.',
    ];

    appendSkillIssues(rules, 'Task', requiredSkillDefaults, optionalSkillDefaults);

    if (taskSkillSet.disallowedWorkflow.length > 0) {
      rules.push(
        `Task skill lists must not include workflow skills: ${taskSkillSet.disallowedWorkflow.join(', ')}. Replace them with concrete domain skills or remove them.`
      );
    }

    if (taskSkillSet.missing.length > 0) {
      rules.push(
        `Missing local skills referenced by this task: ${taskSkillSet.missing.join(', ')}. qdd-apply must hard-block until the skill is installed locally under .codex/skills/ or the task is rewritten.`
      );
    }

    return {
      ...buildInstructionHeader(command, decisionLayer, role),
      target: {
        kind: 'task',
        id,
      },
      read: uniqueSortedValues([
        PATHS.contract,
        PATHS.evolution,
        PATHS.instructions,
        PATHS.layerPolicy,
        ...contextReadPaths,
        ...dataReadPaths,
        `${PATHS.studiesDir}/${studyId}/study.md`,
        `${PATHS.studiesDir}/${studyId}/tasks/${id}.md`,
        PATHS.artifactIndex,
        ...taskSkillSet.matchedPaths,
        ...requiredSkillDefaults.matchedPaths,
        ...optionalSkillDefaults.matchedPaths,
      ]),
      write: uniqueSortedValues([
        `${PATHS.studiesDir}/${studyId}/tasks/${id}.md`,
        `${PATHS.studiesDir}/${studyId}/output/`,
        getStudyArtifactCandidatesPath(studyId),
        PATHS.artifactIndex,
      ]),
      required_skills: requiredSkillIds,
      optional_skills: optionalSkillDefaults.matchedIds,
      rules,
    };
  }

  throw new Error(`Unsupported instructions target '${id}'. Expected PROJECT, STUDY-XXX, or TASK-XXX.`);
}
