import path from 'node:path';
import * as nodeFs from 'node:fs/promises';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { discoverStudies, discoverTasks } from './discovery.js';
import { buildCanonicalArtifactPath, ensureStudyOutputLayout, getStudyArtifactCandidatesPath, getStudyOutputDir, relocateArtifactToCanonicalPath, readNormalizedArtifactCandidatesForPromotion, resolveProjectRelativeFilePath, } from './evidence.js';
import { readMarkdownDocument, readYamlFile, writeMarkdownDocument, writeYamlFile, } from './store.js';
import { normalizeTaskSkillIds, resolveLocalSkills } from './local-skills.js';
const STUDY_ID_PATTERN = /^STUDY-(\d{3})$/;
const TASK_ID_PATTERN = /^TASK-(\d{3})$/;
const ARTIFACT_ID_PATTERN = /^ART-(\d{3})$/;
function formatSequentialId(prefix, index) {
    return `${prefix}-${String(index).padStart(3, '0')}`;
}
// 从一组已有 ID 里找出最大的编号。
// 例如已有 STUDY-001 / STUDY-003，就返回 3，供下一次创建时顺延。
function getHighestMatchingIndex(values, pattern) {
    return values.reduce((highest, value) => {
        const match = value.match(pattern);
        if (!match) {
            return highest;
        }
        return Math.max(highest, Number.parseInt(match[1], 10));
    }, 0);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// 用于就地替换 Markdown 的某个二级标题段落。
// QDD 的做法是 frontmatter 管结构化真相，正文保留给人读，
// 所以这里会在不重建整份文档的前提下同步某个 section。
function replaceMarkdownSection(body, heading, content) {
    const normalizedContent = content.trim();
    const sectionPattern = new RegExp(`(## ${escapeRegExp(heading)}\\n\\n)([\\s\\S]*?)(?=\\n## |$)`);
    if (sectionPattern.test(body)) {
        return body.replace(sectionPattern, `$1${normalizedContent}\n`);
    }
    const suffix = body.trim().length > 0 ? '\n\n' : '';
    return `${body.trim()}${suffix}## ${heading}\n\n${normalizedContent}`.trim();
}
function buildStudyBody(record) {
    const blockers = record.blockers && record.blockers.length > 0 ? record.blockers.map((value) => `- ${value}`).join('\n') : '- None yet.';
    const tasks = record.task_ids && record.task_ids.length > 0 ? record.task_ids.map((taskId) => `- [ ] ${taskId}`).join('\n') : '- No planned tasks yet.';
    const expectedArtifacts = record.expected_artifacts && record.expected_artifacts.length > 0
        ? record.expected_artifacts.map((value) => `- ${value}`).join('\n')
        : '- None specified yet.';
    const evidencePlan = record.expected_artifacts && record.expected_artifacts.length > 0
        ? record.expected_artifacts.map((value) => `- ${value}`).join('\n')
        : '- Define the minimum evidence needed to judge this study.';
    return [
        '## Question',
        '',
        record.question,
        '',
        '## Hypothesis',
        '',
        record.hypothesis,
        '',
        '## Why Now',
        '',
        'Explain why this study is worth doing now and why it belongs in the current project loop.',
        '',
        '## Resource Fit',
        '',
        '- Data: identify which context resources or prior artifacts support this study.',
        '- Runtime: identify which tools, packages, or compute resources are needed.',
        '- Biology: note any stable domain assumptions or prior knowledge that matter.',
        '- Reuse: note any existing artifacts that should be reused instead of regenerated.',
        '',
        '## Evidence Plan',
        '',
        evidencePlan,
        '',
        '## Blockers',
        '',
        blockers,
        '',
        '## Tasks',
        '',
        tasks,
        '',
        '## Expected Artifacts',
        '',
        expectedArtifacts,
    ].join('\n');
}
function buildTaskBody(record, studyId, inputs) {
    const dependsOn = record.depends_on && record.depends_on.length > 0 ? record.depends_on.map((value) => `- ${value}`).join('\n') : '- None.';
    const inputLines = inputs.length > 0
        ? inputs.map((value) => `- ${value}`).join('\n')
        : ['- `contract.yaml`', '- `context/resources.md`', '- `context/*.yaml` (optional structured sidecars)', `- \`studies/${studyId}/study.md\``].join('\n');
    const expectedOutputLines = record.expected_outputs && record.expected_outputs.length > 0
        ? record.expected_outputs.map((value) => `- ${value}`).join('\n')
        : '- None specified yet.';
    const checklistLines = [
        '- Replace this scaffold with 3-7 task-specific executable steps before or during execution.',
        '- [ ] Reconfirm the concrete success signal for this task',
        '- [ ] Prepare the real inputs, dependencies, and execution method',
        '- [ ] Produce the expected evidence or record the blocker explicitly',
        `- [ ] Write study-local evidence into \`${getStudyOutputDir(studyId)}/\` and summarize what changed`,
        `- [ ] Preserve readable analysis scripts in \`${getStudyOutputDir(studyId)}/code/\` when this task runs substantive analysis`,
        `- [ ] Save at least one key figure in \`${getStudyOutputDir(studyId)}/figures/\` when the task conclusion depends on visual evidence, or record why no figure was needed`,
        `- [ ] Add only promotion-worthy outputs to \`${getStudyArtifactCandidatesPath(studyId)}\` and include \`task_id\` when this task clearly produced them`,
        '- [ ] Register reusable artifacts only if this task produced them and immediate registration is warranted',
    ].join('\n');
    const normalizedSkills = normalizeTaskSkillIds(record.skills ?? []);
    const skillLines = normalizedSkills.length > 0 ? normalizedSkills.map((value) => `- ${value}`).join('\n') : '- None specified.';
    return [
        '## Depends On',
        '',
        dependsOn,
        '',
        '## Input',
        '',
        inputLines,
        '',
        '## Expected Output',
        '',
        expectedOutputLines,
        '',
        '## Checklist',
        '',
        checklistLines,
        '',
        '## Skills',
        '',
        skillLines,
    ].join('\n');
}
async function nextStudyId(projectRoot) {
    const studies = await discoverStudies(projectRoot);
    return formatSequentialId('STUDY', getHighestMatchingIndex(studies.map((study) => study.study_id), STUDY_ID_PATTERN) + 1);
}
async function nextTaskId(projectRoot) {
    const tasks = await discoverTasks(projectRoot);
    return formatSequentialId('TASK', getHighestMatchingIndex(tasks.map((task) => task.task_id), TASK_ID_PATTERN) + 1);
}
async function nextArtifactId(projectRoot) {
    const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    return formatSequentialId('ART', getHighestMatchingIndex(artifactIndex.artifacts.map((artifact) => artifact.id), ARTIFACT_ID_PATTERN) + 1);
}
export async function readStudyDocument(projectRoot, studyId) {
    const relativePath = `${PATHS.studiesDir}/${studyId}/study.md`;
    const document = await readMarkdownDocument(projectRoot, relativePath);
    return {
        relativePath,
        record: {
            ...document.frontmatter,
            study_id: document.frontmatter.study_id ?? studyId,
            task_ids: document.frontmatter.task_ids ?? [],
            blockers: document.frontmatter.blockers ?? [],
            expected_artifacts: document.frontmatter.expected_artifacts ?? [],
        },
        body: document.body,
    };
}
// 通过“已知路径 + 预期 ID”读取 task 文档。
// 这里会把缺失的关键 frontmatter 字段用路径信息补齐，
// 保证后续 runtime 在面对半成品文档时仍有稳定视图。
export async function readTaskDocumentByPath(projectRoot, relativePath, studyId, taskId) {
    const document = await readMarkdownDocument(projectRoot, relativePath);
    return {
        relativePath,
        record: {
            ...document.frontmatter,
            task_id: document.frontmatter.task_id ?? taskId,
            study_id: document.frontmatter.study_id ?? studyId,
            expected_outputs: document.frontmatter.expected_outputs ?? [],
            depends_on: document.frontmatter.depends_on ?? [],
            skills: document.frontmatter.skills ?? [],
            artifact_ids: document.frontmatter.artifact_ids ?? [],
        },
        body: document.body,
    };
}
// 反查一个 task 属于哪个 study。
// 这在 register-artifact / instructions / closeStudy 里都很关键，
// 因为 task 本身的 CLI 输入通常只带 TASK-XXX，不带父 studyId。
export async function findTaskDocument(projectRoot, taskId) {
    const studiesDir = path.join(projectRoot, PATHS.studiesDir);
    const studyEntries = await FileSystemUtils.directoryExists(studiesDir)
        ? await nodeFs.readdir(studiesDir, { withFileTypes: true })
        : [];
    for (const studyEntry of studyEntries) {
        if (!studyEntry.isDirectory()) {
            continue;
        }
        const relativePath = `${PATHS.studiesDir}/${studyEntry.name}/tasks/${taskId}.md`;
        const absolutePath = path.join(projectRoot, relativePath);
        if (!(await FileSystemUtils.fileExists(absolutePath))) {
            continue;
        }
        const document = await readTaskDocumentByPath(projectRoot, relativePath, studyEntry.name, taskId);
        return {
            studyId: studyEntry.name,
            ...document,
        };
    }
    throw new Error(`Task '${taskId}' not found.`);
}
// 创建 study 只负责落一个最小但完整的 study scaffold。
// 真正的 task 图由后续 qdd-propose / qdd add-task 补上。
export async function createStudy(projectRoot, options = {}) {
    const studyId = await nextStudyId(projectRoot);
    const studyDir = `${PATHS.studiesDir}/${studyId}`;
    const record = {
        study_id: studyId,
        question: options.question?.trim() || 'Unspecified study question',
        hypothesis: options.hypothesis?.trim() || 'Unspecified hypothesis',
        status: 'created',
        task_ids: [],
        blockers: options.blockers ?? [],
        expected_artifacts: options.expectedArtifacts ?? [],
    };
    await FileSystemUtils.createDirectory(path.join(projectRoot, studyDir, 'tasks'));
    await ensureStudyOutputLayout(projectRoot, studyId);
    await writeMarkdownDocument(projectRoot, `${studyDir}/study.md`, record, buildStudyBody(record));
    return {
        studyId,
        relativePath: `${studyDir}/study.md`,
    };
}
// 创建 task 时会立即校验 skills 是否真实存在于 .codex/skills/ 下。
// 这样 task 记录本身就是“可执行约束”，而不是任意文本。
export async function createTask(projectRoot, studyId, options = {}) {
    const study = await readStudyDocument(projectRoot, studyId);
    const taskId = await nextTaskId(projectRoot);
    const relativePath = `${PATHS.studiesDir}/${studyId}/tasks/${taskId}.md`;
    const normalizedSkills = normalizeTaskSkillIds(options.skills);
    const resolvedSkills = await resolveLocalSkills(projectRoot, normalizedSkills);
    if (resolvedSkills.disallowedWorkflow.length > 0) {
        throw new Error(`Task skills must not include workflow skills: ${resolvedSkills.disallowedWorkflow.join(', ')}. Use concrete domain skills instead.`);
    }
    if (resolvedSkills.planningOnly.length > 0) {
        throw new Error(`Task skills must not include planning-only brain skills: ${resolvedSkills.planningOnly.join(', ')}. Move them to study planning and keep task skills executor-facing.`);
    }
    if (resolvedSkills.missing.length > 0) {
        throw new Error(`Task skills must already exist under ${PATHS.codexSkillsDir}/ before they are referenced: ${resolvedSkills.missing.join(', ')}.`);
    }
    const taskRecord = {
        task_id: taskId,
        study_id: studyId,
        goal: options.goal?.trim() || 'Unspecified task goal',
        status: 'pending',
        expected_outputs: options.expectedOutputs ?? [],
        depends_on: options.dependsOn ?? [],
        skills: normalizedSkills,
        artifact_ids: [],
        updated_at: new Date().toISOString(),
    };
    await writeMarkdownDocument(projectRoot, relativePath, taskRecord, buildTaskBody(taskRecord, studyId, options.inputs ?? []));
    const updatedStudyRecord = {
        ...study.record,
        task_ids: [...(study.record.task_ids ?? []), taskId],
    };
    const updatedTaskIds = updatedStudyRecord.task_ids ?? [];
    const updatedTasksSection = updatedTaskIds.map((linkedTaskId) => {
        if (linkedTaskId === taskId) {
            return `- [ ] ${taskId}: ${taskRecord.goal}`;
        }
        return `- [ ] ${linkedTaskId}`;
    }).join('\n');
    const updatedStudyBody = replaceMarkdownSection(study.body, 'Tasks', updatedTasksSection);
    await writeMarkdownDocument(projectRoot, study.relativePath, updatedStudyRecord, updatedStudyBody);
    return {
        studyId,
        taskId,
        relativePath,
    };
}
function inferArtifactFormat(relativePath) {
    const extension = path.extname(relativePath);
    return extension || 'unknown';
}
async function resolveRegisteredArtifactBySourcePath(projectRoot, artifactIndex, sourceRelativePath) {
    const absoluteSource = path.join(projectRoot, sourceRelativePath);
    let realSourcePath = null;
    try {
        realSourcePath = await nodeFs.realpath(absoluteSource);
    }
    catch {
        realSourcePath = null;
    }
    for (const entry of artifactIndex.artifacts) {
        if (entry.path === sourceRelativePath) {
            return entry;
        }
        if (!realSourcePath) {
            continue;
        }
        const absoluteRegisteredPath = path.join(projectRoot, entry.path);
        try {
            const realRegisteredPath = await nodeFs.realpath(absoluteRegisteredPath);
            if (realRegisteredPath === realSourcePath) {
                return entry;
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
async function ensureTaskArtifactReference(projectRoot, taskId, artifactId) {
    const taskDocument = await findTaskDocument(projectRoot, taskId);
    if ((taskDocument.record.artifact_ids ?? []).includes(artifactId)) {
        return;
    }
    const updatedTaskRecord = {
        ...taskDocument.record,
        artifact_ids: [...(taskDocument.record.artifact_ids ?? []), artifactId],
        updated_at: new Date().toISOString(),
    };
    await writeMarkdownDocument(projectRoot, taskDocument.relativePath, updatedTaskRecord, taskDocument.body);
}
// 把某个文件登记进 artifacts/index.yaml。
// 注意 produced_by 是 provenance，scope 是复用边界，两者分开记录。
export async function registerArtifact(projectRoot, targetPath, options) {
    if (!options.studyId && !options.taskId) {
        throw new Error('Registering an artifact requires --study <id> or --task <id>.');
    }
    let studyId = options.studyId;
    if (options.taskId) {
        const taskDocument = await findTaskDocument(projectRoot, options.taskId);
        if (studyId && studyId !== taskDocument.studyId) {
            throw new Error(`Task '${options.taskId}' belongs to '${taskDocument.studyId}', not '${studyId}'.`);
        }
        studyId = taskDocument.studyId;
    }
    if (studyId) {
        await readStudyDocument(projectRoot, studyId);
    }
    const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    const sourceRelativePath = await resolveProjectRelativeFilePath(projectRoot, targetPath);
    const existingEntry = await resolveRegisteredArtifactBySourcePath(projectRoot, artifactIndex, sourceRelativePath);
    if (existingEntry) {
        if (options.taskId) {
            await ensureTaskArtifactReference(projectRoot, options.taskId, existingEntry.id);
        }
        return {
            artifactId: existingEntry.id,
            entry: existingEntry,
        };
    }
    const artifactId = await nextArtifactId(projectRoot);
    const canonicalRelativePath = buildCanonicalArtifactPath(artifactId, options.artifactType, sourceRelativePath);
    const relativePath = await relocateArtifactToCanonicalPath(projectRoot, sourceRelativePath, canonicalRelativePath);
    const producedBy = options.taskId ? `${studyId}/${options.taskId}` : `${studyId}`;
    const entry = {
        id: artifactId,
        type: options.artifactType,
        format: inferArtifactFormat(relativePath),
        path: relativePath,
        produced_by: producedBy,
        reusable: options.reusable,
        scope: options.scope ?? (options.taskId ? 'task' : studyId ? 'study' : 'project'),
        description: options.description,
        schema: options.schema ?? 'unspecified',
    };
    await writeYamlFile(projectRoot, PATHS.artifactIndex, {
        artifacts: [...artifactIndex.artifacts, entry],
    });
    if (options.taskId) {
        await ensureTaskArtifactReference(projectRoot, options.taskId, artifactId);
    }
    return {
        artifactId,
        entry,
    };
}
function findCurrentQuestion(study, evolution) {
    return study.question || evolution.evolution_trail[evolution.evolution_trail.length - 1]?.question_delta.question_after || study.question;
}
// 根据 task 状态推断一个 study 目前的生命周期位置。
// 这里是 runtime 的统一判定口，status / instructions / close 都复用它。
function inferStudyState(study, tasks) {
    if (study.status === 'closed') {
        return 'closed';
    }
    if (tasks.length === 0) {
        return study.status ?? 'created';
    }
    if (tasks.some((task) => (task.status ?? 'pending') === 'pending' || task.status === 'running')) {
        return study.status === 'blocked' ? 'blocked' : 'running';
    }
    if (tasks.some((task) => task.status === 'blocked')) {
        return 'blocked';
    }
    if (tasks.every((task) => task.status === 'completed')) {
        return 'completed';
    }
    return study.status ?? 'created';
}
// closeStudy 做三件事：
// 1. 检查 study 是否真的已经走到可关闭状态；
// 2. 先把 artifact-candidates 里可提升的输出正式登记；
// 3. 最后再写入 question_delta，并把 study 标记为 closed。
//
// 顺序不能反，否则一旦 promotion 失败，evolution.yaml 就会留下“已经关闭”
// 但 artifact registry 还没同步的坏状态。
export async function closeStudy(projectRoot, studyId, options) {
    const studyDocument = await readStudyDocument(projectRoot, studyId);
    const evolution = await readYamlFile(projectRoot, PATHS.evolution);
    const allTasks = await discoverTasks(projectRoot);
    const studyTasks = allTasks.filter((task) => task.study_id === studyId || (studyDocument.record.task_ids ?? []).includes(task.task_id));
    if (studyTasks.some((task) => (task.status ?? 'pending') === 'pending' || task.status === 'running')) {
        throw new Error(`Study '${studyId}' still has pending or running tasks. Resolve task records before closing the study.`);
    }
    const inferredStatus = inferStudyState(studyDocument.record, studyTasks);
    if (inferredStatus !== 'completed' && inferredStatus !== 'blocked' && studyTasks.length > 0) {
        throw new Error(`Study '${studyId}' could not be cleanly classified before closure. Review task statuses.`);
    }
    const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    const registeredPaths = new Set(artifactIndex.artifacts.map((artifact) => artifact.path));
    const candidates = await readNormalizedArtifactCandidatesForPromotion(projectRoot, studyId);
    for (const candidate of candidates) {
        if (!candidate.reusable || registeredPaths.has(candidate.path)) {
            continue;
        }
        const targetTask = candidate.task_id ? studyTasks.find((task) => task.task_id === candidate.task_id) : undefined;
        if (candidate.task_id && !targetTask) {
            throw new Error(`Promotion candidate '${candidate.path}' references task '${candidate.task_id}' which does not belong to study '${studyId}'.`);
        }
        const result = await registerArtifact(projectRoot, candidate.path, {
            artifactType: candidate.type,
            description: candidate.description,
            reusable: candidate.reusable,
            studyId,
            taskId: targetTask?.task_id,
            scope: candidate.scope,
            schema: candidate.schema,
        });
        registeredPaths.add(result.entry.path);
    }
    const currentQuestion = findCurrentQuestion(studyDocument.record, evolution);
    const nextEvolution = {
        evolution_trail: [
            ...evolution.evolution_trail,
            {
                study_id: studyId,
                question_delta: {
                    question_before: currentQuestion,
                    question_after: options.questionAfter,
                    change_type: options.changeType,
                    change_driver: options.changeDriver,
                    open_boundaries: options.openBoundaries,
                },
                timestamp: new Date().toISOString(),
            },
        ],
    };
    await writeYamlFile(projectRoot, PATHS.evolution, nextEvolution);
    const updatedStudyRecord = {
        ...studyDocument.record,
        status: 'closed',
        closed_at: new Date().toISOString(),
    };
    const finalStudyBody = replaceMarkdownSection(replaceMarkdownSection(studyDocument.body, 'Question', studyDocument.record.question), 'Blockers', updatedStudyRecord.blockers && updatedStudyRecord.blockers.length > 0 ? updatedStudyRecord.blockers.map((value) => `- ${value}`).join('\n') : '- None yet.');
    await writeMarkdownDocument(projectRoot, studyDocument.relativePath, updatedStudyRecord, finalStudyBody);
}
export function deriveStudyLifecycleState(study, tasks) {
    return (inferStudyState(study, tasks) ?? 'created');
}
//# sourceMappingURL=lifecycle.js.map