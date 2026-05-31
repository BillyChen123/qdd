import path from 'node:path';
import * as fs from 'node:fs/promises';
import type {
  ArtifactCandidateManifest,
  ArtifactIndex,
  ArtifactListJson,
  ContextEntry,
  ContextJson,
  EvolutionTrail,
  ResearchContract,
  StudyRecord,
  TaskRecord,
  ValidationIssue,
  ValidationResult,
} from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { discoverStudies, discoverTasks } from './discovery.js';
import { getStudyArtifactCandidatesPath, listNonCanonicalStudyOutputEntries } from './evidence.js';
import { deriveStudyLifecycleState } from './lifecycle.js';
import { readLayerPolicy } from './layer-policy.js';
import {
  listControlledSkillDomains,
  listControlledSkillStages,
  listControlledSkillTags,
  listLocalSkills,
  listProblemSkills,
  normalizeTaskSkillIds,
  resolveLocalSkills,
} from './local-skills.js';
import { readMarkdownDocument, readYamlFile } from './store.js';

const TASK_ID_PATTERN = /^TASK-\d{3}$/;

function isContextFileName(fileName: string): boolean {
  return fileName.endsWith('.yaml') || fileName.endsWith('.md');
}

function pushIssue(issues: ValidationIssue[], issue: ValidationIssue): void {
  issues.push(issue);
}

function hasOwnProperty(value: unknown, key: string): boolean {
  return typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key);
}

function validateResearchContract(contract: ResearchContract, issues: ValidationIssue[]): void {
  if (!contract.theme) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_theme',
      path: PATHS.contract,
      message: 'contract.yaml is missing a non-empty theme.',
    });
  }

  if (!contract.initial_question) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_initial_question',
      path: PATHS.contract,
      message: 'contract.yaml is missing a non-empty initial_question.',
    });
  }

  if (!['human', 'assist', 'auto'].includes(contract.mode)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_mode',
      path: PATHS.contract,
      message: `contract.yaml has invalid mode '${String(contract.mode)}'.`,
    });
  }

  if (!contract.scope || !Array.isArray(contract.scope.in_scope) || !Array.isArray(contract.scope.out_of_scope)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_scope',
      path: PATHS.contract,
      message: 'contract.yaml must define scope.in_scope and scope.out_of_scope arrays.',
    });
  }

  if (contract.termination_type !== 'best_effort') {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_termination_type',
      path: PATHS.contract,
      message: `contract.yaml has invalid termination_type '${String(contract.termination_type)}'.`,
    });
  }

  if (contract.theme === 'Unspecified research theme') {
    pushIssue(issues, {
      level: 'warning',
      code: 'placeholder_theme',
      path: PATHS.contract,
      message: 'contract.yaml still uses the default placeholder theme. Complete qdd-start before real study work.',
    });
  }

  if (contract.initial_question === 'Unspecified initial question') {
    pushIssue(issues, {
      level: 'warning',
      code: 'placeholder_initial_question',
      path: PATHS.contract,
      message: 'contract.yaml still uses the default placeholder initial_question. Complete qdd-start before real study work.',
    });
  }
}

function validateEvolutionTrail(evolution: EvolutionTrail, issues: ValidationIssue[]): void {
  if (!Array.isArray(evolution.evolution_trail)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_evolution_trail',
      path: PATHS.evolution,
      message: 'evolution.yaml must define an evolution_trail array.',
    });
    return;
  }

  for (const [index, entry] of evolution.evolution_trail.entries()) {
    if (!entry.study_id) {
      pushIssue(issues, {
        level: 'error',
        code: 'missing_evolution_study_id',
        path: `${PATHS.evolution}#${index}`,
        message: 'Each evolution trail entry must include study_id.',
      });
    }

    const delta = entry.question_delta;
    if (!delta) {
      pushIssue(issues, {
        level: 'error',
        code: 'missing_question_delta',
        path: `${PATHS.evolution}#${index}`,
        message: 'Each evolution trail entry must include question_delta.',
      });
      continue;
    }

    if (!['refinement', 'confirmation', 'pivot', 'dissolution'].includes(delta.change_type)) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_change_type',
        path: `${PATHS.evolution}#${index}`,
        message: `Invalid question_delta.change_type '${String(delta.change_type)}'.`,
      });
    }
  }
}

function validateArtifactIndex(artifactIndex: ArtifactIndex, issues: ValidationIssue[]): void {
  if (!Array.isArray(artifactIndex.artifacts)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_artifacts_array',
      path: PATHS.artifactIndex,
      message: 'artifacts/index.yaml must define an artifacts array.',
    });
    return;
  }

  for (const [index, entry] of artifactIndex.artifacts.entries()) {
    const entryPath = `${PATHS.artifactIndex}#${index}`;
    const artifactRecord = entry as unknown as Record<string, unknown>;
    for (const key of ['id', 'type', 'path', 'produced_by', 'description', 'schema']) {
      if (!hasOwnProperty(entry, key) || !String(artifactRecord[key] ?? '').trim()) {
        pushIssue(issues, {
          level: 'error',
          code: `missing_artifact_${key}`,
          path: entryPath,
          message: `Artifact entry is missing required field '${key}'.`,
        });
      }
    }

    if (!['data', 'code', 'figure', 'report'].includes(entry.type)) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_artifact_type',
        path: entryPath,
        message: `Artifact entry has invalid type '${String(entry.type)}'.`,
      });
    }

    if (!['project', 'study', 'task'].includes(entry.scope)) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_artifact_scope',
        path: entryPath,
        message: `Artifact entry has invalid scope '${String(entry.scope)}'.`,
      });
    }
  }
}

function validateStudyRecord(study: StudyRecord, issues: ValidationIssue[]): void {
  const studyPath = `${PATHS.studiesDir}/${study.study_id}/study.md`;
  if (!study.study_id) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_study_id',
      path: studyPath,
      message: 'study.md is missing study_id.',
    });
  }

  if (!study.question) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_study_question',
      path: studyPath,
      message: 'study.md is missing question.',
    });
  }

  if (!study.hypothesis) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_study_hypothesis',
      path: studyPath,
      message: 'study.md is missing hypothesis.',
    });
  }

  if (study.status && !['created', 'confirmed', 'running', 'blocked', 'completed', 'closed'].includes(study.status)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_study_status',
      path: studyPath,
      message: `study.md has invalid status '${String(study.status)}'.`,
    });
  }
}

function validateTaskRecord(task: TaskRecord, issues: ValidationIssue[]): void {
  const taskPath = `${PATHS.studiesDir}/${task.study_id}/tasks/${task.task_id}.md`;
  if (!task.task_id) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_task_id',
      path: taskPath,
      message: 'Task file is missing task_id.',
    });
  }

  if (!task.study_id) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_task_study_id',
      path: taskPath,
      message: 'Task file is missing study_id.',
    });
  }

  if (!task.goal) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_task_goal',
      path: taskPath,
      message: 'Task file is missing goal.',
    });
  }

  if (task.status && !['pending', 'running', 'blocked', 'completed'].includes(task.status)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_task_status',
      path: taskPath,
      message: `Task file has invalid status '${String(task.status)}'.`,
    });
  }

  if (task.skills !== undefined && !Array.isArray(task.skills)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_task_skills',
      path: taskPath,
      message: 'Task file must store skills as an array when provided.',
    });
  }

  if (task.promotion_status && !['pending', 'none', 'candidate-recorded', 'registered'].includes(task.promotion_status)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_task_promotion_status',
      path: taskPath,
      message: `Task file has invalid promotion_status '${String(task.promotion_status)}'.`,
    });
  }

  if (task.status === 'completed' && (task.promotion_status ?? 'pending') === 'pending') {
    pushIssue(issues, {
      level: 'error',
      code: 'completed_task_pending_promotion_review',
      path: taskPath,
      message: 'Completed tasks must not remain at promotion_status pending.',
    });
  }
}

function extractBulletSection(body: string, heading: string): string[] | null {
  const pattern = new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = body.match(pattern);
  if (!match) {
    return null;
  }

  const lines = match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));

  if (lines.length === 1 && lines[0] === '- None specified.') {
    return [];
  }

  return lines.map((line) => line.slice(2).trim()).filter((line) => line.length > 0);
}

function validateTaskSkillSection(relativePath: string, task: TaskRecord, body: string, issues: ValidationIssue[]): void {
  const normalizedFrontmatterSkills = normalizeTaskSkillIds(task.skills ?? []);
  const bodySkills = extractBulletSection(body, 'Skills');

  if (bodySkills === null) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_task_skills_section',
      path: relativePath,
      message: 'Task markdown body must include a ## Skills section.',
    });
    return;
  }

  const normalizedBodySkills = normalizeTaskSkillIds(bodySkills);
  if (JSON.stringify(normalizedFrontmatterSkills) !== JSON.stringify(normalizedBodySkills)) {
    pushIssue(issues, {
      level: 'error',
      code: 'task_skill_section_mismatch',
      path: relativePath,
      message: 'Task frontmatter skills and ## Skills section must stay identical after normalization.',
    });
  }
}

function validateArtifactCandidateManifest(
  studyId: string,
  manifest: ArtifactCandidateManifest,
  issues: ValidationIssue[]
): void {
  const manifestPath = getStudyArtifactCandidatesPath(studyId);
  if (!Array.isArray(manifest.artifact_candidates)) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_artifact_candidates_array',
      path: manifestPath,
      message: `${manifestPath} must define an artifact_candidates array.`,
    });
    return;
  }

  for (const [index, entry] of manifest.artifact_candidates.entries()) {
    const entryPath = `${manifestPath}#${index}`;
    const candidateRecord = entry as unknown as Record<string, unknown>;
    for (const key of ['path', 'type', 'description', 'schema']) {
      if (!hasOwnProperty(entry, key) || !String(candidateRecord[key] ?? '').trim()) {
        pushIssue(issues, {
          level: 'error',
          code: `missing_artifact_candidate_${key}`,
          path: entryPath,
          message: `Artifact candidate entry is missing required field '${key}'.`,
        });
      }
    }

    if (hasOwnProperty(entry, 'type') && !['data', 'code', 'figure', 'report'].includes(String(candidateRecord.type ?? ''))) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_artifact_candidate_type',
        path: entryPath,
        message: `Artifact candidate entry has invalid type '${String(candidateRecord.type ?? '')}'.`,
      });
    }

    if (hasOwnProperty(entry, 'scope') && candidateRecord.scope !== undefined && !['project', 'study', 'task'].includes(String(candidateRecord.scope ?? ''))) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_artifact_candidate_scope',
        path: entryPath,
        message: `Artifact candidate entry has invalid scope '${String(candidateRecord.scope ?? '')}'.`,
      });
    }

    if (hasOwnProperty(entry, 'reusable') && typeof candidateRecord.reusable !== 'boolean') {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_artifact_candidate_reusable',
        path: entryPath,
        message: 'Artifact candidate entry must set reusable to a boolean.',
      });
    }

    const taskId = hasOwnProperty(entry, 'task_id') ? String(candidateRecord.task_id ?? '').trim() : '';
    if (taskId.length > 0 && !TASK_ID_PATTERN.test(taskId)) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_artifact_candidate_task_id',
        path: entryPath,
        message: `Artifact candidate entry has invalid task_id '${taskId}'. Expected TASK-XXX.`,
      });
    }

    if (String(candidateRecord.scope ?? '') === 'task' && taskId.length === 0) {
      pushIssue(issues, {
        level: 'error',
        code: 'missing_artifact_candidate_task_id',
        path: entryPath,
        message: 'Task-scoped artifact candidates must declare task_id.',
      });
    }

    if ((candidateRecord.reusable === undefined || candidateRecord.reusable === true) && String(candidateRecord.scope ?? 'study') !== 'project' && taskId.length === 0) {
      pushIssue(issues, {
        level: 'warning',
        code: 'artifact_candidate_missing_task_provenance',
        path: entryPath,
        message: 'Reusable artifact candidates should include task_id whenever one task clearly produced the output.',
      });
    }
  }
}

async function validateMarkdownStructure(projectRoot: string, relativePath: string, issues: ValidationIssue[]): Promise<void> {
  try {
    await readMarkdownDocument(projectRoot, relativePath);
  } catch (error) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_markdown_frontmatter',
      path: relativePath,
      message: (error as Error).message,
    });
  }
}

export async function listArtifacts(projectRoot: string): Promise<ArtifactListJson> {
  const artifactIndex = await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex);
  return {
    artifacts: artifactIndex.artifacts,
  };
}

export async function listContext(projectRoot: string): Promise<ContextJson> {
  const contextDir = path.join(projectRoot, PATHS.contextDir);
  if (!(await FileSystemUtils.directoryExists(contextDir))) {
    return { context: [] };
  }

  const entries = await fs.readdir(contextDir, { withFileTypes: true });
  const contextEntries: ContextEntry[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !isContextFileName(entry.name)) {
      continue;
    }

    const relativePath = `${PATHS.contextDir}/${entry.name}`;
    const data = entry.name.endsWith('.md') ? await FileSystemUtils.readFile(path.join(projectRoot, relativePath)) : await readYamlFile<unknown>(projectRoot, relativePath);
    contextEntries.push({
      path: relativePath,
      name: entry.name,
      data,
    });
  }

  contextEntries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    context: contextEntries,
  };
}

async function listContextPaths(projectRoot: string): Promise<string[]> {
  const contextDir = path.join(projectRoot, PATHS.contextDir);
  if (!(await FileSystemUtils.directoryExists(contextDir))) {
    return [];
  }

  const entries = await fs.readdir(contextDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && isContextFileName(entry.name))
    .map((entry) => `${PATHS.contextDir}/${entry.name}`)
    .sort();
}

async function listSharedDataPaths(projectRoot: string): Promise<string[]> {
  const dataDir = path.join(projectRoot, PATHS.artifactDataDir);
  if (!(await FileSystemUtils.directoryExists(dataDir))) {
    return [];
  }

  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  return entries.map((entry) => `${PATHS.artifactDataDir}/${entry.name}`).sort();
}

export async function validateProject(projectRoot: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  const checked: ValidationResult['checked'] = {
    contract: false,
    evolution: false,
    artifactIndex: false,
    layerPolicy: false,
    contextFiles: [],
    studies: [],
    tasks: [],
  };

  try {
    const contract = await readYamlFile<ResearchContract>(projectRoot, PATHS.contract);
    checked.contract = true;
    validateResearchContract(contract, issues);
  } catch (error) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_contract_yaml',
      path: PATHS.contract,
      message: (error as Error).message,
    });
  }

  try {
    const evolution = await readYamlFile<EvolutionTrail>(projectRoot, PATHS.evolution);
    checked.evolution = true;
    validateEvolutionTrail(evolution, issues);
  } catch (error) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_evolution_yaml',
      path: PATHS.evolution,
      message: (error as Error).message,
    });
  }

  try {
    const artifactIndex = await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex);
    checked.artifactIndex = true;
    validateArtifactIndex(artifactIndex, issues);
  } catch (error) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_artifact_index_yaml',
      path: PATHS.artifactIndex,
      message: (error as Error).message,
    });
  }

  try {
    const layerPolicy = await readLayerPolicy(projectRoot);
    checked.layerPolicy = true;

    for (const [roleName, config] of Object.entries(layerPolicy.roles)) {
      const defaultSkills = await resolveLocalSkills(projectRoot, config.default_skills, { allowPlanningOnly: roleName === 'study-brain' });

      for (const workflowSkillId of defaultSkills.disallowedWorkflow) {
        pushIssue(issues, {
          level: 'error',
          code: 'workflow_skill_not_allowed_in_layer_policy',
          path: PATHS.layerPolicy,
          message: `Role policy for '${roleName}' references workflow skill '${workflowSkillId}'. Role defaults must use local planning or domain skills instead.`,
        });
      }

      if (roleName !== 'study-brain') {
        for (const planningSkillId of defaultSkills.planningOnly) {
          pushIssue(issues, {
            level: 'error',
            code: 'planning_skill_not_allowed_in_task_layer_policy',
            path: PATHS.layerPolicy,
            message: `Role policy for '${roleName}' references planning-only brain skill '${planningSkillId}'. Only study-brain defaults may load planning-only brain skills.`,
          });
        }
      }

      for (const missingSkillId of defaultSkills.missing) {
        pushIssue(issues, {
          level: 'error',
          code: 'missing_layer_policy_skill',
          path: PATHS.layerPolicy,
          message: `Role policy references domain skill '${missingSkillId}', but it does not exist under the QDD root domain-skills/ library.`,
        });
      }
    }
  } catch (error) {
    pushIssue(issues, {
      level: 'error',
      code: 'invalid_layer_policy_yaml',
      path: PATHS.layerPolicy,
      message: (error as Error).message,
    });
  }

  const contextPaths = await listContextPaths(projectRoot);
  checked.contextFiles = contextPaths;

  if (!contextPaths.includes(PATHS.contextResources)) {
    pushIssue(issues, {
      level: 'error',
      code: 'missing_resources_context',
      path: PATHS.contextResources,
      message: 'context/resources.md is required as the default project resource document.',
    });
  }

  for (const relativePath of contextPaths) {
    try {
      if (relativePath.endsWith('.md')) {
        const data = await FileSystemUtils.readFile(path.join(projectRoot, relativePath));
        if (data.trim().length === 0) {
          pushIssue(issues, {
            level: 'warning',
            code: 'empty_context_file',
            path: relativePath,
            message: 'Context markdown file is empty.',
          });
        }

        if (relativePath === PATHS.contextResources) {
          const placeholderMarkers = [
            'Theme statement: unspecified',
            'Current biological focus: unspecified',
            'Biological system: unspecified',
            'Primary datasets: unspecified',
            'Python: unspecified',
            'Stable methodological preferences: unspecified',
          ];

          if (placeholderMarkers.some((marker) => data.includes(marker))) {
            pushIssue(issues, {
              level: 'warning',
              code: 'placeholder_project_resources',
              path: relativePath,
              message: 'context/resources.md still contains scaffold placeholders. Complete qdd-start before real study work.',
            });
          }
        }
      } else {
        const data = await readYamlFile<unknown>(projectRoot, relativePath);
        if (data === null || data === undefined) {
          pushIssue(issues, {
            level: 'warning',
            code: 'empty_context_file',
            path: relativePath,
            message: 'Context file parsed successfully but is empty.',
          });
        }
      }
    } catch (error) {
      pushIssue(issues, {
        level: 'error',
        code: relativePath.endsWith('.md') ? 'invalid_context_markdown' : 'invalid_context_yaml',
        path: relativePath,
        message: (error as Error).message,
      });
    }
  }

  const localSkillsDir = path.join(projectRoot, PATHS.codexSkillsDir);
  if (!(await FileSystemUtils.directoryExists(localSkillsDir))) {
    pushIssue(issues, {
      level: 'warning',
      code: 'missing_local_skill_registry',
      path: PATHS.codexSkillsDir,
      message: 'Project-local workflow skill surface .codex/skills/ is missing.',
    });
  }

  const problemSkills = await listProblemSkills(projectRoot);
  const problemSkillIds = new Set(problemSkills.map((entry) => entry.id));
  const controlledDomains = new Set(listControlledSkillDomains());
  const controlledStages = new Set(listControlledSkillStages());
  const controlledTags = new Set(listControlledSkillTags());
  const localSkills = await listLocalSkills(projectRoot);

  for (const skill of localSkills) {
    if (skill.id.startsWith('qdd/') || skill.id.startsWith('brain/')) {
      continue;
    }

    const skillDocument = await readMarkdownDocument<Record<string, unknown>>(projectRoot, skill.path);
    const domain = typeof skillDocument.frontmatter.domain === 'string' ? skillDocument.frontmatter.domain.trim().toLowerCase() : '';
    const stage = typeof skillDocument.frontmatter.stage === 'string' ? skillDocument.frontmatter.stage.trim().toLowerCase() : '';
    const tags = Array.isArray(skillDocument.frontmatter.tags) ? skillDocument.frontmatter.tags.map((entry) => String(entry).trim().toLowerCase()) : [];

    if (!controlledDomains.has(domain as never) || !controlledStages.has(stage as never) || tags.length === 0 || tags.some((entry) => !controlledTags.has(entry as never))) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_problem_skill_metadata',
        path: skill.path,
        message: `Executor-facing skill '${skill.id}' must declare controlled frontmatter fields domain/stage/tags.`,
      });
    }
  }

  const artifactIndex = checked.artifactIndex ? await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex) : { artifacts: [] };
  const registeredArtifactPaths = new Set(artifactIndex.artifacts.map((entry) => entry.path));
  const dataPaths = await listSharedDataPaths(projectRoot);
  for (const relativePath of dataPaths) {
    const absolutePath = path.join(projectRoot, relativePath);
    try {
      const stats = await fs.lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        try {
          await fs.stat(absolutePath);
        } catch {
          pushIssue(issues, {
            level: 'error',
            code: 'broken_data_link',
            path: relativePath,
            message: 'Dataset entrypoint symlink is broken.',
          });
        }
        continue;
      }

      if (!registeredArtifactPaths.has(relativePath)) {
        pushIssue(issues, {
          level: 'warning',
          code: 'non_symlink_data_entry',
          path: relativePath,
          message: 'Shared data entry is not a symlink and is not registered as an artifact. Prefer symlinks for raw resources under artifacts/data/.',
        });
      }
    } catch (error) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_data_entry',
        path: relativePath,
        message: (error as Error).message,
      });
    }
  }

  const studiesDir = path.join(projectRoot, PATHS.studiesDir);
  if (await FileSystemUtils.directoryExists(studiesDir)) {
    const studyEntries = await fs.readdir(studiesDir, { withFileTypes: true });
    for (const studyEntry of studyEntries) {
      if (!studyEntry.isDirectory()) {
        continue;
      }
      await validateMarkdownStructure(projectRoot, `${PATHS.studiesDir}/${studyEntry.name}/study.md`, issues);
    }
  }

  const studies = await discoverStudies(projectRoot);
  const tasks = await discoverTasks(projectRoot);
  checked.studies = studies.map((study) => study.study_id);
  checked.tasks = tasks.map((task) => task.task_id);

  for (const study of studies) {
    validateStudyRecord(study, issues);
  }

  for (const task of tasks) {
    validateTaskRecord(task, issues);
    const taskRelativePath = `${PATHS.studiesDir}/${task.study_id}/tasks/${task.task_id}.md`;
    await validateMarkdownStructure(projectRoot, taskRelativePath, issues);

    const taskDocument = await readMarkdownDocument<TaskRecord>(projectRoot, taskRelativePath);
    validateTaskSkillSection(taskRelativePath, taskDocument.frontmatter, taskDocument.body, issues);

    const resolvedSkills = await resolveLocalSkills(projectRoot, task.skills ?? []);
    for (const workflowSkillId of resolvedSkills.disallowedWorkflow) {
      pushIssue(issues, {
        level: 'error',
        code: 'workflow_skill_not_allowed_in_task',
        path: taskRelativePath,
        message: `Task references workflow skill '${workflowSkillId}'. Task skills must be concrete domain dependencies, not qdd/* workflow surfaces.`,
      });
    }

    for (const planningSkillId of resolvedSkills.planningOnly) {
      pushIssue(issues, {
        level: 'error',
        code: 'planning_skill_not_allowed_in_task',
        path: taskRelativePath,
        message: `Task references planning-only brain skill '${planningSkillId}'. Move it to study planning and keep task skills executor-facing.`,
      });
    }

    for (const missingSkillId of resolvedSkills.missing) {
      pushIssue(issues, {
        level: 'error',
        code: 'missing_local_skill_reference',
        path: taskRelativePath,
        message: `Task references domain skill '${missingSkillId}', but it does not exist under the QDD root domain-skills/ library.`,
      });
    }

    for (const skillId of normalizeTaskSkillIds(task.skills ?? [])) {
      if (skillId.startsWith('qdd/') || skillId.startsWith('brain/')) {
        continue;
      }

      if (!problemSkillIds.has(skillId)) {
        pushIssue(issues, {
          level: 'error',
          code: 'task_skill_not_cataloged',
          path: taskRelativePath,
          message: `Task skill '${skillId}' exists locally but is not a valid cataloged executor problem-level skill.`,
        });
      }
    }
  }

  for (const study of studies) {
    const manifestPath = getStudyArtifactCandidatesPath(study.study_id);
    const absolutePath = path.join(projectRoot, manifestPath);

    if (!(await FileSystemUtils.fileExists(absolutePath))) {
      continue;
    }

    try {
      const manifest = await readYamlFile<ArtifactCandidateManifest>(projectRoot, manifestPath);
      validateArtifactCandidateManifest(study.study_id, manifest, issues);
    } catch (error) {
      pushIssue(issues, {
        level: 'error',
        code: 'invalid_artifact_candidates_yaml',
        path: manifestPath,
        message: (error as Error).message,
      });
    }
  }

  for (const study of studies) {
    const studyTasks = tasks.filter((task) => task.study_id === study.study_id || (study.task_ids ?? []).includes(task.task_id));
    const inferredState = deriveStudyLifecycleState(study, studyTasks);
    const unpackagedEntries = await listNonCanonicalStudyOutputEntries(projectRoot, study.study_id);

    if (study.status === 'closed' && studyTasks.some((task) => (task.status ?? 'pending') === 'pending' || task.status === 'running')) {
      pushIssue(issues, {
        level: 'error',
        code: 'closed_study_with_open_tasks',
        path: `${PATHS.studiesDir}/${study.study_id}/study.md`,
        message: `Study '${study.study_id}' is closed but still has pending or running tasks.`,
      });
    }

    if ((study.status === 'completed' || study.status === 'blocked') && inferredState !== study.status) {
      pushIssue(issues, {
        level: 'warning',
        code: 'study_state_mismatch',
        path: `${PATHS.studiesDir}/${study.study_id}/study.md`,
        message: `Study '${study.study_id}' has status '${study.status}' but current task state suggests '${inferredState}'.`,
      });
    }

    if (unpackagedEntries.length > 0) {
      pushIssue(issues, {
        level: 'warning',
        code: 'noncanonical_study_output_entries',
        path: `${PATHS.studiesDir}/${study.study_id}/output/`,
        message: `Study output contains unpackaged non-canonical entries: ${unpackagedEntries.join(', ')}.`,
      });
    }
  }

  return {
    valid: !issues.some((issue) => issue.level === 'error'),
    issues,
    checked,
  };
}
