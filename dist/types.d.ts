export type QddMode = 'human' | 'assist' | 'auto';
export type QuestionChangeType = 'refinement' | 'confirmation' | 'pivot' | 'dissolution';
export type ArtifactType = 'data' | 'code' | 'figure' | 'report';
export type ArtifactScope = 'project' | 'study' | 'task';
export type BootstrapTool = 'claude' | 'codex';
export type BootstrapWorkflow = 'qdd-start' | 'qdd-propose' | 'qdd-explore' | 'qdd-apply' | 'qdd-close';
export type BoundaryStatus = 'open' | 'narrowed' | 'resolved' | 'dissolved';
export type BoundaryUpdateAction = 'add' | 'narrow' | 'resolve' | 'dissolve';
export type TaskPromotionStatus = 'pending' | 'none' | 'candidate-recorded' | 'registered';
export type QddRole = 'thesis-manager' | 'study-brain' | 'executor';
export type QddCommand = BootstrapWorkflow;
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
export interface BoundaryRecord {
    id: string;
    text: string;
    depends_on: string[];
    weight: number;
    status: BoundaryStatus;
}
export interface BoundaryState {
    boundaries: BoundaryRecord[];
}
export interface BoundaryUpdateSummaryEntry {
    boundary_id: string;
    action: BoundaryUpdateAction;
}
export interface BoundaryAddUpdate {
    action: 'add';
    boundary: BoundaryRecord;
}
export interface BoundaryNarrowUpdate {
    action: 'narrow';
    id: string;
    text?: string;
    depends_on?: string[];
    weight?: number;
}
export interface BoundaryStatusUpdate {
    action: 'resolve' | 'dissolve';
    id: string;
}
export type BoundaryUpdateEntry = BoundaryAddUpdate | BoundaryNarrowUpdate | BoundaryStatusUpdate;
export interface BoundaryUpdateManifest {
    updates: BoundaryUpdateEntry[];
}
export interface EvolutionTrail {
    evolution_trail: Array<{
        study_id: string;
        question_delta: QuestionDelta;
        boundary_updates?: BoundaryUpdateSummaryEntry[];
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
export interface PublicDataSelectionEntry {
    dataset_id: string;
    alias: string;
}
export interface PublicDataQuery {
    organism?: string;
    tissue?: string;
    disease?: string;
    state?: string;
    cell_type?: string | null;
    max_results?: number;
}
export interface PublicDataRequest {
    source: 'cellxgene';
    modality: 'scrna';
    goal: string;
    query: PublicDataQuery;
    selected: PublicDataSelectionEntry[];
    selection_note?: string;
}
export interface StudyRecord {
    study_id: string;
    question: string;
    hypothesis: string;
    target_boundaries?: string[];
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
    promotion_status?: TaskPromotionStatus;
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
        promotion_pending: string[];
        candidate_recorded: string[];
        registered: string[];
    };
    output_review: {
        studies_with_unpackaged_output: string[];
    };
    artifacts: {
        count: number;
        latest: string[];
    };
    boundaries: {
        total: number;
        open: number;
        narrowed: number;
        resolved: number;
        dissolved: number;
        active: string[];
    };
    question_state: {
        last_change_type: QuestionChangeType | null;
        open_boundaries: string[];
    };
}
export interface InstructionsJson {
    command: QddCommand | null;
    target: {
        kind: 'project' | 'study' | 'task';
        id: string;
    };
    role: QddRole;
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
        boundaries: boolean;
        evolution: boolean;
        artifactIndex: boolean;
        layerPolicy: boolean;
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
export type SkillDomain = 'singlecell' | 'spatial' | 'bulk' | 'general';
export type SkillStage = 'preprocess' | 'integration' | 'clustering' | 'annotation' | 'acquisition' | 'de' | 'visualization' | 'other';
export type SkillTag = 'scanpy' | 'anndata' | 'h5ad' | 'public-data' | 'dataset-search' | 'dataset-download' | 'cellxgene' | 'citation' | 'title-match' | 'raw-counts' | 'qc' | 'normalization' | 'peaks' | 'peak-matrix' | 'multiome' | 'tfidf' | 'lsi' | 'multi-sample' | 'batch-correction' | 'batch-diagnosis' | 'neighbors' | 'leiden' | 'umap' | 'markers' | 'marker-based' | 'gene-activity' | 'cell-type' | 'cell-state' | 'differential-expression' | 'differential-accessibility' | 'condition-comparison';
export interface ProblemSkillMetadata {
    id: string;
    domain: SkillDomain;
    stage: SkillStage;
    tags: SkillTag[];
}
export interface ProblemSkillEntry extends LocalSkillEntry {
    metadata: ProblemSkillMetadata;
}
export interface SkillsCatalog {
    generated_at: string;
    skills: ProblemSkillMetadata[];
}
export interface SkillSuggestJson {
    query: {
        domain: SkillDomain;
        stage: SkillStage;
        tags: SkillTag[];
    };
    candidates: Array<{
        id: string;
        domain: SkillDomain;
        stage: SkillStage;
        matched_tags: SkillTag[];
        score: number;
        reasons: string[];
    }>;
    low_confidence: boolean;
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
    domain_skills_root: string;
    tools: BootstrapToolRecord[];
}
export interface LayerPolicyRoleConfig {
    default_skills: string[];
}
export interface LayerPolicy {
    commands: {
        'qdd-start': QddRole;
        'qdd-propose': QddRole;
        'qdd-explore': QddRole;
        'qdd-apply': QddRole;
        'qdd-close': QddRole;
    };
    roles: {
        'thesis-manager': LayerPolicyRoleConfig;
        'study-brain': LayerPolicyRoleConfig;
        executor: LayerPolicyRoleConfig;
    };
}
//# sourceMappingURL=types.d.ts.map