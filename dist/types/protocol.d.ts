import type { ArtifactIndexEntry } from './artifacts.js';
import type { QddCommand, QddMode, QddRole, QuestionChangeType } from './core.js';
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
        studies_with_invalid_candidate_paths: string[];
    };
    close_preflight: {
        ready: string[];
        blocked: Array<{
            study_id: string;
            reasons: string[];
        }>;
    };
    artifacts: {
        count: number;
        latest: string[];
    };
    memory: {
        recent: string[];
    };
    boundaries: {
        total: number;
        open: number;
        resolved: number;
        active: string[];
    };
    question_state: {
        last_kind: QuestionChangeType | null;
        next_candidates: string[];
        open_boundary_ids: string[];
    };
}
export interface BoundaryScoreJson {
    mode: 'targets' | 'study';
    target_boundaries: string[];
    legal: boolean;
    missing_active_ancestors: string[];
    suggested_frontier: string[];
    closure: string[];
    frontier: string[];
    closure_size: number;
    frontier_size: number;
    closure_mass: number;
    frontier_mass: number;
    reachable_active_mass: number;
    active_project_mass: number;
    quality_score: number;
    priority_score: number;
    notes: string[];
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
//# sourceMappingURL=protocol.d.ts.map