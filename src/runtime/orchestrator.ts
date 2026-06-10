import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import { buildStatus } from './status.js';
import { buildInstructions } from './instructions.js';
import { createStudy } from './lifecycle.js';
import { discoverTasks } from './discovery.js';
import type { InstructionsJson, QddCommand, QddRole, StatusJson, TaskRecord } from '../types.js';
import { hasClaudeCredentials, runAgent } from './agent-runner.js';
import type { AgentRunEvents, AgentRunResult } from './agent-runner.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const bootstrapPromptDir = path.join(moduleDir, 'bootstrap-prompts');

export type OrchestratorPhase = 'start' | 'propose' | 'apply' | 'close';
export type AutoCommand = Extract<QddCommand, 'qdd-start' | 'qdd-propose' | 'qdd-apply' | 'qdd-close'>;
export type AutoStopCode = 'terminal_state' | 'max_iterations' | 'phase_incomplete' | 'agent_failed' | 'missing_auth';

export interface AutoOptions {
  model: string;
  maxIterations: number;
  maxTurnsPerAgent: number | null;
  dryRun: boolean;
  verbose?: boolean;
  prompt?: string;
  logger?: (message: string) => void;
  events?: AutoRunEvents;
}

export interface PhaseTarget {
  phase: OrchestratorPhase;
  target: string;
  command: AutoCommand;
}

export interface AutoPhaseResult extends PhaseTarget {
  role: QddRole;
  dryRun: boolean;
  result: AgentRunResult;
}

export interface AutoResult {
  iterations: number;
  studiesCompleted: number;
  finalPhase: string;
  terminalCode: AutoStopCode;
  terminalReason: string;
  summary: string;
  phases: AutoPhaseResult[];
}

export interface AutoRunStartEvent {
  projectRoot: string;
  phase: PhaseTarget | null;
  model: string;
  maxIterations: number;
  maxTurnsPerAgent: number | null;
  dryRun: boolean;
  prompt?: string;
}

export interface AutoPhaseStartEvent {
  iteration: number;
  phase: PhaseTarget;
  label: string;
  role: QddRole;
}

export interface AutoRunEvents {
  runStart?: (event: AutoRunStartEvent) => void;
  initialState?: (event: { summary: string }) => void;
  phaseStart?: (event: AutoPhaseStartEvent) => void;
  dryRunPhase?: (event: AutoPhaseStartEvent & { systemPrompt: string }) => void;
  studyScaffold?: (event: { requested: string; created: string }) => void;
  instructions?: (event: { role: QddRole; readCount: number; writeCount: number; requiredSkillCount: number }) => void;
  agent?: AgentRunEvents;
  phaseResult?: (event: { phase: PhaseTarget; result: AgentRunResult }) => void;
  stateAfterPhase?: (event: { summary: string }) => void;
  phaseIncomplete?: (event: { reason: string; details: string[] }) => void;
  terminal?: (event: { code: AutoStopCode; reason: string }) => void;
}

interface TerminationCheck {
  shouldTerminate: boolean;
  reason: string;
}

interface PhaseCompletion {
  ok: boolean;
  reason?: string;
  details?: string[];
}

async function readPromptFile(name: string): Promise<string> {
  return fs.readFile(path.join(bootstrapPromptDir, `${name}.md`), 'utf-8');
}

function formatInstructionsForAgent(instructions: InstructionsJson): string {
  const lines: string[] = [];

  lines.push(`## Role: ${instructions.role}`);
  lines.push(`## Command: ${instructions.command ?? 'none'}`);
  lines.push(`## Target: ${instructions.target.kind} / ${instructions.target.id}`);
  lines.push('');

  if (instructions.read.length > 0) {
    lines.push('### Files You May Read');
    for (const p of instructions.read) lines.push(`- ${p}`);
    lines.push('');
  }

  if (instructions.write.length > 0) {
    lines.push('### Files You May Write');
    for (const p of instructions.write) lines.push(`- ${p}`);
    lines.push('');
  }

  if (instructions.required_skills.length > 0) {
    lines.push('### Required Skills');
    for (const s of instructions.required_skills) lines.push(`- ${s}`);
    lines.push('');
  }

  if (instructions.rules.length > 0) {
    lines.push('### Rules');
    for (const r of instructions.rules) lines.push(`- ${r}`);
    lines.push('');
  }

  return lines.join('\n');
}

function latest(values: string[]): string | null {
  return values.length > 0 ? values[values.length - 1] : null;
}

function allStudyIds(status: StatusJson): string[] {
  return [
    ...status.studies.active,
    ...status.studies.blocked,
    ...status.studies.completed,
    ...status.studies.closed,
  ];
}

function taskStatus(task: Pick<TaskRecord, 'status'>): string {
  return task.status ?? 'pending';
}

function tasksForStudy(taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[], studyId: string): Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[] {
  return taskRecords.filter((task) => task.study_id === studyId);
}

function statusTaskIds(status: StatusJson): string[] {
  return [
    ...status.tasks.pending,
    ...status.tasks.running,
    ...status.tasks.blocked,
    ...status.tasks.completed,
  ];
}

function studyHasNoTasks(
  status: StatusJson,
  studyId: string,
  taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[]
): boolean {
  if (taskRecords.length > 0) {
    return tasksForStudy(taskRecords, studyId).length === 0;
  }
  return statusTaskIds(status).length === 0;
}

function studyHasPendingOrRunningTasks(
  status: StatusJson,
  studyId: string,
  taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[]
): boolean {
  if (taskRecords.length > 0) {
    return tasksForStudy(taskRecords, studyId).some((task) => ['pending', 'running'].includes(taskStatus(task)));
  }
  return status.tasks.pending.length > 0 || status.tasks.running.length > 0;
}

function studyHasAnyTasks(
  status: StatusJson,
  studyId: string,
  taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[]
): boolean {
  if (taskRecords.length > 0) {
    return tasksForStudy(taskRecords, studyId).length > 0;
  }
  return statusTaskIds(status).length > 0;
}

function summarizeTaskRecords(
  taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[],
  studyId: string
): string[] {
  return tasksForStudy(taskRecords, studyId).map((task) => `${task.task_id}:${taskStatus(task)}`);
}

function summarizeStatus(status: StatusJson): string {
  return [
    `studies active=${status.studies.active.join(',') || '-'} completed=${status.studies.completed.join(',') || '-'} blocked=${status.studies.blocked.join(',') || '-'} closed=${status.studies.closed.join(',') || '-'}`,
    `tasks pending=${status.tasks.pending.join(',') || '-'} running=${status.tasks.running.join(',') || '-'} completed=${status.tasks.completed.join(',') || '-'} blocked=${status.tasks.blocked.join(',') || '-'}`,
    `promotion pending=${status.tasks.promotion_pending.join(',') || '-'} candidate_recorded=${status.tasks.candidate_recorded.join(',') || '-'} registered=${status.tasks.registered.join(',') || '-'}`,
    `close ready=${status.close_preflight.ready.join(',') || '-'} blocked=${status.close_preflight.blocked.map((entry) => `${entry.study_id}(${entry.reasons.join('; ')})`).join(', ') || '-'}`,
  ].join(' | ');
}

export function determineNextStudyId(status: StatusJson): string {
  let maxNum = 0;
  for (const sid of allStudyIds(status)) {
    const match = sid.match(/^STUDY-(\d{3})$/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  return `STUDY-${String(maxNum + 1).padStart(3, '0')}`;
}

function incrementStudyId(studyId: string): string {
  const match = studyId.match(/^STUDY-(\d{3})$/);
  if (!match) return 'STUDY-001';
  return `STUDY-${String(parseInt(match[1], 10) + 1).padStart(3, '0')}`;
}

export function checkTermination(status: StatusJson): TerminationCheck {
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

export function computeInitialPhase(
  status: StatusJson,
  taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[] = []
): PhaseTarget | null {
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

export function nextPhase(current: PhaseTarget, status: StatusJson): PhaseTarget | null {
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
      if (term.shouldTerminate) return null;
      return {
        phase: 'propose',
        target: determineNextStudyId(status),
        command: 'qdd-propose',
      };
    }
  }
}

export function nextDryRunPhase(current: PhaseTarget, status: StatusJson): PhaseTarget {
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

function commandToBootstrapFile(command: AutoCommand): string {
  return command;
}

function phaseLabel(phase: OrchestratorPhase): string {
  switch (phase) {
    case 'start': return 'Thesis Manager (qdd-start)';
    case 'propose': return 'Study Brain (qdd-propose)';
    case 'apply': return 'Executor (qdd-apply)';
    case 'close': return 'Thesis Manager (qdd-close)';
  }
}

function phaseRole(phase: OrchestratorPhase): QddRole {
  switch (phase) {
    case 'start': return 'thesis-manager';
    case 'propose': return 'study-brain';
    case 'apply': return 'executor';
    case 'close': return 'thesis-manager';
  }
}

function dryRunResult(): AgentRunResult {
  return {
    turns: 0,
    finalMessage: 'DRY_RUN',
    terminatedNormally: true,
    toolCalls: 0,
    status: 'completed',
  };
}

function inspectPhaseCompletion(
  current: PhaseTarget,
  status: StatusJson,
  taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[]
): PhaseCompletion {
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

async function ensureProposeTargetExists(
  projectRoot: string,
  current: PhaseTarget,
  log: (message: string) => void,
  events?: AutoRunEvents
): Promise<PhaseTarget> {
  if (current.phase !== 'propose' || !current.target.startsWith('STUDY-')) {
    return current;
  }

  try {
    await buildInstructions(projectRoot, current.target, { command: 'qdd-propose' });
    return current;
  } catch {
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

function formatSummary(iterations: number, studiesCompleted: number, terminalReason: string): string {
  return `Auto mode completed: ${iterations} iterations, ${studiesCompleted} studies closed. Stop reason: ${terminalReason}`;
}

function formatLogExcerpt(message: string, maxLength = 1000): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function formatMaxTurns(maxTurns: number | null): string {
  return maxTurns === null ? 'unlimited' : String(maxTurns);
}

function appendAutoPrompt(instructions: string, prompt?: string): string {
  const trimmed = prompt?.trim();
  if (!trimmed) return instructions;

  return [
    instructions,
    '### Auto Run User Prompt',
    trimmed,
    '',
    'Use this prompt as the durable user intent for the current auto run. During qdd-start, capture stable project-level context and resources from it. During qdd-propose, turn it into the first bounded study and concrete task graph. During qdd-apply and qdd-close, keep the work aligned with this intent while still obeying the persisted QDD files.',
  ].join('\n');
}

export async function runAuto(
  projectRoot: string,
  options: AutoOptions
): Promise<AutoResult> {
  const phases: AutoPhaseResult[] = [];
  const log = options.logger ?? console.log;
  let iterations = 0;
  let studiesCompleted = 0;
  let terminalCode: AutoStopCode = 'max_iterations';
  let terminalReason = `Reached max iterations (${options.maxIterations}).`;

  let status = await buildStatus(projectRoot);
  let taskRecords = await discoverTasks(projectRoot);
  let current = computeInitialPhase(status, taskRecords);

  options.events?.runStart?.({
    projectRoot,
    phase: current,
    model: options.model,
    maxIterations: options.maxIterations,
    maxTurnsPerAgent: options.maxTurnsPerAgent,
    dryRun: options.dryRun,
    prompt: options.prompt,
  });
  if (options.verbose) options.events?.initialState?.({ summary: summarizeStatus(status) });

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
  log(`Model: ${options.model}, Max iterations: ${options.maxIterations}, Max turns per agent: ${formatMaxTurns(options.maxTurnsPerAgent)}`);
  if (options.prompt?.trim()) log(`Prompt: ${formatLogExcerpt(options.prompt, 300)}`);
  if (options.verbose) log(`Initial state: ${summarizeStatus(status)}`);
  log('');

  while (iterations < options.maxIterations) {
    iterations++;

    log(`--- Iteration ${iterations}: ${phaseLabel(current.phase)} ---`);
    const phaseStartEvent: AutoPhaseStartEvent = {
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

      if (current.phase === 'close') studiesCompleted++;
      current = nextDryRunPhase(current, status);
      continue;
    }

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

    phases.push({
      ...current,
      role: instructions.role,
      dryRun: false,
      result,
    });

    log(`  Turns: ${result.turns}, Tool calls: ${result.toolCalls}`);
    log(`  Status: ${result.status}`);
    if (result.failureReason) log(`  Failure: ${result.failureReason}`);
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

    status = await buildStatus(projectRoot);
    taskRecords = await discoverTasks(projectRoot);
    if (options.verbose) {
      log(`  State after phase: ${summarizeStatus(status)}`);
    }
    if (options.verbose) options.events?.stateAfterPhase?.({ summary: summarizeStatus(status) });
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

    if (current.phase === 'close') studiesCompleted++;

    const next = nextPhase(current, status);
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

  if (iterations >= options.maxIterations && terminalCode === 'max_iterations') {
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
