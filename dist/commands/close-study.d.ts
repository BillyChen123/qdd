import type { QuestionChangeType } from '../types.js';
export interface CloseStudyCommandOptions {
    questionAfter?: string;
    changeType?: QuestionChangeType;
    changeDriver?: string;
    openBoundaries?: string[];
}
export declare function closeStudyCommand(studyId: string | undefined, options?: CloseStudyCommandOptions): Promise<void>;
//# sourceMappingURL=close-study.d.ts.map