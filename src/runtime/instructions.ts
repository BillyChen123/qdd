import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import type { InstructionsJson, QddCommand, QddRole, StudyRecord, TaskRecord } from '../types.js';
import { readMarkdownFrontmatter } from './store.js';
import { PATHS } from './constants.js';
import { getStudyArtifactCandidatesPath, getStudyOutputDir, getStudyPublicDataRequestPath } from './evidence.js';
import { listLocalSkills, resolveLocalSkills } from './local-skills.js';
import { listRecentStudyMemoryPaths } from './evolution.js';
import { getDefaultSkillsForRole, isQddCommand, readLayerPolicy, resolveCommandRole } from './layer-policy.js';

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

async function collectContextReadPaths(projectRoot: string, relativeDir: string = PATHS.contextDir): Promise<string[]> {
  const absoluteDir = path.join(projectRoot, relativeDir);
  if (!(await FileSystemUtils.directoryExists(absoluteDir))) {
    return [];
  }

  const entries = await (await import('node:fs/promises')).readdir(absoluteDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...(await collectContextReadPaths(projectRoot, relativePath)));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.md'))) {
      results.push(relativePath);
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
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
      if (skillId.trim().length > 0) skillIds.add(skillId);
    }
  }

  return [...skillIds].sort();
}

async function resolveSkillSet(projectRoot: string, skillIds: string[], allowPlanningOnly = false): Promise<{
  matchedPaths: string[];
  missing: string[];
  disallowedWorkflow: string[];
  matchedIds: string[];
  planningOnly: string[];
}> {
  const localSkills = await resolveLocalSkills(projectRoot, skillIds, { allowPlanningOnly });
  return {
    matchedPaths: uniqueSortedValues(localSkills.matched.map((entry) => entry.path)),
    missing: uniqueSortedValues(localSkills.missing),
    disallowedWorkflow: uniqueSortedValues(localSkills.disallowedWorkflow),
    matchedIds: uniqueSortedValues(localSkills.matched.map((entry) => entry.id)),
    planningOnly: uniqueSortedValues(localSkills.planningOnly),
  };
}

async function collectAvailableSkillReadPaths(projectRoot: string): Promise<string[]> {
  const availableSkills = await listLocalSkills(projectRoot);
  return uniqueSortedValues(availableSkills.map((entry) => entry.path));
}

function validateCommandForTarget(targetKind: 'project' | 'study' | 'task', command: QddCommand | null): void {
  if (!command) return;

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

function appendRoleSkillIssues(
  rules: string[],
  subject: string,
  roleSkills: { missing: string[]; disallowedWorkflow: string[]; planningOnly: string[] }
): void {
  const disallowed = uniqueSortedValues(roleSkills.disallowedWorkflow);
  const planningOnly = uniqueSortedValues(roleSkills.planningOnly);
  const missingDefault = uniqueSortedValues(roleSkills.missing);

  if (disallowed.length > 0) {
    rules.push(`${subject} role policy must not include workflow skills: ${disallowed.join(', ')}.`);
  }

  if (planningOnly.length > 0 && subject !== 'Study') {
    rules.push(`${subject} role policy must not include planning-only brain skills: ${planningOnly.join(', ')}.`);
  }

  if (missingDefault.length > 0) {
    rules.push(`${subject} default domain skills are missing from the QDD root domain-skills/ library: ${missingDefault.join(', ')}.`);
  }
}

function buildInstructionHeader(command: QddCommand | null, role: InstructionsJson['role']): Pick<InstructionsJson, 'command' | 'role'> {
  return { command, role };
}

async function resolveRoleSkillSet(projectRoot: string, role: QddRole, policy: Awaited<ReturnType<typeof readLayerPolicy>>) {
  return resolveSkillSet(projectRoot, getDefaultSkillsForRole(policy, role), role === 'study-brain');
}

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
    const recentMemoryPaths = await listRecentStudyMemoryPaths(projectRoot);
    const localSkillReadPaths = await collectAvailableSkillReadPaths(projectRoot);
    const role = resolveCommandRole(policy, command, 'thesis-manager');
    const roleSkillSet = await resolveRoleSkillSet(projectRoot, role, policy);
    const rules = [
      'Do not invent project facts that are not grounded in user input or existing files.',
      'Use qdd-start to fill shared project context before the first study is proposed.',
      'Keep contract.yaml concise and machine-readable.',
      'Treat evolution.yaml as the sparse project truth source for current project question state and boundaries.',
      'Treat research-map.html as a derived report, not a truth source.',
      'Keep durable shared context in context/resources.md and optional context sidecars; keep narrative study history in context/memory/*.md.',
      'Create dataset entrypoints under artifacts/data/ as symlinks rather than copying raw data by default.',
      'Treat .qdd/layer-policy.yaml as the editable source for command roles and role-level default skills.',
      'Treat domain skills as read from the QDD root domain-skills/ library, while local workflow skills remain bootstrapped under .codex/skills/qdd/ and .claude/skills/qdd/.',
    ];

    appendRoleSkillIssues(rules, 'Project', roleSkillSet);

    return {
      ...buildInstructionHeader(command, role),
      target: { kind: 'project', id },
      read: uniqueSortedValues([
        PATHS.contract,
        PATHS.evolution,
        PATHS.researchMapHtml,
        PATHS.instructions,
        PATHS.bootstrapConfig,
        PATHS.layerPolicy,
        PATHS.skillsCatalog,
        `${PATHS.artifactDataDir}/`,
        `${PATHS.codexSkillsDir}/qdd/`,
        `${PATHS.claudeSkillsDir}/qdd/`,
        'domain-skills/',
        ...contextReadPaths,
        ...recentMemoryPaths,
        ...dataReadPaths,
        ...localSkillReadPaths,
        ...roleSkillSet.matchedPaths,
      ]),
      write: uniqueSortedValues([
        PATHS.contract,
        PATHS.contextResources,
        `${PATHS.contextDir}/`,
        `${PATHS.artifactDataDir}/`,
        PATHS.layerPolicy,
        PATHS.researchMapHtml,
      ]),
      required_skills: roleSkillSet.matchedIds,
      optional_skills: [],
      rules,
    };
  }

  if (STUDY_ID_PATTERN.test(id)) {
    validateCommandForTarget('study', command);

    await readStudyRecord(projectRoot, id);
    const policy = await readLayerPolicy(projectRoot);
    const contextReadPaths = await collectContextReadPaths(projectRoot);
    const dataReadPaths = await collectSharedDataReadPaths(projectRoot);
    const recentMemoryPaths = await listRecentStudyMemoryPaths(projectRoot);
    const taskPaths = await collectStudyTaskPaths(projectRoot, id);
    const studyTaskSkillIds = await collectTaskSkillIds(projectRoot, taskPaths);
    const studyTaskSkills = await resolveSkillSet(projectRoot, studyTaskSkillIds);
    const role = resolveCommandRole(policy, command, 'study-brain');
    const roleSkillSet = await resolveRoleSkillSet(projectRoot, role, policy);
    const requiredSkillIds = uniqueSortedValues([...roleSkillSet.matchedIds, ...studyTaskSkills.matchedIds]);
    const hasPublicDataTask = studyTaskSkills.matchedIds.includes('singlecell/public-data/cellxgene-discover');
    const readPaths = [
      PATHS.contract,
      PATHS.evolution,
      PATHS.researchMapHtml,
      PATHS.instructions,
      PATHS.layerPolicy,
      PATHS.artifactIndex,
      ...contextReadPaths,
      ...recentMemoryPaths,
      ...dataReadPaths,
      `${PATHS.studiesDir}/${id}/study.md`,
      ...taskPaths,
      ...studyTaskSkills.matchedPaths,
      ...roleSkillSet.matchedPaths,
    ];
    const writePaths = [
      `${PATHS.studiesDir}/${id}/study.md`,
      `${PATHS.studiesDir}/${id}/tasks/`,
      `${PATHS.studiesDir}/${id}/output/`,
      getStudyArtifactCandidatesPath(id),
      PATHS.artifactIndex,
    ];

    if (command === 'qdd-close') {
      writePaths.push(PATHS.evolution, PATHS.contextResources, `${PATHS.contextDir}/`, `${PATHS.contextMemoryDir}/`, PATHS.researchMapHtml);
    }

    const rules = [
      'Do not redefine the project theme.',
      'Keep one bounded question per study.',
      'Use the current mode contract from .qdd/instructions.md before reshaping the study or task set.',
      'Treat .qdd/layer-policy.yaml as the command-to-role contract for this instruction surface.',
      'Only rely on domain task skills that exist under the QDD root domain-skills/ library.',
      'Treat brain/* as planning-only domain-prior skills. They may guide study planning, but must not be written into task skills or treated as executor skills.',
      'Read evolution.yaml and recent context/memory/*.md before making study-level decisions that depend on prior project state.',
      'qdd-propose owns the first-pass study and task-graph creation.',
      'In human or assist mode, qdd-explore must discuss and confirm before modifying study/task artifacts.',
      'Record blockers explicitly.',
      'Update study and task Markdown records directly as work progresses.',
      'Treat the study as the execution unit until it reaches a decision point, explicit blocker, or true study-level replanning need.',
      'Do not return to qdd-explore just because one task finished; keep moving while the next planned study-local task is clear.',
      'Write study outputs into the study output directory.',
      'Use studies/STUDY-XXX/output/tmp only as scratch space; package final outputs back into the canonical study output directories before treating work as complete.',
      'Treat studies/STUDY-XXX/output/data, code, figures, tables, and reports as the canonical final study output surface.',
      'Preserve readable scripts in studies/STUDY-XXX/output/code for substantive analyses.',
      'Save key figures in studies/STUDY-XXX/output/figures when the claim depends on visual evidence, or record why no figure was needed.',
      'Use studies/STUDY-XXX/output/artifact-candidates.yaml as the explicit promotion boundary for reusable study outputs.',
      'Use studies/STUDY-XXX/output/public_data_request.yaml only when this study truly depends on external public data; do not create it for studies that can proceed entirely from local resources.',
      'Include task_id in artifact candidates whenever one task clearly produced the reusable output.',
    ];

    if (command === 'qdd-propose' || command === 'qdd-explore') {
      readPaths.push(PATHS.skillsCatalog);
      rules.push('Keep human propose as the highest semantic authority; treat prior candidates in evolution.yaml only as suggestions.');
      rules.push('Planning should stay grounded in contract.yaml, context/resources.md, evolution.yaml, recent context/memory/*.md, and available artifacts/resources.');
      rules.push('Use study-brain skills plus qdd skills suggest --domain <domain> --stage <stage> --tag <tag> --json when problem-level skill selection is needed.');
      rules.push('Candidate search belongs to planning. Keep apply execution on the task-local skill bundle only.');
      rules.push('When a task clearly belongs to a known executor problem class, choose and write the task-local skill bundle during planning instead of deferring the decision to qdd-apply.');
      rules.push('When a study genuinely needs external public data, planning may search and narrow candidates, but it should persist only the final selected targets in studies/STUDY-XXX/output/public_data_request.yaml.');
      rules.push('Do not make boundary score output a required planning gate. Boundary-compatible CLI views are optional diagnostics, not core protocol requirements.');
    }

    if (command === 'qdd-close') {
      rules.push('For qdd-close, the target is the study but the final promotion and carry-forward judgment belongs to the thesis-manager role.');
      rules.push('qdd-close must register missing reusable outputs from artifact-candidates.yaml before final closure.');
      rules.push('qdd-close must write one sparse study event into evolution.yaml, one narrative memory file into context/memory/, and refresh research-map.html.');
      rules.push('Prefer candidate-driven promotion through qdd-close over ad hoc direct registration.');
      rules.push('Refuse closure when any completed task still has promotion_status pending.');
      rules.push('Refuse closure when non-canonical top-level study output material still remains unpackaged.');
      rules.push('If this study introduced reusable downloaded datasets under artifacts/data/, record their stable source, alias, and intended reuse role in context/resources.md before closure.');
    }

    appendRoleSkillIssues(rules, 'Study', roleSkillSet);

    if (studyTaskSkills.disallowedWorkflow.length > 0) {
      rules.push(`Task skill lists must not include workflow skills: ${studyTaskSkills.disallowedWorkflow.join(', ')}.`);
    }

    if (studyTaskSkills.planningOnly.length > 0) {
      rules.push(`Task skill lists must not include planning-only brain skills: ${studyTaskSkills.planningOnly.join(', ')}.`);
    }

    if (studyTaskSkills.missing.length > 0) {
      rules.push(`Missing domain skills referenced by this study's tasks: ${studyTaskSkills.missing.join(', ')}.`);
    }

    if (hasPublicDataTask) {
      readPaths.push(getStudyPublicDataRequestPath(id));
      rules.push(`Treat ${getStudyPublicDataRequestPath(id)} as the planning-owned handoff for public-data selection.`);
      rules.push('Planning may narrow public-data candidates, but apply may only consume the selected targets already written there.');
      rules.push('If the selected public datasets were downloaded successfully, qdd-close should decide whether they belong in carried-forward project resources and document them explicitly in context/resources.md.');
    }

    return {
      ...buildInstructionHeader(command, role),
      target: { kind: 'study', id },
      read: uniqueSortedValues(readPaths),
      write: uniqueSortedValues(writePaths),
      required_skills: requiredSkillIds,
      optional_skills: [],
      rules,
    };
  }

  if (TASK_ID_PATTERN.test(id)) {
    validateCommandForTarget('task', command);

    const { studyId, task } = await findTaskRecord(projectRoot, id);
    const policy = await readLayerPolicy(projectRoot);
    const contextReadPaths = await collectContextReadPaths(projectRoot);
    const dataReadPaths = await collectSharedDataReadPaths(projectRoot);
    const recentMemoryPaths = await listRecentStudyMemoryPaths(projectRoot);
    const taskSkillSet = await resolveSkillSet(projectRoot, task.skills ?? []);
    const role = resolveCommandRole(policy, command, 'executor');
    const roleSkillSet = await resolveRoleSkillSet(projectRoot, role, policy);
    const requiredSkillIds = uniqueSortedValues([...roleSkillSet.matchedIds, ...taskSkillSet.matchedIds]);
    const hasPublicDataTask = taskSkillSet.matchedIds.includes('singlecell/public-data/cellxgene-discover');
    const rules = [
      'Do not redefine the study question.',
      'Keep the task minimal and evidence-producing.',
      'Produce explicit outputs or blockers.',
      'You may read the current project evolution state for alignment, but you must not mutate project-level evolution state from task-level apply.',
      'Treat .qdd/layer-policy.yaml as the command-to-role contract for this instruction surface.',
      'Only rely on domain task skills that exist under the QDD root domain-skills/ library.',
      'Do not add qdd/* workflow skills or brain/* planning skills to task skill lists.',
      'qdd-apply consumes the declared task-local problem-level skills only; it must not reopen broad skill search.',
      'If task-local executor skills are present, read them first and use them as the primary execution guidance for this task.',
      'Do not bypass declared task-local executor skills with unconstrained ad hoc coding unless you make the gap explicit.',
      'Rewrite the weak checklist scaffold into task-specific executable steps before or during execution.',
      'Keep task checklist progress in the task Markdown body.',
      'Escalate to study-level updates when the task changes the study boundary or evidence plan.',
      'Use studies/STUDY-XXX/output/tmp only as scratch space; package final outputs back into canonical study output directories before marking the task complete.',
      `Treat ${getStudyOutputDir(studyId)}/data, code, figures, tables, and reports as the canonical final output surface for this study.`,
      `Treat ${getStudyPublicDataRequestPath(studyId)} as a planning-owned handoff file. If this task uses it, consume only the selected dataset targets recorded there.`,
      'Preserve readable scripts in studies/STUDY-XXX/output/code for substantive analyses.',
      'Save key figures in studies/STUDY-XXX/output/figures when the claim depends on visual evidence, or record why no figure was needed.',
      'Add only promotion-worthy outputs to studies/STUDY-XXX/output/artifact-candidates.yaml; do not treat all local outputs as artifacts.',
      'Include task_id in artifact candidates whenever this task clearly produced the reusable output.',
      'Before a completed task is left in place, set promotion_status explicitly to none, candidate-recorded, or registered; completed tasks must not remain promotion-pending.',
      'Treat qdd register-artifact as an exception path; prefer candidate-driven promotion unless immediate registration is truly needed.',
      'Register reusable outputs in artifacts/index.yaml only through canonical artifact paths.',
      'Treat slow clustering, UMAP, integration, and large h5ad processing as normal long-running work unless there is explicit evidence of failure.',
      'Do not switch strategies just because a heavy command has been running for a few minutes without finishing.',
      'Treat explicit process exit, repeated hard errors, or sustained non-progress after extended inspection as stronger failure evidence than simple elapsed time.',
    ];

    if (hasPublicDataTask) {
      rules.push(`Treat ${getStudyPublicDataRequestPath(studyId)} as the only public-data handoff file for this task.`);
      rules.push('Do not reopen broad public-data search during apply; download only the selected targets already written during planning.');
    }

    appendRoleSkillIssues(rules, 'Task', roleSkillSet);

    if (taskSkillSet.disallowedWorkflow.length > 0) {
      rules.push(`Task skill lists must not include workflow skills: ${taskSkillSet.disallowedWorkflow.join(', ')}.`);
    }

    if (taskSkillSet.planningOnly.length > 0) {
      rules.push(`Task skill lists must not include planning-only brain skills: ${taskSkillSet.planningOnly.join(', ')}.`);
    }

    if (taskSkillSet.missing.length > 0) {
      rules.push(`Missing domain skills referenced by this task: ${taskSkillSet.missing.join(', ')}. qdd-apply must hard-block until the skill exists under the QDD root domain-skills/ library or the task is rewritten.`);
    }

    return {
      ...buildInstructionHeader(command, role),
      target: { kind: 'task', id },
      read: uniqueSortedValues([
        PATHS.contract,
        PATHS.evolution,
        PATHS.instructions,
        PATHS.layerPolicy,
        PATHS.artifactIndex,
        ...contextReadPaths,
        ...recentMemoryPaths,
        ...dataReadPaths,
        `${PATHS.studiesDir}/${studyId}/study.md`,
        `${PATHS.studiesDir}/${studyId}/tasks/${id}.md`,
        ...taskSkillSet.matchedPaths,
        ...roleSkillSet.matchedPaths,
      ]),
      write: uniqueSortedValues([
        `${PATHS.studiesDir}/${studyId}/tasks/${id}.md`,
        `${PATHS.studiesDir}/${studyId}/output/`,
        getStudyArtifactCandidatesPath(studyId),
        PATHS.artifactIndex,
      ]),
      required_skills: requiredSkillIds,
      optional_skills: [],
      rules,
    };
  }

  throw new Error(`Unsupported instructions target '${id}'. Expected PROJECT, STUDY-XXX, or TASK-XXX.`);
}
