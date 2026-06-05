import type { ArtifactScope, ArtifactType } from './core.js';

// 已正式登记的 artifact 条目。
// 这些条目通常写入 artifacts/index.yaml，表示已经被提升为可管理、可复用证据。
export interface ArtifactIndexEntry {
  // artifact 的稳定 ID，供任务、study、后续复用引用。
  id: string;

  // artifact 的材料类型，例如 code / figure。
  type: ArtifactType;

  // 文件格式或数据格式，例如 png / csv / py / md。
  format: string;

  // artifact 的相对路径。
  path: string;

  // 产出者，一般记录为 study 或 task 的标识。
  produced_by: string;

  // 是否推荐在后续工作中复用。
  reusable: boolean;

  // 复用边界。比如 task-scope 表示只适合当前任务内部参考，
  // project-scope 表示适合进入项目级公共上下文。
  scope: ArtifactScope;

  // 给人和 Agent 看的简短说明。
  description: string;

  // 该 artifact 预期遵循的结构约束；目前通常是文本标识。
  schema: string;
}

// 已登记 artifact 的索引文件结构。
export interface ArtifactIndex {
  artifacts: ArtifactIndexEntry[];
}

// artifact 候选条目。
// apply 阶段先写“候选”，close 阶段再从候选中筛选并提升为正式 artifact。
export interface ArtifactCandidateEntry {
  // 候选材料的相对路径。
  path: string;

  // 候选材料的类型。
  type: ArtifactType;

  // 直接产出它的 task；这是任务级 provenance，不等于 scope。
  task_id?: string;

  // 是否值得在后续复用。
  reusable: boolean;

  // 复用边界，而不是生产来源。
  scope: ArtifactScope;

  // 对候选材料的用途说明。
  description: string;

  // 预期结构或约束说明。
  schema: string;
}

// artifact 候选清单文件结构。
export interface ArtifactCandidateManifest {
  artifact_candidates: ArtifactCandidateEntry[];
}
