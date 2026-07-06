import path from 'node:path';
import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from '../runtime/constants.js';
import { discoverStudies } from '../runtime/discovery.js';
import { getStudyArtifactCandidatesPath, getStudyOutputDir, getStudyPublicDataRequestPath } from '../runtime/evidence.js';
import { listStudyMemoryPaths, readEvolutionState } from '../runtime/evolution.js';
import { isQddProjectRoot } from '../runtime/paths.js';
import { readMarkdownDocument, readYamlFile } from '../runtime/store.js';
const FRONTMATTER_STUDY_ID_PATTERN = /^#\s*(STUDY-\d{3})\s+Memory\b/m;
const RENDER_TOOL_ORDER = ['latexmk', 'xelatex', 'pdflatex', 'pandoc'];
function buildPathStatus(options) {
    return {
        path: options.path,
        kind: options.kind,
        required: options.required,
        status: options.available ? 'available' : 'blocked',
        details: options.details,
        count: options.count,
    };
}
function extractStudyIdFromMemory(content) {
    const match = content.match(FRONTMATTER_STUDY_ID_PATTERN);
    return match ? match[1] : null;
}
async function readStudyMemories(projectRoot, memoryPaths) {
    return Promise.all(memoryPaths.map(async (relativePath) => {
        const content = await FileSystemUtils.readFile(path.join(projectRoot, relativePath));
        return {
            studyId: extractStudyIdFromMemory(content),
            relativePath,
            content,
        };
    }));
}
async function readStudyTasks(projectRoot, studyId) {
    const tasksDir = path.join(projectRoot, PATHS.studiesDir, studyId, 'tasks');
    if (!(await FileSystemUtils.directoryExists(tasksDir))) {
        return [];
    }
    const entries = await fs.readdir(tasksDir, { withFileTypes: true });
    const taskFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    return Promise.all(taskFiles.map(async (fileName) => {
        const taskId = fileName.replace(/\.md$/, '');
        const relativePath = `${PATHS.studiesDir}/${studyId}/tasks/${fileName}`;
        const document = await readMarkdownDocument(projectRoot, relativePath);
        return {
            taskId,
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
    }));
}
async function readStudySnapshots(projectRoot) {
    const discoveredStudies = await discoverStudies(projectRoot);
    const sortedStudies = [...discoveredStudies].sort((left, right) => left.study_id.localeCompare(right.study_id));
    return Promise.all(sortedStudies.map(async (study) => {
        const relativePath = `${PATHS.studiesDir}/${study.study_id}/study.md`;
        const document = await readMarkdownDocument(projectRoot, relativePath);
        const outputDir = getStudyOutputDir(study.study_id);
        const outputDirExists = await FileSystemUtils.directoryExists(path.join(projectRoot, outputDir));
        const artifactCandidatesPath = getStudyArtifactCandidatesPath(study.study_id);
        const publicDataRequestPath = getStudyPublicDataRequestPath(study.study_id);
        return {
            studyId: study.study_id,
            relativePath,
            record: {
                ...document.frontmatter,
                study_id: document.frontmatter.study_id ?? study.study_id,
                target_boundaries: document.frontmatter.target_boundaries ?? [],
                task_ids: document.frontmatter.task_ids ?? [],
                blockers: document.frontmatter.blockers ?? [],
                expected_artifacts: document.frontmatter.expected_artifacts ?? [],
            },
            body: document.body,
            tasks: await readStudyTasks(projectRoot, study.study_id),
            outputDir,
            outputDirExists,
            artifactCandidatesPath: (await FileSystemUtils.fileExists(path.join(projectRoot, artifactCandidatesPath))) ? artifactCandidatesPath : null,
            publicDataRequestPath: (await FileSystemUtils.fileExists(path.join(projectRoot, publicDataRequestPath))) ? publicDataRequestPath : null,
        };
    }));
}
function toolMissingStatus(name) {
    return {
        name,
        status: 'blocked',
        available: false,
        resolvedPath: null,
    };
}
async function detectExecutableWithShell(name, environment, shellPath) {
    return new Promise((resolve) => {
        const child = spawn(shellPath, ['-c', `command -v ${name}`], {
            env: environment,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let settled = false;
        child.stdout.on('data', (chunk) => {
            stdout += String(chunk);
        });
        child.on('error', () => {
            if (!settled) {
                settled = true;
                resolve(toolMissingStatus(name));
            }
        });
        child.on('close', (code) => {
            if (settled) {
                return;
            }
            settled = true;
            const resolvedPath = stdout.trim() || null;
            const available = code === 0 && Boolean(resolvedPath);
            resolve({
                name,
                status: available ? 'available' : 'blocked',
                available,
                resolvedPath,
            });
        });
    });
}
async function detectRenderTools(environment, shellPath) {
    const entries = await Promise.all(RENDER_TOOL_ORDER.map(async (toolName) => [toolName, await detectExecutableWithShell(toolName, environment, shellPath)]));
    return Object.fromEntries(entries);
}
function buildRenderTargetStatus(status, reasons, notes) {
    return {
        status,
        reasons,
        notes,
    };
}
function buildRenderStatus(tools) {
    const pdfReasons = [];
    const pdfNotes = [];
    if (!tools.xelatex.available && !tools.pdflatex.available) {
        pdfReasons.push('Neither xelatex nor pdflatex is installed.');
    }
    else if (tools.xelatex.available) {
        pdfNotes.push(`PDF rendering can use xelatex at ${tools.xelatex.resolvedPath}.`);
    }
    else if (tools.pdflatex.available) {
        pdfNotes.push(`PDF rendering can fall back to pdflatex at ${tools.pdflatex.resolvedPath}.`);
    }
    if (tools.latexmk.available) {
        pdfNotes.push(`latexmk is available at ${tools.latexmk.resolvedPath}.`);
    }
    else {
        pdfNotes.push('latexmk is not installed; conclude should render PDF via the available TeX engine directly.');
    }
    const wordReasons = tools.pandoc.available ? [] : ['pandoc is not installed.'];
    const wordNotes = tools.pandoc.available ? [`Word rendering can use pandoc at ${tools.pandoc.resolvedPath}.`] : [];
    const pdf = buildRenderTargetStatus(pdfReasons.length === 0 ? 'available' : 'blocked', pdfReasons, pdfNotes);
    const word = buildRenderTargetStatus(wordReasons.length === 0 ? 'available' : 'blocked', wordReasons, wordNotes);
    const overallReasons = [...pdfReasons, ...wordReasons];
    const overallNotes = [
        pdf.status === 'available' ? 'PDF rendering is available in the current environment.' : 'PDF rendering is blocked in the current environment.',
        word.status === 'available' ? 'Word rendering is available in the current environment.' : 'Word rendering is blocked in the current environment.',
    ];
    return {
        status: overallReasons.length === 0 ? 'available' : 'blocked',
        reasons: overallReasons,
        notes: overallNotes,
        pdf,
        word,
        tools,
    };
}
function renderPathSummary(status) {
    const countSuffix = typeof status.count === 'number' ? ` (${status.count})` : '';
    return `- ${status.path}: ${status.status.toUpperCase()}${countSuffix} - ${status.details}`;
}
export function renderConcludeRenderStatusMarkdown(result) {
    const render = result.render;
    return [
        '# Render Status',
        '',
        `- Overall status: ${render.status.toUpperCase()}`,
        `- Project preflight: ${result.projectStatus.toUpperCase()}`,
        '',
        '## QDD Preflight',
        '',
        renderPathSummary(result.checkedPaths.contract),
        renderPathSummary(result.checkedPaths.evolution),
        renderPathSummary(result.checkedPaths.resources),
        renderPathSummary(result.checkedPaths.memory),
        renderPathSummary(result.checkedPaths.artifactIndex),
        renderPathSummary(result.checkedPaths.studies),
        '',
        '## Rendering Targets',
        '',
        `- PDF: ${render.pdf.status.toUpperCase()}${render.pdf.reasons.length > 0 ? ` - ${render.pdf.reasons.join(' ')}` : ''}`,
        `- Word: ${render.word.status.toUpperCase()}${render.word.reasons.length > 0 ? ` - ${render.word.reasons.join(' ')}` : ''}`,
        '',
        '## Tool Detection',
        '',
        ...RENDER_TOOL_ORDER.map((toolName) => {
            const tool = render.tools[toolName];
            const suffix = tool.resolvedPath ? ` (${tool.resolvedPath})` : '';
            return `- ${tool.name}: ${tool.status.toUpperCase()}${suffix}`;
        }),
        '',
        ...(result.projectBlockers.length > 0
            ? [
                '## Blockers',
                '',
                ...result.projectBlockers.map((reason) => `- ${reason}`),
                '',
            ]
            : []),
        ...(result.warnings.length > 0
            ? [
                '## Warnings',
                '',
                ...result.warnings.map((warning) => `- ${warning}`),
                '',
            ]
            : []),
    ].join('\n');
}
export async function inspectConcludePreflight(projectRoot, options = {}) {
    const environment = options.environment ?? process.env;
    const shellPath = options.shellPath ?? 'bash';
    const projectIsQddRoot = await isQddProjectRoot(projectRoot);
    const projectBlockers = [];
    const warnings = [];
    const contractPath = path.join(projectRoot, PATHS.contract);
    const evolutionPath = path.join(projectRoot, PATHS.evolution);
    const resourcesPath = path.join(projectRoot, PATHS.contextResources);
    const memoryDir = path.join(projectRoot, PATHS.contextMemoryDir);
    const artifactIndexPath = path.join(projectRoot, PATHS.artifactIndex);
    const studiesDir = path.join(projectRoot, PATHS.studiesDir);
    const hasContract = await FileSystemUtils.fileExists(contractPath);
    const hasEvolution = await FileSystemUtils.fileExists(evolutionPath);
    const hasResources = await FileSystemUtils.fileExists(resourcesPath);
    const hasMemoryDir = await FileSystemUtils.directoryExists(memoryDir);
    const hasArtifactIndex = await FileSystemUtils.fileExists(artifactIndexPath);
    const hasStudiesDir = await FileSystemUtils.directoryExists(studiesDir);
    if (!hasContract) {
        projectBlockers.push(`Missing required conclude input '${PATHS.contract}'.`);
    }
    if (!hasEvolution) {
        projectBlockers.push(`Missing required conclude input '${PATHS.evolution}'.`);
    }
    if (!hasResources) {
        projectBlockers.push(`Missing required conclude input '${PATHS.contextResources}'.`);
    }
    if (!hasMemoryDir) {
        projectBlockers.push(`Missing required conclude directory '${PATHS.contextMemoryDir}'.`);
    }
    if (!hasArtifactIndex) {
        projectBlockers.push(`Missing required conclude input '${PATHS.artifactIndex}'.`);
    }
    if (!hasStudiesDir) {
        projectBlockers.push(`Missing required conclude directory '${PATHS.studiesDir}'.`);
    }
    if (!projectIsQddRoot) {
        warnings.push(`Current directory is missing standard QDD root markers such as '${PATHS.contract}' or '${PATHS.qddDir}'.`);
    }
    let contract = null;
    let evolution = null;
    let resourcesMarkdown = null;
    let artifactIndex = null;
    let studyMemories = [];
    let studies = [];
    try {
        if (hasContract) {
            contract = await readYamlFile(projectRoot, PATHS.contract);
        }
    }
    catch (error) {
        projectBlockers.push(`Failed to read '${PATHS.contract}': ${error.message}`);
    }
    try {
        if (hasEvolution) {
            evolution = await readEvolutionState(projectRoot);
        }
    }
    catch (error) {
        projectBlockers.push(`Failed to read '${PATHS.evolution}': ${error.message}`);
    }
    try {
        if (hasResources) {
            resourcesMarkdown = await FileSystemUtils.readFile(resourcesPath);
        }
    }
    catch (error) {
        projectBlockers.push(`Failed to read '${PATHS.contextResources}': ${error.message}`);
    }
    try {
        if (hasArtifactIndex) {
            artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
        }
    }
    catch (error) {
        projectBlockers.push(`Failed to read '${PATHS.artifactIndex}': ${error.message}`);
    }
    let memoryPaths = [];
    if (hasMemoryDir) {
        try {
            memoryPaths = await listStudyMemoryPaths(projectRoot);
            studyMemories = await readStudyMemories(projectRoot, memoryPaths);
        }
        catch (error) {
            projectBlockers.push(`Failed to read '${PATHS.contextMemoryDir}': ${error.message}`);
        }
    }
    if (hasMemoryDir && memoryPaths.length === 0) {
        warnings.push(`No study memory files were found under '${PATHS.contextMemoryDir}'.`);
    }
    if (hasStudiesDir) {
        try {
            studies = await readStudySnapshots(projectRoot);
        }
        catch (error) {
            projectBlockers.push(`Failed to read '${PATHS.studiesDir}': ${error.message}`);
        }
    }
    if (hasStudiesDir && studies.length === 0) {
        warnings.push(`No study records were found under '${PATHS.studiesDir}'.`);
    }
    for (const study of studies) {
        if (!study.outputDirExists) {
            warnings.push(`Study '${study.studyId}' is missing its output directory '${study.outputDir}'.`);
        }
    }
    const checkedPaths = {
        contract: buildPathStatus({
            path: PATHS.contract,
            kind: 'file',
            required: true,
            available: hasContract,
            details: hasContract ? 'Research contract is present.' : 'Research contract is missing.',
        }),
        evolution: buildPathStatus({
            path: PATHS.evolution,
            kind: 'file',
            required: true,
            available: hasEvolution,
            details: hasEvolution ? 'Evolution state is present.' : 'Evolution state is missing.',
        }),
        resources: buildPathStatus({
            path: PATHS.contextResources,
            kind: 'file',
            required: true,
            available: hasResources,
            details: hasResources ? 'Durable project resources are present.' : 'Durable project resources are missing.',
        }),
        memory: buildPathStatus({
            path: PATHS.contextMemoryDir,
            kind: 'collection',
            required: true,
            available: hasMemoryDir,
            details: hasMemoryDir ? 'Study memory directory is present.' : 'Study memory directory is missing.',
            count: studyMemories.length,
        }),
        artifactIndex: buildPathStatus({
            path: PATHS.artifactIndex,
            kind: 'file',
            required: true,
            available: hasArtifactIndex,
            details: hasArtifactIndex ? 'Artifact index is present.' : 'Artifact index is missing.',
        }),
        studies: buildPathStatus({
            path: PATHS.studiesDir,
            kind: 'collection',
            required: true,
            available: hasStudiesDir,
            details: hasStudiesDir ? 'Study directory is present.' : 'Study directory is missing.',
            count: studies.length,
        }),
    };
    const renderTools = await detectRenderTools(environment, shellPath);
    const render = buildRenderStatus(renderTools);
    return {
        projectRoot: path.resolve(projectRoot),
        qddProjectRoot: projectIsQddRoot,
        projectStatus: projectBlockers.length === 0 ? 'available' : 'blocked',
        projectBlockers,
        warnings,
        checkedPaths,
        snapshot: {
            contract,
            evolution,
            resourcesMarkdown,
            artifactIndex,
            studyMemories,
            studies,
        },
        render,
    };
}
//# sourceMappingURL=conclude.js.map