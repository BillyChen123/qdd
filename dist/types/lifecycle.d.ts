import type { ArtifactIndexEntry } from './artifacts.js';
import type { ArtifactScope, ArtifactType, QuestionChangeType, TaskPromotionStatus } from './core.js';
import type { StudyRecord } from './studies.js';
export interface AddStudyOptions {
    question?: string;
    hypothesis?: string;
    blockers?: string[];
    expectedArtifacts?: string[];
    targetBoundaries?: string[];
}
export interface AddTaskOptions {
    goal?: string;
    dependsOn?: string[];
    inputs?: string[];
    expectedOutputs?: string[];
    skills?: string[];
}
export interface RegisterArtifactOptions {
    artifactType: ArtifactType;
    description: string;
    reusable: boolean;
    studyId?: string;
    taskId?: string;
    scope?: ArtifactScope;
    schema?: string;
    updateTaskPromotionStatus?: boolean;
}
export interface CloseStudyOptions {
    changeType: QuestionChangeType;
    summary: string;
    openBoundaries: string[];
    nextCandidates?: string[];
}
export interface CreatedStudyResult {
    studyId: string;
    relativePath: string;
}
export interface CreatedTaskResult {
    studyId: string;
    taskId: string;
    relativePath: string;
}
export interface RegisteredArtifactResult {
    artifactId: string;
    entry: ArtifactIndexEntry;
}
export interface StudyClosePreflightResult {
    study_id: string;
    inferred_state: Exclude<StudyRecord['status'], 'confirmed' | undefined>;
    ready: boolean;
    reasons: string[];
    pending_or_running_tasks: string[];
    promotion_pending_tasks: string[];
    unpackaged_entries: string[];
    invalid_candidate_paths: string[];
}
export interface RecordArtifactCandidateOptions {
    artifactType: ArtifactType;
    description: string;
    studyId: string;
    taskId?: string;
    reusable?: boolean;
    scope?: ArtifactScope;
    schema?: string;
    promotionStatus?: TaskPromotionStatus | null;
}
//# sourceMappingURL=lifecycle.d.ts.map