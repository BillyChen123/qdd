import type { ArtifactIndex } from '../types.js';
import type { ManagedFileContract } from './shared.js';
export declare const ARTIFACT_TYPE_VALUES: readonly ["data", "code", "figure", "table", "report"];
export declare const ARTIFACT_SCOPE_VALUES: readonly ["project", "study", "task"];
export declare function createDefaultArtifactIndex(): ArtifactIndex;
export declare function createExampleArtifactIndex(): ArtifactIndex;
export declare const artifactIndexFileContract: ManagedFileContract;
//# sourceMappingURL=artifact-index.d.ts.map