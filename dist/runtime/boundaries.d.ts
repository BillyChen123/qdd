import type { BoundaryState, BoundaryUpdateManifest, BoundaryUpdateSummaryEntry } from '../types.js';
export declare function readBoundaryState(projectRoot: string): Promise<BoundaryState>;
export declare function writeBoundaryState(projectRoot: string, state: BoundaryState): Promise<void>;
export declare function readBoundaryUpdateManifest(projectRoot: string, relativePath: string): Promise<BoundaryUpdateManifest>;
export declare function applyBoundaryUpdates(projectRoot: string, relativePath: string): Promise<{
    state: BoundaryState;
    updates: BoundaryUpdateSummaryEntry[];
}>;
export declare function summarizeBoundaryState(state: BoundaryState): {
    total: number;
    open: number;
    narrowed: number;
    resolved: number;
    dissolved: number;
    active: string[];
};
export declare function renderBoundaryGraphHtml(projectRoot: string, outputPath?: string): Promise<string>;
//# sourceMappingURL=boundaries.d.ts.map