import type { ConcludeEvalOracle } from '../types.js';
export declare function resolveDefaultConcludeEvalOraclePath(): string;
export declare function validateConcludeEvalOracle(value: unknown): ConcludeEvalOracle;
export declare function loadConcludeEvalOracle(oraclePath?: string): Promise<{
    oracle: ConcludeEvalOracle;
    oraclePath: string;
}>;
//# sourceMappingURL=conclude-eval-oracle.d.ts.map