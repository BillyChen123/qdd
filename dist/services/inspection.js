import path from 'node:path';
import * as fs from 'node:fs/promises';
import { ARTIFACT_SCOPE_VALUES, ARTIFACT_TYPE_VALUES } from '../file-contracts/artifact-index.js';
import { QDD_MODE_VALUES, TERMINATION_TYPE_VALUES } from '../file-contracts/contract.js';
import { QUESTION_CHANGE_VALUES } from '../file-contracts/evolution.js';
import { listManagedFileReferencePaths } from '../file-contracts/index.js';
import { parseTaskSkillSection, TASK_PROMOTION_VALUES, TASK_STATUS_VALUES } from '../file-contracts/task.js';
import { STUDY_STATUS_VALUES } from '../file-contracts/study.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from '../runtime/constants.js';
import { discoverStudies, discoverTasks } from '../runtime/discovery.js';
import { getStudyArtifactCandidatesPath, inspectArtifactCandidatePaths, listNonCanonicalStudyOutputEntries } from '../runtime/evidence.js';
import { listStudyMemoryPaths, readEvolutionState } from '../runtime/evolution.js';
import { readLayerPolicy } from '../runtime/layer-policy.js';
import { listControlledSkillDomains, listControlledSkillStages, listControlledSkillTags, listLocalSkills, listProblemSkills, normalizeTaskSkillIds, resolveLocalSkills, } from '../runtime/local-skills.js';
import { readMarkdownDocument, readYamlFile } from '../runtime/store.js';
import { deriveStudyLifecycleState, inspectStudyClosePreflight } from './closure.js';
const TASK_ID_PATTERN = /^TASK-\d{3}$/;
const BOUNDARY_ID_PATTERN = /^B\d{3}$/;
function isContextFileName(fileName) {
    return fileName.endsWith('.yaml') || fileName.endsWith('.md');
}
function pushIssue(issues, issue) {
    issues.push(issue);
}
function hasOwnProperty(value, key) {
    return typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key);
}
function validateResearchContract(contract, issues) {
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
    if (!QDD_MODE_VALUES.includes(contract.mode)) {
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
    if (!TERMINATION_TYPE_VALUES.includes(contract.termination_type)) {
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
function validateArtifactIndex(artifactIndex, issues) {
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
        const artifactRecord = entry;
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
        if (!ARTIFACT_TYPE_VALUES.includes(entry.type)) {
            pushIssue(issues, {
                level: 'error',
                code: 'invalid_artifact_type',
                path: entryPath,
                message: `Artifact entry has invalid type '${String(entry.type)}'.`,
            });
        }
        if (!ARTIFACT_SCOPE_VALUES.includes(entry.scope)) {
            pushIssue(issues, {
                level: 'error',
                code: 'invalid_artifact_scope',
                path: entryPath,
                message: `Artifact entry has invalid scope '${String(entry.scope)}'.`,
            });
        }
    }
}
function validateStudyRecord(study, issues) {
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
    if (study.status && !STUDY_STATUS_VALUES.includes(study.status)) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_study_status',
            path: studyPath,
            message: `study.md has invalid status '${String(study.status)}'.`,
        });
    }
}
function validateStudyTargetBoundaries(study, knownBoundaryIds, issues) {
    const studyPath = `${PATHS.studiesDir}/${study.study_id}/study.md`;
    if (study.target_boundaries !== undefined && !Array.isArray(study.target_boundaries)) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_target_boundaries',
            path: studyPath,
            message: 'study.md must store target_boundaries as an array when provided.',
        });
        return;
    }
    const targetBoundaries = Array.isArray(study.target_boundaries) ? study.target_boundaries : [];
    const seen = new Set();
    for (const boundaryId of targetBoundaries) {
        if (!BOUNDARY_ID_PATTERN.test(String(boundaryId ?? '').trim())) {
            pushIssue(issues, {
                level: 'error',
                code: 'invalid_target_boundary_id',
                path: studyPath,
                message: `Study target_boundaries contains invalid id '${String(boundaryId ?? '')}'. Expected BXXX.`,
            });
            continue;
        }
        if (seen.has(boundaryId)) {
            pushIssue(issues, {
                level: 'warning',
                code: 'duplicate_target_boundary_id',
                path: studyPath,
                message: `Study target_boundaries repeats '${boundaryId}'.`,
            });
            continue;
        }
        seen.add(boundaryId);
        if (!knownBoundaryIds.has(boundaryId)) {
            pushIssue(issues, {
                level: 'warning',
                code: 'unknown_target_boundary',
                path: studyPath,
                message: `Study target_boundaries references unknown project boundary '${boundaryId}'.`,
            });
        }
    }
}
function validateTaskRecord(task, issues) {
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
    if (task.status && !TASK_STATUS_VALUES.includes(task.status)) {
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
    if (task.promotion_status && !TASK_PROMOTION_VALUES.includes(task.promotion_status)) {
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
function validateTaskSkillSection(relativePath, task, body, issues) {
    const normalizedFrontmatterSkills = normalizeTaskSkillIds(task.skills ?? []);
    const parsedSection = parseTaskSkillSection(body);
    if (!parsedSection.present) {
        pushIssue(issues, {
            level: 'error',
            code: 'missing_task_skills_section',
            path: relativePath,
            message: 'Task markdown body must include a ## Skills section.',
        });
        return;
    }
    if (parsedSection.skillIds === null) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_task_skill_section_entry',
            path: relativePath,
            message: 'Each ## Skills bullet must start with one skill ID. Optional descriptions may follow after ":" or " - ".',
        });
        return;
    }
    const normalizedBodySkills = normalizeTaskSkillIds(parsedSection.skillIds);
    if (JSON.stringify(normalizedFrontmatterSkills) !== JSON.stringify(normalizedBodySkills)) {
        pushIssue(issues, {
            level: 'error',
            code: 'task_skill_section_mismatch',
            path: relativePath,
            message: 'Task frontmatter skills and ## Skills section must stay identical after normalization.',
        });
    }
}
function validateArtifactCandidateManifest(studyId, manifest, issues) {
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
        const candidateRecord = entry;
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
        if (hasOwnProperty(entry, 'type') && !ARTIFACT_TYPE_VALUES.includes(String(candidateRecord.type ?? ''))) {
            pushIssue(issues, {
                level: 'error',
                code: 'invalid_artifact_candidate_type',
                path: entryPath,
                message: `Artifact candidate entry has invalid type '${String(candidateRecord.type ?? '')}'.`,
            });
        }
        if (hasOwnProperty(entry, 'scope') && candidateRecord.scope !== undefined && !ARTIFACT_SCOPE_VALUES.includes(String(candidateRecord.scope ?? ''))) {
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
    }
}
async function validateMarkdownStructure(projectRoot, relativePath, issues) {
    try {
        await readMarkdownDocument(projectRoot, relativePath);
    }
    catch (error) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_markdown_frontmatter',
            path: relativePath,
            message: error.message,
        });
    }
}
async function collectContextPaths(projectRoot, relativeDir = PATHS.contextDir) {
    const absoluteDir = path.join(projectRoot, relativeDir);
    if (!(await FileSystemUtils.directoryExists(absoluteDir))) {
        return [];
    }
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        const relativePath = `${relativeDir}/${entry.name}`;
        if (entry.isDirectory()) {
            results.push(...(await collectContextPaths(projectRoot, relativePath)));
            continue;
        }
        if (entry.isFile() && isContextFileName(entry.name)) {
            results.push(relativePath);
        }
    }
    return results.sort((left, right) => left.localeCompare(right));
}
async function listSharedDataPaths(projectRoot) {
    const dataDir = path.join(projectRoot, PATHS.artifactDataDir);
    if (!(await FileSystemUtils.directoryExists(dataDir))) {
        return [];
    }
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    return entries.map((entry) => `${PATHS.artifactDataDir}/${entry.name}`).sort();
}
export async function listArtifacts(projectRoot) {
    const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    return {
        artifacts: artifactIndex.artifacts,
    };
}
export async function listContext(projectRoot) {
    const contextPaths = await collectContextPaths(projectRoot);
    const contextEntries = [];
    for (const relativePath of contextPaths) {
        const data = relativePath.endsWith('.md')
            ? await FileSystemUtils.readFile(path.join(projectRoot, relativePath))
            : await readYamlFile(projectRoot, relativePath);
        contextEntries.push({
            path: relativePath,
            name: path.basename(relativePath),
            data,
        });
    }
    return { context: contextEntries };
}
export async function validateProject(projectRoot) {
    const issues = [];
    let knownBoundaryIds = new Set();
    const checked = {
        contract: false,
        evolution: false,
        artifactIndex: false,
        layerPolicy: false,
        contextFiles: [],
        studies: [],
        tasks: [],
    };
    try {
        const contract = await readYamlFile(projectRoot, PATHS.contract);
        checked.contract = true;
        validateResearchContract(contract, issues);
    }
    catch (error) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_contract_yaml',
            path: PATHS.contract,
            message: error.message,
        });
    }
    try {
        const evolution = await readEvolutionState(projectRoot);
        checked.evolution = true;
        knownBoundaryIds = new Set(evolution.boundaries.map((boundary) => boundary.id));
        for (const [index, study] of evolution.studies.entries()) {
            if (!study.id || !study.question || !study.ts || !QUESTION_CHANGE_VALUES.includes(study.kind)) {
                pushIssue(issues, {
                    level: 'error',
                    code: 'invalid_evolution_study_entry',
                    path: `${PATHS.evolution}#studies.${index}`,
                    message: 'Each evolution study entry must include id, question, kind, and ts.',
                });
            }
        }
    }
    catch (error) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_evolution_yaml',
            path: PATHS.evolution,
            message: error.message,
        });
    }
    try {
        const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
        checked.artifactIndex = true;
        validateArtifactIndex(artifactIndex, issues);
    }
    catch (error) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_artifact_index_yaml',
            path: PATHS.artifactIndex,
            message: error.message,
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
                    message: `Role policy for '${roleName}' references workflow skill '${workflowSkillId}'.`,
                });
            }
            if (roleName !== 'study-brain') {
                for (const planningSkillId of defaultSkills.planningOnly) {
                    pushIssue(issues, {
                        level: 'error',
                        code: 'planning_skill_not_allowed_in_role_policy',
                        path: PATHS.layerPolicy,
                        message: `Role policy for '${roleName}' references planning-only brain skill '${planningSkillId}'.`,
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
    }
    catch (error) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_layer_policy_yaml',
            path: PATHS.layerPolicy,
            message: error.message,
        });
    }
    const contextPaths = await collectContextPaths(projectRoot);
    checked.contextFiles = contextPaths;
    for (const relativePath of listManagedFileReferencePaths()) {
        if (!(await FileSystemUtils.fileExists(path.join(projectRoot, relativePath)))) {
            pushIssue(issues, {
                level: 'warning',
                code: 'missing_managed_file_reference',
                path: relativePath,
                message: 'Managed-file schema/example reference is missing. Re-run qdd init to refresh project-local references.',
            });
        }
    }
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
            }
            else {
                await readYamlFile(projectRoot, relativePath);
            }
        }
        catch (error) {
            pushIssue(issues, {
                level: 'error',
                code: relativePath.endsWith('.md') ? 'invalid_context_markdown' : 'invalid_context_yaml',
                path: relativePath,
                message: error.message,
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
        const skillDocument = await readMarkdownDocument(projectRoot, skill.path);
        const domain = typeof skillDocument.frontmatter.domain === 'string' ? skillDocument.frontmatter.domain.trim().toLowerCase() : '';
        const stage = typeof skillDocument.frontmatter.stage === 'string' ? skillDocument.frontmatter.stage.trim().toLowerCase() : '';
        const tags = Array.isArray(skillDocument.frontmatter.tags) ? skillDocument.frontmatter.tags.map((entry) => String(entry).trim().toLowerCase()) : [];
        if (!controlledDomains.has(domain) || !controlledStages.has(stage) || tags.length === 0 || tags.some((entry) => !controlledTags.has(entry))) {
            pushIssue(issues, {
                level: 'error',
                code: 'invalid_problem_skill_metadata',
                path: skill.path,
                message: `Executor-facing skill '${skill.id}' must declare controlled frontmatter fields domain/stage/tags.`,
            });
        }
    }
    const artifactIndex = checked.artifactIndex ? await readYamlFile(projectRoot, PATHS.artifactIndex) : { artifacts: [] };
    const registeredArtifactPaths = new Set(artifactIndex.artifacts.map((entry) => entry.path));
    const dataPaths = await listSharedDataPaths(projectRoot);
    for (const relativePath of dataPaths) {
        const absolutePath = path.join(projectRoot, relativePath);
        try {
            const stats = await fs.lstat(absolutePath);
            if (stats.isSymbolicLink()) {
                try {
                    await fs.stat(absolutePath);
                }
                catch {
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
                    message: 'Shared data entry is not a symlink and is not registered as an artifact.',
                });
            }
        }
        catch (error) {
            pushIssue(issues, {
                level: 'error',
                code: 'invalid_data_entry',
                path: relativePath,
                message: error.message,
            });
        }
    }
    const studiesDir = path.join(projectRoot, PATHS.studiesDir);
    if (await FileSystemUtils.directoryExists(studiesDir)) {
        const studyEntries = await fs.readdir(studiesDir, { withFileTypes: true });
        for (const studyEntry of studyEntries) {
            if (studyEntry.isDirectory()) {
                await validateMarkdownStructure(projectRoot, `${PATHS.studiesDir}/${studyEntry.name}/study.md`, issues);
            }
        }
    }
    const studies = await discoverStudies(projectRoot);
    const tasks = await discoverTasks(projectRoot);
    checked.studies = studies.map((study) => study.study_id);
    checked.tasks = tasks.map((task) => task.task_id);
    for (const study of studies) {
        validateStudyRecord(study, issues);
        validateStudyTargetBoundaries(study, knownBoundaryIds, issues);
    }
    for (const task of tasks) {
        validateTaskRecord(task, issues);
        const taskRelativePath = `${PATHS.studiesDir}/${task.study_id}/tasks/${task.task_id}.md`;
        await validateMarkdownStructure(projectRoot, taskRelativePath, issues);
        const taskDocument = await readMarkdownDocument(projectRoot, taskRelativePath);
        validateTaskSkillSection(taskRelativePath, taskDocument.frontmatter, taskDocument.body, issues);
        const resolvedSkills = await resolveLocalSkills(projectRoot, task.skills ?? []);
        for (const workflowSkillId of resolvedSkills.disallowedWorkflow) {
            pushIssue(issues, {
                level: 'error',
                code: 'workflow_skill_not_allowed_in_task',
                path: taskRelativePath,
                message: `Task references workflow skill '${workflowSkillId}'.`,
            });
        }
        for (const planningSkillId of resolvedSkills.planningOnly) {
            pushIssue(issues, {
                level: 'error',
                code: 'planning_skill_not_allowed_in_task',
                path: taskRelativePath,
                message: `Task references planning-only brain skill '${planningSkillId}'.`,
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
            const manifest = await readYamlFile(projectRoot, manifestPath);
            validateArtifactCandidateManifest(study.study_id, manifest, issues);
            const pathIssues = await inspectArtifactCandidatePaths(projectRoot, study.study_id);
            for (const issue of pathIssues) {
                pushIssue(issues, {
                    level: 'error',
                    code: 'invalid_artifact_candidate_path',
                    path: `${manifestPath}#${issue.index >= 0 ? issue.index : 'manifest'}`,
                    message: `Artifact candidate path '${issue.path || '(missing)'}' ${issue.reason}`,
                });
            }
        }
        catch (error) {
            pushIssue(issues, {
                level: 'error',
                code: 'invalid_artifact_candidates_yaml',
                path: manifestPath,
                message: error.message,
            });
        }
    }
    const memoryPaths = await listStudyMemoryPaths(projectRoot);
    const memorySet = new Set(memoryPaths);
    for (const study of studies) {
        const studyTasks = tasks.filter((task) => task.study_id === study.study_id || (study.task_ids ?? []).includes(task.task_id));
        const inferredState = deriveStudyLifecycleState(study, studyTasks);
        const unpackagedEntries = await listNonCanonicalStudyOutputEntries(projectRoot, study.study_id);
        const closePreflight = await inspectStudyClosePreflight(projectRoot, study.study_id);
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
        if (study.status === 'closed') {
            const expectedMemoryPath = `${PATHS.contextMemoryDir}/${study.study_id}.md`;
            if (!memorySet.has(expectedMemoryPath)) {
                pushIssue(issues, {
                    level: 'error',
                    code: 'missing_study_memory',
                    path: expectedMemoryPath,
                    message: `Closed study '${study.study_id}' must have a matching memory file under context/memory/.`,
                });
            }
        }
        if (study.status !== 'closed' && closePreflight.ready === false && inferredState === 'completed') {
            for (const reason of closePreflight.reasons) {
                pushIssue(issues, {
                    level: 'warning',
                    code: 'close_preflight_blocked',
                    path: `${PATHS.studiesDir}/${study.study_id}/study.md`,
                    message: `Study '${study.study_id}' is completed but not close-ready: ${reason}`,
                });
            }
        }
    }
    const researchMapPath = path.join(projectRoot, PATHS.researchMapHtml);
    if (!(await FileSystemUtils.fileExists(researchMapPath))) {
        pushIssue(issues, {
            level: 'warning',
            code: 'missing_research_map',
            path: PATHS.researchMapHtml,
            message: 'research-map.html is missing. Re-render the derived project map.',
        });
    }
    return {
        valid: !issues.some((issue) => issue.level === 'error'),
        issues,
        checked,
    };
}
//# sourceMappingURL=inspection.js.map