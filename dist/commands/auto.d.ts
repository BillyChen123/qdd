export declare function parseAutoMaxIterationsForTest(value: string | undefined): number | null;
export declare function parseAutoMaxTurnsForTest(value: string | undefined): number | null;
export declare function autoCommand(projectRoot: string, promptArg: string | undefined, options: {
    model?: string;
    maxIterations?: string;
    maxTurns?: string;
    dryRun?: boolean;
    json?: boolean;
    verbose?: boolean;
    prompt?: string;
    promptFile?: string;
}): Promise<void>;
//# sourceMappingURL=auto.d.ts.map