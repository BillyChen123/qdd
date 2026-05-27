export interface AddStudyCommandOptions {
    question?: string;
    hypothesis?: string;
    blockers?: string[];
    expectedArtifacts?: string[];
}
export declare function addStudyCommand(options?: AddStudyCommandOptions): Promise<void>;
//# sourceMappingURL=add-study.d.ts.map