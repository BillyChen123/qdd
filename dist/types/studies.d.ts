import type { TaskPromotionStatus } from './core.js';
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
//# sourceMappingURL=studies.d.ts.map