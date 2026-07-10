import type { ConcludeCanonicalStory, ConcludeClaimStrength, ConcludeEvidenceDossier, ConcludeEvidenceDossierUnit, ConcludeEvidenceItem, ConcludeQuestionEvolutionTransition, ConcludeSemanticStoryPlanner, ConcludeSemanticStoryPlannerInput, ConcludeStoryOracleConstraints, ConcludeStoryPlan, EvolutionState } from '../types.js';
interface StoryPlanBuildOptions {
    evolution?: EvolutionState | null;
    semanticPlanner?: ConcludeSemanticStoryPlanner;
    oracleConstraints?: ConcludeStoryOracleConstraints | null;
}
export declare function buildConcludeQuestionEvolutionTransitions(evolution: EvolutionState | null | undefined): ConcludeQuestionEvolutionTransition[];
export declare const defaultConcludeSemanticStoryPlanner: ConcludeSemanticStoryPlanner;
export declare function auditConcludeStoryPlan(story: ConcludeCanonicalStory | null, input?: ConcludeSemanticStoryPlannerInput): ConcludeStoryPlan['audit'];
export declare function buildConcludeStoryPlan(dossier: ConcludeEvidenceDossier, options?: StoryPlanBuildOptions): Promise<ConcludeStoryPlan>;
export declare function dossierClaimToEvidence(dossier: ConcludeEvidenceDossier, claimId: string, kind: 'supporting' | 'boundary'): ConcludeEvidenceItem[];
export declare function strongestClaimStrength(units: ConcludeEvidenceDossierUnit[]): ConcludeClaimStrength;
export {};
//# sourceMappingURL=conclude-story.d.ts.map