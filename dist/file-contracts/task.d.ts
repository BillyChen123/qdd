import type { TaskRecord } from '../types.js';
import type { ManagedFileContract } from './shared.js';
export declare const TASK_STATUS_VALUES: readonly ["pending", "running", "blocked", "completed"];
export declare const TASK_PROMOTION_VALUES: readonly ["pending", "none", "candidate-recorded", "registered"];
export declare const TASK_SKILLS_SECTION_COMMENT = "<!-- Each bullet must start with a skill ID. Optional description may follow after \":\" or \" - \". -->";
export declare function parseTaskSkillSection(body: string): {
    present: boolean;
    skillIds: string[] | null;
};
export declare function extractTaskSkillIdsFromBody(body: string): string[] | null;
export declare function renderTaskBody(record: TaskRecord, studyId: string, inputs: string[]): string;
export declare function renderTaskMarkdown(record: TaskRecord, studyId: string, inputs: string[]): string;
export declare function createExampleTaskRecord(): TaskRecord;
export declare function createExampleTaskMarkdown(): string;
export declare const taskFileContract: ManagedFileContract;
//# sourceMappingURL=task.d.ts.map