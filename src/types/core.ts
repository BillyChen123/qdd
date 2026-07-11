// QDD 的运行模式。
// - human: 以人工决策为主，Agent 只做辅助
// - assist: 人和 Agent 协同推进
// - auto: Agent 按既定流程自动执行
export type QddMode = 'human' | 'assist' | 'auto';

// 一轮 study 结束后，核心问题相对于上一轮是如何变化的。
export type QuestionChangeType = 'refinement' | 'confirmation' | 'pivot' | 'dissolution';

// 可登记为 artifact 的材料类型。
// `table` 在这里是一等公民，不再被迫塞进 data。
export type ArtifactType = 'data' | 'code' | 'figure' | 'table' | 'report';

// artifact 的复用边界。
// 这里描述“它适合在哪一层复用”，而不是“它由哪一层产出”。
export type ArtifactScope = 'project' | 'study' | 'task';

// 当前支持注入 bootstrap 资产的 Agent / 工具类型。
export type BootstrapTool = 'claude' | 'codex';

// qdd init 当前安装的项目级 human workflow 名称。
export type BootstrapWorkflow = 'qdd-start' | 'qdd-propose' | 'qdd-explore' | 'qdd-apply' | 'qdd-close' | 'qdd-conclude';

// project-level boundary 当前所处的状态。
// 这组状态主要服务于旧版 boundary 兼容层。
export type BoundaryStatus = 'open' | 'narrowed' | 'resolved' | 'dissolved';

// 受控的 boundary 更新动作。
// 第一版故意收得很小，只支持最核心的四种状态迁移。
export type BoundaryUpdateAction = 'add' | 'narrow' | 'resolve' | 'dissolve';

// task 在 apply / close 之间的 promotion review 状态。
// 这里刻意保持很小，只回答一个问题：
// “这个 task 的可复用输出，apply 到底审没审过？”
export type TaskPromotionStatus = 'pending' | 'none' | 'candidate-recorded' | 'registered';

// 每一层默认绑定的角色名称。
export type QddRole = 'thesis-manager' | 'study-brain' | 'executor';

// CLI instructions / runtime 当前支持的命令上下文名称。
// qdd-conclude 目前只作为通用 agent 的 human workflow 安装，不是 CLI 或 auto runtime phase。
export type QddCommand = Exclude<BootstrapWorkflow, 'qdd-conclude'>;

// 项目级研究合同。
// 用来描述这个 QDD 项目的总主题、初始问题、运行模式，以及边界约束。
export interface ResearchContract {
  // 研究主题，例如某个生物学问题或疾病方向。
  theme: string;

  // 项目启动时的初始研究问题。
  initial_question: string;

  // 当前项目采用的人机协作模式。
  mode: QddMode;

  // 项目边界：哪些事情明确要做，哪些事情明确不做。
  scope: {
    in_scope: string[];
    out_of_scope: string[];
  };

  // 当前先固定为 best_effort，表示尽力推进而不是保证完全证明。
  termination_type: 'best_effort';
}
