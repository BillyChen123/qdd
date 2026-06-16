import path from 'node:path';
import * as fs from 'node:fs/promises';
import type { ArtifactCandidateEntry, ArtifactCandidateManifest, ArtifactScope, ArtifactType } from '../types.js';
import {
  ARTIFACT_SCOPE_VALUES,
  ARTIFACT_TYPE_VALUES,
} from '../file-contracts/artifact-index.js';
import { createDefaultArtifactCandidateManifest } from '../file-contracts/artifact-candidates.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { readYamlFile, writeYamlFile } from './store.js';

const FINAL_STUDY_OUTPUT_SUBDIRS = ['data', 'code', 'figures', 'tables', 'reports'] as const;
const STUDY_OUTPUT_SUBDIRS = [...FINAL_STUDY_OUTPUT_SUBDIRS, 'tmp'] as const;
const TASK_ID_PATTERN = /^TASK-\d{3}$/;
const CANONICAL_TOP_LEVEL_STUDY_OUTPUT_NAMES: ReadonlySet<string> = new Set([
  ...STUDY_OUTPUT_SUBDIRS,
  PATHS.artifactCandidatesFileName,
  PATHS.publicDataRequestFileName,
]);

function isArtifactType(value: string): value is ArtifactType {
  return ARTIFACT_TYPE_VALUES.includes(value as ArtifactType);
}

function isArtifactScope(value: string): value is ArtifactScope {
  return ARTIFACT_SCOPE_VALUES.includes(value as ArtifactScope);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function describeArtifactCandidateManifestShapeIssue(manifest: unknown): string | null {
  if (!isRecord(manifest)) {
    return 'artifact-candidates.yaml must be a YAML mapping with top-level artifact_candidates array.';
  }

  if (Array.isArray(manifest.artifact_candidates)) {
    return null;
  }

  if (Array.isArray(manifest.candidates)) {
    return 'stale schema: top-level candidates is invalid for artifact-candidates.yaml; use artifact_candidates instead.';
  }

  return 'artifact_candidates must be an array.';
}

function getArtifactDirectoryForType(type: ArtifactType): string {
  switch (type) {
    case 'data':
      return PATHS.artifactDataDir;
    case 'code':
      return PATHS.artifactCodeDir;
    case 'figure':
      return PATHS.artifactFiguresDir;
    case 'table':
      return PATHS.artifactTablesDir;
    case 'report':
      return PATHS.artifactReportsDir;
  }
}

export function isCanonicalStudyOutputPath(studyId: string, relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  const studyOutputPrefix = `${getStudyOutputDir(studyId)}/`;
  if (!normalized.startsWith(studyOutputPrefix)) {
    return false;
  }

  const suffix = normalized.slice(studyOutputPrefix.length);
  return STUDY_OUTPUT_SUBDIRS.some((subdir) => suffix === subdir || suffix.startsWith(`${subdir}/`));
}

export function isScratchStudyOutputPath(studyId: string, relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  const tmpPrefix = `${getStudyOutputDir(studyId)}/tmp/`;
  return normalized === `${getStudyOutputDir(studyId)}/tmp` || normalized.startsWith(tmpPrefix);
}

export function isPromotableStudyOutputPath(studyId: string, relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  const studyOutputPrefix = `${getStudyOutputDir(studyId)}/`;
  if (!normalized.startsWith(studyOutputPrefix)) {
    return false;
  }

  const suffix = normalized.slice(studyOutputPrefix.length);
  return FINAL_STUDY_OUTPUT_SUBDIRS.some((subdir) => suffix === subdir || suffix.startsWith(`${subdir}/`));
}

function sanitizeArtifactBaseName(fileName: string): string {
  return fileName.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'artifact';
}

export function getStudyOutputDir(studyId: string): string {
  return `${PATHS.studiesDir}/${studyId}/output`;
}

export function getStudyArtifactCandidatesPath(studyId: string): string {
  return `${getStudyOutputDir(studyId)}/${PATHS.artifactCandidatesFileName}`;
}

export function getStudyPublicDataRequestPath(studyId: string): string {
  return `${getStudyOutputDir(studyId)}/${PATHS.publicDataRequestFileName}`;
}

export function getStudyOutputSubdirPaths(studyId: string): string[] {
  return STUDY_OUTPUT_SUBDIRS.map((subdir) => `${getStudyOutputDir(studyId)}/${subdir}`);
}

export async function listNonCanonicalStudyOutputEntries(projectRoot: string, studyId: string): Promise<string[]> {
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
export async function ensureStudyOutputLayout(projectRoot: string, studyId: string): Promise<void> {
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
export async function resolveProjectRelativeFilePath(projectRoot: string, targetPath: string): Promise<string> {
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

export function buildCanonicalArtifactPath(artifactId: string, artifactType: ArtifactType, sourceRelativePath: string): string {
  const sourceBaseName = sanitizeArtifactBaseName(path.posix.basename(sourceRelativePath));
  return `${getArtifactDirectoryForType(artifactType)}/${artifactId}-${sourceBaseName}`;
}

async function moveFileAcrossDevices(sourcePath: string, targetPath: string): Promise<void> {
  await fs.copyFile(sourcePath, targetPath);
  await fs.rm(sourcePath, { force: true });
}

// 把一个已存在的项目内文件搬到 artifact 的 canonical 位置。
// 如果原路径不是 canonical 路径，就在原位置留下一个相对 symlink，
// 这样 study output 仍然可读、可追踪。
export async function relocateArtifactToCanonicalPath(
  projectRoot: string,
  sourceRelativePath: string,
  targetRelativePath: string
): Promise<string> {
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
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
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
export async function readArtifactCandidateManifest(projectRoot: string, studyId: string): Promise<ArtifactCandidateManifest> {
  const relativePath = getStudyArtifactCandidatesPath(studyId);
  if (!(await FileSystemUtils.fileExists(path.join(projectRoot, relativePath)))) {
    return createDefaultArtifactCandidateManifest();
  }

  return readYamlFile<ArtifactCandidateManifest>(projectRoot, relativePath);
}

export interface CandidatePathIssue {
  index: number;
  path: string;
  reason: string;
}

export async function inspectArtifactCandidatePaths(projectRoot: string, studyId: string): Promise<CandidatePathIssue[]> {
  const relativePath = getStudyArtifactCandidatesPath(studyId);
  const manifest = await readArtifactCandidateManifest(projectRoot, studyId);
  const shapeIssue = describeArtifactCandidateManifestShapeIssue(manifest);
  if (shapeIssue) {
    return [
      {
        index: -1,
        path: relativePath,
        reason: shapeIssue,
      },
    ];
  }

  const issues: CandidatePathIssue[] = [];
  for (const [index, candidate] of manifest.artifact_candidates.entries()) {
    if (!isRecord(candidate)) {
      issues.push({
        index,
        path: '',
        reason: 'entry must be an object.',
      });
      continue;
    }

    const rawPath = String(candidate.path ?? '').trim();
    if (!rawPath) {
      issues.push({
        index,
        path: '',
        reason: 'path is missing or empty.',
      });
      continue;
    }

    try {
      const normalizedPath = await resolveProjectRelativeFilePath(projectRoot, rawPath);
      if (!isPromotableStudyOutputPath(studyId, normalizedPath)) {
        issues.push({
          index,
          path: normalizedPath,
          reason: `must point under studies/${studyId}/output/{data,code,figures,tables,reports}/.`,
        });
        continue;
      }
    } catch (error) {
      issues.push({
        index,
        path: rawPath,
        reason: (error as Error).message,
      });
    }
  }

  return issues;
}

// 把 artifact candidate 规范化成 runtime 真正消费的结构。
//
// 这里有一个重要语义：
// - task_id 表示“哪个 task 产出了它”，也就是 provenance
// - scope 表示“这个东西应该以什么范围被复用”
//
// 两者不是同一件事，所以即使写了 task_id，
// 默认 scope 也仍然保持为 study，除非用户显式写成 task / project。
export async function readNormalizedArtifactCandidatesForPromotion(projectRoot: string, studyId: string): Promise<ArtifactCandidateEntry[]> {
  const relativePath = getStudyArtifactCandidatesPath(studyId);
  const manifest = await readArtifactCandidateManifest(projectRoot, studyId);

  if (!Array.isArray(manifest.artifact_candidates)) {
    throw new Error(`${relativePath} must define an artifact_candidates array.`);
  }

  const deduplicated = new Map<string, ArtifactCandidateEntry>();

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
    if (!isPromotableStudyOutputPath(studyId, normalizedPath)) {
      throw new Error(
        `${relativePath}#${index} path '${normalizedPath}' must point under studies/${studyId}/output/{data,code,figures,tables,reports}/.`
      );
    }

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
