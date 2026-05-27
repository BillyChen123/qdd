import type { ArtifactIndexEntry, ArtifactScope, ArtifactType, QuestionChangeType, StudyRecord, TaskRecord } from '../types.js';
export interface AddStudyOptions {
    question?: string;
    hypothesis?: string;
    blockers?: string[];
    expectedArtifacts?: string[];
}
export interface AddTaskOptions {
    goal?: string;
    dependsOn?: string[];
    inputs?: string[];
    expectedOutputs?: string[];
    skills?: string[];
}
export interface RegisterArtifactOptions {
    artifactType: ArtifactType;
    description: string;
    reusable: boolean;
    studyId?: string;
    taskId?: string;
    scope?: ArtifactScope;
    schema?: string;
}
export interface CloseStudyOptions {
    questionAfter: string;
    changeType: QuestionChangeType;
    changeDriver: string;
    openBoundaries: string[];
}
export interface CreatedStudyResult {
    studyId: string;
    relativePath: string;
}
export interface CreatedTaskResult {
    studyId: string;
    taskId: string;
    relativePath: string;
}
export interface RegisteredArtifactResult {
    artifactId: string;
    entry: ArtifactIndexEntry;
}
export declare function readStudyDocument(projectRoot: string, studyId: string): Promise<{
    relativePath: string;
    record: StudyRecord;
    body: string;
}>;
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
export declare function createStudy(projectRoot: string, options?: AddStudyOptions): Promise<CreatedStudyResult>;
export declare function createTask(projectRoot: string, studyId: string, options?: AddTaskOptions): Promise<CreatedTaskResult>;
export declare function registerArtifact(projectRoot: string, targetPath: string, options: RegisterArtifactOptions): Promise<RegisteredArtifactResult>;
export declare function closeStudy(projectRoot: string, studyId: string, options: CloseStudyOptions): Promise<void>;
export declare function deriveStudyLifecycleState(study: StudyRecord, tasks: TaskRecord[]): Exclude<StudyRecord['status'], 'confirmed' | undefined>;
//# sourceMappingURL=lifecycle.d.ts.map