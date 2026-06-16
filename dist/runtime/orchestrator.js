import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import { buildStatus } from './status.js';
import { buildInstructions } from './instructions.js';
import { createStudy } from './lifecycle.js';
import { discoverTasks } from './discovery.js';
import { getStudyArtifactCandidatesPath } from './evidence.js';
import { PATHS } from './constants.js';
import { hasClaudeCredentials, runAgent } from './agent-runner.js';
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const bootstrapPromptDir = path.join(moduleDir, 'bootstrap-prompts');
const MANAGED_SNAPSHOT_ROOTS = [
    PATHS.contract,
    PATHS.evolution,
    PATHS.researchMapHtml,
    PATHS.contextDir,
    PATHS.studiesDir,
    PATHS.artifactsDir,
];
async function readPromptFile(name) {
    return fs.readFile(path.join(bootstrapPromptDir, `${name}.md`), 'utf-8');
}
function formatInstructionsForAgent(instructions) {
    const lines = [];
    lines.push(`## Role: ${instructions.role}`);
    lines.push(`## Command: ${instructions.command ?? 'none'}`);
    lines.push(`## Target: ${instructions.target.kind} / ${instructions.target.id}`);
    lines.push('');
    if (instructions.read.length > 0) {
        lines.push('### Files You May Read');
        for (const p of instructions.read)
            lines.push(`- ${p}`);
        lines.push('');
    }
    if (instructions.write.length > 0) {
        lines.push('### Files You May Write');
        for (const p of instructions.write)
            lines.push(`- ${p}`);
        lines.push('');
    }
    if (instructions.required_skills.length > 0) {
        lines.push('### Required Skills');
        for (const s of instructions.required_skills)
            lines.push(`- ${s}`);
        lines.push('');
    }
    if (instructions.rules.length > 0) {
        lines.push('### Rules');
        for (const r of instructions.rules)
            lines.push(`- ${r}`);
        lines.push('');
    }
    return lines.join('\n');
}
function latest(values) {
    return values.length > 0 ? values[values.length - 1] : null;
}
function allStudyIds(status) {
    return [
        ...status.studies.active,
        ...status.studies.blocked,
        ...status.studies.completed,
        ...status.studies.closed,
    ];
}
function taskStatus(task) {
    return task.status ?? 'pending';
}
function tasksForStudy(taskRecords, studyId) {
    return taskRecords.filter((task) => task.study_id === studyId);
}
function statusTaskIds(status) {
    return [
        ...status.tasks.pending,
        ...status.tasks.running,
        ...status.tasks.blocked,
        ...status.tasks.completed,
    ];
}
function studyHasNoTasks(status, studyId, taskRecords) {
    if (taskRecords.length > 0) {
        return tasksForStudy(taskRecords, studyId).length === 0;
    }
    return statusTaskIds(status).length === 0;
}
function studyHasPendingOrRunningTasks(status, studyId, taskRecords) {
    if (taskRecords.length > 0) {
        return tasksForStudy(taskRecords, studyId).some((task) => ['pending', 'running'].includes(taskStatus(task)));
    }
    return status.tasks.pending.length > 0 || status.tasks.running.length > 0;
}
function studyHasAnyTasks(status, studyId, taskRecords) {
    if (taskRecords.length > 0) {
        return tasksForStudy(taskRecords, studyId).length > 0;
    }
    return statusTaskIds(status).length > 0;
}
function summarizeTaskRecords(taskRecords, studyId) {
    return tasksForStudy(taskRecords, studyId).map((task) => `${task.task_id}:${taskStatus(task)}`);
}
function summarizeStatus(status) {
    return [
        `studies active=${status.studies.active.join(',') || '-'} completed=${status.studies.completed.join(',') || '-'} blocked=${status.studies.blocked.join(',') || '-'} closed=${status.studies.closed.join(',') || '-'}`,
        `tasks pending=${status.tasks.pending.join(',') || '-'} running=${status.tasks.running.join(',') || '-'} completed=${status.tasks.completed.join(',') || '-'} blocked=${status.tasks.blocked.join(',') || '-'}`,
        `promotion pending=${status.tasks.promotion_pending.join(',') || '-'} candidate_recorded=${status.tasks.candidate_recorded.join(',') || '-'} registered=${status.tasks.registered.join(',') || '-'}`,
        `close ready=${status.close_preflight.ready.join(',') || '-'} blocked=${status.close_preflight.blocked.map((entry) => `${entry.study_id}(${entry.reasons.join('; ')})`).join(', ') || '-'}`,
    ].join(' | ');
}
function normalizeProjectPath(relativePath) {
    return relativePath.split(path.sep).join('/');
}
function isManagedPath(relativePath) {
    const normalized = normalizeProjectPath(relativePath);
    return normalized === PATHS.contract
        || normalized === PATHS.evolution
        || normalized === PATHS.researchMapHtml
        || normalized === PATHS.artifactIndex
        || normalized === PATHS.contextResources
        || normalized.startsWith(`${PATHS.contextDir}/`)
        || normalized.startsWith(`${PATHS.studiesDir}/`)
        || normalized.startsWith(`${PATHS.artifactsDir}/`);
}
async function collectManagedPathEntries(projectRoot, relativeDir = '') {
    const absoluteDir = path.join(projectRoot, relativeDir);
    let entries;
    try {
        entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const results = [];
    for (const entry of entries) {
        const relativePath = normalizeProjectPath(relativeDir ? path.join(relativeDir, entry.name) : entry.name);
        if (entry.isDirectory()) {
            results.push(...(await collectManagedPathEntries(projectRoot, relativePath)));
            continue;
        }
        if (entry.isFile() || entry.isSymbolicLink()) {
            if (isManagedPath(relativePath)) {
                results.push(relativePath);
            }
        }
    }
    return results.sort((left, right) => left.localeCompare(right));
}
async function collectManagedRootEntries(projectRoot, relativePath) {
    const normalized = normalizeProjectPath(relativePath);
    const absolutePath = path.join(projectRoot, normalized);
    try {
        const stats = await fs.lstat(absolutePath);
        if (stats.isDirectory()) {
            return collectManagedPathEntries(projectRoot, normalized);
        }
        if (stats.isFile() || stats.isSymbolicLink()) {
            return [normalized];
        }
    }
    catch {
        return [];
    }
    return [];
}
async function fileFingerprint(projectRoot, relativePath) {
    try {
        const stats = await fs.lstat(path.join(projectRoot, relativePath));
        return `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
    }
    catch {
        return 'missing';
    }
}
export async function captureManagedPathSnapshot(projectRoot) {
    const snapshot = new Map();
    const relativePaths = (await Promise.all(MANAGED_SNAPSHOT_ROOTS.map((relativePath) => collectManagedRootEntries(projectRoot, relativePath)))).flat();
    for (const relativePath of [...new Set(relativePaths)].sort((left, right) => left.localeCompare(right))) {
        snapshot.set(relativePath, await fileFingerprint(projectRoot, relativePath));
    }
    return snapshot;
}
function listChangedManagedPaths(before, after) {
    const allPaths = new Set([...before.keys(), ...after.keys()]);
    return [...allPaths]
        .filter((relativePath) => before.get(relativePath) !== after.get(relativePath))
        .sort((left, right) => left.localeCompare(right));
}
function pathMatchesPattern(relativePath, pattern) {
    if (pattern.endsWith('/**')) {
        const prefix = pattern.slice(0, -3);
        return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
    }
    return relativePath === pattern;
}
function expectedWritePatternsForPhase(phase, target) {
    switch (phase) {
        case 'start':
            return [
                PATHS.contract,
                PATHS.contextResources,
                `${PATHS.contextDir}/**`,
                `${PATHS.artifactDataDir}/**`,
                PATHS.layerPolicy,
                PATHS.researchMapHtml,
            ];
        case 'propose':
            return [
                `${PATHS.studiesDir}/${target}/study.md`,
                `${PATHS.studiesDir}/${target}/tasks/**`,
                `${PATHS.studiesDir}/${target}/output/**`,
            ];
        case 'apply':
            return [
                `${PATHS.studiesDir}/${target}/study.md`,
                `${PATHS.studiesDir}/${target}/tasks/**`,
                `${PATHS.studiesDir}/${target}/output/**`,
                PATHS.artifactIndex,
            ];
        case 'close':
            return [
                `${PATHS.studiesDir}/${target}/study.md`,
                `${PATHS.studiesDir}/${target}/tasks/**`,
                `${PATHS.studiesDir}/${target}/output/**`,
                PATHS.artifactIndex,
                `${PATHS.artifactsDir}/**`,
                PATHS.evolution,
                PATHS.contextResources,
                `${PATHS.contextMemoryDir}/**`,
                PATHS.researchMapHtml,
            ];
    }
}
function unexpectedWritesForPhase(phase, target, changedPaths) {
    const patterns = expectedWritePatternsForPhase(phase, target);
    return changedPaths.filter((relativePath) => !patterns.some((pattern) => pathMatchesPattern(relativePath, pattern)));
}
function inferLikelyInvalidStatePath(message) {
    if (/artifact-candidates\.yaml|artifact_candidates|artifact candidate/i.test(message)) {
        const studyMatch = message.match(/STUDY-\d{3}/);
        return studyMatch ? getStudyArtifactCandidatesPath(studyMatch[0]) : `studies/STUDY-XXX/output/${PATHS.artifactCandidatesFileName}`;
    }
    if (/evolution\.yaml|boundaries#|studies#/i.test(message)) {
        return PATHS.evolution;
    }
    if (/artifacts\/index\.yaml|artifact index/i.test(message)) {
        return PATHS.artifactIndex;
    }
    if (/contract\.yaml/i.test(message)) {
        return PATHS.contract;
    }
    return undefined;
}
export async function safeReadAutoStatus(projectRoot) {
    try {
        const status = await buildStatus(projectRoot);
        if (status.output_review.studies_with_invalid_candidate_paths.length > 0) {
            const studyId = status.output_review.studies_with_invalid_candidate_paths[0] ?? 'STUDY-XXX';
            const closeBlocker = status.close_preflight.blocked.find((entry) => entry.study_id === studyId);
            const candidateReason = closeBlocker?.reasons.find((reason) => /artifact candidate|artifact_candidates|candidates:/i.test(reason));
            return {
                ok: false,
                invalidState: {
                    message: candidateReason ? `Invalid artifact candidates for ${studyId}: ${candidateReason}` : `Invalid artifact candidate paths detected for ${studyId}.`,
                    likelyPath: getStudyArtifactCandidatesPath(studyId),
                },
            };
        }
        return { ok: true, status, taskRecords: await discoverTasks(projectRoot) };
    }
    catch (error) {
        const message = error.message;
        return {
            ok: false,
            invalidState: {
                message,
                likelyPath: inferLikelyInvalidStatePath(message),
            },
        };
    }
}
export function computeNextPhaseAfterCompletedPhase(current, status, taskRecords = []) {
    if (current.phase === 'start' && allStudyIds(status).length === 0) {
        return { phase: 'propose', target: determineNextStudyId(status), command: 'qdd-propose' };
    }
    return computeInitialPhase(status, taskRecords);
}
export async function inspectAutoPhaseDrift(projectRoot, phase, before) {
    const after = await captureManagedPathSnapshot(projectRoot);
    const changedPaths = listChangedManagedPaths(before, after);
    return {
        changedPaths,
        unexpectedPaths: unexpectedWritesForPhase(phase.phase, phase.target, changedPaths),
    };
}
export function determineNextStudyId(status) {
    let maxNum = 0;
    for (const sid of allStudyIds(status)) {
        const match = sid.match(/^STUDY-(\d{3})$/);
        if (match) {
            maxNum = Math.max(maxNum, parseInt(match[1], 10));
        }
    }
    return `STUDY-${String(maxNum + 1).padStart(3, '0')}`;
}
function incrementStudyId(studyId) {
    const match = studyId.match(/^STUDY-(\d{3})$/);
    if (!match)
        return 'STUDY-001';
    return `STUDY-${String(parseInt(match[1], 10) + 1).padStart(3, '0')}`;
}
export function checkTermination(status) {
    const qs = status.question_state;
    const hasNextCandidates = qs.next_candidates.length > 0;
    if (!qs.last_kind) {
        return { shouldTerminate: false, reason: '' };
    }
    if (hasNextCandidates) {
        return { shouldTerminate: false, reason: '' };
    }
    return { shouldTerminate: true, reason: 'Thesis frontier has no executable next candidates.' };
}
export function computeInitialPhase(status, taskRecords = []) {
    const studies = allStudyIds(status);
    if (studies.length === 0) {
        return { phase: 'start', target: 'PROJECT', command: 'qdd-start' };
    }
    const activeStudy = latest(status.studies.active);
    if (activeStudy) {
        if (studyHasNoTasks(status, activeStudy, taskRecords)) {
            return { phase: 'propose', target: activeStudy, command: 'qdd-propose' };
        }
        if (studyHasPendingOrRunningTasks(status, activeStudy, taskRecords)) {
            return { phase: 'apply', target: activeStudy, command: 'qdd-apply' };
        }
        return { phase: 'close', target: activeStudy, command: 'qdd-close' };
    }
    const blockedStudy = latest(status.studies.blocked);
    if (blockedStudy) {
        return { phase: 'close', target: blockedStudy, command: 'qdd-close' };
    }
    const completedStudy = latest(status.studies.completed);
    if (completedStudy) {
        return { phase: 'close', target: completedStudy, command: 'qdd-close' };
    }
    const terminal = checkTermination(status);
    if (terminal.shouldTerminate) {
        return null;
    }
    return { phase: 'propose', target: determineNextStudyId(status), command: 'qdd-propose' };
}
export function nextPhase(current, status) {
    switch (current.phase) {
        case 'start':
            return {
                phase: 'propose',
                target: determineNextStudyId(status),
                command: 'qdd-propose',
            };
        case 'propose':
            return { phase: 'apply', target: current.target, command: 'qdd-apply' };
        case 'apply':
            return { phase: 'close', target: current.target, command: 'qdd-close' };
        case 'close': {
            const term = checkTermination(status);
            if (term.shouldTerminate)
                return null;
            return {
                phase: 'propose',
                target: determineNextStudyId(status),
                command: 'qdd-propose',
            };
        }
    }
}
export function nextDryRunPhase(current, status) {
    switch (current.phase) {
        case 'start':
            return { phase: 'propose', target: determineNextStudyId(status), command: 'qdd-propose' };
        case 'propose':
            return { phase: 'apply', target: current.target, command: 'qdd-apply' };
        case 'apply':
            return { phase: 'close', target: current.target, command: 'qdd-close' };
        case 'close':
            return { phase: 'propose', target: incrementStudyId(current.target), command: 'qdd-propose' };
    }
}
function commandToBootstrapFile(command) {
    return command;
}
function phaseLabel(phase) {
    switch (phase) {
        case 'start': return 'Thesis Manager (qdd-start)';
        case 'propose': return 'Study Brain (qdd-propose)';
        case 'apply': return 'Executor (qdd-apply)';
        case 'close': return 'Thesis Manager (qdd-close)';
    }
}
function phaseRole(phase) {
    switch (phase) {
        case 'start': return 'thesis-manager';
        case 'propose': return 'study-brain';
        case 'apply': return 'executor';
        case 'close': return 'thesis-manager';
    }
}
function dryRunResult() {
    return {
        turns: 0,
        finalMessage: 'DRY_RUN',
        terminatedNormally: true,
        toolCalls: 0,
        status: 'completed',
    };
}
function inspectPhaseCompletion(current, status, taskRecords) {
    switch (current.phase) {
        case 'start':
            return { ok: true };
        case 'propose':
            if (!allStudyIds(status).includes(current.target)) {
                return {
                    ok: false,
                    reason: `qdd-propose did not create or preserve ${current.target}.`,
                    details: [`known studies: ${allStudyIds(status).join(',') || '-'}`],
                };
            }
            if (!studyHasAnyTasks(status, current.target, taskRecords)) {
                return {
                    ok: false,
                    reason: `qdd-propose did not create any tasks for ${current.target}.`,
                    details: [
                        `discovered tasks for ${current.target}: ${summarizeTaskRecords(taskRecords, current.target).join(',') || '-'}`,
                        `global task ids: ${statusTaskIds(status).join(',') || '-'}`,
                    ],
                };
            }
            return { ok: true };
        case 'apply':
            if (!studyHasAnyTasks(status, current.target, taskRecords)) {
                return {
                    ok: false,
                    reason: `qdd-apply target ${current.target} has no tasks.`,
                    details: [`discovered tasks for ${current.target}: ${summarizeTaskRecords(taskRecords, current.target).join(',') || '-'}`],
                };
            }
            if (studyHasPendingOrRunningTasks(status, current.target, taskRecords)) {
                return {
                    ok: false,
                    reason: `qdd-apply left pending or running tasks for ${current.target}.`,
                    details: [
                        `discovered tasks for ${current.target}: ${summarizeTaskRecords(taskRecords, current.target).join(',') || '-'}`,
                        `status pending=${status.tasks.pending.join(',') || '-'} running=${status.tasks.running.join(',') || '-'}`,
                    ],
                };
            }
            return { ok: true };
        case 'close':
            if (!status.studies.closed.includes(current.target)) {
                return {
                    ok: false,
                    reason: `qdd-close did not close ${current.target}.`,
                    details: [
                        `study lifecycle lists: active=${status.studies.active.join(',') || '-'} completed=${status.studies.completed.join(',') || '-'} blocked=${status.studies.blocked.join(',') || '-'} closed=${status.studies.closed.join(',') || '-'}`,
                        `close preflight blocked: ${status.close_preflight.blocked.filter((entry) => entry.study_id === current.target).flatMap((entry) => entry.reasons).join('; ') || '-'}`,
                    ],
                };
            }
            return { ok: true };
    }
}
async function ensureProposeTargetExists(projectRoot, current, log, events) {
    if (current.phase !== 'propose' || !current.target.startsWith('STUDY-')) {
        return current;
    }
    try {
        await buildInstructions(projectRoot, current.target, { command: 'qdd-propose' });
        return current;
    }
    catch {
        const created = await createStudy(projectRoot, {
            question: 'To be refined by Study Brain agent during qdd-propose.',
            hypothesis: 'To be formulated.',
        });
        if (created.studyId !== current.target) {
            log(`  Study scaffold created as ${created.studyId} (requested: ${current.target})`);
            events?.studyScaffold?.({ requested: current.target, created: created.studyId });
            return { ...current, target: created.studyId };
        }
        log(`  Created study scaffold: ${current.target}`);
        events?.studyScaffold?.({ requested: current.target, created: current.target });
        return current;
    }
}
function formatSummary(iterations, studiesCompleted, terminalReason) {
    return `Auto mode completed: ${iterations} iterations, ${studiesCompleted} studies closed. Stop reason: ${terminalReason}`;
}
function formatInvalidStateReason(invalidState) {
    return invalidState.likelyPath
        ? `Invalid managed file state at ${invalidState.likelyPath}: ${invalidState.message}`
        : `Invalid managed file state: ${invalidState.message}`;
}
function formatLogExcerpt(message, maxLength = 1000) {
    const compact = message.replace(/\s+/g, ' ').trim();
    if (compact.length <= maxLength)
        return compact;
    return `${compact.slice(0, maxLength)}...`;
}
function formatMaxTurns(maxTurns) {
    return maxTurns === null ? 'unlimited' : String(maxTurns);
}
function formatMaxIterations(maxIterations) {
    return maxIterations === null ? 'unlimited' : String(maxIterations);
}
export function inferAutoVisibleLanguage(prompt, env = process.env) {
    const requested = env.QDD_AUTO_MODEL_LANG ?? env.QDD_AUTO_LANG ?? env.QDD_LANG ?? '';
    if (/^zh(?:$|[-_])/i.test(requested))
        return 'zh';
    if (/^(default|auto|en)(?:$|[-_])/i.test(requested))
        return 'default';
    return /[\u3400-\u9fff\uf900-\ufaff]/.test(prompt ?? '') ? 'zh' : 'default';
}
function appendAutoPrompt(instructions, prompt) {
    const trimmed = prompt?.trim();
    const sections = [instructions];
    if (trimmed) {
        sections.push('### Auto Run User Prompt', trimmed, '', 'Use this prompt as the durable user intent for the current auto run. During qdd-start, capture stable project-level context and resources from it. During qdd-propose, turn it into the first bounded study and concrete task graph. During qdd-apply and qdd-close, keep the work aligned with this intent while still obeying the persisted QDD files.');
    }
    if (inferAutoVisibleLanguage(prompt) === 'zh') {
        sections.push('', '### Visible Output Language', 'Use Chinese for visible progress notes and concise final summaries shown to the user.', 'Keep file paths, shell commands, code identifiers, QDD ids, schema keys, and literal data values unchanged.');
    }
    return sections.join('\n');
}
export async function runAuto(projectRoot, options) {
    const phases = [];
    const log = options.logger ?? console.log;
    let iterations = 0;
    let studiesCompleted = 0;
    let terminalCode = 'max_iterations';
    let terminalReason = options.maxIterations === null
        ? 'Auto loop ended unexpectedly before reaching a terminal state.'
        : `Reached max iterations (${options.maxIterations}).`;
    let statusRead = await safeReadAutoStatus(projectRoot);
    const initialPhase = statusRead.ok ? computeInitialPhase(statusRead.status, statusRead.taskRecords) : null;
    options.events?.runStart?.({
        projectRoot,
        phase: initialPhase,
        model: options.model,
        maxIterations: options.maxIterations,
        maxTurnsPerAgent: options.maxTurnsPerAgent,
        dryRun: options.dryRun,
        prompt: options.prompt,
    });
    if (!statusRead.ok) {
        terminalCode = 'invalid_state';
        terminalReason = formatInvalidStateReason(statusRead.invalidState);
        log(`Cannot start auto mode: ${terminalReason}`);
        options.events?.terminal?.({ code: terminalCode, reason: terminalReason });
        return {
            iterations,
            studiesCompleted,
            finalPhase: 'none',
            terminalCode,
            terminalReason,
            summary: formatSummary(iterations, studiesCompleted, terminalReason),
            phases,
        };
    }
    let status = statusRead.status;
    let taskRecords = statusRead.taskRecords;
    let current = initialPhase;
    if (options.verbose)
        options.events?.initialState?.({ summary: summarizeStatus(status) });
    if (!current) {
        const term = checkTermination(status);
        terminalCode = 'terminal_state';
        terminalReason = term.reason || 'Project is already in a terminal auto-mode state.';
        options.events?.terminal?.({ code: terminalCode, reason: terminalReason });
        return {
            iterations,
            studiesCompleted,
            finalPhase: 'none',
            terminalCode,
            terminalReason,
            summary: formatSummary(iterations, studiesCompleted, terminalReason),
            phases,
        };
    }
    if (!options.dryRun && !hasClaudeCredentials()) {
        terminalCode = 'missing_auth';
        terminalReason = 'Claude SDK authentication is missing. Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY, or configure ~/.claude/settings.json.';
        log(`Cannot start auto mode: ${terminalReason}`);
        options.events?.terminal?.({ code: terminalCode, reason: terminalReason });
        return {
            iterations,
            studiesCompleted,
            finalPhase: current.phase,
            terminalCode,
            terminalReason,
            summary: formatSummary(iterations, studiesCompleted, terminalReason),
            phases,
        };
    }
    log(`Auto mode starting from phase: ${phaseLabel(current.phase)}`);
    log(`Target: ${current.target}, Command: ${current.command}`);
    log(`Model: ${options.model}, Max iterations: ${formatMaxIterations(options.maxIterations)}, Max turns per agent: ${formatMaxTurns(options.maxTurnsPerAgent)}`);
    if (options.prompt?.trim())
        log(`Prompt: ${formatLogExcerpt(options.prompt, 300)}`);
    if (options.verbose)
        log(`Initial state: ${summarizeStatus(status)}`);
    log('');
    while (options.maxIterations === null || iterations < options.maxIterations) {
        iterations++;
        log(`--- Iteration ${iterations}: ${phaseLabel(current.phase)} ---`);
        const phaseStartEvent = {
            iteration: iterations,
            phase: current,
            label: phaseLabel(current.phase),
            role: phaseRole(current.phase),
        };
        options.events?.phaseStart?.(phaseStartEvent);
        if (options.dryRun) {
            const bootstrapFile = commandToBootstrapFile(current.command);
            log('[DRY RUN] Would run agent with:');
            log(`  Role: ${phaseRole(current.phase)}`);
            log(`  Target: ${current.target}`);
            log(`  Command: ${current.command}`);
            log(`  System prompt: ${bootstrapFile}.md`);
            log('');
            options.events?.dryRunPhase?.({ ...phaseStartEvent, systemPrompt: `${bootstrapFile}.md` });
            phases.push({
                ...current,
                role: phaseRole(current.phase),
                dryRun: true,
                result: dryRunResult(),
            });
            if (current.phase === 'close')
                studiesCompleted++;
            current = nextDryRunPhase(current, status);
            continue;
        }
        const beforePhaseSnapshot = await captureManagedPathSnapshot(projectRoot);
        current = await ensureProposeTargetExists(projectRoot, current, log, options.events);
        const instructions = await buildInstructions(projectRoot, current.target, {
            command: current.command,
        });
        const bootstrapFile = commandToBootstrapFile(current.command);
        const systemPrompt = await readPromptFile(bootstrapFile);
        const instructionsText = appendAutoPrompt(formatInstructionsForAgent(instructions), options.prompt);
        if (options.verbose) {
            log(`  Instructions: role=${instructions.role}, read=${instructions.read.length}, write=${instructions.write.length}, required_skills=${instructions.required_skills.length}`);
        }
        options.events?.instructions?.({
            role: instructions.role,
            readCount: instructions.read.length,
            writeCount: instructions.write.length,
            requiredSkillCount: instructions.required_skills.length,
        });
        const result = await runAgent({
            model: options.model,
            systemPrompt,
            instructions: instructionsText,
            maxTurns: options.maxTurnsPerAgent,
            cwd: projectRoot,
            logger: log,
            verbose: options.verbose ?? false,
            events: options.events?.agent,
        });
        const phaseEntry = {
            ...current,
            role: instructions.role,
            dryRun: false,
            result,
        };
        phases.push(phaseEntry);
        log(`  Turns: ${result.turns}, Tool calls: ${result.toolCalls}`);
        log(`  Status: ${result.status}`);
        if (result.failureReason)
            log(`  Failure: ${result.failureReason}`);
        if (!result.terminatedNormally && result.finalMessage.trim()) {
            log(`  Final message: ${formatLogExcerpt(result.finalMessage)}`);
        }
        log('');
        options.events?.phaseResult?.({ phase: current, result });
        if (!result.terminatedNormally) {
            terminalCode = 'agent_failed';
            terminalReason = result.failureReason ?? result.finalMessage;
            options.events?.terminal?.({ code: terminalCode, reason: terminalReason });
            break;
        }
        const drift = await inspectAutoPhaseDrift(projectRoot, current, beforePhaseSnapshot);
        phaseEntry.drift = drift;
        if (drift.unexpectedPaths.length > 0) {
            log(`  Phase drift: unexpected writes ${drift.unexpectedPaths.join(', ')}`);
        }
        statusRead = await safeReadAutoStatus(projectRoot);
        if (!statusRead.ok) {
            phaseEntry.invalidState = statusRead.invalidState;
            terminalCode = 'invalid_state';
            terminalReason = formatInvalidStateReason(statusRead.invalidState);
            log(`Stopping: ${terminalReason}`);
            options.events?.terminal?.({ code: terminalCode, reason: terminalReason });
            break;
        }
        status = statusRead.status;
        taskRecords = statusRead.taskRecords;
        if (options.verbose) {
            log(`  State after phase: ${summarizeStatus(status)}`);
        }
        if (options.verbose)
            options.events?.stateAfterPhase?.({ summary: summarizeStatus(status) });
        const completion = inspectPhaseCompletion(current, status, taskRecords);
        if (!completion.ok) {
            terminalCode = 'phase_incomplete';
            terminalReason = completion.reason ?? 'Phase completed without producing required filesystem state.';
            log(`Stopping: ${terminalReason}`);
            for (const detail of completion.details ?? []) {
                log(`  Detail: ${detail}`);
            }
            options.events?.phaseIncomplete?.({ reason: terminalReason, details: completion.details ?? [] });
            options.events?.terminal?.({ code: terminalCode, reason: terminalReason });
            break;
        }
        if (current.phase === 'close')
            studiesCompleted++;
        const next = computeNextPhaseAfterCompletedPhase(current, status, taskRecords);
        phaseEntry.nextPhase = next;
        if (!next) {
            const term = checkTermination(status);
            terminalCode = 'terminal_state';
            terminalReason = term.reason || 'No next phase is available.';
            log(`Termination: ${terminalReason}`);
            options.events?.terminal?.({ code: terminalCode, reason: terminalReason });
            break;
        }
        current = next;
    }
    if (options.maxIterations !== null && iterations >= options.maxIterations && terminalCode === 'max_iterations') {
        log(terminalReason);
        options.events?.terminal?.({ code: terminalCode, reason: terminalReason });
    }
    return {
        iterations,
        studiesCompleted,
        finalPhase: current.phase,
        terminalCode,
        terminalReason,
        summary: formatSummary(iterations, studiesCompleted, terminalReason),
        phases,
    };
}
//# sourceMappingURL=orchestrator.js.map