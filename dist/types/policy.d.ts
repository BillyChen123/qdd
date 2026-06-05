import type { QddRole } from './core.js';
export interface LayerPolicyRoleConfig {
    default_skills: string[];
}
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
//# sourceMappingURL=policy.d.ts.map