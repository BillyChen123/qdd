import { renderYamlDocument } from './shared.js';
export const QDD_MODE_VALUES = ['human', 'assist', 'auto'];
export const TERMINATION_TYPE_VALUES = ['best_effort'];
export function createDefaultResearchContract() {
    return {
        theme: 'Unspecified research theme',
        initial_question: 'Unspecified initial question',
        mode: 'human',
        scope: {
            in_scope: [],
            out_of_scope: [],
        },
        termination_type: 'best_effort',
    };
}
export function createExampleResearchContract() {
    return {
        theme: 'Tumor-reactive T cell state discovery in checkpoint blockade',
        initial_question: 'Which T cell state is most worth carrying into the next validation study?',
        mode: 'assist',
        scope: {
            in_scope: ['single-cell transcriptomic evidence', 'study-level iterative refinement'],
            out_of_scope: ['wet-lab validation', 'clinical deployment claims'],
        },
        termination_type: 'best_effort',
    };
}
export const researchContractFileContract = {
    id: 'contract',
    title: 'contract.yaml',
    projectPath: 'contract.yaml',
    exampleFileName: 'contract.example.yaml',
    format: 'yaml',
    purpose: 'Stable project contract: research theme, initial question, collaboration mode, and scope.',
    fields: [
        { path: 'theme', type: 'string', required: true, description: 'Stable project theme or research direction.' },
        { path: 'initial_question', type: 'string', required: true, description: 'Starting project question before later study refinement.' },
        { path: 'mode', type: 'enum', required: true, description: 'Authority mode for later workflow behavior.', allowedValues: QDD_MODE_VALUES },
        { path: 'scope.in_scope', type: 'string[]', required: true, description: 'Topics or activities explicitly in scope.' },
        { path: 'scope.out_of_scope', type: 'string[]', required: true, description: 'Topics or activities explicitly out of scope.' },
        {
            path: 'termination_type',
            type: 'enum',
            required: true,
            description: 'Current project-level termination contract.',
            allowedValues: TERMINATION_TYPE_VALUES,
        },
    ],
    notes: [
        'Keep this file concise and machine-readable.',
        'Later study evolution belongs in evolution.yaml, not here.',
    ],
    renderExample: () => renderYamlDocument(createExampleResearchContract()),
};
//# sourceMappingURL=contract.js.map