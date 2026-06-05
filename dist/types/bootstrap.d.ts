import type { BootstrapTool, BootstrapWorkflow } from './core.js';
export interface BootstrapAssetRecord {
    workflow: BootstrapWorkflow;
    path: string;
}
export interface BootstrapToolRecord {
    tool: BootstrapTool;
    assets: BootstrapAssetRecord[];
}
export interface BootstrapConfig {
    version: number;
    installed_at: string;
    instructions_path: string;
    domain_skills_root: string;
    tools: BootstrapToolRecord[];
}
//# sourceMappingURL=bootstrap.d.ts.map