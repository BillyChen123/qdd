import type { BoundaryState } from '../types.js';

// 兼容层：历史上 init / policy / bootstrap 会从 runtime/defaults 取默认值。
// 现在这些默认模板的真正归属已经下沉到 file-contracts/*，这里只保留窄转发。

export { createDefaultArtifactCandidateManifest } from '../file-contracts/artifact-candidates.js';
export { createDefaultArtifactIndex } from '../file-contracts/artifact-index.js';
export { createDefaultResearchContract } from '../file-contracts/contract.js';
export { createDefaultEvolutionState as createDefaultEvolutionTrail } from '../file-contracts/evolution.js';
export { createDefaultInstructionsMarkdown } from '../file-contracts/instructions.js';
export { createDefaultLayerPolicy } from '../file-contracts/layer-policy.js';
export { createDefaultResourcesMarkdown } from '../file-contracts/resources.js';

export function createDefaultBoundaryState(): BoundaryState {
  return {
    boundaries: [],
  };
}
