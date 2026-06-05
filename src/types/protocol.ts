import type { ArtifactIndexEntry } from './artifacts.js';
import type { QddCommand, QddMode, QddRole, QuestionChangeType } from './core.js';

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
    studies_with_invalid_candidate_paths: string[];
  };
  close_preflight: {
    ready: string[];
    blocked: Array<{
      study_id: string;
      reasons: string[];
    }>;
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
