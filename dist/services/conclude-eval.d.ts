import type { ConcludeEvalReport, RunConcludeEvalOptions } from '../types.js';
declare function extractVisibleManuscriptText(mainTex: string): string;
declare function collectRawTaskStudyLeakage(visibleText: string): string[];
declare function collectReportToneSignals(visibleText: string): string[];
export declare function runConcludeEval(options: RunConcludeEvalOptions): Promise<ConcludeEvalReport>;
export declare const __testOnly: {
    extractVisibleManuscriptText: typeof extractVisibleManuscriptText;
    collectRawTaskStudyLeakage: typeof collectRawTaskStudyLeakage;
    collectReportToneSignals: typeof collectReportToneSignals;
};
export {};
//# sourceMappingURL=conclude-eval.d.ts.map