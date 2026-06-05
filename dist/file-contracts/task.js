import { extractBulletSection, renderBulletList, renderMarkdownDocument } from './shared.js';
export const TASK_STATUS_VALUES = ['pending', 'running', 'blocked', 'completed'];
export const TASK_PROMOTION_VALUES = ['pending', 'none', 'candidate-recorded', 'registered'];
export const TASK_SKILLS_SECTION_COMMENT = '<!-- Each bullet must start with a skill ID. Optional description may follow after ":" or " - ". -->';
const SKILL_ID_WITH_OPTIONAL_DESCRIPTION_PATTERN = /^`?([A-Za-z0-9][A-Za-z0-9._/-]*)`?(?=\s*(?::|-\s+|$))/;
function renderTaskSkillLines(skillIds) {
    return renderBulletList(skillIds, '- None specified.');
}
export function parseTaskSkillSection(body) {
    const values = extractBulletSection(body, 'Skills');
    if (values === null) {
        return { present: false, skillIds: null };
    }
    if (values.length === 1 && values[0] === 'None specified.') {
        return { present: true, skillIds: [] };
    }
    const skillIds = [];
    for (const value of values) {
        const match = value.match(SKILL_ID_WITH_OPTIONAL_DESCRIPTION_PATTERN);
        if (!match) {
            return { present: true, skillIds: null };
        }
        skillIds.push(match[1]);
    }
    return { present: true, skillIds };
}
export function extractTaskSkillIdsFromBody(body) {
    const parsed = parseTaskSkillSection(body);
    return parsed.present ? parsed.skillIds : null;
}
export function renderTaskBody(record, studyId, inputs) {
    const inputLines = inputs.length > 0
        ? renderBulletList(inputs, '- None.')
        : ['- `contract.yaml`', '- `context/resources.md`', '- `context/*.yaml` (optional structured sidecars)', `- \`studies/${studyId}/study.md\``].join('\n');
    return [
        '## Depends On',
        '',
        renderBulletList(record.depends_on ?? [], '- None.'),
        '',
        '## Input',
        '',
        inputLines,
        '',
        '## Expected Output',
        '',
        renderBulletList(record.expected_outputs ?? [], '- None specified yet.'),
        '',
        '## Checklist',
        '',
        '- Replace this scaffold with 3-7 task-specific executable steps before or during execution.',
        '- [ ] Reconfirm the concrete success signal for this task',
        '- [ ] Prepare the real inputs, dependencies, and execution method',
        '- [ ] Produce the expected evidence or record the blocker explicitly',
        `- [ ] Write study-local evidence into \`studies/${studyId}/output/\` and summarize what changed`,
        `- [ ] Package final reusable outputs into \`studies/${studyId}/output/{data,code,figures,tables,reports}/\` before marking the task complete`,
        `- [ ] Preserve readable analysis scripts in \`studies/${studyId}/output/code/\` when this task runs substantive analysis`,
        `- [ ] Save at least one key figure in \`studies/${studyId}/output/figures/\` when the task conclusion depends on visual evidence, or record why no figure was needed`,
        `- [ ] Add only promotion-worthy outputs to \`studies/${studyId}/output/artifact-candidates.yaml\` and include \`task_id\` when this task clearly produced them`,
        '- [ ] Set promotion review explicitly to none, candidate-recorded, or registered before leaving the task as completed',
        '- [ ] Register reusable artifacts only if this task produced them and immediate registration is warranted',
        '',
        '## Skills',
        '',
        TASK_SKILLS_SECTION_COMMENT,
        '',
        renderTaskSkillLines(record.skills ?? []),
    ].join('\n');
}
export function renderTaskMarkdown(record, studyId, inputs) {
    return renderMarkdownDocument(record, renderTaskBody(record, studyId, inputs));
}
export function createExampleTaskRecord() {
    return {
        task_id: 'TASK-001',
        study_id: 'STUDY-001',
        goal: 'Run one first-pass integration analysis and preserve the executed script and key figure.',
        status: 'pending',
        expected_outputs: ['One integration script under output/code/', 'One key figure under output/figures/'],
        depends_on: [],
        skills: ['singlecell/scrna/sc-batch-integration'],
        promotion_status: 'pending',
        artifact_ids: [],
        updated_at: '2026-06-05T12:00:00.000Z',
    };
}
export function createExampleTaskMarkdown() {
    const record = createExampleTaskRecord();
    const body = renderTaskBody(record, record.study_id, [
        'artifacts/data/example-input.h5ad',
        `studies/${record.study_id}/study.md`,
    ]).replace('- singlecell/scrna/sc-batch-integration', '- singlecell/scrna/sc-batch-integration: use this task-level executor skill for first-pass batch correction and latent-space integration.');
    return renderMarkdownDocument(record, body);
}
export const taskFileContract = {
    id: 'task',
    title: 'studies/STUDY-XXX/tasks/TASK-XXX.md',
    projectPath: 'studies/STUDY-XXX/tasks/TASK-XXX.md',
    exampleFileName: 'task.example.md',
    format: 'markdown',
    purpose: 'Executable task contract inside one study.',
    fields: [
        { path: 'task_id', type: 'TASK-XXX', required: true, description: 'Stable task ID.' },
        { path: 'study_id', type: 'STUDY-XXX', required: true, description: 'Parent study ID.' },
        { path: 'goal', type: 'string', required: true, description: 'Task goal in executable language.' },
        {
            path: 'status',
            type: 'enum',
            required: false,
            description: 'Current task execution state.',
            allowedValues: TASK_STATUS_VALUES,
        },
        { path: 'expected_outputs', type: 'string[]', required: false, description: 'Expected outputs for the task.' },
        { path: 'depends_on', type: 'TASK-XXX[]', required: false, description: 'Task dependencies.' },
        { path: 'skills', type: 'string[]', required: false, description: 'Executor-facing problem-level skill IDs.' },
        {
            path: 'promotion_status',
            type: 'enum',
            required: false,
            description: 'Whether apply reviewed promotion-worthy outputs for this task.',
            allowedValues: TASK_PROMOTION_VALUES,
        },
        { path: 'artifact_ids', type: 'ART-XXX[]', required: false, description: 'Registered artifact IDs tied to this task.' },
        { path: 'blocker_reason', type: 'string', required: false, description: 'Why the task is blocked.' },
        { path: 'result_summary', type: 'string', required: false, description: 'Compact task result summary.' },
        { path: 'updated_at', type: 'ISO datetime', required: false, description: 'Last update timestamp.' },
    ],
    sections: [
        { name: 'Depends On', required: true, description: 'Human-readable dependency list.' },
        { name: 'Input', required: true, description: 'Concrete input files or context for the task.' },
        { name: 'Expected Output', required: true, description: 'Concrete outputs expected from the task.' },
        { name: 'Checklist', required: true, description: 'Execution checklist that should be rewritten into task-specific steps.' },
        {
            name: 'Skills',
            required: true,
            description: 'Task-local executor skills mirrored from frontmatter skills.',
            rules: [
                'Each bullet must begin with one skill ID.',
                'Optional human-readable descriptions may follow after ":" or " - ".',
                'Frontmatter skills remains the truth source; the body section must normalize back to the same set.',
            ],
        },
    ],
    notes: [
        'Do not list qdd/* workflow skills or brain/* planning skills in task frontmatter or body skills.',
        'Descriptions in the body are allowed, but the leading skill ID must stay machine-readable.',
    ],
    renderExample: () => createExampleTaskMarkdown(),
};
//# sourceMappingURL=task.js.map