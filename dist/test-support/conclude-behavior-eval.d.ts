import { type ConcludeEvalCase } from './conclude-eval-case.js';
export declare const MAX_EVAL_TOOL_TEXT_CHARS = 120000;
export type ConcludeEvalMode = 'fake' | 'live';
export type ConcludeEvalStatus = 'passed' | 'failed' | 'blocked';
export type ConcludeEvalStage = 'synthesis' | 'gate1_feedback' | 'story_draft' | 'gate2_revision' | 'semantic_review';
export type SemanticReviewStatus = 'pass' | 'fail' | 'cannot_assess';
export interface ConcludeEvalTranscriptEntry {
    sequence: number;
    timestamp: string;
    stage: ConcludeEvalStage;
    actor: 'human' | 'assistant' | 'tool';
    kind: 'message' | 'tool_use' | 'tool_result';
    content: string;
    tool?: string;
    path?: string;
}
export interface ConcludeEvalAccessEntry {
    sequence: number;
    timestamp: string;
    stage: ConcludeEvalStage;
    action: 'list' | 'read' | 'write' | 'view_image' | 'view_image_deferred';
    path: string;
}
export interface ConcludeEvalAssertion {
    id: string;
    status: 'pass' | 'fail' | 'not_run';
    detail: string;
}
export interface ConcludeEvalReport {
    schema_version: 2;
    mode: ConcludeEvalMode;
    status: ConcludeEvalStatus;
    started_at: string;
    finished_at: string;
    model: string;
    provider: string;
    repository_commit: string;
    production_skill_sha256: string;
    case: {
        id: string;
        name: string;
        fingerprint_sha256: string;
        provenance: ConcludeEvalCase['provenance'];
    };
    fixture_path: string;
    project_path: string;
    installed_skill_path: string;
    outputs: {
        run_root: string;
        conclusion_dir: string;
        research_synthesis: string;
        story: string;
        story_before_gate2_revision: string;
        transcript: string;
        access_log: string;
        report_json: string;
        report_markdown: string;
        semantic_review_json: string;
        semantic_review_transcript: string;
        semantic_review_access_log: string;
    };
    harness: {
        status: 'PASS' | 'FAIL' | 'NOT_RUN';
        assertions: ConcludeEvalAssertion[];
    };
    semantic_review: ConcludeSemanticReview;
    capabilities: {
        pixel_level_visual_verification: 'available' | 'deferred';
    };
    environment_blockers: string[];
    gates: Array<{
        gate: 'gate_1' | 'gate_2';
        action: 'feedback' | 'accepted';
        message: string;
    }>;
    stage_results: Array<{
        stage: ConcludeEvalStage;
        assistant_message: string;
        research_synthesis_exists: boolean;
        story_exists: boolean;
    }>;
}
export interface RunConcludeEvalOptions {
    mode: ConcludeEvalMode;
    outputRoot: string;
    model?: string;
    provider?: string;
    casePath?: string;
    projectPath?: string;
    runId?: string;
    visionAvailable?: boolean;
    credentialOverride?: string | null;
}
export interface ConcludeSemanticReview {
    protocol_version: 1;
    verdict: 'accepted' | 'revision_required' | 'blocked';
    summary: string;
    dimensions: Array<{
        id: string;
        status: SemanticReviewStatus;
        analysis: string;
        evidence_paths: string[];
    }>;
    major_claim_checks: Array<{
        claim: string;
        status: SemanticReviewStatus;
        analysis: string;
        source_paths: string[];
    }>;
    figure_checks: Array<{
        figure_path: string;
        status: SemanticReviewStatus;
        analysis: string;
    }>;
    findings: Array<{
        severity: 'critical' | 'major' | 'minor';
        detail: string;
        evidence_paths: string[];
    }>;
}
export declare function truncateEvalToolText(value: string): string;
export declare function recheckConcludeBehaviorEval(outputRoot: string): Promise<ConcludeEvalReport>;
export declare function runConcludeBehaviorEval(options: RunConcludeEvalOptions): Promise<ConcludeEvalReport>;
//# sourceMappingURL=conclude-behavior-eval.d.ts.map