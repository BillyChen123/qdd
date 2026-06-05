import type { QddRole } from './core.js';

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
