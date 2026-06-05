import type { BoundaryStatus, BoundaryUpdateAction, QuestionChangeType } from './core.js';

// 旧版 question_delta 结构。
// 新版 evolution.yaml 不再把 before / after 作为主状态，
// 但兼容读取旧项目时仍然需要支持它。
export interface LegacyQuestionDelta {
  // 本轮 study 之前的问题表述。
  question_before: string;

  // 本轮 study 之后更新得到的问题表述。
  question_after: string;

  // 问题变化的类型。
  change_type: QuestionChangeType;

  // 导致问题变化的主要证据或结论。
  change_driver: string;

  // 本轮之后仍未解决、需要继续开放探索的边界。
  open_boundaries: string[];
}

// project 当前的 boundary 节点。
// 这里表达的是“项目级未决问题状态”，不是 task 或 method。
export interface BoundaryRecord {
  // 稳定 boundary ID，例如 B001。
  id: string;

  // 边界描述，应该写成问题或约束，而不是方法名。
  text: string;

  // 这个 boundary 依赖哪些上游 boundary 先被澄清。
  depends_on: string[];

  // 人工维护的轻量权重，后续可用于 priority / quality 计算。
  weight: number;

  // 当前状态。
  status: BoundaryStatus;
}

// boundaries.yaml 的结构。
export interface BoundaryState {
  boundaries: BoundaryRecord[];
}

// evolution / render / apply 里需要的轻量 boundary update 摘要。
export interface BoundaryUpdateSummaryEntry {
  boundary_id: string;
  action: BoundaryUpdateAction;
}

// boundary-updates.yaml 中 add 动作的完整负载。
export interface BoundaryAddUpdate {
  action: 'add';
  boundary: BoundaryRecord;
}

// boundary-updates.yaml 中 narrow 动作的负载。
// narrow 允许更新 text / depends_on / weight，但最终状态固定为 narrowed。
export interface BoundaryNarrowUpdate {
  action: 'narrow';
  id: string;
  text?: string;
  depends_on?: string[];
  weight?: number;
}

// resolve / dissolve 只需要指定目标 boundary。
export interface BoundaryStatusUpdate {
  action: 'resolve' | 'dissolve';
  id: string;
}

// boundary-updates.yaml 中允许的更新条目。
export type BoundaryUpdateEntry = BoundaryAddUpdate | BoundaryNarrowUpdate | BoundaryStatusUpdate;

// study-local boundary 更新文件。
export interface BoundaryUpdateManifest {
  updates: BoundaryUpdateEntry[];
}

// 旧版 evolution.yaml 结构。
export interface LegacyEvolutionTrail {
  evolution_trail: Array<{
    // 对应的 study 编号。
    study_id: string;

    // 本轮对问题的更新内容。
    question_delta: LegacyQuestionDelta;

    // 本轮对 project-level boundary state 做了哪些受控更新。
    boundary_updates?: BoundaryUpdateSummaryEntry[];

    // 写入时间，通常为 ISO 时间字符串。
    timestamp: string;
  }>;
}

// 新版 evolution.yaml 里的 boundary 状态。
// 这里故意收得很小：只区分仍需推进 vs 已经收口。
export type EvolutionBoundaryState = 'open' | 'resolved';

// 新版 evolution.yaml 的 boundary 节点。
// 它是项目地图的一部分，不再承担独立治理语义。
export interface EvolutionBoundary {
  id: string;
  text: string;
  state: EvolutionBoundaryState;
}

// 新版 evolution.yaml 的单轮 study 事件。
// 只记录 project 级别真正需要保留的稀疏变化。
export interface EvolutionStudyEvent {
  id: string;
  question: string;
  kind: QuestionChangeType;
  resolves: string[];
  opens: string[];
  candidates: string[];
  ts: string;
}

// 新版 evolution.yaml 真相源。
export interface EvolutionState {
  studies: EvolutionStudyEvent[];
  boundaries: EvolutionBoundary[];
}

// 兼容旧代码里的类型命名。
// 迁移完成前，runtime 会逐步从旧语义切到新版 EvolutionState。
export type EvolutionTrail = EvolutionState;
export type QuestionDelta = LegacyQuestionDelta;
