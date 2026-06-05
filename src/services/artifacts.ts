import path from 'node:path';
import * as nodeFs from 'node:fs/promises';
import type {
  ArtifactCandidateManifest,
  ArtifactIndex,
  ArtifactIndexEntry,
  RecordArtifactCandidateOptions,
  RegisterArtifactOptions,
  RegisteredArtifactResult,
  TaskPromotionStatus,
  TaskRecord,
} from '../types.js';
import { PATHS } from '../runtime/constants.js';
import {
  buildCanonicalArtifactPath,
  getStudyArtifactCandidatesPath,
  getStudyOutputDir,
  isPromotableStudyOutputPath,
  isScratchStudyOutputPath,
  readArtifactCandidateManifest,
  relocateArtifactToCanonicalPath,
  resolveProjectRelativeFilePath,
} from '../runtime/evidence.js';
import { readYamlFile, writeMarkdownDocument, writeYamlFile } from '../runtime/store.js';
import { findTaskDocument } from './tasks.js';
import { readStudyDocument } from './studies.js';

const ARTIFACT_ID_PATTERN = /^ART-(\d{3})$/;

function formatSequentialId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

function getHighestMatchingIndex(values: string[], pattern: RegExp): number {
  return values.reduce((highest, value) => {
    const match = value.match(pattern);
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number.parseInt(match[1], 10));
  }, 0);
}

async function nextArtifactId(projectRoot: string): Promise<string> {
  const artifactIndex = await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex);
  return formatSequentialId('ART', getHighestMatchingIndex(artifactIndex.artifacts.map((artifact) => artifact.id), ARTIFACT_ID_PATTERN) + 1);
}

function inferArtifactFormat(relativePath: string): string {
  const extension = path.extname(relativePath);
  return extension || 'unknown';
}

async function resolveRegisteredArtifactBySourcePath(
  projectRoot: string,
  artifactIndex: ArtifactIndex,
  sourceRelativePath: string
): Promise<ArtifactIndexEntry | null> {
  const absoluteSource = path.join(projectRoot, sourceRelativePath);
  let realSourcePath: string | null = null;

  try {
    realSourcePath = await nodeFs.realpath(absoluteSource);
  } catch {
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
    } catch {
      continue;
    }
  }

  return null;
}

async function ensureTaskArtifactReference(
  projectRoot: string,
  taskId: string,
  artifactId: string,
  promotionStatus: TaskPromotionStatus | null = null
): Promise<void> {
  const taskDocument = await findTaskDocument(projectRoot, taskId);
  const existingArtifactIds = taskDocument.record.artifact_ids ?? [];
  const nextPromotionStatus = promotionStatus ?? taskDocument.record.promotion_status;

  if (existingArtifactIds.includes(artifactId) && nextPromotionStatus === taskDocument.record.promotion_status) {
    return;
  }

  const updatedTaskRecord: TaskRecord = {
    ...taskDocument.record,
    artifact_ids: existingArtifactIds.includes(artifactId) ? existingArtifactIds : [...existingArtifactIds, artifactId],
    promotion_status: nextPromotionStatus,
    updated_at: new Date().toISOString(),
  };
  await writeMarkdownDocument(projectRoot, taskDocument.relativePath, updatedTaskRecord, taskDocument.body);
}

export async function recordArtifactCandidate(
  projectRoot: string,
  targetPath: string,
  options: RecordArtifactCandidateOptions
): Promise<string> {
  const sourceRelativePath = await resolveProjectRelativeFilePath(projectRoot, targetPath);
  if (!isPromotableStudyOutputPath(options.studyId, sourceRelativePath)) {
    throw new Error(
      `Artifact candidates must point to final study outputs under ${getStudyOutputDir(options.studyId)}/{data,code,figures,tables,reports}/, got '${sourceRelativePath}'.`
    );
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
  const nextManifest: ArtifactCandidateManifest = {
    artifact_candidates: [
      ...(manifest.artifact_candidates ?? []).filter((entry) => String(entry.path ?? '').trim() !== sourceRelativePath),
      nextEntry,
    ],
  };

  await writeYamlFile(projectRoot, manifestPath, nextManifest);

  if (options.taskId && options.promotionStatus) {
    const taskDocument = await findTaskDocument(projectRoot, options.taskId);
    const updatedTaskRecord: TaskRecord = {
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
export async function registerArtifact(
  projectRoot: string,
  targetPath: string,
  options: RegisterArtifactOptions
): Promise<RegisteredArtifactResult> {
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

  const artifactIndex = await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex);
  const sourceRelativePath = await resolveProjectRelativeFilePath(projectRoot, targetPath);
  if (studyId && isScratchStudyOutputPath(studyId, sourceRelativePath)) {
    throw new Error(
      `Registering artifacts directly from scratch space is not allowed. Package the final output under studies/${studyId}/output/{data,code,figures,tables,reports}/ first.`
    );
  }
  const shouldUpdateTaskPromotionStatus = options.updateTaskPromotionStatus ?? true;
  const existingEntry = await resolveRegisteredArtifactBySourcePath(projectRoot, artifactIndex, sourceRelativePath);
  if (existingEntry) {
    if (options.taskId) {
      await ensureTaskArtifactReference(
        projectRoot,
        options.taskId,
        existingEntry.id,
        shouldUpdateTaskPromotionStatus ? 'registered' : null
      );
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
  const entry: ArtifactIndexEntry = {
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
    await ensureTaskArtifactReference(
      projectRoot,
      options.taskId,
      artifactId,
      shouldUpdateTaskPromotionStatus ? 'registered' : null
    );
  }

  return {
    artifactId,
    entry,
  };
}
