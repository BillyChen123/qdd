import type { ConcludeClaimSafetyAuditEntry, ConcludeEvalDimensionScore, ConcludeEvalGate, ConcludeEvalHardFail, ConcludeEvalOracle, ConcludeEvalReport, ConcludeFigureAssetMapEntry, ConcludeResultsClaim, RunConcludeEvalOptions } from '../types.js';
interface ManuscriptQualityInput {
    oracle: ConcludeEvalOracle;
    mainTexContent: string;
    referencesBibContent: string;
    mainTexPath: string;
    referencesBibPath: string;
    resultsClaims: ConcludeResultsClaim[];
    figureAssets: ConcludeFigureAssetMapEntry[];
}
interface ManuscriptQualityResult {
    visibleText: string;
    hardFails: ConcludeEvalHardFail[];
    gate: ConcludeEvalGate;
}
declare function stripLatexComments(text: string): string;
declare function extractVisibleManuscriptText(mainTex: string): string;
declare function evaluateManuscriptQuality(input: ManuscriptQualityInput): ManuscriptQualityResult;
declare function scoreLogicalCoherence(mainTex: string, hardFails: ConcludeEvalHardFail[]): ConcludeEvalDimensionScore;
declare function collectAssociativeToCausalOverclaims(claims: ConcludeResultsClaim[], audit: ConcludeClaimSafetyAuditEntry[]): string[];
export declare function runConcludeEval(options: RunConcludeEvalOptions): Promise<ConcludeEvalReport>;
declare function collectRawTaskStudyLeakage(visibleText: string): string[];
declare function collectReportToneSignals(visibleText: string): string[];
export declare const __testOnly: {
    stripLatexComments: typeof stripLatexComments;
    extractVisibleManuscriptText: typeof extractVisibleManuscriptText;
    collectRawTaskStudyLeakage: typeof collectRawTaskStudyLeakage;
    collectReportToneSignals: typeof collectReportToneSignals;
    evaluateManuscriptQuality: typeof evaluateManuscriptQuality;
    scoreLogicalCoherence: typeof scoreLogicalCoherence;
    collectAssociativeToCausalOverclaims: typeof collectAssociativeToCausalOverclaims;
};
export {};
//# sourceMappingURL=conclude-eval.d.ts.map