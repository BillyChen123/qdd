import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import { buildStatus } from './status.js';
import { buildInstructions } from './instructions.js';
import { createStudy } from './lifecycle.js';
import { discoverTasks } from './discovery.js';
import { getStudyArtifactCandidatesPath } from './evidence.js';
import { PATHS } from './constants.js';
import type { InstructionsJson, QddCommand, QddRole, StatusJson, TaskRecord } from '../types.js';
import { hasClaudeCredentials, runAgent } from './agent-runner.js';
import type { AgentRunEvents, AgentRunResult } from './agent-runner.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const bootstrapPromptDir = path.join(moduleDir, 'bootstrap-prompts');

export type OrchestratorPhase = 'start' | 'propose' | 'apply' | 'close';
export type AutoCommand = Extract<QddCommand, 'qdd-start' | 'qdd-propose' | 'qdd-apply' | 'qdd-close'>;
export type AutoStopCode = 'terminal_state' | 'max_iterations' | 'phase_incomplete' | 'agent_failed' | 'missing_auth' | 'invalid_state';

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

export interface AutoInvalidState {
  message: string;
  likelyPath?: string;
}

export interface AutoPhaseDrift {
  changedPaths: string[];
  unexpectedPaths: string[];
}

export interface AutoPhaseResult extends PhaseTarget {
  role: QddRole;
  dryRun: boolean;
  result: AgentRunResult;
  invalidState?: AutoInvalidState;
  drift?: AutoPhaseDrift;
  nextPhase?: PhaseTarget | null;
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

interface AutoStatusReadOk {
  ok: true;
  status: StatusJson;
  taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[];
}

interface AutoStatusReadInvalid {
  ok: false;
  invalidState: AutoInvalidState;
}

type AutoStatusRead = AutoStatusReadOk | AutoStatusReadInvalid;

type ManagedPathSnapshot = Map<string, string>;

const MANAGED_SNAPSHOT_ROOTS = [
  PATHS.contract,
  PATHS.evolution,
  PATHS.researchMapHtml,
  PATHS.contextDir,
  PATHS.studiesDir,
  PATHS.artifactsDir,
];

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

function normalizeProjectPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function isManagedPath(relativePath: string): boolean {
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

async function collectManagedPathEntries(projectRoot: string, relativeDir = ''): Promise<string[]> {
  const absoluteDir = path.join(projectRoot, relativeDir);
  let entries: Array<import('node:fs').Dirent>;
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];
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

async function collectManagedRootEntries(projectRoot: string, relativePath: string): Promise<string[]> {
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
  } catch {
    return [];
  }
  return [];
}

async function fileFingerprint(projectRoot: string, relativePath: string): Promise<string> {
  try {
    const stats = await fs.lstat(path.join(projectRoot, relativePath));
    return `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
  } catch {
    return 'missing';
  }
}

export async function captureManagedPathSnapshot(projectRoot: string): Promise<ManagedPathSnapshot> {
  const snapshot: ManagedPathSnapshot = new Map();
  const relativePaths = (
    await Promise.all(MANAGED_SNAPSHOT_ROOTS.map((relativePath) => collectManagedRootEntries(projectRoot, relativePath)))
  ).flat();
  for (const relativePath of [...new Set(relativePaths)].sort((left, right) => left.localeCompare(right))) {
    snapshot.set(relativePath, await fileFingerprint(projectRoot, relativePath));
  }
  return snapshot;
}

function listChangedManagedPaths(before: ManagedPathSnapshot, after: ManagedPathSnapshot): string[] {
  const allPaths = new Set([...before.keys(), ...after.keys()]);
  return [...allPaths]
    .filter((relativePath) => before.get(relativePath) !== after.get(relativePath))
    .sort((left, right) => left.localeCompare(right));
}

function pathMatchesPattern(relativePath: string, pattern: string): boolean {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
  }
  return relativePath === pattern;
}

function expectedWritePatternsForPhase(phase: OrchestratorPhase, target: string): string[] {
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

function unexpectedWritesForPhase(phase: OrchestratorPhase, target: string, changedPaths: string[]): string[] {
  const patterns = expectedWritePatternsForPhase(phase, target);
  return changedPaths.filter((relativePath) => !patterns.some((pattern) => pathMatchesPattern(relativePath, pattern)));
}

function inferLikelyInvalidStatePath(message: string): string | undefined {
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

export async function safeReadAutoStatus(projectRoot: string): Promise<AutoStatusRead> {
  try {
    const status = await buildStatus(projectRoot);
    if (status.output_review.studies_with_invalid_candidate_paths.length > 0) {
      const studyId = status.output_review.studies_with_invalid_candidate_paths[0] ?? 'STUDY-XXX';
      return {
        ok: false,
        invalidState: {
          message: `Invalid artifact candidate paths detected for ${studyId}.`,
          likelyPath: getStudyArtifactCandidatesPath(studyId),
        },
      };
    }
    return { ok: true, status, taskRecords: await discoverTasks(projectRoot) };
  } catch (error) {
    const message = (error as Error).message;
    return {
      ok: false,
      invalidState: {
        message,
        likelyPath: inferLikelyInvalidStatePath(message),
      },
    };
  }
}

export function computeNextPhaseAfterCompletedPhase(
  current: PhaseTarget,
  status: StatusJson,
  taskRecords: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[] = []
): PhaseTarget | null {
  if (current.phase === 'start' && allStudyIds(status).length === 0) {
    return { phase: 'propose', target: determineNextStudyId(status), command: 'qdd-propose' };
  }
  return computeInitialPhase(status, taskRecords);
}

export async function inspectAutoPhaseDrift(
  projectRoot: string,
  phase: PhaseTarget,
  before: ManagedPathSnapshot
): Promise<AutoPhaseDrift> {
  const after = await captureManagedPathSnapshot(projectRoot);
  const changedPaths = listChangedManagedPaths(before, after);
  return {
    changedPaths,
    unexpectedPaths: unexpectedWritesForPhase(phase.phase, phase.target, changedPaths),
  };
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
  const hasNextCandidates = qs.next_candidates.length > 0;
  const hasOpenBoundaries = qs.open_boundary_ids.length > 0;
  const hasContinuationSignal = hasNextCandidates || hasOpenBoundaries;

  if (!qs.last_kind) {
    return { shouldTerminate: false, reason: '' };
  }
  if (qs.last_kind === 'dissolution') {
    return hasContinuationSignal
      ? { shouldTerminate: false, reason: '' }
      : { shouldTerminate: true, reason: 'Question is dissolved and no executable continuation remains.' };
  }
  if (!hasContinuationSignal) {
    return { shouldTerminate: true, reason: 'Thesis frontier has no next candidates or open boundaries.' };
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

function formatInvalidStateReason(invalidState: AutoInvalidState): string {
  return invalidState.likelyPath
    ? `Invalid managed file state at ${invalidState.likelyPath}: ${invalidState.message}`
    : `Invalid managed file state: ${invalidState.message}`;
}

function formatLogExcerpt(message: string, maxLength = 1000): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function formatMaxTurns(maxTurns: number | null): string {
  return maxTurns === null ? 'unlimited' : String(maxTurns);
}

export type AutoVisibleLanguage = 'default' | 'zh';

export function inferAutoVisibleLanguage(
  prompt?: string,
  env: NodeJS.ProcessEnv = process.env
): AutoVisibleLanguage {
  const requested = env.QDD_AUTO_MODEL_LANG ?? env.QDD_AUTO_LANG ?? env.QDD_LANG ?? '';
  if (/^zh(?:$|[-_])/i.test(requested)) return 'zh';
  if (/^(default|auto|en)(?:$|[-_])/i.test(requested)) return 'default';
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(prompt ?? '') ? 'zh' : 'default';
}

function appendAutoPrompt(instructions: string, prompt?: string): string {
  const trimmed = prompt?.trim();
  const sections = [instructions];

  if (trimmed) {
    sections.push(
      '### Auto Run User Prompt',
      trimmed,
      '',
      'Use this prompt as the durable user intent for the current auto run. During qdd-start, capture stable project-level context and resources from it. During qdd-propose, turn it into the first bounded study and concrete task graph. During qdd-apply and qdd-close, keep the work aligned with this intent while still obeying the persisted QDD files.'
    );
  }

  if (inferAutoVisibleLanguage(prompt) === 'zh') {
    sections.push(
      '',
      '### Visible Output Language',
      'Use Chinese for visible progress notes and concise final summaries shown to the user.',
      'Keep file paths, shell commands, code identifiers, QDD ids, schema keys, and literal data values unchanged.'
    );
  }

  return sections.join('\n');
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

    const phaseEntry: AutoPhaseResult = {
      ...current,
      role: instructions.role,
      dryRun: false,
      result,
    };
    phases.push(phaseEntry);

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
