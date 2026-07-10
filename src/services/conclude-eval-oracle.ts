import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ConcludeEvalHardFailId,
  ConcludeEvalOracle,
  ConcludeEvalOracleFact,
  ConcludeEvalOracleHardFailure,
} from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';

const SUPPORTED_SCHEMA_VERSION = 1;
const ORACLE_HARD_FAIL_IDS: readonly ConcludeEvalHardFailId[] = [
  'evidence-inventory-prose',
  'fragmented-or-metadata-prose',
  'unsupported-central-claim',
  'missing-result-anchor',
  'invalid-citation',
  'meta-writing',
  'false-positive-evaluation',
];

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid conclude eval oracle: ${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid conclude eval oracle: ${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid conclude eval oracle: ${label} must be an array.`);
  }
  return value.map((entry, index) => requireString(entry, `${label}[${index}]`));
}

function parseExpectedFacts(value: unknown): ConcludeEvalOracleFact[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Invalid conclude eval oracle: expectedFacts must be a non-empty array.');
  }

  const facts = value.map((entry, index) => {
    const record = requireRecord(entry, `expectedFacts[${index}]`);
    return {
      id: requireString(record.id, `expectedFacts[${index}].id`),
      fact: requireString(record.fact, `expectedFacts[${index}].fact`),
      sourceRefs: requireStringArray(record.sourceRefs, `expectedFacts[${index}].sourceRefs`),
      support: requireStringArray(record.support, `expectedFacts[${index}].support`),
    };
  });

  if (new Set(facts.map((fact) => fact.id)).size !== facts.length) {
    throw new Error('Invalid conclude eval oracle: expectedFacts ids must be unique.');
  }
  return facts;
}

function parseHardFailures(value: unknown): ConcludeEvalOracleHardFailure[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid conclude eval oracle: hardFailures must be an array.');
  }

  const supportedIds = new Set<string>(ORACLE_HARD_FAIL_IDS);
  const hardFailures = value.map((entry, index) => {
    const record = requireRecord(entry, `hardFailures[${index}]`);
    const id = requireString(record.id, `hardFailures[${index}].id`);
    if (!supportedIds.has(id)) {
      throw new Error(`Invalid conclude eval oracle: unsupported hard failure id \`${id}\`.`);
    }
    return {
      id: id as ConcludeEvalHardFailId,
      description: requireString(record.description, `hardFailures[${index}].description`),
    };
  });

  const ids = hardFailures.map((failure) => failure.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Invalid conclude eval oracle: hard failure ids must be unique.');
  }
  const missingIds = ORACLE_HARD_FAIL_IDS.filter((id) => !ids.includes(id));
  if (missingIds.length > 0) {
    throw new Error(`Invalid conclude eval oracle: missing hard failure id(s): ${missingIds.join(', ')}.`);
  }
  return hardFailures;
}

export function resolveDefaultConcludeEvalOraclePath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '..', '..', 'src', 'test', 'fixtures', 'conclude', 'parkinson-oracle', 'oracle.json');
}

export function validateConcludeEvalOracle(value: unknown): ConcludeEvalOracle {
  const record = requireRecord(value, 'root');
  if (record.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Invalid conclude eval oracle: schemaVersion must be ${SUPPORTED_SCHEMA_VERSION}, received ${String(record.schemaVersion)}.`
    );
  }

  const forbiddenVisiblePatterns = requireStringArray(record.forbiddenVisiblePatterns, 'forbiddenVisiblePatterns');
  for (const pattern of forbiddenVisiblePatterns) {
    try {
      new RegExp(pattern, 'i');
    } catch {
      throw new Error(`Invalid conclude eval oracle: forbidden visible pattern is not a valid regex: ${pattern}`);
    }
  }

  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    caseId: requireString(record.caseId, 'caseId'),
    purpose: requireString(record.purpose, 'purpose'),
    expectedFacts: parseExpectedFacts(record.expectedFacts),
    expectedStoryRelationships: requireStringArray(record.expectedStoryRelationships, 'expectedStoryRelationships'),
    claimLimits: requireStringArray(record.claimLimits, 'claimLimits'),
    requiredManuscriptSignals: requireStringArray(record.requiredManuscriptSignals, 'requiredManuscriptSignals'),
    forbiddenVisiblePatterns,
    hardFailures: parseHardFailures(record.hardFailures),
  };
}

export async function loadConcludeEvalOracle(oraclePath = resolveDefaultConcludeEvalOraclePath()): Promise<{
  oracle: ConcludeEvalOracle;
  oraclePath: string;
}> {
  const resolvedPath = path.resolve(oraclePath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await FileSystemUtils.readFile(resolvedPath)) as unknown;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load conclude eval oracle at ${resolvedPath}: ${details}`);
  }
  return {
    oracle: validateConcludeEvalOracle(parsed),
    oraclePath: resolvedPath,
  };
}
