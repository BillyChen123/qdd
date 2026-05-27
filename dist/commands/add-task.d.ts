export interface AddTaskCommandOptions {
    goal?: string;
    dependsOn?: string[];
    inputs?: string[];
    expectedOutputs?: string[];
    skills?: string[];
}
export declare function addTaskCommand(studyId: string | undefined, options?: AddTaskCommandOptions): Promise<void>;
//# sourceMappingURL=add-task.d.ts.map