import type { StudyRecord } from '../types.js';
import type { ManagedFileContract } from './shared.js';
export declare const STUDY_STATUS_VALUES: readonly ["created", "confirmed", "running", "blocked", "completed", "closed"];
export declare function renderStudyBody(record: StudyRecord): string;
export declare function renderStudyMarkdown(record: StudyRecord): string;
export declare function createExampleStudyRecord(): StudyRecord;
export declare const studyFileContract: ManagedFileContract;
//# sourceMappingURL=study.d.ts.map