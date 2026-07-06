import type { ConcludePreflightOptions, ConcludePreflightResult, ConcludeStoryGenerationResult, GenerateConcludeStoryCandidatesOptions } from '../types.js';
export declare function generateConcludeStoryCandidates(projectRoot: string, options?: GenerateConcludeStoryCandidatesOptions): Promise<ConcludeStoryGenerationResult>;
export declare function renderConcludeRenderStatusMarkdown(result: ConcludePreflightResult): string;
export declare function inspectConcludePreflight(projectRoot: string, options?: ConcludePreflightOptions): Promise<ConcludePreflightResult>;
//# sourceMappingURL=conclude.d.ts.map