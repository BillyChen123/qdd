import type { QuestionChangeType } from '../types.js';
import type { ManagedFileContract } from './shared.js';
import { renderBulletList } from './shared.js';

export function buildStudyMemoryMarkdown(options: {
  studyId: string;
  question: string;
  kind: QuestionChangeType;
  summary: string;
  promotedArtifacts: string[];
  reusedMaterials: string[];
  usedSkills: string[];
  adHocScripts: string[];
  openBoundaryTexts: string[];
  nextCandidates: string[];
  resolvedBoundaryTexts: string[];
}): string {
  return [
    `# ${options.studyId} Memory`,
    '',
    '## Question',
    '',
    options.question,
    '',
    '## Outcome',
    '',
    `- Kind: ${options.kind}`,
    '',
    '## Study Summary',
    '',
    options.summary,
    '',
    '## Evidence Index',
    '',
    `- Study contract: studies/${options.studyId}/study.md`,
    `- Task contracts: studies/${options.studyId}/tasks/`,
    `- Study outputs: studies/${options.studyId}/output/`,
    '- Artifact registry: artifacts/index.yaml',
    '- Research map: research-map.html',
    '',
    '## Promoted Artifacts',
    '',
    renderBulletList(options.promotedArtifacts, '- None promoted.'),
    '',
    '## Reused Resources And Artifacts',
    '',
    renderBulletList(options.reusedMaterials, '- None recorded.'),
    '',
    '## Used Skills',
    '',
    renderBulletList(options.usedSkills, '- No task-local executor skills were recorded.'),
    '',
    '## Ad Hoc Scripts',
    '',
    renderBulletList(options.adHocScripts, '- No preserved study-local scripts were recorded.'),
    '',
    '## Resolved Boundaries',
    '',
    renderBulletList(options.resolvedBoundaryTexts, '- None'),
    '',
    '## Open Boundaries',
    '',
    renderBulletList(options.openBoundaryTexts, '- None'),
    '',
    '## Next Candidates',
    '',
    renderBulletList(options.nextCandidates, '- None'),
    '',
    '## Carry Forward Notes',
    '',
    '- Keep this file readable and durable; do not turn it into a raw execution log.',
    '- If a stable resource, dataset alias, or method preference should carry across studies, also update context/resources.md explicitly.',
    '',
  ].join('\n');
}

export function createExampleStudyMemoryMarkdown(): string {
  return buildStudyMemoryMarkdown({
    studyId: 'STUDY-001',
    question: 'Does the current h5ad support a first-pass integration check?',
    kind: 'refinement',
    summary: 'The first-pass integration run narrowed the next question and preserved one reusable script plus one reusable figure path.',
    promotedArtifacts: [
      'ART-001 (`code`) - artifacts/code/ART-001-integration.py: Executed first-pass integration script.',
    ],
    reusedMaterials: [
      'artifacts/data/example-input.h5ad',
      'context/resources.md',
    ],
    usedSkills: [
      'singlecell/scrna/sc-batch-integration',
    ],
    adHocScripts: [
      'studies/STUDY-001/output/code/integration.py',
    ],
    openBoundaryTexts: ['Need an external validation dataset for the narrowed result.'],
    nextCandidates: ['Should the narrowed result be validated in a second dataset?'],
    resolvedBoundaryTexts: ['Need a first-pass integration reality check.'],
  });
}

export const memoryFileContract: ManagedFileContract = {
  id: 'memory',
  title: 'context/memory/STUDY-XXX.md',
  projectPath: 'context/memory/STUDY-XXX.md',
  exampleFileName: 'memory.example.md',
  format: 'markdown',
  purpose: 'Narrative per-study memory written during closure.',
  sections: [
    { name: 'Question', required: true, description: 'The study question that was actually executed.' },
    { name: 'Outcome', required: true, description: 'High-level outcome kind for the study.' },
    { name: 'Study Summary', required: true, description: 'Compact explanation of what the study established.' },
    { name: 'Evidence Index', required: true, description: 'Pointers to study contracts, outputs, artifact registry, and research map.' },
    { name: 'Promoted Artifacts', required: true, description: 'Artifacts promoted during or before closure for this study.' },
    { name: 'Reused Resources And Artifacts', required: true, description: 'Inputs or prior materials explicitly reused by this study.' },
    { name: 'Used Skills', required: true, description: 'Task-local executor skills actually referenced by this study.' },
    { name: 'Ad Hoc Scripts', required: true, description: 'Study-local preserved scripts that remain useful for audit or reuse.' },
    { name: 'Resolved Boundaries', required: true, description: 'Boundary texts resolved by this study.' },
    { name: 'Open Boundaries', required: true, description: 'Boundary texts that remain open after closure.' },
    { name: 'Next Candidates', required: true, description: 'One to three candidate next studies or questions.' },
    { name: 'Carry Forward Notes', required: true, description: 'Durable carry-forward notes for later studies.' },
  ],
  notes: [
    'This is the only default narrative report surface for a study.',
    'Keep it readable; do not dump raw execution logs here.',
  ],
  renderExample: () => `${createExampleStudyMemoryMarkdown().trim()}\n`,
};
