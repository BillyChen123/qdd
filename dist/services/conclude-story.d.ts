import type { ConcludeClaimStrength, ConcludeEvidenceDossier, ConcludeEvidenceDossierUnit, ConcludeEvidenceItem, ConcludeStoryCandidate, ConcludeStoryPlan } from '../types.js';
export declare function auditConcludeStoryPlan(candidates: ConcludeStoryCandidate[]): ConcludeStoryPlan['audit'];
export declare function buildConcludeStoryPlan(dossier: ConcludeEvidenceDossier): ConcludeStoryPlan;
export declare function dossierClaimToEvidence(dossier: ConcludeEvidenceDossier, claimId: string, kind: 'supporting' | 'boundary'): ConcludeEvidenceItem[];
export declare function strongestClaimStrength(units: ConcludeEvidenceDossierUnit[]): ConcludeClaimStrength;
//# sourceMappingURL=conclude-story.d.ts.map