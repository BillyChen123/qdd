export interface ConcludeEvalCase {
    schema_version: 1;
    id: string;
    name: string;
    run_id: string;
    provenance: {
        kind: string;
        source: string;
        notes: string;
    };
    navigation_files: string[];
    underlying_outputs: string[];
    unpromoted_finalized_outputs: string[];
    figures: string[];
    gates: {
        gate1_feedback: string;
        gate1_acceptance: string;
        gate2_feedback: string;
        gate2_acceptance: string;
    };
    reviewer_focus: string[];
}
export declare const CONCLUDE_EVAL_CASES_ROOT: string;
export declare const DEFAULT_CONCLUDE_EVAL_CASE = "sdk-two-gate";
export declare function loadConcludeEvalCase(casePath?: string): Promise<{
    root: string;
    manifestPath: string;
    definition: ConcludeEvalCase;
    fingerprint: string;
}>;
//# sourceMappingURL=conclude-eval-case.d.ts.map