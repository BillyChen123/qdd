import path from 'node:path';
import * as nodeFs from 'node:fs/promises';
import type {
  ArtifactIndex,
  ArtifactIndexEntry,
  ArtifactScope,
  ArtifactType,
  EvolutionTrail,
  QuestionChangeType,
  StudyRecord,
  TaskRecord,
} from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { discoverStudies, discoverTasks } from './discovery.js';
import {
  ensureStudyOutputLayout,
  getStudyArtifactCandidatesPath,
  getStudyOutputDir,
  readNormalizedArtifactCandidatesForPromotion,
  resolveProjectRelativeFilePath,
} from './evidence.js';
import {
  readMarkdownDocument,
  readYamlFile,
  writeMarkdownDocument,
  writeYamlFile,
} from './store.js';

const STUDY_ID_PATTERN = /^STUDY-(\d{3})$/;
const TASK_ID_PATTERN = /^TASK-(\d{3})$/;
const ARTIFACT_ID_PATTERN = /^ART-(\d{3})$/;

export interface AddStudyOptions {
  question?: string;
  hypothesis?: string;
  blockers?: string[];
  expectedArtifacts?: string[];
}

export interface AddTaskOptions {
  goal?: string;
  dependsOn?: string[];
  inputs?: string[];
  expectedOutputs?: string[];
  skills?: string[];
}

export interface RegisterArtifactOptions {
  artifactType: ArtifactType;
  description: string;
  reusable: boolean;
  studyId?: string;
  taskId?: string;
  scope?: ArtifactScope;
  schema?: string;
}

export interface CloseStudyOptions {
  questionAfter: string;
  changeType: QuestionChangeType;
  changeDriver: string;
  openBoundaries: string[];
}

export interface CreatedStudyResult {
  studyId: string;
  relativePath: string;
}

export interface CreatedTaskResult {
  studyId: string;
  taskId: string;
  relativePath: string;
}

export interface RegisteredArtifactResult {
  artifactId: string;
  entry: ArtifactIndexEntry;
}

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceMarkdownSection(body: string, heading: string, content: string): string {
  const normalizedContent = content.trim();
  const sectionPattern = new RegExp(`(## ${escapeRegExp(heading)}\\n\\n)([\\s\\S]*?)(?=\\n## |$)`);

  if (sectionPattern.test(body)) {
    return body.replace(sectionPattern, `$1${normalizedContent}\n`);
  }

  const suffix = body.trim().length > 0 ? '\n\n' : '';
  return `${body.trim()}${suffix}## ${heading}\n\n${normalizedContent}`.trim();
}

function buildStudyBody(record: StudyRecord): string {
  const blockers = record.blockers && record.blockers.length > 0 ? record.blockers.map((value) => `- ${value}`).join('\n') : '- None yet.';
  const tasks = record.task_ids && record.task_ids.length > 0 ? record.task_ids.map((taskId) => `- [ ] ${taskId}`).join('\n') : '- No starter tasks yet.';
  const expectedArtifacts =
    record.expected_artifacts && record.expected_artifacts.length > 0
      ? record.expected_artifacts.map((value) => `- ${value}`).join('\n')
      : '- None specified yet.';
  const evidencePlan =
    record.expected_artifacts && record.expected_artifacts.length > 0
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

function buildTaskBody(record: TaskRecord, studyId: string, inputs: string[]): string {
  const dependsOn = record.depends_on && record.depends_on.length > 0 ? record.depends_on.map((value) => `- ${value}`).join('\n') : '- None.';
  const inputLines =
    inputs.length > 0
      ? inputs.map((value) => `- ${value}`).join('\n')
      : ['- `contract.yaml`', '- `context/resources.md`', '- `context/*.yaml` (optional structured sidecars)', `- \`studies/${studyId}/study.md\``].join('\n');
  const expectedOutputLines =
    record.expected_outputs && record.expected_outputs.length > 0
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
    `- [ ] Add only promotion-worthy outputs to \`${getStudyArtifactCandidatesPath(studyId)}\``,
    '- [ ] Register reusable artifacts only if this task produced them and immediate registration is warranted',
  ].join('\n');
  const skillLines = record.skills && record.skills.length > 0 ? record.skills.map((value) => `- ${value}`).join('\n') : '- None specified.';

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

async function nextStudyId(projectRoot: string): Promise<string> {
  const studies = await discoverStudies(projectRoot);
  return formatSequentialId('STUDY', getHighestMatchingIndex(studies.map((study) => study.study_id), STUDY_ID_PATTERN) + 1);
}

async function nextTaskId(projectRoot: string): Promise<string> {
  const tasks = await discoverTasks(projectRoot);
  return formatSequentialId('TASK', getHighestMatchingIndex(tasks.map((task) => task.task_id), TASK_ID_PATTERN) + 1);
}

async function nextArtifactId(projectRoot: string): Promise<string> {
  const artifactIndex = await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex);
  return formatSequentialId('ART', getHighestMatchingIndex(artifactIndex.artifacts.map((artifact) => artifact.id), ARTIFACT_ID_PATTERN) + 1);
}

export async function readStudyDocument(projectRoot: string, studyId: string): Promise<{ relativePath: string; record: StudyRecord; body: string }> {
  const relativePath = `${PATHS.studiesDir}/${studyId}/study.md`;
  const document = await readMarkdownDocument<StudyRecord>(projectRoot, relativePath);
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

export async function readTaskDocumentByPath(
  projectRoot: string,
  relativePath: string,
  studyId: string,
  taskId: string
): Promise<{ relativePath: string; record: TaskRecord; body: string }> {
  const document = await readMarkdownDocument<TaskRecord>(projectRoot, relativePath);
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

export async function findTaskDocument(projectRoot: string, taskId: string): Promise<{ studyId: string; relativePath: string; record: TaskRecord; body: string }> {
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

export async function createStudy(projectRoot: string, options: AddStudyOptions = {}): Promise<CreatedStudyResult> {
  const studyId = await nextStudyId(projectRoot);
  const studyDir = `${PATHS.studiesDir}/${studyId}`;

  const record: StudyRecord = {
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

export async function createTask(projectRoot: string, studyId: string, options: AddTaskOptions = {}): Promise<CreatedTaskResult> {
  const study = await readStudyDocument(projectRoot, studyId);
  const taskId = await nextTaskId(projectRoot);
  const relativePath = `${PATHS.studiesDir}/${studyId}/tasks/${taskId}.md`;

  const taskRecord: TaskRecord = {
    task_id: taskId,
    study_id: studyId,
    goal: options.goal?.trim() || 'Unspecified task goal',
    status: 'pending',
    expected_outputs: options.expectedOutputs ?? [],
    depends_on: options.dependsOn ?? [],
    skills: options.skills ?? [],
    artifact_ids: [],
    updated_at: new Date().toISOString(),
  };

  await writeMarkdownDocument(projectRoot, relativePath, taskRecord, buildTaskBody(taskRecord, studyId, options.inputs ?? []));

  const updatedStudyRecord: StudyRecord = {
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

function inferArtifactFormat(relativePath: string): string {
  const extension = path.extname(relativePath);
  return extension || 'unknown';
}

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
  const artifactId = await nextArtifactId(projectRoot);
  const relativePath = await resolveProjectRelativeFilePath(projectRoot, targetPath);
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
    const taskDocument = await findTaskDocument(projectRoot, options.taskId);
    const updatedTaskRecord: TaskRecord = {
      ...taskDocument.record,
      artifact_ids: [...(taskDocument.record.artifact_ids ?? []), artifactId],
      updated_at: new Date().toISOString(),
    };
    await writeMarkdownDocument(projectRoot, taskDocument.relativePath, updatedTaskRecord, taskDocument.body);
  }

  return {
    artifactId,
    entry,
  };
}

function findCurrentQuestion(study: StudyRecord, evolution: EvolutionTrail): string {
  return study.question || evolution.evolution_trail[evolution.evolution_trail.length - 1]?.question_delta.question_after || study.question;
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

export async function closeStudy(projectRoot: string, studyId: string, options: CloseStudyOptions): Promise<void> {
  const studyDocument = await readStudyDocument(projectRoot, studyId);
  const evolution = await readYamlFile<EvolutionTrail>(projectRoot, PATHS.evolution);
  const allTasks = await discoverTasks(projectRoot);
  const studyTasks = allTasks.filter((task) => task.study_id === studyId || (studyDocument.record.task_ids ?? []).includes(task.task_id));

  if (studyTasks.some((task) => (task.status ?? 'pending') === 'pending' || task.status === 'running')) {
    throw new Error(`Study '${studyId}' still has pending or running tasks. Resolve task records before closing the study.`);
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
    });
    registeredPaths.add(result.entry.path);
  }

  const currentQuestion = findCurrentQuestion(studyDocument.record, evolution);
  const nextEvolution: EvolutionTrail = {
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

  const inferredStatus = inferStudyState(studyDocument.record, studyTasks);
  if (inferredStatus !== 'completed' && inferredStatus !== 'blocked' && studyTasks.length > 0) {
    throw new Error(`Study '${studyId}' could not be cleanly classified before closure. Review task statuses.`);
  }
}

export function deriveStudyLifecycleState(study: StudyRecord, tasks: TaskRecord[]): Exclude<StudyRecord['status'], 'confirmed' | undefined> {
  return (inferStudyState(study, tasks) ?? 'created') as Exclude<StudyRecord['status'], 'confirmed' | undefined>;
}
