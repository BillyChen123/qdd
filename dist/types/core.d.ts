export type QddMode = 'human' | 'assist' | 'auto';
export type QuestionChangeType = 'refinement' | 'confirmation' | 'pivot' | 'dissolution';
export type ArtifactType = 'data' | 'code' | 'figure' | 'table' | 'report';
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
//# sourceMappingURL=core.d.ts.map