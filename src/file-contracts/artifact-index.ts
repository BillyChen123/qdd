import type { ArtifactIndex } from '../types.js';
import type { ManagedFileContract } from './shared.js';
import { renderYamlDocument } from './shared.js';

export const ARTIFACT_TYPE_VALUES = ['data', 'code', 'figure', 'report'] as const;
export const ARTIFACT_SCOPE_VALUES = ['project', 'study', 'task'] as const;

export function createDefaultArtifactIndex(): ArtifactIndex {
  return {
    artifacts: [],
  };
}

export function createExampleArtifactIndex(): ArtifactIndex {
  return {
    artifacts: [
      {
        id: 'ART-001',
        type: 'code',
        format: '.py',
        path: 'artifacts/code/ART-001-integration.py',
        produced_by: 'STUDY-001/TASK-001',
        reusable: true,
        scope: 'study',
        description: 'Executed first-pass integration script preserved for review and reuse.',
        schema: 'python-script',
      },
    ],
  };
}

export const artifactIndexFileContract: ManagedFileContract = {
  id: 'artifact-index',
  title: 'artifacts/index.yaml',
  projectPath: 'artifacts/index.yaml',
  exampleFileName: 'artifacts-index.example.yaml',
  format: 'yaml',
  purpose: 'Registry of promoted reusable artifacts.',
  fields: [
    { path: 'artifacts', type: 'ArtifactIndexEntry[]', required: true, description: 'Promoted reusable artifacts.' },
    { path: 'artifacts[].id', type: 'ART-XXX', required: true, description: 'Stable artifact ID.' },
    {
      path: 'artifacts[].type',
      type: 'enum',
      required: true,
      description: 'Artifact material class.',
      allowedValues: ARTIFACT_TYPE_VALUES,
    },
    { path: 'artifacts[].format', type: 'string', required: true, description: 'File format or extension.' },
    { path: 'artifacts[].path', type: 'string', required: true, description: 'Canonical project-relative artifact path.' },
    { path: 'artifacts[].produced_by', type: 'string', required: true, description: 'Study or study/task provenance string.' },
    { path: 'artifacts[].reusable', type: 'boolean', required: true, description: 'Whether later work should reuse this artifact.' },
    {
      path: 'artifacts[].scope',
      type: 'enum',
      required: true,
      description: 'Reuse scope, not production provenance.',
      allowedValues: ARTIFACT_SCOPE_VALUES,
    },
    { path: 'artifacts[].description', type: 'string', required: true, description: 'Human-readable artifact description.' },
    { path: 'artifacts[].schema', type: 'string', required: true, description: 'Expected structural or semantic schema label.' },
  ],
  notes: [
    'Promoted artifacts should already live under canonical artifacts/{data,code,figures,reports}/ paths.',
    'This slice still uses type=data for tabular data; later proposals may add table explicitly.',
  ],
  renderExample: () => renderYamlDocument(createExampleArtifactIndex()),
};
