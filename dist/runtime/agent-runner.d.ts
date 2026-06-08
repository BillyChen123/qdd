export interface AgentRunnerOptions {
    model: string;
    systemPrompt: string;
    instructions: string;
    maxTurns: number;
    cwd: string;
    signal?: AbortSignal;
}
export type AgentRunStatus = 'completed' | 'max_turns' | 'aborted' | 'missing_auth' | 'sdk_error';
export interface AgentRunResult {
    turns: number;
    finalMessage: string;
    terminatedNormally: boolean;
    toolCalls: number;
    status: AgentRunStatus;
    failureReason?: string;
}
interface ClaudeSettings {
    ANTHROPIC_AUTH_TOKEN?: string;
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_BASE_URL?: string;
    ANTHROPIC_MODEL?: string;
}
export declare function getClaudeSettings(): ClaudeSettings;
export declare function resolveClaudeApiKey(): string | undefined;
export declare function hasClaudeCredentials(): boolean;
export declare function resolveClaudeModel(cliModel?: string): string;
export declare function runAgent(options: AgentRunnerOptions): Promise<AgentRunResult>;
export {};
//# sourceMappingURL=agent-runner.d.ts.map