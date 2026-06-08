import type { AgentRunResult } from './agent-runner.js';
export interface AutoOptions {
    model: string;
    maxIterations: number;
    maxTurnsPerAgent: number;
    dryRun: boolean;
}
export interface AutoResult {
    iterations: number;
    studiesCompleted: number;
    finalPhase: string;
    summary: string;
    phases: Array<{
        phase: string;
        target: string;
        command: string;
        role: string;
        result: AgentRunResult;
    }>;
}
export declare function runAuto(projectRoot: string, options: AutoOptions): Promise<AutoResult>;
//# sourceMappingURL=orchestrator.d.ts.map