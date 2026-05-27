import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { createDefaultArtifactCandidateManifest } from './defaults.js';
import { readYamlFile, writeYamlFile } from './store.js';
const STUDY_OUTPUT_SUBDIRS = ['code', 'figures', 'tables', 'reports'];
function isArtifactType(value) {
    return ['data', 'code', 'figure', 'report'].includes(value);
}
function isArtifactScope(value) {
    return ['project', 'study', 'task'].includes(value);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
export async function ensureStudyOutputLayout(projectRoot, studyId) {
    const studyOutputDir = path.join(projectRoot, getStudyOutputDir(studyId));
    await FileSystemUtils.createDirectory(studyOutputDir);
    await Promise.all(getStudyOutputSubdirPaths(studyId).map((relativePath) => FileSystemUtils.createDirectory(path.join(projectRoot, relativePath))));
    const candidatePath = path.join(projectRoot, getStudyArtifactCandidatesPath(studyId));
    if (!(await FileSystemUtils.fileExists(candidatePath))) {
        await writeYamlFile(projectRoot, getStudyArtifactCandidatesPath(studyId), createDefaultArtifactCandidateManifest());
    }
}
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
export async function readArtifactCandidateManifest(projectRoot, studyId) {
    const relativePath = getStudyArtifactCandidatesPath(studyId);
    if (!(await FileSystemUtils.fileExists(path.join(projectRoot, relativePath)))) {
        return createDefaultArtifactCandidateManifest();
    }
    return readYamlFile(projectRoot, relativePath);
}
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
        const reusable = typeof candidate.reusable === 'boolean' ? candidate.reusable : true;
        const rawScope = typeof candidate.scope === 'string' ? candidate.scope.trim() : '';
        const scope = isArtifactScope(rawScope) ? rawScope : taskId ? 'task' : 'study';
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