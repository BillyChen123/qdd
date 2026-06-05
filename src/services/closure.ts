import path from 'node:path';
import * as nodeFs from 'node:fs/promises';
import type {
  ArtifactIndex,
  ArtifactIndexEntry,
  CloseStudyOptions,
  EvolutionState,
  StudyClosePreflightResult,
  StudyRecord,
  TaskPromotionStatus,
  TaskRecord,
} from '../types.js';
import { buildStudyMemoryMarkdown } from '../file-contracts/memory.js';
import { extractBulletSection, replaceMarkdownSection } from '../file-contracts/shared.js';
import { PATHS } from '../runtime/constants.js';
import { discoverTasks } from '../runtime/discovery.js';
import {
  getStudyOutputDir,
  inspectArtifactCandidatePaths,
  listNonCanonicalStudyOutputEntries,
  readNormalizedArtifactCandidatesForPromotion,
} from '../runtime/evidence.js';
import { applyOpenBoundaryTexts, readEvolutionState, writeEvolutionState } from '../runtime/evolution.js';
import { readYamlFile, writeMarkdownDocument } from '../runtime/store.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { renderResearchMapHtml } from '../runtime/evolution.js';
import { registerArtifact } from './artifacts.js';
import { readStudyDocument } from './studies.js';
import { readTaskDocumentByPath } from './tasks.js';

function uniqueSortedValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeTaskPromotionStatus(status: TaskPromotionStatus | undefined): TaskPromotionStatus {
  return status ?? 'pending';
}

async function listFilesRecursively(projectRoot: string, relativeDir: string): Promise<string[]> {
  const absoluteDir = path.join(projectRoot, relativeDir);
  if (!(await FileSystemUtils.directoryExists(absoluteDir))) {
    return [];
  }

  const entries = await nodeFs.readdir(absoluteDir, { withFileTypes: true });
  const results: string[] = [];

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

function collectTaskInputReferences(taskDocuments: Array<{ record: TaskRecord; body: string }>): string[] {
  const ignoredDefaults = new Set([
    'contract.yaml',
    'context/resources.md',
    'context/*.yaml (optional structured sidecars)',
  ]);

  return uniqueSortedValues(
    taskDocuments
      .flatMap((task) => extractBulletSection(task.body, 'Input') ?? [])
      .map((value) => value.replaceAll('`', '').trim())
      .filter((value) => value !== 'None.')
      .filter((value) => !ignoredDefaults.has(value))
      .filter((value) => !/^studies\/STUDY-\d{3}\/study\.md$/.test(value))
  );
}

function collectUsedSkills(taskDocuments: Array<{ record: TaskRecord }>): string[] {
  return uniqueSortedValues(taskDocuments.flatMap((task) => task.record.skills ?? []));
}

function formatPromotedArtifactMemoryLine(entry: ArtifactIndexEntry): string {
  return `${entry.id} (\`${entry.type}\`) - ${entry.path}: ${entry.description}`;
}

function collectPromotedArtifactsForStudy(artifactIndex: ArtifactIndex, studyId: string): string[] {
  return artifactIndex.artifacts
    .filter((entry) => entry.produced_by === studyId || entry.produced_by.startsWith(`${studyId}/`))
    .map(formatPromotedArtifactMemoryLine)
    .sort((left, right) => left.localeCompare(right));
}

async function collectStudyTasksForClosure(projectRoot: string, studyId: string, study: StudyRecord): Promise<TaskRecord[]> {
  const allTasks = await discoverTasks(projectRoot);
  return allTasks.filter((task) => task.study_id === studyId || (study.task_ids ?? []).includes(task.task_id));
}

async function cleanupStudyScratchOutputs(projectRoot: string, studyId: string): Promise<void> {
  const scratchDir = path.join(projectRoot, getStudyOutputDir(studyId), 'tmp');
  if (!(await FileSystemUtils.directoryExists(scratchDir))) {
    return;
  }

  const HEAVY_FILE_EXTENSIONS = new Set(['.h5ad', '.h5', '.h5mu', '.loom', '.rds']);
  const HEAVY_DIR_EXTENSIONS = new Set(['.zarr']);

  async function cleanupEntry(absolutePath: string): Promise<boolean> {
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

function inferStudyState(study: StudyRecord, tasks: TaskRecord[]): StudyRecord['status'] {
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

export function deriveStudyLifecycleState(study: StudyRecord, tasks: TaskRecord[]): Exclude<StudyRecord['status'], 'confirmed' | undefined> {
  return (inferStudyState(study, tasks) ?? 'created') as Exclude<StudyRecord['status'], 'confirmed' | undefined>;
}

export async function inspectStudyClosePreflight(projectRoot: string, studyId: string): Promise<StudyClosePreflightResult> {
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
  const reasons: string[] = [];

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
    reasons.push(
      `invalid artifact candidate paths: ${candidatePathIssues
        .map((issue) => `${issue.path || `#${issue.index}`}: ${issue.reason}`)
        .join('; ')}`
    );
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
export async function closeStudy(projectRoot: string, studyId: string, options: CloseStudyOptions): Promise<void> {
  const studyDocument = await readStudyDocument(projectRoot, studyId);
  const evolution = await readEvolutionState(projectRoot);
  const studyTasks = await collectStudyTasksForClosure(projectRoot, studyId, studyDocument.record);
  const taskDocuments = await Promise.all(
    studyTasks.map(async (task) => readTaskDocumentByPath(projectRoot, `${PATHS.studiesDir}/${studyId}/tasks/${task.task_id}.md`, studyId, task.task_id))
  );

  const preflight = await inspectStudyClosePreflight(projectRoot, studyId);
  if (!preflight.ready) {
    throw new Error(`Study '${studyId}' failed close preflight:\n- ${preflight.reasons.join('\n- ')}`);
  }

  const artifactIndex = await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex);
  const registeredPaths = new Set(artifactIndex.artifacts.map((artifact) => artifact.path));
  const candidates = await readNormalizedArtifactCandidatesForPromotion(projectRoot, studyId);

  for (const candidate of candidates) {
    if (!candidate.reusable || registeredPaths.has(candidate.path)) {
      continue;
    }

    const targetTask = candidate.task_id ? studyTasks.find((task) => task.task_id === candidate.task_id) : undefined;
    if (candidate.task_id && !targetTask) {
      throw new Error(
        `Promotion candidate '${candidate.path}' references task '${candidate.task_id}' which does not belong to study '${studyId}'.`
      );
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
  const nextEvolution: EvolutionState = applyOpenBoundaryTexts(
    evolution,
    studyId,
    studyQuestion,
    options.changeType,
    options.openBoundaries,
    nextCandidates
  );
  await writeEvolutionState(projectRoot, nextEvolution);

  const lastEvent = nextEvolution.studies.at(-1);
  const boundaryTextById = new Map(nextEvolution.boundaries.map((boundary) => [boundary.id, boundary.text]));
  const resolvedBoundaryTexts = (lastEvent?.resolves ?? []).map((boundaryId) => boundaryTextById.get(boundaryId) ?? boundaryId);
  const refreshedArtifactIndex = await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex);
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

  const updatedStudyRecord: StudyRecord = {
    ...studyDocument.record,
    status: 'closed',
    closed_at: new Date().toISOString(),
  };
  const finalStudyBody = replaceMarkdownSection(
    replaceMarkdownSection(studyDocument.body, 'Question', studyDocument.record.question),
    'Blockers',
    updatedStudyRecord.blockers && updatedStudyRecord.blockers.length > 0 ? updatedStudyRecord.blockers.map((value) => `- ${value}`).join('\n') : '- None yet.'
  );

  await writeMarkdownDocument(projectRoot, studyDocument.relativePath, updatedStudyRecord, finalStudyBody);
}
