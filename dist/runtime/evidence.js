import path from 'node:path';
import * as fs from 'node:fs/promises';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { createDefaultArtifactCandidateManifest } from './defaults.js';
import { readYamlFile, writeYamlFile } from './store.js';
const STUDY_OUTPUT_SUBDIRS = ['data', 'code', 'figures', 'tables', 'reports', 'tmp'];
const TASK_ID_PATTERN = /^TASK-\d{3}$/;
const CANONICAL_TOP_LEVEL_STUDY_OUTPUT_NAMES = new Set([...STUDY_OUTPUT_SUBDIRS, PATHS.artifactCandidatesFileName]);
function isArtifactType(value) {
    return ['data', 'code', 'figure', 'report'].includes(value);
}
function isArtifactScope(value) {
    return ['project', 'study', 'task'].includes(value);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function getArtifactDirectoryForType(type) {
    switch (type) {
        case 'data':
            return PATHS.artifactDataDir;
        case 'code':
            return PATHS.artifactCodeDir;
        case 'figure':
            return PATHS.artifactFiguresDir;
        case 'report':
            return PATHS.artifactReportsDir;
    }
}
function sanitizeArtifactBaseName(fileName) {
    return fileName.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'artifact';
}
export function getStudyOutputDir(studyId) {
    return `${PATHS.studiesDir}/${studyId}/output`;
}
export function getStudyArtifactCandidatesPath(studyId) {
    return `${getStudyOutputDir(studyId)}/${PATHS.artifactCandidatesFileName}`;
}
export function getStudyOutputSubdirPaths(studyId) {
    return STUDY_OUTPUT_SUBDIRS.map((subdir) => `${getStudyOutputDir(studyId)}/${subdir}`);
}
export async function listNonCanonicalStudyOutputEntries(projectRoot, studyId) {
    const studyOutputDir = path.join(projectRoot, getStudyOutputDir(studyId));
    if (!(await FileSystemUtils.directoryExists(studyOutputDir))) {
        return [];
    }
    const entries = await fs.readdir(studyOutputDir, { withFileTypes: true });
    return entries
        .filter((entry) => !CANONICAL_TOP_LEVEL_STUDY_OUTPUT_NAMES.has(entry.name))
        .map((entry) => `${getStudyOutputDir(studyId)}/${entry.name}`)
        .sort();
}
// 为每个 study 建好标准输出目录。
// 这里顺手保证 artifact-candidates.yaml 一定存在，
// 这样 apply / close 可以始终围绕一个显式的 promotion 清单工作。
export async function ensureStudyOutputLayout(projectRoot, studyId) {
    const studyOutputDir = path.join(projectRoot, getStudyOutputDir(studyId));
    await FileSystemUtils.createDirectory(studyOutputDir);
    await Promise.all(getStudyOutputSubdirPaths(studyId).map((relativePath) => FileSystemUtils.createDirectory(path.join(projectRoot, relativePath))));
    const candidatePath = path.join(projectRoot, getStudyArtifactCandidatesPath(studyId));
    if (!(await FileSystemUtils.fileExists(candidatePath))) {
        await writeYamlFile(projectRoot, getStudyArtifactCandidatesPath(studyId), createDefaultArtifactCandidateManifest());
    }
}
// 把用户传入的路径规范成“项目内相对路径”。
// 这样 artifacts/index.yaml 和 artifact-candidates.yaml 里的 path
// 都能稳定地在不同机器、不同根目录下复用和审查。
export async function resolveProjectRelativeFilePath(projectRoot, targetPath) {
    const absolutePath = path.resolve(projectRoot, targetPath);
    if (!(await FileSystemUtils.fileExists(absolutePath))) {
        throw new Error(`Path '${targetPath}' does not exist.`);
    }
    const relativePath = path.relative(projectRoot, absolutePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('Paths must stay within the current QDD project directory.');
    }
    return relativePath.split(path.sep).join('/');
}
export function buildCanonicalArtifactPath(artifactId, artifactType, sourceRelativePath) {
    const sourceBaseName = sanitizeArtifactBaseName(path.posix.basename(sourceRelativePath));
    return `${getArtifactDirectoryForType(artifactType)}/${artifactId}-${sourceBaseName}`;
}
async function moveFileAcrossDevices(sourcePath, targetPath) {
    await fs.copyFile(sourcePath, targetPath);
    await fs.rm(sourcePath, { force: true });
}
// 把一个已存在的项目内文件搬到 artifact 的 canonical 位置。
// 如果原路径不是 canonical 路径，就在原位置留下一个相对 symlink，
// 这样 study output 仍然可读、可追踪。
export async function relocateArtifactToCanonicalPath(projectRoot, sourceRelativePath, targetRelativePath) {
    const normalizedSource = sourceRelativePath.split(path.sep).join('/');
    const normalizedTarget = targetRelativePath.split(path.sep).join('/');
    if (normalizedSource === normalizedTarget) {
        return normalizedTarget;
    }
    const absoluteSource = path.join(projectRoot, normalizedSource);
    const absoluteTarget = path.join(projectRoot, normalizedTarget);
    if (!(await FileSystemUtils.fileExists(absoluteSource))) {
        throw new Error(`Path '${normalizedSource}' does not exist.`);
    }
    await FileSystemUtils.createDirectory(path.dirname(absoluteTarget));
    try {
        await fs.rename(absoluteSource, absoluteTarget);
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code !== 'EXDEV') {
            throw error;
        }
        await moveFileAcrossDevices(absoluteSource, absoluteTarget);
    }
    const relativeLinkTarget = path.relative(path.dirname(absoluteSource), absoluteTarget);
    await fs.symlink(relativeLinkTarget, absoluteSource);
    return normalizedTarget;
}
// 读取原始 candidate manifest。文件不存在时返回空清单，
// 这样 close 流程可以自然处理“当前 study 还没有待提升 artifact”的情况。
export async function readArtifactCandidateManifest(projectRoot, studyId) {
    const relativePath = getStudyArtifactCandidatesPath(studyId);
    if (!(await FileSystemUtils.fileExists(path.join(projectRoot, relativePath)))) {
        return createDefaultArtifactCandidateManifest();
    }
    return readYamlFile(projectRoot, relativePath);
}
// 把 artifact candidate 规范化成 runtime 真正消费的结构。
//
// 这里有一个重要语义：
// - task_id 表示“哪个 task 产出了它”，也就是 provenance
// - scope 表示“这个东西应该以什么范围被复用”
//
// 两者不是同一件事，所以即使写了 task_id，
// 默认 scope 也仍然保持为 study，除非用户显式写成 task / project。
export async function readNormalizedArtifactCandidatesForPromotion(projectRoot, studyId) {
    const relativePath = getStudyArtifactCandidatesPath(studyId);
    const manifest = await readArtifactCandidateManifest(projectRoot, studyId);
    if (!Array.isArray(manifest.artifact_candidates)) {
        throw new Error(`${relativePath} must define an artifact_candidates array.`);
    }
    const deduplicated = new Map();
    for (const [index, candidate] of manifest.artifact_candidates.entries()) {
        if (!isRecord(candidate)) {
            throw new Error(`${relativePath}#${index} must be an object.`);
        }
        const rawPath = String(candidate.path ?? '').trim();
        if (!rawPath) {
            throw new Error(`${relativePath}#${index} is missing a non-empty path.`);
        }
        const rawType = String(candidate.type ?? '').trim();
        if (!isArtifactType(rawType)) {
            throw new Error(`${relativePath}#${index} has invalid type '${rawType || 'undefined'}'.`);
        }
        const description = String(candidate.description ?? '').trim();
        if (!description) {
            throw new Error(`${relativePath}#${index} is missing a non-empty description.`);
        }
        const normalizedPath = await resolveProjectRelativeFilePath(projectRoot, rawPath);
        const taskId = typeof candidate.task_id === 'string' && candidate.task_id.trim().length > 0 ? candidate.task_id.trim() : undefined;
        if (taskId && !TASK_ID_PATTERN.test(taskId)) {
            throw new Error(`${relativePath}#${index} has invalid task_id '${taskId}'. Expected TASK-XXX.`);
        }
        const reusable = typeof candidate.reusable === 'boolean' ? candidate.reusable : true;
        const rawScope = typeof candidate.scope === 'string' ? candidate.scope.trim() : '';
        const scope = isArtifactScope(rawScope) ? rawScope : 'study';
        const schema = typeof candidate.schema === 'string' && candidate.schema.trim().length > 0 ? candidate.schema.trim() : 'unspecified';
        deduplicated.set(normalizedPath, {
            path: normalizedPath,
            type: rawType,
            task_id: taskId,
            reusable,
            scope,
            description,
            schema,
        });
    }
    return [...deduplicated.values()];
}
//# sourceMappingURL=evidence.js.map