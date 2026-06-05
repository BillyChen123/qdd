import type { QuestionChangeType } from '../types.js';
export interface CloseStudyCommandOptions {
    changeType?: QuestionChangeType;
    summary?: string;
    openBoundaries?: string[];
    nextCandidates?: string[];
}
export declare function closeStudyCommand(studyId: string | undefined, options?: CloseStudyCommandOptions): Promise<void>;
//# sourceMappingURL=close-study.d.ts.map