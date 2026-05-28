import type { BootstrapConfig, BootstrapTool } from '../types.js';
interface InstallBootstrapOptions {
    tools: BootstrapTool[];
    refresh: boolean;
    domainSkillsSourceDir?: string;
}
export declare function resolveBootstrapTools(requestedTools?: string[]): BootstrapTool[];
export declare function readBootstrapConfig(projectRoot: string): Promise<BootstrapConfig | null>;
export declare function resolveBootstrapToolsForInit(projectRoot: string, requestedTools?: string[]): Promise<BootstrapTool[]>;
export declare function installBootstrap(projectRoot: string, options: InstallBootstrapOptions): Promise<BootstrapConfig>;
export {};
//# sourceMappingURL=bootstrap.d.ts.map