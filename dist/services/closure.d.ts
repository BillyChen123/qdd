import type { CloseStudyOptions, StudyClosePreflightResult, StudyRecord, TaskRecord } from '../types.js';
export declare function deriveStudyLifecycleState(study: StudyRecord, tasks: TaskRecord[]): Exclude<StudyRecord['status'], 'confirmed' | undefined>;
export declare function inspectStudyClosePreflight(projectRoot: string, studyId: string): Promise<StudyClosePreflightResult>;
export declare function closeStudy(projectRoot: string, studyId: string, options: CloseStudyOptions): Promise<void>;
//# sourceMappingURL=closure.d.ts.map