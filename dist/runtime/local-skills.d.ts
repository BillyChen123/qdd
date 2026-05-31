import type { LocalSkillEntry, ProblemSkillEntry, SkillDomain, SkillStage, SkillSuggestJson, SkillTag, SkillsCatalog } from '../types.js';
export declare function normalizeSkillId(value: string): string;
export declare function normalizeTaskSkillIds(skillIds: string[] | undefined): string[];
export declare function isWorkflowSkillId(skillId: string): boolean;
export declare function isPlanningOnlySkillCategory(skillId: string): boolean;
export declare function listControlledSkillDomains(): SkillDomain[];
export declare function listControlledSkillStages(): SkillStage[];
export declare function listControlledSkillTags(): SkillTag[];
export declare function listLocalSkills(projectRoot: string): Promise<LocalSkillEntry[]>;
export declare function listProblemSkills(projectRoot: string): Promise<ProblemSkillEntry[]>;
export declare function buildSkillsCatalog(projectRoot: string): Promise<SkillsCatalog>;
export declare function refreshSkillsCatalog(projectRoot: string): Promise<SkillsCatalog>;
export declare function readSkillsCatalog(projectRoot: string): Promise<SkillsCatalog>;
export declare function suggestProblemSkills(projectRoot: string, query: {
    domain: SkillDomain;
    stage: SkillStage;
    tags?: SkillTag[];
}): Promise<SkillSuggestJson>;
export declare function resolveLocalSkills(projectRoot: string, requestedSkillIds: string[] | undefined, options?: {
    allowPlanningOnly?: boolean;
}): Promise<{
    available: LocalSkillEntry[];
    matched: LocalSkillEntry[];
    missing: string[];
    disallowedWorkflow: string[];
    planningOnly: string[];
}>;
//# sourceMappingURL=local-skills.d.ts.map