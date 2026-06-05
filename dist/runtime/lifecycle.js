import path from 'node:path';
import * as nodeFs from 'node:fs/promises';
import { buildStudyMemoryMarkdown } from '../file-contracts/memory.js';
import { extractBulletSection } from '../file-contracts/shared.js';
import { renderStudyBody } from '../file-contracts/study.js';
import { renderTaskBody } from '../file-contracts/task.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { discoverStudies, discoverTasks } from './discovery.js';
import { buildCanonicalArtifactPath, ensureStudyOutputLayout, getStudyArtifactCandidatesPath, getStudyOutputDir, inspectArtifactCandidatePaths, isScratchStudyOutputPath, isPromotableStudyOutputPath, listNonCanonicalStudyOutputEntries, relocateArtifactToCanonicalPath, readArtifactCandidateManifest, readNormalizedArtifactCandidatesForPromotion, resolveProjectRelativeFilePath, } from './evidence.js';
import { readMarkdownDocument, readYamlFile, writeMarkdownDocument, writeYamlFile, } from './store.js';
import { normalizeTaskSkillIds, resolveLocalSkills } from './local-skills.js';
import { applyOpenBoundaryTexts, readEvolutionState, renderResearchMapHtml, writeEvolutionState, } from './evolution.js';
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
function uniqueSortedValues(values) {
    return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) => left.localeCompare(right));
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
            target_boundaries: document.frontmatter.target_boundaries ?? [],
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
        target_boundaries: options.targetBoundaries ?? [],
        status: 'created',
        task_ids: [],
        blockers: options.blockers ?? [],
        expected_artifacts: options.expectedArtifacts ?? [],
    };
    await FileSystemUtils.createDirectory(path.join(projectRoot, studyDir, 'tasks'));
    await ensureStudyOutputLayout(projectRoot, studyId);
    await writeMarkdownDocument(projectRoot, `${studyDir}/study.md`, record, renderStudyBody(record));
    return {
        studyId,
        relativePath: `${studyDir}/study.md`,
    };
}
// 创建 task 时会立即校验 skills 是否真实存在于 central domain-skills/ 下。
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
        throw new Error(`Task skills must already exist under the QDD root domain-skills/ library before they are referenced: ${resolvedSkills.missing.join(', ')}.`);
    }
    const taskRecord = {
        task_id: taskId,
        study_id: studyId,
        goal: options.goal?.trim() || 'Unspecified task goal',
        status: 'pending',
        expected_outputs: options.expectedOutputs ?? [],
        depends_on: options.dependsOn ?? [],
        skills: normalizedSkills,
        promotion_status: 'pending',
        artifact_ids: [],
        updated_at: new Date().toISOString(),
    };
    await writeMarkdownDocument(projectRoot, relativePath, taskRecord, renderTaskBody(taskRecord, studyId, options.inputs ?? []));
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
function normalizeTaskPromotionStatus(status) {
    return status ?? 'pending';
}
async function listFilesRecursively(projectRoot, relativeDir) {
    const absoluteDir = path.join(projectRoot, relativeDir);
    if (!(await FileSystemUtils.directoryExists(absoluteDir))) {
        return [];
    }
    const entries = await nodeFs.readdir(absoluteDir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        const relativePath = `${relativeDir}/${entry.name}`;
        if (entry.isDirectory()) {
            results.push(...(await listFilesRecursively(projectRoot, relativePath)));
            continue;
        }
        if (entry.isFile() || entry.isSymbolicLink()) {
            results.push(relativePath);
        }
    }
    return results.sort((left, right) => left.localeCompare(right));
}
function collectTaskInputReferences(taskDocuments) {
    const ignoredDefaults = new Set([
        'contract.yaml',
        'context/resources.md',
        'context/*.yaml (optional structured sidecars)',
    ]);
    return uniqueSortedValues(taskDocuments
        .flatMap((task) => extractBulletSection(task.body, 'Input') ?? [])
        .map((value) => value.replaceAll('`', '').trim())
        .filter((value) => value !== 'None.')
        .filter((value) => !ignoredDefaults.has(value))
        .filter((value) => !/^studies\/STUDY-\d{3}\/study\.md$/.test(value)));
}
function collectUsedSkills(taskDocuments) {
    return uniqueSortedValues(taskDocuments.flatMap((task) => normalizeTaskSkillIds(task.record.skills ?? [])));
}
function formatPromotedArtifactMemoryLine(entry) {
    return `${entry.id} (\`${entry.type}\`) - ${entry.path}: ${entry.description}`;
}
function collectPromotedArtifactsForStudy(artifactIndex, studyId) {
    return artifactIndex.artifacts
        .filter((entry) => entry.produced_by === studyId || entry.produced_by.startsWith(`${studyId}/`))
        .map(formatPromotedArtifactMemoryLine)
        .sort((left, right) => left.localeCompare(right));
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
async function ensureTaskArtifactReference(projectRoot, taskId, artifactId, promotionStatus = null) {
    const taskDocument = await findTaskDocument(projectRoot, taskId);
    const existingArtifactIds = taskDocument.record.artifact_ids ?? [];
    const nextPromotionStatus = promotionStatus ?? taskDocument.record.promotion_status;
    if (existingArtifactIds.includes(artifactId) && nextPromotionStatus === taskDocument.record.promotion_status) {
        return;
    }
    const updatedTaskRecord = {
        ...taskDocument.record,
        artifact_ids: existingArtifactIds.includes(artifactId) ? existingArtifactIds : [...existingArtifactIds, artifactId],
        promotion_status: nextPromotionStatus,
        updated_at: new Date().toISOString(),
    };
    await writeMarkdownDocument(projectRoot, taskDocument.relativePath, updatedTaskRecord, taskDocument.body);
}
export async function recordArtifactCandidate(projectRoot, targetPath, options) {
    const sourceRelativePath = await resolveProjectRelativeFilePath(projectRoot, targetPath);
    if (!isPromotableStudyOutputPath(options.studyId, sourceRelativePath)) {
        throw new Error(`Artifact candidates must point to final study outputs under ${getStudyOutputDir(options.studyId)}/{data,code,figures,tables,reports}/, got '${sourceRelativePath}'.`);
    }
    const manifestPath = getStudyArtifactCandidatesPath(options.studyId);
    const manifest = await readArtifactCandidateManifest(projectRoot, options.studyId);
    const nextEntry = {
        path: sourceRelativePath,
        type: options.artifactType,
        task_id: options.taskId,
        reusable: options.reusable ?? true,
        scope: options.scope ?? (options.taskId ? 'task' : 'study'),
        description: options.description,
        schema: options.schema ?? 'unspecified',
    };
    const nextManifest = {
        artifact_candidates: [
            ...(manifest.artifact_candidates ?? []).filter((entry) => String(entry.path ?? '').trim() !== sourceRelativePath),
            nextEntry,
        ],
    };
    await writeYamlFile(projectRoot, manifestPath, nextManifest);
    if (options.taskId && options.promotionStatus) {
        const taskDocument = await findTaskDocument(projectRoot, options.taskId);
        const updatedTaskRecord = {
            ...taskDocument.record,
            promotion_status: options.promotionStatus,
            updated_at: new Date().toISOString(),
        };
        await writeMarkdownDocument(projectRoot, taskDocument.relativePath, updatedTaskRecord, taskDocument.body);
    }
    return sourceRelativePath;
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
    if (studyId && isScratchStudyOutputPath(studyId, sourceRelativePath)) {
        throw new Error(`Registering artifacts directly from scratch space is not allowed. Package the final output under studies/${studyId}/output/{data,code,figures,tables,reports}/ first.`);
    }
    const shouldUpdateTaskPromotionStatus = options.updateTaskPromotionStatus ?? true;
    const existingEntry = await resolveRegisteredArtifactBySourcePath(projectRoot, artifactIndex, sourceRelativePath);
    if (existingEntry) {
        if (options.taskId) {
            await ensureTaskArtifactReference(projectRoot, options.taskId, existingEntry.id, shouldUpdateTaskPromotionStatus ? 'registered' : null);
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
        await ensureTaskArtifactReference(projectRoot, options.taskId, artifactId, shouldUpdateTaskPromotionStatus ? 'registered' : null);
    }
    return {
        artifactId,
        entry,
    };
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
async function collectStudyTasksForClosure(projectRoot, studyId, study) {
    const allTasks = await discoverTasks(projectRoot);
    return allTasks.filter((task) => task.study_id === studyId || (study.task_ids ?? []).includes(task.task_id));
}
async function cleanupStudyScratchOutputs(projectRoot, studyId) {
    const scratchDir = path.join(projectRoot, getStudyOutputDir(studyId), 'tmp');
    if (!(await FileSystemUtils.directoryExists(scratchDir))) {
        return;
    }
    const HEAVY_FILE_EXTENSIONS = new Set(['.h5ad', '.h5', '.h5mu', '.loom', '.rds']);
    const HEAVY_DIR_EXTENSIONS = new Set(['.zarr']);
    async function cleanupEntry(absolutePath) {
        const stats = await nodeFs.lstat(absolutePath);
        const baseName = path.basename(absolutePath).toLowerCase();
        if (stats.isDirectory()) {
            if (HEAVY_DIR_EXTENSIONS.has(path.extname(baseName))) {
                await nodeFs.rm(absolutePath, { recursive: true, force: true });
                return true;
            }
            const childEntries = await nodeFs.readdir(absolutePath);
            for (const childEntry of childEntries) {
                await cleanupEntry(path.join(absolutePath, childEntry));
            }
            const remaining = await nodeFs.readdir(absolutePath);
            if (remaining.length === 0) {
                await nodeFs.rmdir(absolutePath);
                return true;
            }
            return false;
        }
        if (stats.isFile() && HEAVY_FILE_EXTENSIONS.has(path.extname(baseName))) {
            await nodeFs.rm(absolutePath, { force: true });
            return true;
        }
        return false;
    }
    const entries = await nodeFs.readdir(scratchDir);
    for (const entry of entries) {
        await cleanupEntry(path.join(scratchDir, entry));
    }
}
export async function inspectStudyClosePreflight(projectRoot, studyId) {
    const studyDocument = await readStudyDocument(projectRoot, studyId);
    const studyTasks = await collectStudyTasksForClosure(projectRoot, studyId, studyDocument.record);
    const pendingOrRunningTasks = studyTasks
        .filter((task) => (task.status ?? 'pending') === 'pending' || task.status === 'running')
        .map((task) => task.task_id);
    const promotionPendingTasks = studyTasks
        .filter((task) => task.status === 'completed' && normalizeTaskPromotionStatus(task.promotion_status) === 'pending')
        .map((task) => task.task_id);
    const unpackagedEntries = await listNonCanonicalStudyOutputEntries(projectRoot, studyId);
    const candidatePathIssues = await inspectArtifactCandidatePaths(projectRoot, studyId);
    const inferredState = deriveStudyLifecycleState(studyDocument.record, studyTasks);
    const reasons = [];
    if (studyTasks.length === 0) {
        reasons.push('study has no tasks attached.');
    }
    if (pendingOrRunningTasks.length > 0) {
        reasons.push(`pending or running tasks: ${pendingOrRunningTasks.join(', ')}`);
    }
    if (promotionPendingTasks.length > 0) {
        reasons.push(`completed tasks with pending promotion review: ${promotionPendingTasks.join(', ')}`);
    }
    if (unpackagedEntries.length > 0) {
        reasons.push(`unpackaged non-canonical outputs: ${unpackagedEntries.join(', ')}`);
    }
    if (candidatePathIssues.length > 0) {
        reasons.push(`invalid artifact candidate paths: ${candidatePathIssues
            .map((issue) => `${issue.path || `#${issue.index}`}: ${issue.reason}`)
            .join('; ')}`);
    }
    if (inferredState !== 'completed' && inferredState !== 'blocked' && studyTasks.length > 0) {
        reasons.push(`study state is '${inferredState}', not closable yet.`);
    }
    return {
        study_id: studyId,
        inferred_state: inferredState,
        ready: reasons.length === 0,
        reasons,
        pending_or_running_tasks: pendingOrRunningTasks,
        promotion_pending_tasks: promotionPendingTasks,
        unpackaged_entries: unpackagedEntries,
        invalid_candidate_paths: candidatePathIssues.map((issue) => `${issue.path || `#${issue.index}`}: ${issue.reason}`),
    };
}
// closeStudy 做三件事：
// 1. 检查 study 是否真的已经走到可关闭状态；
// 2. 先把 artifact-candidates 里可提升的输出正式登记；
// 3. 最后再写入简化后的 evolution study event、memory，并把 study 标记为 closed。
//
// 顺序不能反，否则一旦 promotion 失败，evolution.yaml 就会留下“已经关闭”
// 但 artifact registry 还没同步的坏状态。
export async function closeStudy(projectRoot, studyId, options) {
    const studyDocument = await readStudyDocument(projectRoot, studyId);
    const evolution = await readEvolutionState(projectRoot);
    const studyTasks = await collectStudyTasksForClosure(projectRoot, studyId, studyDocument.record);
    const taskDocuments = await Promise.all(studyTasks.map(async (task) => readTaskDocumentByPath(projectRoot, `${PATHS.studiesDir}/${studyId}/tasks/${task.task_id}.md`, studyId, task.task_id)));
    const preflight = await inspectStudyClosePreflight(projectRoot, studyId);
    if (!preflight.ready) {
        throw new Error(`Study '${studyId}' failed close preflight:\n- ${preflight.reasons.join('\n- ')}`);
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
            updateTaskPromotionStatus: true,
        });
        registeredPaths.add(result.entry.path);
    }
    await cleanupStudyScratchOutputs(projectRoot, studyId);
    const studyQuestion = studyDocument.record.question;
    const nextCandidates = uniqueSortedValues((options.nextCandidates ?? []).slice(0, 3));
    const nextEvolution = applyOpenBoundaryTexts(evolution, studyId, studyQuestion, options.changeType, options.openBoundaries, nextCandidates);
    await writeEvolutionState(projectRoot, nextEvolution);
    const lastEvent = nextEvolution.studies.at(-1);
    const boundaryTextById = new Map(nextEvolution.boundaries.map((boundary) => [boundary.id, boundary.text]));
    const resolvedBoundaryTexts = (lastEvent?.resolves ?? []).map((boundaryId) => boundaryTextById.get(boundaryId) ?? boundaryId);
    const refreshedArtifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    const promotedArtifacts = collectPromotedArtifactsForStudy(refreshedArtifactIndex, studyId);
    const reusedMaterials = collectTaskInputReferences(taskDocuments);
    const usedSkills = collectUsedSkills(taskDocuments);
    const adHocScripts = await listFilesRecursively(projectRoot, `${getStudyOutputDir(studyId)}/code`);
    const memoryMarkdown = buildStudyMemoryMarkdown({
        studyId,
        question: studyQuestion,
        kind: options.changeType,
        summary: options.summary.trim(),
        promotedArtifacts,
        reusedMaterials,
        usedSkills,
        adHocScripts,
        openBoundaryTexts: options.openBoundaries,
        nextCandidates,
        resolvedBoundaryTexts,
    });
    await FileSystemUtils.writeFile(path.join(projectRoot, PATHS.contextMemoryDir, `${studyId}.md`), memoryMarkdown);
    await renderResearchMapHtml(projectRoot, PATHS.researchMapHtml);
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