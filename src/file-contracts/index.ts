import { PATHS } from '../runtime/constants.js';
import { artifactCandidateFileContract } from './artifact-candidates.js';
import { artifactIndexFileContract } from './artifact-index.js';
import { researchContractFileContract } from './contract.js';
import { evolutionFileContract } from './evolution.js';
import { layerPolicyFileContract } from './layer-policy.js';
import { memoryFileContract } from './memory.js';
import { publicDataRequestFileContract } from './public-data-request.js';
import { resourcesFileContract } from './resources.js';
import type { ManagedFileContract } from './shared.js';
import { renderSchemaReferenceMarkdown } from './shared.js';
import { studyFileContract } from './study.js';
import { taskFileContract } from './task.js';

const MANAGED_FILE_CONTRACTS: ManagedFileContract[] = [
  researchContractFileContract,
  evolutionFileContract,
  studyFileContract,
  taskFileContract,
  artifactCandidateFileContract,
  artifactIndexFileContract,
  resourcesFileContract,
  memoryFileContract,
  publicDataRequestFileContract,
  layerPolicyFileContract,
];

const MANAGED_FILE_CONTRACT_IDS_BY_TARGET = {
  project: ['contract', 'evolution', 'artifact-index', 'resources', 'layer-policy'],
  study: ['study', 'task', 'artifact-candidates', 'memory', 'public-data-request'],
  task: ['task', 'artifact-candidates', 'public-data-request'],
} as const;

export function listManagedFileContracts(): ManagedFileContract[] {
  return [...MANAGED_FILE_CONTRACTS];
}

export function getManagedFileContract(id: string): ManagedFileContract {
  const contract = MANAGED_FILE_CONTRACTS.find((entry) => entry.id === id);
  if (!contract) {
    throw new Error(`Unknown managed file contract '${id}'.`);
  }
  return contract;
}

export function getManagedFileExamplePath(contract: ManagedFileContract): string {
  return `${PATHS.examplesDir}/${contract.exampleFileName}`;
}

export function buildManagedFileReferenceOutputs(): Array<{ relativePath: string; content: string }> {
  const outputs: Array<{ relativePath: string; content: string }> = [
    {
      relativePath: PATHS.schemaReference,
      content: renderSchemaReferenceMarkdown(MANAGED_FILE_CONTRACTS),
    },
  ];

  return outputs.concat(
    MANAGED_FILE_CONTRACTS.map((contract) => ({
      relativePath: getManagedFileExamplePath(contract),
      content: contract.renderExample(),
    }))
  );
}

export function listManagedFileReferencePaths(): string[] {
  return buildManagedFileReferenceOutputs().map((entry) => entry.relativePath);
}

export function listManagedFileReferencePathsForTarget(target: keyof typeof MANAGED_FILE_CONTRACT_IDS_BY_TARGET): string[] {
  const ids = MANAGED_FILE_CONTRACT_IDS_BY_TARGET[target];
  return [PATHS.schemaReference, ...ids.map((id) => getManagedFileExamplePath(getManagedFileContract(id)))];
}
