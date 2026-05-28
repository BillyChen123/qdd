import type { LocalSkillEntry } from '../types.js';
export declare function normalizeSkillId(value: string): string;
export declare function normalizeTaskSkillIds(skillIds: string[] | undefined): string[];
export declare function isWorkflowSkillId(skillId: string): boolean;
export declare function getCodexLocalSkillPath(skillId: string): string;
export declare function getClaudeLocalSkillPath(skillId: string): string;
export declare function listLocalSkills(projectRoot: string): Promise<LocalSkillEntry[]>;
export declare function resolveLocalSkills(projectRoot: string, requestedSkillIds: string[] | undefined): Promise<{
    available: LocalSkillEntry[];
    matched: LocalSkillEntry[];
    missing: string[];
    disallowedWorkflow: string[];
}>;
//# sourceMappingURL=local-skills.d.ts.map