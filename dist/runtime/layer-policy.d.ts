import type { LayerPolicy, QddCommand, QddRole } from '../types.js';
export declare function readLayerPolicy(projectRoot: string): Promise<LayerPolicy>;
export declare function resolveCommandRole(policy: LayerPolicy, command: QddCommand | null, fallbackRole: QddRole): QddRole;
export declare function getDefaultSkillsForRole(policy: LayerPolicy, role: QddRole): string[];
export declare function isQddCommand(value: string): value is QddCommand;
//# sourceMappingURL=layer-policy.d.ts.map