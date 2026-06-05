import type { BoundaryState, EvolutionState, QuestionChangeType, ResearchContract } from '../types.js';
export declare function createDefaultEvolutionState(): EvolutionState;
export declare function readEvolutionState(projectRoot: string): Promise<EvolutionState>;
export declare function writeEvolutionState(projectRoot: string, state: EvolutionState): Promise<void>;
export declare function summarizeEvolutionBoundaries(state: EvolutionState): {
    total: number;
    open: number;
    resolved: number;
    active: string[];
};
export declare function getCurrentProjectQuestion(contract: ResearchContract, state: EvolutionState): string;
export declare function toBoundaryState(state: EvolutionState): BoundaryState;
export declare function mergeBoundaryStateIntoEvolution(state: EvolutionState, boundaryState: BoundaryState): EvolutionState;
export declare function applyOpenBoundaryTexts(state: EvolutionState, studyId: string, studyQuestion: string, kind: QuestionChangeType, openBoundaryTexts: string[], candidates: string[]): EvolutionState;
export declare function listStudyMemoryPaths(projectRoot: string): Promise<string[]>;
export declare function listRecentStudyMemoryPaths(projectRoot: string, limit?: number): Promise<string[]>;
export declare function buildStudyMemoryMarkdown(options: {
    studyId: string;
    question: string;
    kind: QuestionChangeType;
    changeDriver: string;
    openBoundaryTexts: string[];
    nextCandidates: string[];
    resolvedBoundaryTexts: string[];
}): string;
export declare function writeStudyMemory(projectRoot: string, studyId: string, markdown: string): Promise<string>;
export declare function renderResearchMapHtml(projectRoot: string, outputPath?: string): Promise<string>;
//# sourceMappingURL=evolution.d.ts.map