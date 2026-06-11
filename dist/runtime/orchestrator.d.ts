import type { QddCommand, QddRole, StatusJson, TaskRecord } from '../types.js';
import type { AgentRunEvents, AgentRunResult } from './agent-runner.js';
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
    initialState?: (event: {
        summary: string;
    }) => void;
    phaseStart?: (event: AutoPhaseStartEvent) => void;
    dryRunPhase?: (event: AutoPhaseStartEvent & {
        systemPrompt: string;
    }) => void;
    studyScaffold?: (event: {
        requested: string;
        created: string;
    }) => void;
    instructions?: (event: {
        role: QddRole;
        readCount: number;
        writeCount: number;
        requiredSkillCount: number;
    }) => void;
    agent?: AgentRunEvents;
    phaseResult?: (event: {
        phase: PhaseTarget;
        result: AgentRunResult;
    }) => void;
    stateAfterPhase?: (event: {
        summary: string;
    }) => void;
    phaseIncomplete?: (event: {
        reason: string;
        details: string[];
    }) => void;
    terminal?: (event: {
        code: AutoStopCode;
        reason: string;
    }) => void;
}
interface TerminationCheck {
    shouldTerminate: boolean;
    reason: string;
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
export declare function captureManagedPathSnapshot(projectRoot: string): Promise<ManagedPathSnapshot>;
export declare function safeReadAutoStatus(projectRoot: string): Promise<AutoStatusRead>;
export declare function computeNextPhaseAfterCompletedPhase(current: PhaseTarget, status: StatusJson, taskRecords?: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[]): PhaseTarget | null;
export declare function inspectAutoPhaseDrift(projectRoot: string, phase: PhaseTarget, before: ManagedPathSnapshot): Promise<AutoPhaseDrift>;
export declare function determineNextStudyId(status: StatusJson): string;
export declare function checkTermination(status: StatusJson): TerminationCheck;
export declare function computeInitialPhase(status: StatusJson, taskRecords?: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[]): PhaseTarget | null;
export declare function nextPhase(current: PhaseTarget, status: StatusJson): PhaseTarget | null;
export declare function nextDryRunPhase(current: PhaseTarget, status: StatusJson): PhaseTarget;
export type AutoVisibleLanguage = 'default' | 'zh';
export declare function inferAutoVisibleLanguage(prompt?: string, env?: NodeJS.ProcessEnv): AutoVisibleLanguage;
export declare function runAuto(projectRoot: string, options: AutoOptions): Promise<AutoResult>;
export {};
//# sourceMappingURL=orchestrator.d.ts.map