import type { EvolutionState } from '../types.js';
import type { ManagedFileContract } from './shared.js';
export declare const QUESTION_CHANGE_VALUES: readonly ["refinement", "confirmation", "pivot", "dissolution"];
export declare const EVOLUTION_BOUNDARY_STATE_VALUES: readonly ["open", "resolved"];
export declare function createDefaultEvolutionState(): EvolutionState;
export declare function createExampleEvolutionState(): EvolutionState;
export declare const evolutionFileContract: ManagedFileContract;
//# sourceMappingURL=evolution.d.ts.map