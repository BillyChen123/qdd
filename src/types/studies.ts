import type { TaskPromotionStatus } from './core.js';

// study 的结构化状态记录。
// 它是对 study.md 的补充索引，方便 CLI 汇总、校验和机器读取。
export interface StudyRecord {
  // study 编号，例如 STUDY-001。
  study_id: string;

  // 当前 study 试图回答的具体问题。
  question: string;

  // 当前 study 的核心假设。
  hypothesis: string;

  // 可选：这轮 study 主要关联哪些当前 project-level boundary。
  // 它不再是强制治理字段，只是帮助人和 Agent 理解 study scope。
  target_boundaries?: string[];

  // study 当前状态。
  status?: 'created' | 'confirmed' | 'running' | 'blocked' | 'completed' | 'closed';

  // 造成阻塞的原因列表。
  blockers?: string[];

  // 该 study 关联的 task 编号列表。
  task_ids?: string[];

  // 预期会产生的关键输出。
  expected_artifacts?: string[];

  // study 关闭时间。
  closed_at?: string;
}

// task 的结构化状态记录。
// 和 StudyRecord 一样，它主要服务于 CLI 状态汇总、执行跟踪和校验。
export interface TaskRecord {
  // task 编号，例如 TASK-001。
  task_id: string;

  // 所属的 study 编号。
  study_id: string;

  // 任务目标，要求直接、可执行。
  goal: string;

  // task 当前状态。
  status?: 'pending' | 'running' | 'blocked' | 'completed';

  // 预期输出，例如脚本、表格、图片、报告。
  expected_outputs?: string[];

  // 依赖的前置 task。
  depends_on?: string[];

  // 执行该 task 时推荐使用的 skills。
  skills?: string[];

  // apply 是否已经检查过本 task 的可复用输出。
  // pending: 还没审
  // none: 审过了，但这轮没有值得提升的材料
  // candidate-recorded: 审过了，并写进了 artifact-candidates.yaml
  // registered: 审过了，并且已经直接登记为 artifact
  promotion_status?: TaskPromotionStatus;

  // 本任务最终关联到的 artifact ID 列表。
  artifact_ids?: string[];

  // 如果阻塞，记录阻塞原因。
  blocker_reason?: string;

  // 本任务结果的摘要。
  result_summary?: string;

  // 最后更新时间。
  updated_at?: string;
}
