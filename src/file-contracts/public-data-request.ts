import type { PublicDataRequest } from '../types.js';
import type { ManagedFileContract } from './shared.js';
import { renderYamlDocument } from './shared.js';

export function createExamplePublicDataRequest(): PublicDataRequest {
  return {
    source: 'cellxgene',
    modality: 'scrna',
    goal: 'Find one external validation dataset for the narrowed T cell comparison.',
    query: {
      organism: 'Homo sapiens',
      tissue: 'tumor',
      disease: 'head and neck squamous cell carcinoma',
      cell_type: 'T cell',
      max_results: 5,
    },
    selected: [
      {
        dataset_id: 'cellxgene-example-dataset',
        alias: 'HNSCC_validation_1',
      },
    ],
    selection_note: 'Keep the selected set explicit so apply only downloads the agreed target.',
  };
}

export const publicDataRequestFileContract: ManagedFileContract = {
  id: 'public-data-request',
  title: 'studies/STUDY-XXX/output/public_data_request.yaml',
  projectPath: 'studies/STUDY-XXX/output/public_data_request.yaml',
  exampleFileName: 'public-data-request.example.yaml',
  format: 'yaml',
  purpose: 'Thin planning-to-apply handoff for selected public datasets.',
  fields: [
    { path: 'source', type: 'enum', required: true, description: 'Current public data source.', allowedValues: ['cellxgene'] },
    { path: 'modality', type: 'enum', required: true, description: 'Current modality for this handoff.', allowedValues: ['scrna'] },
    { path: 'goal', type: 'string', required: true, description: 'Why the study needs public data.' },
    { path: 'query', type: 'object', required: true, description: 'Structured planning query used to narrow candidates.' },
    { path: 'selected', type: 'PublicDataSelectionEntry[]', required: true, description: 'Final selected dataset targets that apply may consume.' },
    { path: 'selection_note', type: 'string', required: false, description: 'Optional explanation of the final selection.' },
  ],
  notes: [
    'Planning may search broadly, but only the final selected targets belong here.',
    'Apply should consume selected targets only; it should not reopen broad public-data search.',
  ],
  renderExample: () => renderYamlDocument(createExamplePublicDataRequest()),
};
