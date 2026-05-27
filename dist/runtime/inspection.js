import path from 'node:path';
import * as fs from 'node:fs/promises';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { discoverStudies, discoverTasks } from './discovery.js';
import { getStudyArtifactCandidatesPath } from './evidence.js';
import { deriveStudyLifecycleState } from './lifecycle.js';
import { readMarkdownDocument, readYamlFile } from './store.js';
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
}
function validateEvolutionTrail(evolution, issues) {
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
    if (study.status && !['created', 'confirmed', 'running', 'blocked', 'completed', 'closed'].includes(study.status)) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_study_status',
            path: studyPath,
            message: `study.md has invalid status '${String(study.status)}'.`,
        });
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
    if (task.status && !['pending', 'running', 'blocked', 'completed'].includes(task.status)) {
        pushIssue(issues, {
            level: 'error',
            code: 'invalid_task_status',
            path: taskPath,
            message: `Task file has invalid status '${String(task.status)}'.`,
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
export async function listArtifacts(projectRoot) {
    const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    return {
        artifacts: artifactIndex.artifacts,
    };
}
export async function listContext(projectRoot) {
    const contextDir = path.join(projectRoot, PATHS.contextDir);
    if (!(await FileSystemUtils.directoryExists(contextDir))) {
        return { context: [] };
    }
    const entries = await fs.readdir(contextDir, { withFileTypes: true });
    const contextEntries = [];
    for (const entry of entries) {
        if (!entry.isFile() || !isContextFileName(entry.name)) {
            continue;
        }
        const relativePath = `${PATHS.contextDir}/${entry.name}`;
        const data = entry.name.endsWith('.md') ? await FileSystemUtils.readFile(path.join(projectRoot, relativePath)) : await readYamlFile(projectRoot, relativePath);
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
async function listContextPaths(projectRoot) {
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
export async function validateProject(projectRoot) {
    const issues = [];
    const checked = {
        contract: false,
        evolution: false,
        artifactIndex: false,
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
        const evolution = await readYamlFile(projectRoot, PATHS.evolution);
        checked.evolution = true;
        validateEvolutionTrail(evolution, issues);
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
    const contextPaths = await listContextPaths(projectRoot);
    checked.contextFiles = contextPaths;
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
                const data = await readYamlFile(projectRoot, relativePath);
                if (data === null || data === undefined) {
                    pushIssue(issues, {
                        level: 'warning',
                        code: 'empty_context_file',
                        path: relativePath,
                        message: 'Context file parsed successfully but is empty.',
                    });
                }
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
        await validateMarkdownStructure(projectRoot, `${PATHS.studiesDir}/${task.study_id}/tasks/${task.task_id}.md`, issues);
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
    for (const study of studies) {
        const studyTasks = tasks.filter((task) => task.study_id === study.study_id || (study.task_ids ?? []).includes(task.task_id));
        const inferredState = deriveStudyLifecycleState(study, studyTasks);
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
    }
    return {
        valid: !issues.some((issue) => issue.level === 'error'),
        issues,
        checked,
    };
}
//# sourceMappingURL=inspection.js.map