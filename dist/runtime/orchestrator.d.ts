import type { QddCommand, QddRole, StatusJson, TaskRecord } from '../types.js';
import type { AgentRunResult } from './agent-runner.js';
export type OrchestratorPhase = 'start' | 'propose' | 'apply' | 'close';
export type AutoCommand = Extract<QddCommand, 'qdd-start' | 'qdd-propose' | 'qdd-apply' | 'qdd-close'>;
export type AutoStopCode = 'terminal_state' | 'max_iterations' | 'phase_incomplete' | 'agent_failed' | 'missing_auth';
export interface AutoOptions {
    model: string;
    maxIterations: number;
    maxTurnsPerAgent: number;
    dryRun: boolean;
    logger?: (message: string) => void;
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
interface TerminationCheck {
    shouldTerminate: boolean;
    reason: string;
}
export declare function determineNextStudyId(status: StatusJson): string;
export declare function checkTermination(status: StatusJson): TerminationCheck;
export declare function computeInitialPhase(status: StatusJson, taskRecords?: Pick<TaskRecord, 'study_id' | 'task_id' | 'status'>[]): PhaseTarget | null;
export declare function nextPhase(current: PhaseTarget, status: StatusJson): PhaseTarget | null;
export declare function nextDryRunPhase(current: PhaseTarget, status: StatusJson): PhaseTarget;
export declare function runAuto(projectRoot: string, options: AutoOptions): Promise<AutoResult>;
export {};
//# sourceMappingURL=orchestrator.d.ts.map