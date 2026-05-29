import type { LayerPolicy, QddCommand, QddLayer, QddRole } from '../types.js';
export declare function readLayerPolicy(projectRoot: string): Promise<LayerPolicy>;
export declare function getRoleForLayer(policy: LayerPolicy, layer: QddLayer): QddRole;
export declare function getLayerForTargetKind(kind: 'project' | 'study' | 'task'): QddLayer;
export declare function resolveCommandDecisionLayer(policy: LayerPolicy, command: QddCommand | null, fallbackTargetKind: 'project' | 'study' | 'task'): QddLayer;
export declare function isQddCommand(value: string): value is QddCommand;
//# sourceMappingURL=layer-policy.d.ts.map