// QDD 的运行模式。
// - human: 以人工决策为主，Agent 只做辅助
// - assist: 人和 Agent 协同推进
// - auto: Agent 按既定流程自动执行
export type QddMode = 'human' | 'assist' | 'auto';

// 一轮 study 结束后，核心问题相对于上一轮是如何变化的。
export type QuestionChangeType = 'refinement' | 'confirmation' | 'pivot' | 'dissolution';

// 可登记为 artifact 的材料类型。
export type ArtifactType = 'data' | 'code' | 'figure' | 'report';

// artifact 的复用边界。
// 这里描述“它适合在哪一层复用”，而不是“它由哪一层产出”。
export type ArtifactScope = 'project' | 'study' | 'task';

// 当前支持注入 bootstrap 资产的 Agent / 工具类型。
export type BootstrapTool = 'claude' | 'codex';

// QDD 当前定义的核心工作流名称。
export type BootstrapWorkflow = 'qdd-start' | 'qdd-propose' | 'qdd-explore' | 'qdd-apply' | 'qdd-close';

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

// 命令上下文名称。
// 当前和 bootstrap workflow 共享同一组命名。
export type QddCommand = BootstrapWorkflow;

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
  deps?: string[];
  weight?: number;
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

// public-data 请求中单条已选数据集。
// 只保留 apply 真正需要消费的最小信息。
export interface PublicDataSelectionEntry {
  dataset_id: string;
  alias: string;
}

// public-data 请求里的结构化查询部分。
// 这个对象是 planning 写给 executor 的薄 handoff，而不是候选集历史。
export interface PublicDataQuery {
  organism?: string;
  tissue?: string;
  disease?: string;
  state?: string;
  cell_type?: string | null;
  max_results?: number;
}

// `studies/STUDY-XXX/output/public_data_request.yaml` 的结构。
// planning 负责写 query 和 selected；apply 只消费 selected。
export interface PublicDataRequest {
  source: 'cellxgene';
  modality: 'scrna';
  goal: string;
  query: PublicDataQuery;
  selected: PublicDataSelectionEntry[];
  selection_note?: string;
}

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

// `qdd status --json` 的输出结构。
// 用于给 Agent 或外部工具快速获取项目当前状态。
export interface StatusJson {
  project: {
    theme: string;
    mode: QddMode;
    current_question: string;
  };
  studies: {
    active: string[];
    blocked: string[];
    completed: string[];
    closed: string[];
  };
  tasks: {
    pending: string[];
    running: string[];
    blocked: string[];
    completed: string[];
    promotion_pending: string[];
    candidate_recorded: string[];
    registered: string[];
  };
  output_review: {
    studies_with_unpackaged_output: string[];
  };
  artifacts: {
    count: number;
    latest: string[];
  };
  memory: {
    recent: string[];
  };
  boundaries: {
    total: number;
    open: number;
    resolved: number;
    active: string[];
  };
  question_state: {
    last_kind: QuestionChangeType | null;
    next_candidates: string[];
    open_boundary_ids: string[];
  };
}

// `qdd boundaries score --json` 的输出结构。
// 它给 planning 一个纯结构化的 proposal 评分面：
// - 这个 target set 现在能不能作为单轮 study
// - 如果不能，建议先收缩到哪个 frontier
// - 当前 proposal 的 readiness / leverage 大概怎样
export interface BoundaryScoreJson {
  mode: 'targets' | 'study';
  target_boundaries: string[];
  legal: boolean;
  missing_active_ancestors: string[];
  suggested_frontier: string[];
  closure: string[];
  frontier: string[];
  closure_size: number;
  frontier_size: number;
  closure_mass: number;
  frontier_mass: number;
  reachable_active_mass: number;
  active_project_mass: number;
  quality_score: number;
  priority_score: number;
  notes: string[];
}

// `qdd instructions <id> --json` 的输出结构。
// 它告诉 Agent：面对某个 project / study / task 时应该读什么、写什么、遵守什么规则。
export interface InstructionsJson {
  command: QddCommand | null;
  target: {
    kind: 'project' | 'study' | 'task';
    id: string;
  };
  role: QddRole;
  read: string[];
  write: string[];
  required_skills: string[];
  optional_skills: string[];
  rules: string[];
}

// 单条校验问题。
// validate 命令会把发现的问题组织成这个结构。
export interface ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

// `qdd validate` 的完整输出。
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  checked: {
    contract: boolean;
    evolution: boolean;
    artifactIndex: boolean;
    layerPolicy: boolean;
    contextFiles: string[];
    studies: string[];
    tasks: string[];
  };
}

// 一条上下文资源。
// 这里是通用抽象，不把 context 限死为 markers / datasets 之类固定类型。
export interface ContextEntry {
  // 资源文件路径。
  path: string;

  // 资源显示名称，通常由路径或文件名派生。
  name: string;

  // 文件解析后的内容；可能是 markdown 文本、YAML 对象等。
  data: unknown;
}

// `qdd artifacts list --json` 的输出结构。
export interface ArtifactListJson {
  artifacts: ArtifactIndexEntry[];
}

// `qdd context --json` 的输出结构。
export interface ContextJson {
  context: ContextEntry[];
}

// 本地 skill 条目。
// 主要用于 runtime 扫描、校验 task skills、以及 bootstrap 投影。
export interface LocalSkillEntry {
  // skill 的稳定标识，例如 qdd/qdd-apply 或 plot/xxx。
  id: string;

  // skill 在仓库中的源路径。
  path: string;
}

// problem-level skill 所属的领域。
// 第一版只收敛到少量可控领域，避免 catalog 变成自由文本。
export type SkillDomain = 'singlecell' | 'spatial' | 'bulk' | 'general';

// problem-level skill 的 stage。
// 第一版保持受控但很小，避免元数据膨胀。
export type SkillStage =
  | 'preprocess'
  | 'integration'
  | 'clustering'
  | 'annotation'
  | 'acquisition'
  | 'de'
  | 'visualization'
  | 'other';

// problem-level skill 的受控标签。
// 这些标签是轻量判别信号，不是自由关键词池。
export type SkillTag =
  | 'scanpy'
  | 'anndata'
  | 'h5ad'
  | 'public-data'
  | 'dataset-search'
  | 'dataset-download'
  | 'cellxgene'
  | 'citation'
  | 'title-match'
  | 'raw-counts'
  | 'qc'
  | 'normalization'
  | 'peaks'
  | 'peak-matrix'
  | 'multiome'
  | 'tfidf'
  | 'lsi'
  | 'multi-sample'
  | 'batch-correction'
  | 'batch-diagnosis'
  | 'neighbors'
  | 'leiden'
  | 'umap'
  | 'markers'
  | 'marker-based'
  | 'gene-activity'
  | 'cell-type'
  | 'cell-state'
  | 'differential-expression'
  | 'differential-accessibility'
  | 'condition-comparison';

// problem-level skill 的 metadata。
// 这里是给轻量 resolver / suggest CLI 用的机器面。
export interface ProblemSkillMetadata {
  id: string;
  domain: SkillDomain;
  stage: SkillStage;
  tags: SkillTag[];
}

// 从本地 skill 里解析出的 problem-level skill 条目。
export interface ProblemSkillEntry extends LocalSkillEntry {
  metadata: ProblemSkillMetadata;
}

// `.qdd/skills-catalog.json` 的结构。
export interface SkillsCatalog {
  generated_at: string;
  skills: ProblemSkillMetadata[];
}

// `qdd skills suggest --json` 的输出结构。
export interface SkillSuggestJson {
  query: {
    domain: SkillDomain;
    stage: SkillStage;
    tags: SkillTag[];
  };
  candidates: Array<{
    id: string;
    domain: SkillDomain;
    stage: SkillStage;
    matched_tags: SkillTag[];
    score: number;
    reasons: string[];
  }>;
  low_confidence: boolean;
}

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

// layer-policy.yaml 中某个 role 的默认 skill 配置。
// 这里是“planning / management 默认读取哪些本地 skills”，
// 不是 task 执行时的真实 skill 清单。
export interface LayerPolicyRoleConfig {
  default_skills: string[];
}

// `.qdd/layer-policy.yaml` 的结构。
// 它不是 task 的显式技能清单，而是“命令 -> 角色”与“角色 -> 默认 skills”的轻量策略。
export interface LayerPolicy {
  commands: {
    'qdd-start': QddRole;
    'qdd-propose': QddRole;
    'qdd-explore': QddRole;
    'qdd-apply': QddRole;
    'qdd-close': QddRole;
  };
  roles: {
    'thesis-manager': LayerPolicyRoleConfig;
    'study-brain': LayerPolicyRoleConfig;
    executor: LayerPolicyRoleConfig;
  };
}
