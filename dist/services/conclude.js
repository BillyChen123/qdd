import path from 'node:path';
import * as fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { CONCLUDE_EVIDENCE_KIND_VALUES, CONCLUDE_EVIDENCE_SIGNAL_VALUES, CONCLUDE_RENDERING_TOOL_VALUES, } from '../types.js';
import { extractBulletSection } from '../file-contracts/shared.js';
import { PATHS } from '../runtime/constants.js';
import { discoverStudies, discoverTasks } from '../runtime/discovery.js';
import { getStudyOutputDir, inspectArtifactCandidatePaths, listNonCanonicalStudyOutputEntries, readArtifactCandidateManifest, } from '../runtime/evidence.js';
import { listStudyMemoryPaths, readEvolutionState } from '../runtime/evolution.js';
import { readMarkdownDocument, readYamlFile } from '../runtime/store.js';
import { FileSystemUtils } from '../utils/file-system.js';
const STUDY_MEMORY_FILE_PATTERN = /^(STUDY-\d{3})\.md$/;
const SIGNAL_ORDER = {
    positive: 0,
    negative: 1,
    blocked: 2,
    downgraded: 3,
    dissolved: 4,
    boundary: 5,
};
const STUDY_OUTPUT_CATEGORY_BY_SUBDIR = {
    data: 'data',
    code: 'code',
    figures: 'figure',
    tables: 'table',
    reports: 'report',
};
function normalizeRelativePath(relativePath) {
    return relativePath.split(path.sep).join('/');
}
function normalizePathKey(value) {
    return normalizeRelativePath(value).toLowerCase();
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function extractMarkdownSectionText(body, heading) {
    const pattern = new RegExp(`## ${escapeRegExp(heading)}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
    const match = body.match(pattern);
    return match ? match[1].trim() || null : null;
}
function parseStudyMemory(relativePath, body) {
    const fileName = path.posix.basename(relativePath);
    const studyId = fileName.replace(/\.md$/, '');
    const outcomeBullets = extractBulletSection(body, 'Outcome') ?? [];
    const outcomeKindLine = outcomeBullets.find((line) => /^Kind:/i.test(line)) ?? null;
    return {
        studyId,
        relativePath,
        question: extractMarkdownSectionText(body, 'Question'),
        outcomeKind: outcomeKindLine ? outcomeKindLine.replace(/^Kind:/i, '').trim() : null,
        summary: extractMarkdownSectionText(body, 'Study Summary'),
        resolvedBoundaries: extractBulletSection(body, 'Resolved Boundaries') ?? [],
        openBoundaries: extractBulletSection(body, 'Open Boundaries') ?? [],
    };
}
function parseProducedBy(producedBy) {
    const [studyId, taskId] = producedBy.split('/');
    return {
        studyId: studyId && /^STUDY-\d{3}$/.test(studyId) ? studyId : null,
        taskId: taskId && /^TASK-\d{3}$/.test(taskId) ? taskId : null,
    };
}
function isContextFileName(fileName) {
    return fileName.endsWith('.md') || fileName.endsWith('.yaml') || fileName.endsWith('.yml');
}
function buildDefaultRunId(now = new Date()) {
    return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function buildStudyOutputPath(studyId, subdir) {
    return `${getStudyOutputDir(studyId)}/${subdir}`;
}
async function listFilesRecursively(projectRoot, relativeDir) {
    const absoluteDir = path.join(projectRoot, relativeDir);
    if (!(await FileSystemUtils.directoryExists(absoluteDir))) {
        return [];
    }
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        const relativePath = normalizeRelativePath(`${relativeDir}/${entry.name}`);
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
async function collectReusableContextPaths(projectRoot, relativeDir = PATHS.contextDir) {
    const absoluteDir = path.join(projectRoot, relativeDir);
    if (!(await FileSystemUtils.directoryExists(absoluteDir))) {
        return [];
    }
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        const relativePath = normalizeRelativePath(`${relativeDir}/${entry.name}`);
        if (entry.isDirectory()) {
            if (relativePath === PATHS.contextMemoryDir) {
                continue;
            }
            results.push(...(await collectReusableContextPaths(projectRoot, relativePath)));
            continue;
        }
        if (entry.isFile() && isContextFileName(entry.name)) {
            results.push(relativePath);
        }
    }
    return results.sort((left, right) => left.localeCompare(right));
}
async function resolveExecutableOnPath(binary) {
    const pathValue = process.env.PATH ?? '';
    const extensions = process.platform === 'win32'
        ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter((value) => value.length > 0)]
        : [''];
    for (const directory of pathValue.split(path.delimiter).filter((value) => value.length > 0)) {
        for (const extension of extensions) {
            const candidate = path.join(directory, extension ? `${binary}${extension}` : binary);
            try {
                await fs.access(candidate, fsConstants.X_OK);
                return {
                    tool: binary,
                    available: true,
                    resolved_path: normalizeRelativePath(candidate),
                };
            }
            catch {
                continue;
            }
        }
    }
    return {
        tool: binary,
        available: false,
        resolved_path: null,
    };
}
async function buildPreflight(projectRoot, studies) {
    const memoryPaths = await listStudyMemoryPaths(projectRoot);
    const memoryByStudyId = new Map(memoryPaths
        .map((relativePath) => {
        const match = path.posix.basename(relativePath).match(STUDY_MEMORY_FILE_PATTERN);
        return match ? [match[1], relativePath] : null;
    })
        .filter((entry) => entry !== null));
    const reusableContextPaths = await collectReusableContextPaths(projectRoot);
    const studyChecks = [];
    const warnings = [];
    for (const study of [...studies].sort((left, right) => left.study_id.localeCompare(right.study_id))) {
        const unpackagedEntries = await listNonCanonicalStudyOutputEntries(projectRoot, study.study_id);
        const invalidCandidatePaths = (await inspectArtifactCandidatePaths(projectRoot, study.study_id)).map((issue) => `${issue.path || `#${issue.index}`}: ${issue.reason}`);
        const memoryPath = memoryByStudyId.get(study.study_id) ?? null;
        if ((study.status === 'closed' || study.status === 'completed') && !memoryPath) {
            warnings.push(`Closed/completed study '${study.study_id}' is missing context/memory/${study.study_id}.md.`);
        }
        if (unpackagedEntries.length > 0) {
            warnings.push(`Study '${study.study_id}' still has unpackaged outputs: ${unpackagedEntries.join(', ')}.`);
        }
        if (invalidCandidatePaths.length > 0) {
            warnings.push(`Study '${study.study_id}' has invalid artifact candidates: ${invalidCandidatePaths.join('; ')}.`);
        }
        studyChecks.push({
            study_id: study.study_id,
            study_path: `${PATHS.studiesDir}/${study.study_id}/study.md`,
            status: study.status ?? 'created',
            memory_path: memoryPath,
            unpackaged_entries: unpackagedEntries,
            invalid_candidate_paths: invalidCandidatePaths,
        });
    }
    return {
        contract_path: PATHS.contract,
        evolution_path: PATHS.evolution,
        resources_path: PATHS.contextResources,
        artifact_index_path: PATHS.artifactIndex,
        study_paths: studyChecks.map((entry) => entry.study_path),
        memory_paths: memoryPaths,
        reusable_context_paths: reusableContextPaths,
        rendering_tools: await Promise.all(CONCLUDE_RENDERING_TOOL_VALUES.map((tool) => resolveExecutableOnPath(tool))),
        study_checks: studyChecks,
        warnings: warnings.sort((left, right) => left.localeCompare(right)),
    };
}
function detectSignalsInText(text) {
    const normalized = text.trim().toLowerCase();
    if (!normalized) {
        return [];
    }
    const detected = new Set();
    const patterns = [
        ['blocked', [/\bblocked?\b/, /\bblocker\b/, /\bmissing\b/, /\bcould not\b/, /\bunable to\b/, /\bpending\b/]],
        ['dissolved', [/\bdissolv/, /\bruled out\b/, /\babandon(?:ed)?\b/]],
        ['downgraded', [/\bdowngrad/, /\bassociation only\b/, /\bassociative\b/, /\bbounded hypothesis\b/, /\bcandidate state\b/, /\bnot mechanistic\b/]],
        ['negative', [/\bnegative evidence\b/, /\bfailed\b/, /\bfailure\b/, /\bno evidence\b/, /\bdid not support\b/, /\bnot support\b/, /\bdid not detect\b/, /\bnull result\b/, /\binconsistent\b/]],
        ['positive', [/\bsupported?\b/, /\bresolved?\b/, /\breproducible\b/, /\bpromot/, /\bconfirm/, /\bnarrowed?\b/, /\bconsistent\b/, /\bvalidated?\b/]],
    ];
    for (const [signal, signalPatterns] of patterns) {
        if (signalPatterns.some((pattern) => pattern.test(normalized))) {
            detected.add(signal);
        }
    }
    return [...detected].sort((left, right) => SIGNAL_ORDER[left] - SIGNAL_ORDER[right]);
}
function pushClue(target, clue) {
    if (!clue || !clue.text.trim()) {
        return;
    }
    target.push({
        ...clue,
        text: clue.text.trim(),
    });
}
function pushTextSignals(target, text, options) {
    if (!text?.trim()) {
        return;
    }
    for (const signal of detectSignalsInText(text)) {
        pushClue(target, {
            ...options,
            signal,
            text,
        });
    }
}
function createInitialKindCounts() {
    return {
        'promoted-artifact': 0,
        'study-output': 0,
        'study-memory': 0,
        'reusable-context': 0,
    };
}
function createInitialSignalCounts() {
    return {
        positive: 0,
        negative: 0,
        blocked: 0,
        downgraded: 0,
        dissolved: 0,
        boundary: 0,
    };
}
function summarizeEvidence(items, clues) {
    const itemsByKind = createInitialKindCounts();
    const cluesBySignal = createInitialSignalCounts();
    for (const item of items) {
        itemsByKind[item.kind] += 1;
    }
    for (const clue of clues) {
        cluesBySignal[clue.signal] += 1;
    }
    return {
        evidence_item_count: items.length,
        clue_count: clues.length,
        items_by_kind: itemsByKind,
        clues_by_signal: cluesBySignal,
    };
}
function dedupeEvidenceItems(items) {
    const seen = new Map();
    for (const item of items) {
        const key = [
            item.kind,
            item.relative_path ?? '',
            item.source_path,
            item.provenance,
            item.study_id ?? '',
            item.task_id ?? '',
            item.promoted_artifact_id ?? '',
            item.description,
        ].join('|');
        if (!seen.has(key)) {
            seen.set(key, item);
        }
    }
    return [...seen.values()]
        .sort((left, right) => {
        const leftPath = left.relative_path ?? left.source_path;
        const rightPath = right.relative_path ?? right.source_path;
        return (left.kind.localeCompare(right.kind)
            || left.category.localeCompare(right.category)
            || leftPath.localeCompare(rightPath)
            || left.title.localeCompare(right.title));
    })
        .map((item, index) => ({
        id: `EVI-${String(index + 1).padStart(3, '0')}`,
        ...item,
    }));
}
function dedupeEvidenceClues(clues) {
    const seen = new Map();
    for (const clue of clues) {
        const key = [clue.signal, clue.source_path, clue.provenance, clue.study_id ?? '', clue.task_id ?? '', clue.text].join('|');
        if (!seen.has(key)) {
            seen.set(key, clue);
        }
    }
    return [...seen.values()]
        .sort((left, right) => {
        return ((left.study_id ?? '').localeCompare(right.study_id ?? '')
            || SIGNAL_ORDER[left.signal] - SIGNAL_ORDER[right.signal]
            || left.source_path.localeCompare(right.source_path)
            || left.text.localeCompare(right.text));
    })
        .map((clue, index) => ({
        id: `CLUE-${String(index + 1).padStart(3, '0')}`,
        ...clue,
    }));
}
async function resolveSymlinkArtifactPath(projectRoot, relativePath) {
    const absolutePath = path.join(projectRoot, relativePath);
    try {
        const stats = await fs.lstat(absolutePath);
        if (!stats.isSymbolicLink()) {
            return null;
        }
        const linkTarget = await fs.readlink(absolutePath);
        const absoluteTarget = path.resolve(path.dirname(absolutePath), linkTarget);
        const normalized = path.relative(projectRoot, absoluteTarget);
        if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
            return null;
        }
        return normalizeRelativePath(normalized);
    }
    catch {
        return null;
    }
}
function buildArtifactEvidenceItem(entry) {
    const provenance = parseProducedBy(entry.produced_by);
    return {
        kind: 'promoted-artifact',
        category: entry.type,
        title: `${entry.id} ${entry.type}`,
        relative_path: entry.path,
        source_path: PATHS.artifactIndex,
        provenance: entry.produced_by,
        study_id: provenance.studyId,
        task_id: provenance.taskId,
        description: entry.description,
        promoted_artifact_id: entry.id,
    };
}
async function buildStudyOutputEvidenceItems(projectRoot, studyId, candidateByPath, artifactByPath) {
    const items = [];
    for (const [subdir, category] of Object.entries(STUDY_OUTPUT_CATEGORY_BY_SUBDIR)) {
        const outputPaths = await listFilesRecursively(projectRoot, buildStudyOutputPath(studyId, subdir));
        for (const relativePath of outputPaths) {
            const candidate = candidateByPath.get(normalizePathKey(relativePath));
            const linkedArtifactPath = await resolveSymlinkArtifactPath(projectRoot, relativePath);
            const linkedArtifact = linkedArtifactPath ? artifactByPath.get(normalizePathKey(linkedArtifactPath)) ?? null : null;
            const producedBy = candidate?.task_id ? `${studyId}/${candidate.task_id}` : studyId;
            items.push({
                kind: 'study-output',
                category,
                title: path.posix.basename(relativePath),
                relative_path: relativePath,
                source_path: `${PATHS.studiesDir}/${studyId}/study.md`,
                provenance: producedBy,
                study_id: studyId,
                task_id: candidate?.task_id ?? null,
                description: candidate?.description ?? `${subdir} evidence captured under ${getStudyOutputDir(studyId)}.`,
                promoted_artifact_id: linkedArtifact?.id ?? null,
            });
        }
    }
    return items;
}
async function collectEvidence(projectRoot, preflight) {
    const artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
    const studies = await discoverStudies(projectRoot);
    const tasks = await discoverTasks(projectRoot);
    const evolution = await readEvolutionState(projectRoot);
    const taskPathById = new Map();
    const artifactByPath = new Map(artifactIndex.artifacts.map((entry) => [normalizePathKey(entry.path), entry]));
    const boundaryById = new Map(evolution.boundaries.map((boundary) => [boundary.id, boundary.text]));
    const studyEventById = new Map(evolution.studies.map((event) => [event.id, event]));
    const rawItems = [];
    const rawClues = [];
    for (const task of tasks) {
        taskPathById.set(task.task_id, `${PATHS.studiesDir}/${task.study_id}/tasks/${task.task_id}.md`);
    }
    for (const contextPath of preflight.reusable_context_paths) {
        rawItems.push({
            kind: 'reusable-context',
            category: 'context',
            title: path.posix.basename(contextPath),
            relative_path: contextPath,
            source_path: contextPath,
            provenance: contextPath,
            study_id: null,
            task_id: null,
            description: contextPath === PATHS.contextResources ? 'Reusable project context and resource memory.' : 'Reusable context sidecar.',
            promoted_artifact_id: null,
        });
    }
    for (const entry of artifactIndex.artifacts) {
        rawItems.push(buildArtifactEvidenceItem(entry));
        const provenance = parseProducedBy(entry.produced_by);
        pushClue(rawClues, {
            signal: 'positive',
            text: `Promoted reusable artifact preserved: ${entry.id} -> ${entry.path}`,
            source_path: PATHS.artifactIndex,
            provenance: entry.produced_by,
            study_id: provenance.studyId,
            task_id: provenance.taskId,
        });
    }
    for (const memoryPath of preflight.memory_paths) {
        const body = await FileSystemUtils.readFile(path.join(projectRoot, memoryPath));
        const parsed = parseStudyMemory(memoryPath, body);
        rawItems.push({
            kind: 'study-memory',
            category: 'memory',
            title: `${parsed.studyId} memory`,
            relative_path: memoryPath,
            source_path: memoryPath,
            provenance: parsed.studyId,
            study_id: parsed.studyId,
            task_id: null,
            description: parsed.summary ?? parsed.question ?? 'Narrative study memory.',
            promoted_artifact_id: null,
        });
        if (parsed.outcomeKind === 'dissolution') {
            pushClue(rawClues, {
                signal: 'dissolved',
                text: `Memory outcome kind is dissolution for ${parsed.studyId}.`,
                source_path: memoryPath,
                provenance: parsed.studyId,
                study_id: parsed.studyId,
                task_id: null,
            });
        }
        for (const boundaryText of parsed.resolvedBoundaries.filter((value) => value !== 'None')) {
            pushClue(rawClues, {
                signal: 'positive',
                text: `Resolved boundary carried in memory: ${boundaryText}`,
                source_path: memoryPath,
                provenance: parsed.studyId,
                study_id: parsed.studyId,
                task_id: null,
            });
            pushClue(rawClues, {
                signal: 'boundary',
                text: `Resolved boundary carried in memory: ${boundaryText}`,
                source_path: memoryPath,
                provenance: parsed.studyId,
                study_id: parsed.studyId,
                task_id: null,
            });
        }
        for (const boundaryText of parsed.openBoundaries.filter((value) => value !== 'None')) {
            pushClue(rawClues, {
                signal: 'boundary',
                text: `Open boundary carried in memory: ${boundaryText}`,
                source_path: memoryPath,
                provenance: parsed.studyId,
                study_id: parsed.studyId,
                task_id: null,
            });
        }
        pushTextSignals(rawClues, parsed.summary, {
            source_path: memoryPath,
            provenance: parsed.studyId,
            study_id: parsed.studyId,
            task_id: null,
        });
    }
    for (const study of studies) {
        const studyPath = `${PATHS.studiesDir}/${study.study_id}/study.md`;
        const candidateManifest = await readArtifactCandidateManifest(projectRoot, study.study_id);
        const candidateByPath = new Map();
        if (Array.isArray(candidateManifest.artifact_candidates)) {
            for (const candidate of candidateManifest.artifact_candidates) {
                candidateByPath.set(normalizePathKey(candidate.path), candidate);
            }
        }
        rawItems.push(...(await buildStudyOutputEvidenceItems(projectRoot, study.study_id, candidateByPath, artifactByPath)));
        if (study.status === 'closed' || study.status === 'completed') {
            pushClue(rawClues, {
                signal: 'positive',
                text: `Study status is ${study.status}.`,
                source_path: studyPath,
                provenance: study.study_id,
                study_id: study.study_id,
                task_id: null,
            });
        }
        if (study.status === 'blocked') {
            pushClue(rawClues, {
                signal: 'blocked',
                text: 'Study status is blocked.',
                source_path: studyPath,
                provenance: study.study_id,
                study_id: study.study_id,
                task_id: null,
            });
        }
        for (const blocker of study.blockers ?? []) {
            pushClue(rawClues, {
                signal: 'blocked',
                text: blocker,
                source_path: studyPath,
                provenance: study.study_id,
                study_id: study.study_id,
                task_id: null,
            });
            pushTextSignals(rawClues, blocker, {
                source_path: studyPath,
                provenance: study.study_id,
                study_id: study.study_id,
                task_id: null,
            });
        }
        const event = studyEventById.get(study.study_id);
        if (event?.kind === 'dissolution') {
            pushClue(rawClues, {
                signal: 'dissolved',
                text: `Evolution event kind is dissolution for ${study.study_id}.`,
                source_path: PATHS.evolution,
                provenance: study.study_id,
                study_id: study.study_id,
                task_id: null,
            });
        }
        for (const boundaryId of event?.resolves ?? []) {
            const boundaryText = boundaryById.get(boundaryId) ?? boundaryId;
            pushClue(rawClues, {
                signal: 'positive',
                text: `Resolved project boundary: ${boundaryText}`,
                source_path: PATHS.evolution,
                provenance: study.study_id,
                study_id: study.study_id,
                task_id: null,
            });
            pushClue(rawClues, {
                signal: 'boundary',
                text: `Resolved project boundary: ${boundaryText}`,
                source_path: PATHS.evolution,
                provenance: study.study_id,
                study_id: study.study_id,
                task_id: null,
            });
        }
        for (const boundaryId of event?.opens ?? []) {
            const boundaryText = boundaryById.get(boundaryId) ?? boundaryId;
            pushClue(rawClues, {
                signal: 'boundary',
                text: `Open project boundary: ${boundaryText}`,
                source_path: PATHS.evolution,
                provenance: study.study_id,
                study_id: study.study_id,
                task_id: null,
            });
        }
    }
    for (const task of tasks) {
        const taskPath = taskPathById.get(task.task_id) ?? `${PATHS.studiesDir}/${task.study_id}/tasks/${task.task_id}.md`;
        const document = await readMarkdownDocument(projectRoot, taskPath);
        const resultSummary = task.result_summary ?? extractMarkdownSectionText(document.body, 'Result Summary');
        if (task.status === 'blocked' && task.blocker_reason?.trim()) {
            pushClue(rawClues, {
                signal: 'blocked',
                text: task.blocker_reason,
                source_path: taskPath,
                provenance: `${task.study_id}/${task.task_id}`,
                study_id: task.study_id,
                task_id: task.task_id,
            });
        }
        pushTextSignals(rawClues, resultSummary, {
            source_path: taskPath,
            provenance: `${task.study_id}/${task.task_id}`,
            study_id: task.study_id,
            task_id: task.task_id,
        });
    }
    return {
        evidenceItems: dedupeEvidenceItems(rawItems),
        evidenceClues: dedupeEvidenceClues(rawClues),
    };
}
function renderToolStatus(tool) {
    return `${tool.tool}: ${tool.available ? `AVAILABLE (${tool.resolved_path})` : 'MISSING'}`;
}
function renderStudyCheck(check) {
    return [
        `### ${check.study_id}`,
        '',
        `- Study file: ${check.study_path}`,
        `- Status: ${check.status}`,
        `- Memory: ${check.memory_path ?? 'missing'}`,
        `- Unpackaged outputs: ${check.unpackaged_entries.length > 0 ? check.unpackaged_entries.join(', ') : 'none'}`,
        `- Invalid candidate paths: ${check.invalid_candidate_paths.length > 0 ? check.invalid_candidate_paths.join('; ') : 'none'}`,
        '',
    ];
}
function renderEvidenceItem(item) {
    return [
        `### ${item.id} ${item.title}`,
        '',
        `- Kind: ${item.kind}`,
        `- Category: ${item.category}`,
        `- Path: ${item.relative_path ?? 'none'}`,
        `- Source: ${item.source_path}`,
        `- Provenance: ${item.provenance}`,
        `- Study: ${item.study_id ?? 'n/a'}`,
        `- Task: ${item.task_id ?? 'n/a'}`,
        `- Linked promoted artifact: ${item.promoted_artifact_id ?? 'none'}`,
        `- Description: ${item.description}`,
        '',
    ];
}
function buildEvidenceAuditMarkdown(result) {
    const lines = [
        '# Evidence Audit',
        '',
        `- Run ID: ${result.run_id}`,
        `- Output directory: ${result.output_dir}`,
        `- Generated at: ${new Date().toISOString()}`,
        '',
        '## QDD Preflight',
        '',
        `- Contract: ${result.preflight.contract_path}`,
        `- Evolution: ${result.preflight.evolution_path}`,
        `- Resource memory: ${result.preflight.resources_path}`,
        `- Artifact registry: ${result.preflight.artifact_index_path}`,
        `- Studies discovered: ${result.preflight.study_paths.length}`,
        `- Study memories discovered: ${result.preflight.memory_paths.length}`,
        `- Reusable context files: ${result.preflight.reusable_context_paths.length}`,
        '',
        '### Rendering Tool Detection',
        '',
        ...result.preflight.rendering_tools.map((tool) => `- ${renderToolStatus(tool)}`),
        '',
        '### Study Checks',
        '',
    ];
    for (const check of result.preflight.study_checks) {
        lines.push(...renderStudyCheck(check));
    }
    lines.push('## Harvest Summary', '');
    lines.push(`- Evidence items: ${result.summary.evidence_item_count}`);
    lines.push(`- Evidence clues: ${result.summary.clue_count}`);
    for (const kind of CONCLUDE_EVIDENCE_KIND_VALUES) {
        lines.push(`- ${kind}: ${result.summary.items_by_kind[kind]}`);
    }
    for (const signal of CONCLUDE_EVIDENCE_SIGNAL_VALUES) {
        lines.push(`- ${signal}: ${result.summary.clues_by_signal[signal]}`);
    }
    lines.push('');
    lines.push('## Preflight Warnings', '');
    if (result.preflight.warnings.length === 0) {
        lines.push('- None.');
    }
    else {
        lines.push(...result.preflight.warnings.map((warning) => `- ${warning}`));
    }
    lines.push('');
    lines.push('## Major Evidence Items', '');
    for (const item of result.evidence_items) {
        lines.push(...renderEvidenceItem(item));
    }
    lines.push('## Evidence Clues', '');
    if (result.evidence_clues.length === 0) {
        lines.push('- None.');
    }
    else {
        for (const clue of result.evidence_clues) {
            lines.push(`- ${clue.id} [${clue.signal}] ${clue.text} | source=${clue.source_path} | provenance=${clue.provenance}`);
        }
    }
    lines.push('');
    return `${lines.join('\n').trim()}\n`;
}
function resolveOutputDir(projectRoot, outputDir, runId) {
    const relativeOutputDir = normalizeRelativePath(outputDir?.trim() || `${PATHS.conclusionsDir}/${runId}`);
    const absoluteOutputDir = path.resolve(projectRoot, relativeOutputDir);
    const projectRelative = path.relative(projectRoot, absoluteOutputDir);
    if (projectRelative.startsWith('..') || path.isAbsolute(projectRelative)) {
        throw new Error('Conclude output directory must stay within the current QDD project directory.');
    }
    return normalizeRelativePath(projectRelative);
}
export async function runConclude(projectRoot, options = {}) {
    const runId = buildDefaultRunId();
    const outputDir = resolveOutputDir(projectRoot, options.outputDir, runId);
    const studies = await discoverStudies(projectRoot);
    const preflight = await buildPreflight(projectRoot, studies);
    const harvested = await collectEvidence(projectRoot, preflight);
    const summary = summarizeEvidence(harvested.evidenceItems, harvested.evidenceClues);
    const result = {
        run_id: runId,
        output_dir: outputDir,
        evidence_audit_path: `${outputDir}/evidence_audit.md`,
        preflight,
        evidence_items: harvested.evidenceItems,
        evidence_clues: harvested.evidenceClues,
        summary,
    };
    const auditMarkdown = buildEvidenceAuditMarkdown(result);
    await FileSystemUtils.writeFile(path.join(projectRoot, result.evidence_audit_path), auditMarkdown);
    return result;
}
//# sourceMappingURL=conclude.js.map