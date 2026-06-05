import type { ManagedFileContract } from './shared.js';
declare const MANAGED_FILE_CONTRACT_IDS_BY_TARGET: {
    readonly project: readonly ["contract", "evolution", "artifact-index", "resources", "layer-policy"];
    readonly study: readonly ["study", "task", "artifact-candidates", "memory", "public-data-request"];
    readonly task: readonly ["task", "artifact-candidates", "public-data-request"];
};
export declare function listManagedFileContracts(): ManagedFileContract[];
export declare function getManagedFileContract(id: string): ManagedFileContract;
export declare function getManagedFileExamplePath(contract: ManagedFileContract): string;
export declare function buildManagedFileReferenceOutputs(): Array<{
    relativePath: string;
    content: string;
}>;
export declare function listManagedFileReferencePaths(): string[];
export declare function listManagedFileReferencePathsForTarget(target: keyof typeof MANAGED_FILE_CONTRACT_IDS_BY_TARGET): string[];
export {};
//# sourceMappingURL=index.d.ts.map