import { ARTIFACT_SCOPE_VALUES, ARTIFACT_TYPE_VALUES } from './artifact-index.js';
import { renderYamlDocument } from './shared.js';
export function createDefaultArtifactCandidateManifest() {
    return {
        artifact_candidates: [],
    };
}
export function createExampleArtifactCandidateManifest() {
    return {
        artifact_candidates: [
            {
                path: 'studies/STUDY-001/output/code/integration.py',
                type: 'code',
                task_id: 'TASK-001',
                reusable: true,
                scope: 'study',
                description: 'Main executed integration script for the study; safe to reuse for audit and reruns.',
                schema: 'python-script',
            },
            {
                path: 'studies/STUDY-001/output/tables/integration-summary.csv',
                type: 'table',
                task_id: 'TASK-001',
                reusable: true,
                scope: 'study',
                description: 'Reusable integration summary table preserved for downstream comparison; includes batch and cluster-level metrics.',
                schema: 'csv-table',
            },
        ],
    };
}
export const artifactCandidateFileContract = {
    id: 'artifact-candidates',
    title: 'studies/STUDY-XXX/output/artifact-candidates.yaml',
    projectPath: 'studies/STUDY-XXX/output/artifact-candidates.yaml',
    exampleFileName: 'artifact-candidates.example.yaml',
    format: 'yaml',
    purpose: 'Explicit promotion boundary between study-local outputs and reusable artifacts.',
    fields: [
        { path: 'artifact_candidates', type: 'ArtifactCandidateEntry[]', required: true, description: 'Promotion-worthy study outputs.' },
        { path: 'artifact_candidates[].path', type: 'string', required: true, description: 'Project-relative path to the candidate output.' },
        {
            path: 'artifact_candidates[].type',
            type: 'enum',
            required: true,
            description: 'Candidate material class.',
            allowedValues: ARTIFACT_TYPE_VALUES,
        },
        { path: 'artifact_candidates[].task_id', type: 'TASK-XXX', required: false, description: 'Optional producing task provenance.' },
        { path: 'artifact_candidates[].reusable', type: 'boolean', required: false, description: 'Whether later work should reuse this output. Defaults to true when omitted.' },
        {
            path: 'artifact_candidates[].scope',
            type: 'enum',
            required: false,
            description: 'Reuse scope for the promoted artifact. Defaults to study when omitted.',
            allowedValues: ARTIFACT_SCOPE_VALUES,
        },
        { path: 'artifact_candidates[].description', type: 'string', required: true, description: 'Why this candidate is worth promoting.' },
        { path: 'artifact_candidates[].schema', type: 'string', required: true, description: 'Expected schema or semantic label.' },
    ],
    notes: [
        'Only promotion-worthy outputs belong here; not every study-local file is an artifact candidate.',
        'Task-scoped candidates should also declare task_id.',
        'Candidate paths must point to canonical study outputs, never to output/tmp scratch files.',
        'When editing by hand, quote natural-language `description` and `schema` values or use YAML block scalars such as `>-` for longer prose.',
    ],
    renderExample: () => renderYamlDocument(createExampleArtifactCandidateManifest()),
};
//# sourceMappingURL=artifact-candidates.js.map