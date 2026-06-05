import type { ArtifactCandidateEntry, ArtifactCandidateManifest, ArtifactType } from '../types.js';
export declare function isCanonicalStudyOutputPath(studyId: string, relativePath: string): boolean;
export declare function isScratchStudyOutputPath(studyId: string, relativePath: string): boolean;
export declare function isPromotableStudyOutputPath(studyId: string, relativePath: string): boolean;
export declare function getStudyOutputDir(studyId: string): string;
export declare function getStudyArtifactCandidatesPath(studyId: string): string;
export declare function getStudyPublicDataRequestPath(studyId: string): string;
export declare function getStudyOutputSubdirPaths(studyId: string): string[];
export declare function listNonCanonicalStudyOutputEntries(projectRoot: string, studyId: string): Promise<string[]>;
export declare function ensureStudyOutputLayout(projectRoot: string, studyId: string): Promise<void>;
export declare function resolveProjectRelativeFilePath(projectRoot: string, targetPath: string): Promise<string>;
export declare function buildCanonicalArtifactPath(artifactId: string, artifactType: ArtifactType, sourceRelativePath: string): string;
export declare function relocateArtifactToCanonicalPath(projectRoot: string, sourceRelativePath: string, targetRelativePath: string): Promise<string>;
export declare function readArtifactCandidateManifest(projectRoot: string, studyId: string): Promise<ArtifactCandidateManifest>;
export interface CandidatePathIssue {
    index: number;
    path: string;
    reason: string;
}
export declare function inspectArtifactCandidatePaths(projectRoot: string, studyId: string): Promise<CandidatePathIssue[]>;
export declare function readNormalizedArtifactCandidatesForPromotion(projectRoot: string, studyId: string): Promise<ArtifactCandidateEntry[]>;
//# sourceMappingURL=evidence.d.ts.map