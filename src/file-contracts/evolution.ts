import type { EvolutionState } from '../types.js';
import type { ManagedFileContract } from './shared.js';
import { renderYamlDocument } from './shared.js';

export const QUESTION_CHANGE_VALUES = ['refinement', 'confirmation', 'pivot', 'dissolution'] as const;
export const EVOLUTION_BOUNDARY_STATE_VALUES = ['open', 'resolved'] as const;

export function createDefaultEvolutionState(): EvolutionState {
  return {
    studies: [],
    boundaries: [],
  };
}

export function createExampleEvolutionState(): EvolutionState {
  return {
    studies: [
      {
        id: 'STUDY-001',
        question: 'Does the current h5ad support a first-pass integration check?',
        kind: 'refinement',
        resolves: ['B001'],
        opens: ['B002'],
        candidates: ['Should the narrowed result be validated in a second dataset?'],
        ts: '2026-06-05T12:00:00.000Z',
      },
    ],
    boundaries: [
      {
        id: 'B001',
        text: 'Need a first-pass integration reality check.',
        state: 'resolved',
        weight: 1,
      },
      {
        id: 'B002',
        text: 'Need an external validation dataset for the narrowed result.',
        state: 'open',
        deps: ['B001'],
        weight: 2,
      },
    ],
  };
}

export const evolutionFileContract: ManagedFileContract = {
  id: 'evolution',
  title: 'evolution.yaml',
  projectPath: 'evolution.yaml',
  exampleFileName: 'evolution.example.yaml',
  format: 'yaml',
  purpose: 'Sparse project evolution record: study events plus the current open/resolved boundary map.',
  fields: [
    { path: 'studies', type: 'EvolutionStudyEvent[]', required: true, description: 'Chronological study-level evolution events.' },
    { path: 'studies[].id', type: 'STUDY-XXX', required: true, description: 'Closed study ID recorded by qdd-close.' },
    { path: 'studies[].question', type: 'string', required: true, description: 'Question the study actually worked on.' },
    {
      path: 'studies[].kind',
      type: 'enum',
      required: true,
      description: 'How the question moved after this study.',
      allowedValues: QUESTION_CHANGE_VALUES,
    },
    { path: 'studies[].resolves', type: 'BXXX[]', required: true, description: 'Boundary IDs resolved by this study.' },
    { path: 'studies[].opens', type: 'BXXX[]', required: true, description: 'Boundary IDs newly opened or carried forward.' },
    { path: 'studies[].candidates', type: 'string[]', required: true, description: 'Candidate next study questions or directions.' },
    { path: 'studies[].ts', type: 'ISO datetime', required: true, description: 'Timestamp for the study event.' },
    { path: 'boundaries', type: 'EvolutionBoundary[]', required: true, description: 'Current project boundary map.' },
    { path: 'boundaries[].id', type: 'BXXX', required: true, description: 'Stable boundary ID.' },
    { path: 'boundaries[].text', type: 'string', required: true, description: 'Human-readable boundary statement.' },
    {
      path: 'boundaries[].state',
      type: 'enum',
      required: true,
      description: 'Current project-level boundary state.',
      allowedValues: EVOLUTION_BOUNDARY_STATE_VALUES,
    },
    { path: 'boundaries[].deps', type: 'BXXX[]', required: false, description: 'Optional upstream boundary dependencies.' },
    { path: 'boundaries[].weight', type: 'number', required: false, description: 'Optional lightweight priority signal.' },
  ],
  notes: [
    'Keep evolution sparse. Narrative detail belongs in context/memory/STUDY-XXX.md.',
    'Use current runtime field names exactly: id, question, kind, resolves, opens, candidates, ts.',
  ],
  renderExample: () => renderYamlDocument(createExampleEvolutionState()),
};
