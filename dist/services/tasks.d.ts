import type { AddTaskOptions, CreatedTaskResult, TaskRecord } from '../types.js';
export declare function readTaskDocumentByPath(projectRoot: string, relativePath: string, studyId: string, taskId: string): Promise<{
    relativePath: string;
    record: TaskRecord;
    body: string;
}>;
export declare function findTaskDocument(projectRoot: string, taskId: string): Promise<{
    studyId: string;
    relativePath: string;
    record: TaskRecord;
    body: string;
}>;
export declare function createTask(projectRoot: string, studyId: string, options?: AddTaskOptions): Promise<CreatedTaskResult>;
//# sourceMappingURL=tasks.d.ts.map