import type { ArtifactScope, ArtifactType } from './core.js';
export interface ArtifactIndexEntry {
    id: string;
    type: ArtifactType;
    format: string;
    path: string;
    produced_by: string;
    reusable: boolean;
    scope: ArtifactScope;
    description: string;
    schema: string;
}
export interface ArtifactIndex {
    artifacts: ArtifactIndexEntry[];
}
export interface ArtifactCandidateEntry {
    path: string;
    type: ArtifactType;
    task_id?: string;
    reusable: boolean;
    scope: ArtifactScope;
    description: string;
    schema: string;
}
export interface ArtifactCandidateManifest {
    artifact_candidates: ArtifactCandidateEntry[];
}
//# sourceMappingURL=artifacts.d.ts.map