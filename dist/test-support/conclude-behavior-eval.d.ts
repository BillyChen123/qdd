export type ConcludeEvalMode = 'fake' | 'live';
export type ConcludeEvalStatus = 'passed' | 'failed' | 'blocked';
export type ConcludeEvalStage = 'synthesis' | 'gate1_feedback' | 'story_draft' | 'gate2_revision';
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
    action: 'list' | 'read' | 'write' | 'view_image';
    path: string;
}
export interface ConcludeEvalAssertion {
    id: string;
    status: 'pass' | 'fail' | 'not_run';
    detail: string;
}
export interface ConcludeEvalReport {
    schema_version: 1;
    mode: ConcludeEvalMode;
    status: ConcludeEvalStatus;
    started_at: string;
    finished_at: string;
    model: string;
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
    };
    harness: {
        status: 'PASS' | 'FAIL' | 'NOT_RUN';
        assertions: ConcludeEvalAssertion[];
    };
    semantic_observations: Array<{
        id: string;
        status: 'simulated' | 'review_required' | 'not_run';
        detail: string;
        evidence_paths: string[];
    }>;
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
    credentialOverride?: string | null;
}
export declare const CONCLUDE_EVAL_FIXTURE_PATH: string;
export declare function runConcludeBehaviorEval(options: RunConcludeEvalOptions): Promise<ConcludeEvalReport>;
//# sourceMappingURL=conclude-behavior-eval.d.ts.map