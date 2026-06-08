import { renderYamlDocument } from './shared.js';
export function createExamplePublicDataRequest() {
    return {
        source: 'cellxgene',
        modality: 'scrna',
        goal: 'Find one external validation dataset for the narrowed T cell comparison.',
        constraints: {
            organism: 'Homo sapiens',
            tissue: 'tumor',
            disease: 'head and neck squamous cell carcinoma',
            cell_type: 'T cell',
        },
        source_query: {
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
export const publicDataRequestFileContract = {
    id: 'public-data-request',
    title: 'studies/STUDY-XXX/output/public_data_request.yaml',
    projectPath: 'studies/STUDY-XXX/output/public_data_request.yaml',
    exampleFileName: 'public-data-request.example.yaml',
    format: 'yaml',
    purpose: 'Thin planning-to-apply handoff for selected public datasets.',
    fields: [
        { path: 'source', type: 'string', required: true, description: 'Public data source chosen by planning and validated by the executor skill.' },
        {
            path: 'modality',
            type: 'enum',
            required: true,
            description: 'Study modality intent for this handoff.',
            allowedValues: ['scrna', 'spatial', 'scatac', 'bulk', 'other'],
        },
        { path: 'goal', type: 'string', required: true, description: 'Why the study needs public data.' },
        { path: 'constraints', type: 'object', required: true, description: 'Source-agnostic study constraints used to narrow candidates.' },
        { path: 'source_query', type: 'object', required: false, description: 'Optional source-specific query knobs such as max_results.' },
        { path: 'selected', type: 'PublicDataSelectionEntry[]', required: true, description: 'Final selected dataset targets that apply may consume.' },
        { path: 'selection_note', type: 'string', required: false, description: 'Optional explanation of the final selection.' },
    ],
    notes: [
        'Planning may search broadly, but only the final selected targets belong here.',
        'Apply should consume selected targets only; it should not reopen broad public-data search.',
        'Legacy handoffs may still contain query; executor skills may read it for backward compatibility during migration.',
    ],
    renderExample: () => renderYamlDocument(createExamplePublicDataRequest()),
};
//# sourceMappingURL=public-data-request.js.map