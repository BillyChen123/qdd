import type { StudyRecord } from './studies.js';
export declare const CONCLUDE_RENDERING_TOOL_VALUES: readonly ["latexmk", "xelatex", "pdflatex", "pandoc"];
export declare const CONCLUDE_EVIDENCE_KIND_VALUES: readonly ["promoted-artifact", "study-output", "study-memory", "reusable-context"];
export declare const CONCLUDE_EVIDENCE_CATEGORY_VALUES: readonly ["data", "code", "figure", "table", "report", "memory", "context"];
export declare const CONCLUDE_EVIDENCE_SIGNAL_VALUES: readonly ["positive", "negative", "blocked", "downgraded", "dissolved", "boundary"];
export type ConcludeRenderingTool = (typeof CONCLUDE_RENDERING_TOOL_VALUES)[number];
export type ConcludeEvidenceKind = (typeof CONCLUDE_EVIDENCE_KIND_VALUES)[number];
export type ConcludeEvidenceCategory = (typeof CONCLUDE_EVIDENCE_CATEGORY_VALUES)[number];
export type ConcludeEvidenceSignal = (typeof CONCLUDE_EVIDENCE_SIGNAL_VALUES)[number];
export interface ConcludeRenderingToolStatus {
    tool: ConcludeRenderingTool;
    available: boolean;
    resolved_path: string | null;
}
export interface ConcludeStudyPreflight {
    study_id: string;
    study_path: string;
    status: StudyRecord['status'] | 'created';
    memory_path: string | null;
    unpackaged_entries: string[];
    invalid_candidate_paths: string[];
}
export interface ConcludePreflightResult {
    contract_path: string;
    evolution_path: string;
    resources_path: string;
    artifact_index_path: string;
    study_paths: string[];
    memory_paths: string[];
    reusable_context_paths: string[];
    rendering_tools: ConcludeRenderingToolStatus[];
    study_checks: ConcludeStudyPreflight[];
    warnings: string[];
}
export interface ConcludeEvidenceItem {
    id: string;
    kind: ConcludeEvidenceKind;
    category: ConcludeEvidenceCategory;
    title: string;
    relative_path: string | null;
    source_path: string;
    provenance: string;
    study_id: string | null;
    task_id: string | null;
    description: string;
    promoted_artifact_id: string | null;
}
export interface ConcludeEvidenceClue {
    id: string;
    signal: ConcludeEvidenceSignal;
    text: string;
    source_path: string;
    provenance: string;
    study_id: string | null;
    task_id: string | null;
}
export interface ConcludeHarvestSummary {
    evidence_item_count: number;
    clue_count: number;
    items_by_kind: Record<ConcludeEvidenceKind, number>;
    clues_by_signal: Record<ConcludeEvidenceSignal, number>;
}
export interface RunConcludeOptions {
    outputDir?: string;
}
export interface RunConcludeResult {
    run_id: string;
    output_dir: string;
    evidence_audit_path: string;
    preflight: ConcludePreflightResult;
    evidence_items: ConcludeEvidenceItem[];
    evidence_clues: ConcludeEvidenceClue[];
    summary: ConcludeHarvestSummary;
}
//# sourceMappingURL=conclude.d.ts.map