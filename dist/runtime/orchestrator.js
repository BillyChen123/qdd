import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import { buildStatus } from './status.js';
import { buildInstructions } from './instructions.js';
import { createStudy } from './lifecycle.js';
import { discoverTasks } from './discovery.js';
import { hasClaudeCredentials, runAgent } from './agent-runner.js';
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const bootstrapPromptDir = path.join(moduleDir, 'bootstrap-prompts');
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
    if (!qs.last_kind) {
        return { shouldTerminate: false, reason: '' };
    }
    if (qs.last_kind === 'confirmation') {
        return { shouldTerminate: true, reason: 'Research question has been sufficiently answered (confirmation).' };
    }
    if (qs.last_kind === 'dissolution') {
        return { shouldTerminate: true, reason: 'Question is undecidable within current resource boundaries (dissolution).' };
    }
    if (qs.open_boundary_ids.length === 0) {
        return { shouldTerminate: true, reason: 'No remaining open boundaries; research frontier is closed.' };
    }
    if (qs.next_candidates.length === 0) {
        return { shouldTerminate: true, reason: 'No credible follow-up directions exist.' };
    }
    return { shouldTerminate: false, reason: '' };
}
export function computeInitialPhase(status, taskRecords = []) {
    const studies = allStudyIds(status);
    if (studies.length === 0) {
        return { phase: 'start', target: 'PROJECT', command: 'qdd-start' };
    }
    const terminal = checkTermination(status);
    if (terminal.shouldTerminate) {
        return null;
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
                return { ok: false, reason: `qdd-propose did not create or preserve ${current.target}.` };
            }
            if (!studyHasAnyTasks(status, current.target, taskRecords)) {
                return { ok: false, reason: `qdd-propose did not create any tasks for ${current.target}.` };
            }
            return { ok: true };
        case 'apply':
            if (!studyHasAnyTasks(status, current.target, taskRecords)) {
                return { ok: false, reason: `qdd-apply target ${current.target} has no tasks.` };
            }
            if (studyHasPendingOrRunningTasks(status, current.target, taskRecords)) {
                return { ok: false, reason: `qdd-apply left pending or running tasks for ${current.target}.` };
            }
            return { ok: true };
        case 'close':
            if (!status.studies.closed.includes(current.target)) {
                return { ok: false, reason: `qdd-close did not close ${current.target}.` };
            }
            return { ok: true };
    }
}
async function ensureProposeTargetExists(projectRoot, current, log) {
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
            return { ...current, target: created.studyId };
        }
        log(`  Created study scaffold: ${current.target}`);
        return current;
    }
}
function formatSummary(iterations, studiesCompleted, terminalReason) {
    return `Auto mode completed: ${iterations} iterations, ${studiesCompleted} studies closed. Stop reason: ${terminalReason}`;
}
export async function runAuto(projectRoot, options) {
    const phases = [];
    const log = options.logger ?? console.log;
    let iterations = 0;
    let studiesCompleted = 0;
    let terminalCode = 'max_iterations';
    let terminalReason = `Reached max iterations (${options.maxIterations}).`;
    let status = await buildStatus(projectRoot);
    let taskRecords = await discoverTasks(projectRoot);
    let current = computeInitialPhase(status, taskRecords);
    if (!current) {
        const term = checkTermination(status);
        terminalCode = 'terminal_state';
        terminalReason = term.reason || 'Project is already in a terminal auto-mode state.';
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
    log(`Model: ${options.model}, Max iterations: ${options.maxIterations}, Max turns per agent: ${options.maxTurnsPerAgent}`);
    log('');
    while (iterations < options.maxIterations) {
        iterations++;
        log(`--- Iteration ${iterations}: ${phaseLabel(current.phase)} ---`);
        if (options.dryRun) {
            const bootstrapFile = commandToBootstrapFile(current.command);
            log('[DRY RUN] Would run agent with:');
            log(`  Role: ${phaseRole(current.phase)}`);
            log(`  Target: ${current.target}`);
            log(`  Command: ${current.command}`);
            log(`  System prompt: ${bootstrapFile}.md`);
            log('');
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
        current = await ensureProposeTargetExists(projectRoot, current, log);
        const instructions = await buildInstructions(projectRoot, current.target, {
            command: current.command,
        });
        const bootstrapFile = commandToBootstrapFile(current.command);
        const systemPrompt = await readPromptFile(bootstrapFile);
        const instructionsText = formatInstructionsForAgent(instructions);
        const result = await runAgent({
            model: options.model,
            systemPrompt,
            instructions: instructionsText,
            maxTurns: options.maxTurnsPerAgent,
            cwd: projectRoot,
        });
        phases.push({
            ...current,
            role: instructions.role,
            dryRun: false,
            result,
        });
        log(`  Turns: ${result.turns}, Tool calls: ${result.toolCalls}`);
        log(`  Status: ${result.status}`);
        if (result.failureReason)
            log(`  Failure: ${result.failureReason}`);
        log('');
        if (!result.terminatedNormally) {
            terminalCode = 'agent_failed';
            terminalReason = result.failureReason ?? result.finalMessage;
            break;
        }
        status = await buildStatus(projectRoot);
        taskRecords = await discoverTasks(projectRoot);
        const completion = inspectPhaseCompletion(current, status, taskRecords);
        if (!completion.ok) {
            terminalCode = 'phase_incomplete';
            terminalReason = completion.reason ?? 'Phase completed without producing required filesystem state.';
            log(`Stopping: ${terminalReason}`);
            break;
        }
        if (current.phase === 'close')
            studiesCompleted++;
        const next = nextPhase(current, status);
        if (!next) {
            const term = checkTermination(status);
            terminalCode = 'terminal_state';
            terminalReason = term.reason || 'No next phase is available.';
            log(`Termination: ${terminalReason}`);
            break;
        }
        current = next;
    }
    if (iterations >= options.maxIterations && terminalCode === 'max_iterations') {
        log(terminalReason);
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