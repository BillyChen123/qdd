import type { QuestionChangeType } from '../types.js';
import type { ManagedFileContract } from './shared.js';
export declare function buildStudyMemoryMarkdown(options: {
    studyId: string;
    question: string;
    kind: QuestionChangeType;
    changeDriver: string;
    openBoundaryTexts: string[];
    nextCandidates: string[];
    resolvedBoundaryTexts: string[];
}): string;
export declare function createExampleStudyMemoryMarkdown(): string;
export declare const memoryFileContract: ManagedFileContract;
//# sourceMappingURL=memory.d.ts.map