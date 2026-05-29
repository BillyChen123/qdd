import type { ArtifactCandidateEntry, ArtifactCandidateManifest, ArtifactType } from '../types.js';
export declare function getStudyOutputDir(studyId: string): string;
export declare function getStudyArtifactCandidatesPath(studyId: string): string;
export declare function getStudyOutputSubdirPaths(studyId: string): string[];
export declare function ensureStudyOutputLayout(projectRoot: string, studyId: string): Promise<void>;
export declare function resolveProjectRelativeFilePath(projectRoot: string, targetPath: string): Promise<string>;
export declare function buildCanonicalArtifactPath(artifactId: string, artifactType: ArtifactType, sourceRelativePath: string): string;
export declare function relocateArtifactToCanonicalPath(projectRoot: string, sourceRelativePath: string, targetRelativePath: string): Promise<string>;
export declare function readArtifactCandidateManifest(projectRoot: string, studyId: string): Promise<ArtifactCandidateManifest>;
export declare function readNormalizedArtifactCandidatesForPromotion(projectRoot: string, studyId: string): Promise<ArtifactCandidateEntry[]>;
//# sourceMappingURL=evidence.d.ts.map