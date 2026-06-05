import type { StudyRecord } from '../types.js';
import type { ManagedFileContract } from './shared.js';
import { renderBulletList, renderMarkdownDocument } from './shared.js';

export const STUDY_STATUS_VALUES = ['created', 'confirmed', 'running', 'blocked', 'completed', 'closed'] as const;

export function renderStudyBody(record: StudyRecord): string {
  const evidencePlan = renderBulletList(
    record.expected_artifacts ?? [],
    '- Define the minimum evidence needed to judge this study.'
  );

  return [
    '## Question',
    '',
    record.question,
    '',
    '## Hypothesis',
    '',
    record.hypothesis,
    '',
    '## Target Boundaries',
    '',
    renderBulletList(
      record.target_boundaries ?? [],
      '- None declared yet. Read `evolution.yaml` and declare only the current open boundaries this study will actually clarify.'
    ),
    '',
    '## Why Now',
    '',
    'Explain why this study is worth doing now and why it belongs in the current project loop.',
    '',
    '## Resource Fit',
    '',
    '- Data: identify which context resources or prior artifacts support this study.',
    '- Runtime: identify which tools, packages, or compute resources are needed.',
    '- Biology: note any stable domain assumptions or prior knowledge that matter.',
    '- Reuse: note any existing artifacts that should be reused instead of regenerated.',
    '',
    '## Evidence Plan',
    '',
    evidencePlan,
    '',
    '## Blockers',
    '',
    renderBulletList(record.blockers ?? [], '- None yet.'),
    '',
    '## Tasks',
    '',
    renderBulletList(record.task_ids ?? [], '- No planned tasks yet.'),
    '',
    '## Expected Artifacts',
    '',
    renderBulletList(record.expected_artifacts ?? [], '- None specified yet.'),
  ].join('\n');
}

export function renderStudyMarkdown(record: StudyRecord): string {
  return renderMarkdownDocument(record, renderStudyBody(record));
}

export function createExampleStudyRecord(): StudyRecord {
  return {
    study_id: 'STUDY-001',
    question: 'Does the current h5ad support a bounded first-pass integration check?',
    hypothesis: 'A single first-pass integration run is enough to judge whether the comparison is worth narrowing further.',
    target_boundaries: ['B001'],
    status: 'created',
    task_ids: ['TASK-001'],
    blockers: ['External validation dataset not yet selected.'],
    expected_artifacts: ['One reusable integration script', 'One key integration figure'],
  };
}

export const studyFileContract: ManagedFileContract = {
  id: 'study',
  title: 'studies/STUDY-XXX/study.md',
  projectPath: 'studies/STUDY-XXX/study.md',
  exampleFileName: 'study.example.md',
  format: 'markdown',
  purpose: 'Bounded study definition for one research question.',
  fields: [
    { path: 'study_id', type: 'STUDY-XXX', required: true, description: 'Stable study ID.' },
    { path: 'question', type: 'string', required: true, description: 'Bounded study question.' },
    { path: 'hypothesis', type: 'string', required: true, description: 'Current study hypothesis.' },
    { path: 'target_boundaries', type: 'BXXX[]', required: false, description: 'Current open boundaries this study will clarify.' },
    {
      path: 'status',
      type: 'enum',
      required: false,
      description: 'Current study lifecycle state.',
      allowedValues: STUDY_STATUS_VALUES,
    },
    { path: 'blockers', type: 'string[]', required: false, description: 'Known blockers.' },
    { path: 'task_ids', type: 'TASK-XXX[]', required: false, description: 'Task IDs attached to the study.' },
    { path: 'expected_artifacts', type: 'string[]', required: false, description: 'Expected key outputs for the study.' },
    { path: 'closed_at', type: 'ISO datetime', required: false, description: 'Closure timestamp when the study is closed.' },
  ],
  sections: [
    { name: 'Question', required: true, description: 'Human-readable question text aligned with the frontmatter question.' },
    { name: 'Hypothesis', required: true, description: 'Human-readable hypothesis text aligned with the frontmatter hypothesis.' },
    { name: 'Target Boundaries', required: true, description: 'Current open boundaries this study will clarify.' },
    { name: 'Why Now', required: true, description: 'Why the study belongs in the current project loop.' },
    { name: 'Resource Fit', required: true, description: 'Data, runtime, biology, and reuse fit.' },
    { name: 'Evidence Plan', required: true, description: 'Minimum evidence needed to judge the study.' },
    { name: 'Blockers', required: true, description: 'Current blockers for the study.' },
    { name: 'Tasks', required: true, description: 'Human-readable task list for the study.' },
    { name: 'Expected Artifacts', required: true, description: 'Expected reusable outputs or evidence.' },
  ],
  notes: [
    'Frontmatter remains the machine-readable truth source.',
    'The body should stay aligned with the frontmatter, not drift into a separate plan.',
  ],
  renderExample: () => renderStudyMarkdown(createExampleStudyRecord()),
};
