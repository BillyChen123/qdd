import type { ConcludeFinalPaperPackage, ConcludePreflightOptions, ConcludePreflightResult, ConcludeStoryGenerationResult, GenerateConcludeStoryCandidatesOptions, RunConcludeOptions, RunConcludeResult } from '../types.js';
export declare function generateConcludeStoryCandidates(projectRoot: string, options?: GenerateConcludeStoryCandidatesOptions): Promise<ConcludeStoryGenerationResult>;
export declare function runConclude(projectRoot: string, options?: RunConcludeOptions): Promise<RunConcludeResult>;
export declare function renderConcludeRenderStatusMarkdown(result: ConcludePreflightResult, finalPaper?: ConcludeFinalPaperPackage | null): string;
export declare function inspectConcludePreflight(projectRoot: string, options?: ConcludePreflightOptions): Promise<ConcludePreflightResult>;
//# sourceMappingURL=conclude.d.ts.map