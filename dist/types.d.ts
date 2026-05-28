export type QddMode = 'human' | 'assist' | 'auto';
export type QuestionChangeType = 'refinement' | 'confirmation' | 'pivot' | 'dissolution';
export type ArtifactType = 'data' | 'code' | 'figure' | 'report';
export type ArtifactScope = 'project' | 'study' | 'task';
export type BootstrapTool = 'claude' | 'codex';
export type BootstrapWorkflow = 'qdd-start' | 'qdd-propose' | 'qdd-explore' | 'qdd-apply' | 'qdd-close';
export interface ResearchContract {
    theme: string;
    initial_question: string;
    mode: QddMode;
    scope: {
        in_scope: string[];
        out_of_scope: string[];
    };
    termination_type: 'best_effort';
}
export interface QuestionDelta {
    question_before: string;
    question_after: string;
    change_type: QuestionChangeType;
    change_driver: string;
    open_boundaries: string[];
}
export interface EvolutionTrail {
    evolution_trail: Array<{
        study_id: string;
        question_delta: QuestionDelta;
        timestamp: string;
    }>;
}
export interface ArtifactIndexEntry {
    id: string;
    type: ArtifactType;
    format: string;
    path: string;
    produced_by: string;
    reusable: boolean;
    scope: ArtifactScope;
    description: string;
    schema: string;
}
export interface ArtifactIndex {
    artifacts: ArtifactIndexEntry[];
}
export interface ArtifactCandidateEntry {
    path: string;
    type: ArtifactType;
    task_id?: string;
    reusable: boolean;
    scope: ArtifactScope;
    description: string;
    schema: string;
}
export interface ArtifactCandidateManifest {
    artifact_candidates: ArtifactCandidateEntry[];
}
export interface StudyRecord {
    study_id: string;
    question: string;
    hypothesis: string;
    status?: 'created' | 'confirmed' | 'running' | 'blocked' | 'completed' | 'closed';
    blockers?: string[];
    task_ids?: string[];
    expected_artifacts?: string[];
    closed_at?: string;
}
export interface TaskRecord {
    task_id: string;
    study_id: string;
    goal: string;
    status?: 'pending' | 'running' | 'blocked' | 'completed';
    expected_outputs?: string[];
    depends_on?: string[];
    skills?: string[];
    artifact_ids?: string[];
    blocker_reason?: string;
    result_summary?: string;
    updated_at?: string;
}
export interface StatusJson {
    project: {
        theme: string;
        mode: QddMode;
        current_question: string;
    };
    studies: {
        active: string[];
        blocked: string[];
        completed: string[];
        closed: string[];
    };
    tasks: {
        pending: string[];
        running: string[];
        blocked: string[];
        completed: string[];
    };
    artifacts: {
        count: number;
        latest: string[];
    };
    question_state: {
        last_change_type: QuestionChangeType | null;
        open_boundaries: string[];
    };
}
export interface InstructionsJson {
    target: {
        kind: 'project' | 'study' | 'task';
        id: string;
    };
    read: string[];
    write: string[];
    required_skills: string[];
    optional_skills: string[];
    rules: string[];
}
export interface ValidationIssue {
    level: 'error' | 'warning';
    code: string;
    path: string;
    message: string;
}
export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
    checked: {
        contract: boolean;
        evolution: boolean;
        artifactIndex: boolean;
        contextFiles: string[];
        studies: string[];
        tasks: string[];
    };
}
export interface ContextEntry {
    path: string;
    name: string;
    data: unknown;
}
export interface ArtifactListJson {
    artifacts: ArtifactIndexEntry[];
}
export interface ContextJson {
    context: ContextEntry[];
}
export interface LocalSkillEntry {
    id: string;
    path: string;
}
export interface BootstrapAssetRecord {
    workflow: BootstrapWorkflow;
    path: string;
}
export interface BootstrapToolRecord {
    tool: BootstrapTool;
    assets: BootstrapAssetRecord[];
}
export interface BootstrapConfig {
    version: number;
    installed_at: string;
    instructions_path: string;
    tools: BootstrapToolRecord[];
}
//# sourceMappingURL=types.d.ts.map