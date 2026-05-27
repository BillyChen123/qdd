import type { ArtifactScope, ArtifactType } from '../types.js';
export interface RegisterArtifactCommandOptions {
    type?: ArtifactType;
    description?: string;
    reusable?: boolean;
    study?: string;
    task?: string;
    scope?: ArtifactScope;
    schema?: string;
}
export declare function registerArtifactCommand(artifactPath: string | undefined, options?: RegisterArtifactCommandOptions): Promise<void>;
//# sourceMappingURL=register-artifact.d.ts.map