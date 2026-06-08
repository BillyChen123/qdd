export interface AgentRunnerOptions {
    model: string;
    systemPrompt: string;
    instructions: string;
    maxTurns: number;
    cwd: string;
    signal?: AbortSignal;
}
export interface AgentRunResult {
    turns: number;
    finalMessage: string;
    terminatedNormally: boolean;
    toolCalls: number;
}
export declare function runAgent(options: AgentRunnerOptions): Promise<AgentRunResult>;
//# sourceMappingURL=agent-runner.d.ts.map