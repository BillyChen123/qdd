import type { BootstrapTool, BootstrapWorkflow } from './core.js';

// 一条 bootstrap 资产记录。
// 例如把某个 workflow prompt 安装到 codex / claude 时，会记录它落到了哪里。
export interface BootstrapAssetRecord {
  workflow: BootstrapWorkflow;
  path: string;
}

// 某个工具的 bootstrap 安装结果。
export interface BootstrapToolRecord {
  tool: BootstrapTool;
  assets: BootstrapAssetRecord[];
}

// `.qdd/bootstrap.json` 的结构。
// 用来记录当前项目已经安装了哪些 prompt / instructions 资产。
export interface BootstrapConfig {
  version: number;
  installed_at: string;
  instructions_path: string;
  domain_skills_root: string;
  tools: BootstrapToolRecord[];
}
