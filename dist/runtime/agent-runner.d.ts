export interface AgentRunnerOptions {
    model: string;
    systemPrompt: string;
    instructions: string;
    maxTurns: number | null;
    cwd: string;
    signal?: AbortSignal;
    logger?: (message: string) => void;
    verbose?: boolean;
    events?: AgentRunEvents;
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
export interface AgentToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}
export interface AgentRunEvents {
    turnStart?: (event: {
        turn: number;
    }) => void;
    textDelta?: (event: {
        turn: number;
        delta: string;
    }) => void;
    textEnd?: (event: {
        turn: number;
        text: string;
    }) => void;
    toolUse?: (event: {
        turn: number;
        tool: AgentToolCall;
    }) => void;
    toolResult?: (event: {
        turn: number;
        tool: AgentToolCall;
        result: string;
    }) => void;
    completionMarkerMissing?: (event: {
        turn: number;
        attempt: number;
        maxAttempts: number;
    }) => void;
}
export declare function executeProjectBashForTest(cwd: string, command: string, timeoutMs?: number): Promise<string>;
export declare function executeAgentToolForTest(cwd: string, tool: AgentToolCall): Promise<string>;
interface ClaudeSettings {
    ANTHROPIC_AUTH_TOKEN?: string;
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_BASE_URL?: string;
    ANTHROPIC_MODEL?: string;
}
interface ModelResolutionSources {
    env?: NodeJS.ProcessEnv;
    settings?: ClaudeSettings;
}
export declare function parseClaudeSettings(raw: string): ClaudeSettings;
export declare function getClaudeSettings(): ClaudeSettings;
export declare function resolveClaudeApiKey(): string | undefined;
export declare function hasClaudeCredentials(): boolean;
export declare function resolveClaudeModel(cliModel?: string, sources?: ModelResolutionSources): string;
export declare function runAgent(options: AgentRunnerOptions): Promise<AgentRunResult>;
export {};
//# sourceMappingURL=agent-runner.d.ts.map