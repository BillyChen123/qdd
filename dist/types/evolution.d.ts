import type { BoundaryStatus, BoundaryUpdateAction, QuestionChangeType } from './core.js';
export interface LegacyQuestionDelta {
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
export interface LegacyEvolutionTrail {
    evolution_trail: Array<{
        study_id: string;
        question_delta: LegacyQuestionDelta;
        boundary_updates?: BoundaryUpdateSummaryEntry[];
        timestamp: string;
    }>;
}
export type EvolutionBoundaryState = 'open' | 'resolved';
export interface EvolutionBoundary {
    id: string;
    text: string;
    state: EvolutionBoundaryState;
}
export interface EvolutionStudyEvent {
    id: string;
    question: string;
    kind: QuestionChangeType;
    resolves: string[];
    opens: string[];
    candidates: string[];
    ts: string;
}
export interface EvolutionState {
    studies: EvolutionStudyEvent[];
    boundaries: EvolutionBoundary[];
}
export type EvolutionTrail = EvolutionState;
export type QuestionDelta = LegacyQuestionDelta;
//# sourceMappingURL=evolution.d.ts.map