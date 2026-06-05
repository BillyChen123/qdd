import type { AddStudyOptions, CreatedStudyResult, StudyRecord } from '../types.js';
export declare function readStudyDocument(projectRoot: string, studyId: string): Promise<{
    relativePath: string;
    record: StudyRecord;
    body: string;
}>;
export declare function createStudy(projectRoot: string, options?: AddStudyOptions): Promise<CreatedStudyResult>;
//# sourceMappingURL=studies.d.ts.map