import type { ArtifactListJson, ContextJson, ValidationResult } from '../types.js';
export declare function listArtifacts(projectRoot: string): Promise<ArtifactListJson>;
export declare function listContext(projectRoot: string): Promise<ContextJson>;
export declare function validateProject(projectRoot: string): Promise<ValidationResult>;
//# sourceMappingURL=inspection.d.ts.map