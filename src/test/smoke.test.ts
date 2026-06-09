import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { initCommand } from '../commands/init.js';
import { parseTaskSkillSection } from '../file-contracts/task.js';
import { suggestProblemSkills } from '../runtime/local-skills.js';
import { readMarkdownDocument, readYamlFile, writeMarkdownDocument, writeYamlFile } from '../runtime/store.js';
import { recordArtifactCandidate } from '../services/artifacts.js';
import { closeStudy } from '../services/closure.js';
import { listArtifacts, validateProject } from '../services/inspection.js';
import { buildInstructions } from '../services/instructions.js';
import { buildStatus } from '../services/status.js';
import { createStudy } from '../services/studies.js';
import { createTask } from '../services/tasks.js';
import type { EvolutionState, StudyRecord, TaskRecord } from '../types.js';

async function createTempProject(prefix: string, options: { tools?: string[] } = {}): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await initCommand(projectRoot, { tools: options.tools ?? ['claude'] });
  return projectRoot;
}

async function setTaskCompleted(projectRoot: string, studyId: string, taskId: string): Promise<void> {
  const relativePath = `studies/${studyId}/tasks/${taskId}.md`;
  const document = await readMarkdownDocument<TaskRecord>(projectRoot, relativePath);
  await writeMarkdownDocument(
    projectRoot,
    relativePath,
    {
      ...document.frontmatter,
      status: 'completed',
      updated_at: new Date().toISOString(),
    },
    document.body
  );
}

test('qdd init creates the new protocol scaffold and bootstrap assets', async () => {
  const projectRoot = await createTempProject('qdd-init-');

  await assert.doesNotReject(fs.access(path.join(projectRoot, 'contract.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'evolution.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'context', 'resources.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'context', 'memory')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'research-map.html')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'instructions.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'schema-reference.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'examples', 'contract.example.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'examples', 'study.example.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'examples', 'task.example.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'examples', 'artifact-candidates.example.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'bootstrap.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'layer-policy.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'skills-catalog.json')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'artifacts', 'data')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'artifacts', 'code')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'artifacts', 'figures')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'artifacts', 'tables')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'artifacts', 'reports')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-start.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-propose.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-explore.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-close.md')));
  await assert.rejects(fs.access(path.join(projectRoot, 'boundaries.yaml')));

  const status = await buildStatus(projectRoot);
  assert.equal(status.project.mode, 'human');
  assert.equal(status.project.current_question, 'Unspecified initial question');
  assert.equal(status.artifacts.count, 0);
  assert.deepEqual(status.memory.recent, []);
  assert.equal(status.boundaries.total, 0);
  assert.deepEqual(status.question_state.next_candidates, []);
  assert.deepEqual(status.question_state.open_boundary_ids, []);

  const instructions = await fs.readFile(path.join(projectRoot, '.qdd', 'instructions.md'), 'utf-8');
  assert.match(instructions, /evolution\.yaml/);
  assert.match(instructions, /context\/memory\/STUDY-XXX\.md/);
  assert.match(instructions, /research-map\.html/);
  assert.doesNotMatch(instructions, /boundaries\.yaml/);
  assert.doesNotMatch(instructions, /question_delta/);

  const schemaReference = await fs.readFile(path.join(projectRoot, '.qdd', 'schema-reference.md'), 'utf-8');
  assert.match(schemaReference, /contract\.yaml/);
  assert.match(schemaReference, /task\.example\.md/);
  assert.match(schemaReference, /Optional human-readable descriptions may follow/);
  assert.match(schemaReference, /Use type=table for reusable tabular outputs/);

  const startCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-start.md'), 'utf-8');
  assert.match(startCommand, /contract\.yaml/);
  assert.match(startCommand, /context\/resources\.md/);
  assert.match(startCommand, /artifacts\/data\//);
  assert.doesNotMatch(startCommand, /qdd boundaries apply --file/);
  assert.doesNotMatch(startCommand, /boundaries\.yaml/);

  const proposeCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-propose.md'), 'utf-8');
  assert.match(proposeCommand, /evolution\.yaml/);
  assert.match(proposeCommand, /context\/memory/);
  assert.doesNotMatch(proposeCommand, /qdd boundaries score/);
  assert.doesNotMatch(proposeCommand, /question_delta/);

  const closeCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-close.md'), 'utf-8');
  assert.match(closeCommand, /context\/memory/);
  assert.match(closeCommand, /research-map\.html/);
  assert.doesNotMatch(closeCommand, /Get human approval before running `qdd close-study`\./);
  assert.doesNotMatch(closeCommand, /boundary-updates\.yaml/);
  assert.doesNotMatch(closeCommand, /question_delta/);

  const catalog = JSON.parse(await fs.readFile(path.join(projectRoot, '.qdd', 'skills-catalog.json'), 'utf-8')) as {
    skills: Array<{ id: string }>;
  };
  assert.ok(catalog.skills.some((entry) => entry.id === 'singlecell/scrna/sc-batch-integration'));
  assert.ok(catalog.skills.some((entry) => entry.id === 'public-data/cellxgene-discover'));
  assert.ok(!catalog.skills.some((entry) => entry.id === 'brain/singlecell/scrna-planning'));
});

test('qdd instructions are aligned to contract, evolution, memory, and research-map', async () => {
  const projectRoot = await createTempProject('qdd-instructions-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can the current dataset support a bounded integration check?',
    hypothesis: 'The existing h5ad is enough for one first-pass integration study.',
  });
  const { taskId } = await createTask(projectRoot, studyId, {
    goal: 'Run the first integration-oriented evidence step.',
    expectedOutputs: ['One reusable analysis script'],
    skills: ['singlecell/scrna/sc-batch-integration'],
  });

  await fs.writeFile(path.join(projectRoot, 'context', 'memory', 'STUDY-000.md'), '# Previous memory\n', 'utf-8');

  const projectInstructions = await buildInstructions(projectRoot, 'PROJECT', { command: 'qdd-start' });
  assert.equal(projectInstructions.role, 'thesis-manager');
  assert.ok(projectInstructions.read.includes('.qdd/schema-reference.md'));
  assert.ok(projectInstructions.read.includes('.qdd/examples/contract.example.yaml'));
  assert.ok(projectInstructions.read.includes('contract.yaml'));
  assert.ok(projectInstructions.read.includes('evolution.yaml'));
  assert.ok(projectInstructions.read.includes('research-map.html'));
  assert.ok(projectInstructions.read.includes('context/resources.md'));
  assert.ok(projectInstructions.read.includes('context/memory/STUDY-000.md'));
  assert.ok(projectInstructions.write.includes('context/resources.md'));
  assert.ok(projectInstructions.write.includes('research-map.html'));
  assert.ok(!projectInstructions.read.includes('boundaries.yaml'));
  assert.ok(!projectInstructions.write.includes('boundaries.yaml'));

  const studyInstructions = await buildInstructions(projectRoot, studyId, { command: 'qdd-close' });
  assert.equal(studyInstructions.role, 'thesis-manager');
  assert.ok(studyInstructions.read.includes('.qdd/schema-reference.md'));
  assert.ok(studyInstructions.read.includes('.qdd/examples/study.example.md'));
  assert.ok(studyInstructions.read.includes('.qdd/examples/task.example.md'));
  assert.ok(studyInstructions.read.includes('evolution.yaml'));
  assert.ok(studyInstructions.read.includes(`studies/${studyId}/study.md`));
  assert.ok(studyInstructions.read.includes(`studies/${studyId}/tasks/${taskId}.md`));
  assert.ok(studyInstructions.write.includes('evolution.yaml'));
  assert.ok(studyInstructions.write.includes('context/resources.md'));
  assert.ok(studyInstructions.write.includes('context/memory/'));
  assert.ok(studyInstructions.write.includes('research-map.html'));
  assert.ok(
    studyInstructions.rules.includes(
      'If close preflight passes, run qdd close-study directly instead of waiting for an extra manual confirmation gate.'
    )
  );
  assert.ok(!studyInstructions.write.includes(`studies/${studyId}/output/boundary-updates.yaml`));
  assert.ok(studyInstructions.required_skills.includes('singlecell/scrna/sc-batch-integration'));

  const proposeInstructions = await buildInstructions(projectRoot, studyId, { command: 'qdd-propose' });
  assert.equal(proposeInstructions.role, 'study-brain');
  assert.ok(proposeInstructions.required_skills.includes('brain/singlecell/scrna-planning'));
  assert.ok(
    proposeInstructions.rules.includes(
      'Keep human propose as the highest semantic authority; treat prior candidates in evolution.yaml only as suggestions.'
    )
  );

  const taskInstructions = await buildInstructions(projectRoot, taskId, { command: 'qdd-apply' });
  assert.equal(taskInstructions.role, 'executor');
  assert.ok(taskInstructions.read.includes('.qdd/schema-reference.md'));
  assert.ok(taskInstructions.read.includes('.qdd/examples/task.example.md'));
  assert.ok(taskInstructions.read.includes('evolution.yaml'));
  assert.ok(taskInstructions.read.includes(`studies/${studyId}/tasks/${taskId}.md`));
  assert.ok(
    taskInstructions.rules.includes(
      'You may read the current project evolution state for alignment, but you must not mutate project-level evolution state from task-level apply.'
    )
  );
  assert.ok(
    taskInstructions.rules.includes(
      'Preserve reusable summary matrices or CSV/TSV outputs under studies/STUDY-XXX/output/tables/ and treat them as type=table when promoted.'
    )
  );
  assert.ok(!taskInstructions.read.includes('boundaries.yaml'));
});

test('qdd closeStudy promotes candidates and writes evolution, memory, and research-map', async () => {
  const projectRoot = await createTempProject('qdd-close-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Does one integration pass narrow the comparison question?',
    hypothesis: 'A first integration pass will reduce uncertainty about sample comparability.',
    targetBoundaries: ['B001'],
  });
  const { taskId } = await createTask(projectRoot, studyId, {
    goal: 'Run and preserve the first executable integration script.',
    expectedOutputs: ['One reusable Python script'],
    skills: ['singlecell/scrna/sc-batch-integration'],
  });

  await writeYamlFile(projectRoot, 'evolution.yaml', {
    studies: [],
    boundaries: [{ id: 'B001', text: 'Need a clearer first-pass integration check', state: 'open' }],
  } satisfies EvolutionState);

  const scriptPath = path.join(projectRoot, 'studies', studyId, 'output', 'code', 'integration.py');
  const tablePath = path.join(projectRoot, 'studies', studyId, 'output', 'tables', 'integration-summary.csv');
  const dataPath = path.join(projectRoot, 'studies', studyId, 'output', 'data', 'integration-final.h5ad');
  const scratchPath = path.join(projectRoot, 'studies', studyId, 'output', 'tmp', 'integration-intermediate.h5ad');
  await fs.writeFile(scriptPath, 'print("integration")\n', 'utf-8');
  await fs.writeFile(tablePath, 'sample,score\nA,1\n', 'utf-8');
  await fs.writeFile(dataPath, 'fake-h5ad-content\n', 'utf-8');
  await fs.writeFile(scratchPath, 'scratch-h5ad-content\n', 'utf-8');
  await setTaskCompleted(projectRoot, studyId, taskId);
  await recordArtifactCandidate(projectRoot, scriptPath, {
    artifactType: 'code',
    description: 'Primary first-pass integration script',
    studyId,
    taskId,
    reusable: true,
    scope: 'study',
    schema: 'python-script',
    promotionStatus: 'candidate-recorded',
  });
  await recordArtifactCandidate(projectRoot, tablePath, {
    artifactType: 'table',
    description: 'Reusable integration summary table',
    studyId,
    taskId,
    reusable: true,
    scope: 'study',
    schema: 'csv-table',
    promotionStatus: 'candidate-recorded',
  });
  await recordArtifactCandidate(projectRoot, dataPath, {
    artifactType: 'data',
    description: 'Final processed h5ad kept for downstream reuse',
    studyId,
    taskId,
    reusable: true,
    scope: 'study',
    schema: 'h5ad',
    promotionStatus: 'candidate-recorded',
  });

  await closeStudy(projectRoot, studyId, {
    changeType: 'refinement',
    summary: 'The first-pass integration run narrowed the next comparison question and produced one reusable integration script.',
    openBoundaries: ['Validate the narrowed result in a second dataset'],
    nextCandidates: ['Should we validate the narrowed integration result in a second dataset?'],
  });

  const artifacts = await listArtifacts(projectRoot);
  assert.equal(artifacts.artifacts.length, 3);
  assert.ok(artifacts.artifacts.some((entry) => entry.type === 'code' && /^artifacts\/code\/ART-\d{3}-/.test(entry.path)));
  assert.ok(artifacts.artifacts.some((entry) => entry.type === 'table' && /^artifacts\/tables\/ART-\d{3}-/.test(entry.path)));
  assert.ok(artifacts.artifacts.some((entry) => entry.type === 'data' && /^artifacts\/data\/ART-\d{3}-/.test(entry.path)));
  assert.ok(artifacts.artifacts.every((entry) => entry.produced_by === `${studyId}/${taskId}`));

  const scriptStats = await fs.lstat(scriptPath);
  const tableStats = await fs.lstat(tablePath);
  const dataStats = await fs.lstat(dataPath);
  assert.equal(scriptStats.isSymbolicLink(), true);
  assert.equal(tableStats.isSymbolicLink(), true);
  assert.equal(dataStats.isSymbolicLink(), true);
  await assert.rejects(fs.access(scratchPath));

  const evolution = await readYamlFile<EvolutionState>(projectRoot, 'evolution.yaml');
  assert.equal(evolution.studies.length, 1);
  assert.equal(evolution.studies[0]?.id, studyId);
  assert.equal(evolution.studies[0]?.question, 'Does one integration pass narrow the comparison question?');
  assert.equal(evolution.studies[0]?.kind, 'refinement');
  assert.deepEqual(evolution.studies[0]?.candidates, ['Should we validate the narrowed integration result in a second dataset?']);
  assert.equal(evolution.boundaries.length, 2);
  assert.equal(evolution.boundaries.find((entry) => entry.id === 'B001')?.state, 'resolved');
  assert.equal(
    evolution.boundaries.find((entry) => entry.text === 'Validate the narrowed result in a second dataset')?.state,
    'open'
  );

  const memoryPath = path.join(projectRoot, 'context', 'memory', `${studyId}.md`);
  const memory = await fs.readFile(memoryPath, 'utf-8');
  assert.match(memory, new RegExp(`# ${studyId} Memory`));
  assert.match(memory, /## Promoted Artifacts/);
  assert.match(memory, /ART-001/);
  assert.match(memory, /`table`/);
  assert.match(memory, /`data`/);
  assert.match(memory, /singlecell\/scrna\/sc-batch-integration/);
  assert.match(memory, /Validate the narrowed result in a second dataset/);

  const studyDocument = await readMarkdownDocument<StudyRecord>(projectRoot, `studies/${studyId}/study.md`);
  assert.equal(studyDocument.frontmatter.status, 'closed');
  assert.ok(studyDocument.frontmatter.closed_at);

  const status = await buildStatus(projectRoot);
  assert.deepEqual(status.studies.closed, [studyId]);
  assert.equal(status.question_state.last_kind, 'refinement');
  assert.deepEqual(status.question_state.next_candidates, ['Should we validate the narrowed integration result in a second dataset?']);
  assert.equal(status.memory.recent[0], `context/memory/${studyId}.md`);
  assert.equal(status.boundaries.open, 1);
  assert.ok(!status.output_review.studies_with_invalid_candidate_paths.includes(studyId));

  const validation = await validateProject(projectRoot);
  assert.equal(validation.valid, true);
});

test('qdd validate requires study memory for closed studies under the new model', async () => {
  const projectRoot = await createTempProject('qdd-validate-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can this study be marked closed without memory?',
    hypothesis: 'No, close-time memory should be required.',
  });

  const studyPath = `studies/${studyId}/study.md`;
  const studyDocument = await readMarkdownDocument<StudyRecord>(projectRoot, studyPath);
  await writeMarkdownDocument(
    projectRoot,
    studyPath,
    {
      ...studyDocument.frontmatter,
      status: 'closed',
      closed_at: new Date().toISOString(),
    },
    studyDocument.body
  );

  const validation = await validateProject(projectRoot);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === 'missing_study_memory'));
  assert.ok(!('boundaries' in validation.checked));
});

test('generated managed-file examples stay aligned with validation and task skill parsing', async () => {
  const projectRoot = await createTempProject('qdd-examples-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can the generated examples be copied into a real project without validator drift?',
    hypothesis: 'The managed-file examples should match the runtime validators.',
  });
  const { taskId } = await createTask(projectRoot, studyId, {
    goal: 'Use the generated task example as-is.',
    skills: ['singlecell/scrna/sc-batch-integration'],
  });

  const studyExample = await fs.readFile(path.join(projectRoot, '.qdd', 'examples', 'study.example.md'), 'utf-8');
  const taskExample = await fs.readFile(path.join(projectRoot, '.qdd', 'examples', 'task.example.md'), 'utf-8');
  const candidateExample = await fs.readFile(path.join(projectRoot, '.qdd', 'examples', 'artifact-candidates.example.yaml'), 'utf-8');

  await fs.writeFile(path.join(projectRoot, 'studies', studyId, 'study.md'), studyExample, 'utf-8');
  await fs.writeFile(path.join(projectRoot, 'studies', studyId, 'tasks', `${taskId}.md`), taskExample, 'utf-8');
  await fs.writeFile(path.join(projectRoot, 'studies', studyId, 'output', 'code', 'integration.py'), 'print("ok")\n', 'utf-8');
  await fs.writeFile(path.join(projectRoot, 'studies', studyId, 'output', 'tables', 'integration-summary.csv'), 'x,y\n1,2\n', 'utf-8');
  await fs.writeFile(path.join(projectRoot, 'studies', studyId, 'output', 'artifact-candidates.yaml'), candidateExample, 'utf-8');

  const taskDocument = await readMarkdownDocument<TaskRecord>(projectRoot, `studies/${studyId}/tasks/${taskId}.md`);
  const parsedSkillSection = parseTaskSkillSection(taskDocument.body);
  assert.equal(parsedSkillSection.present, true);
  assert.deepEqual(parsedSkillSection.skillIds, ['singlecell/scrna/sc-batch-integration']);

  const validation = await validateProject(projectRoot);
  assert.equal(validation.valid, true);
});

test('qdd rejects scratch-space artifact candidates and surfaces them in status and validation', async () => {
  const projectRoot = await createTempProject('qdd-invalid-candidate-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can invalid tmp candidates be surfaced before close?',
    hypothesis: 'Yes, scratch-path candidates should block close.',
  });
  const { taskId } = await createTask(projectRoot, studyId, {
    goal: 'Create one invalid scratch candidate.',
    skills: ['singlecell/scrna/sc-batch-integration'],
  });

  const scratchPath = path.join(projectRoot, 'studies', studyId, 'output', 'tmp', 'bad-intermediate.h5ad');
  await fs.writeFile(scratchPath, 'scratch\n', 'utf-8');

  await assert.rejects(
    recordArtifactCandidate(projectRoot, scratchPath, {
      artifactType: 'data',
      description: 'Invalid scratch candidate',
      studyId,
      taskId,
      reusable: true,
      scope: 'study',
      schema: 'h5ad',
      promotionStatus: 'candidate-recorded',
    }),
    /must point to final study outputs/
  );

  const taskPath = `studies/${studyId}/tasks/${taskId}.md`;
  const taskDocument = await readMarkdownDocument<TaskRecord>(projectRoot, taskPath);
  await writeMarkdownDocument(
    projectRoot,
    taskPath,
    {
      ...taskDocument.frontmatter,
      status: 'completed',
      promotion_status: 'candidate-recorded',
      updated_at: new Date().toISOString(),
    },
    taskDocument.body
  );

  await writeYamlFile(projectRoot, `studies/${studyId}/output/artifact-candidates.yaml`, {
    artifact_candidates: [
      {
        path: `studies/${studyId}/output/tmp/bad-intermediate.h5ad`,
        type: 'data',
        task_id: taskId,
        reusable: true,
        scope: 'study',
        description: 'Invalid scratch candidate',
        schema: 'h5ad',
      },
    ],
  });

  const status = await buildStatus(projectRoot);
  assert.ok(status.output_review.studies_with_invalid_candidate_paths.includes(studyId));
  assert.ok(status.close_preflight.blocked.some((entry) => entry.study_id === studyId));

  const validation = await validateProject(projectRoot);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === 'invalid_artifact_candidate_path'));

  await assert.rejects(
    closeStudy(projectRoot, studyId, {
      changeType: 'refinement',
      summary: 'This should fail before close.',
      openBoundaries: ['Need a valid final packaged output instead of tmp scratch'],
      nextCandidates: ['Repackage the final output correctly'],
    }),
    /failed close preflight/
  );
});

test('qdd validate rejects task skill bullets that do not start with a skill id', async () => {
  const projectRoot = await createTempProject('qdd-invalid-skill-body-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can invalid task skill body lines be detected?',
    hypothesis: 'Validator should reject non-machine-readable skill bullets.',
  });
  const { taskId } = await createTask(projectRoot, studyId, {
    goal: 'Create one task with an invalid skills body section.',
    skills: ['singlecell/scrna/sc-batch-integration'],
  });

  const relativePath = `studies/${studyId}/tasks/${taskId}.md`;
  const document = await readMarkdownDocument<TaskRecord>(projectRoot, relativePath);
  const invalidBody = document.body.replace(
    /## Skills[\s\S]*$/,
    ['## Skills', '', '- use scanpy first and decide later'].join('\n')
  );

  await writeMarkdownDocument(projectRoot, relativePath, document.frontmatter, invalidBody);

  const validation = await validateProject(projectRoot);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === 'invalid_task_skill_section_entry'));
});

test('qdd skills suggest returns executor-facing candidates and excludes brain skills from the catalog', async () => {
  const projectRoot = await createTempProject('qdd-skills-');

  const catalog = JSON.parse(await fs.readFile(path.join(projectRoot, '.qdd', 'skills-catalog.json'), 'utf-8')) as {
    skills: Array<{ id: string }>;
  };
  assert.ok(catalog.skills.some((entry) => entry.id === 'singlecell/scatac/scatac-preprocess-lsi'));
  assert.ok(catalog.skills.some((entry) => entry.id === 'spatial/spatial-batch-integration'));
  assert.ok(catalog.skills.some((entry) => entry.id === 'spatial/spatial-clustering'));
  assert.ok(catalog.skills.some((entry) => entry.id === 'singlecell/scrna/sc-cell-communication'));
  assert.ok(catalog.skills.some((entry) => entry.id === 'public-data/cellmarker-fetch'));
  assert.ok(catalog.skills.some((entry) => entry.id === 'public-data/geo-candidate-capture'));
  assert.ok(catalog.skills.some((entry) => entry.id === 'public-data/lrdb-fetch'));
  assert.ok(catalog.skills.some((entry) => entry.id === 'public-data/pubmed-evidence-capture'));
  assert.ok(!catalog.skills.some((entry) => entry.id === 'brain/public-data/public-data-planning'));
  assert.ok(!catalog.skills.some((entry) => entry.id === 'brain/public-data/reference-planning'));

  const integration = await suggestProblemSkills(projectRoot, {
    domain: 'singlecell',
    stage: 'integration',
    tags: ['batch'],
  });
  assert.equal(integration.low_confidence, false);
  assert.ok(integration.candidates.some((candidate) => candidate.id === 'singlecell/scrna/sc-batch-integration'));
  assert.ok(integration.candidates.some((candidate) => candidate.id === 'singlecell/scatac/scatac-batch-latent'));

  const publicData = await suggestProblemSkills(projectRoot, {
    domain: 'public-data',
    stage: 'acquisition',
    tags: ['cellxgene'],
  });
  assert.equal(publicData.low_confidence, false);
  assert.equal(publicData.candidates[0]?.id, 'public-data/cellxgene-discover');

  const publicMarkers = await suggestProblemSkills(projectRoot, {
    domain: 'public-data',
    stage: 'acquisition',
    tags: ['markers'],
  });
  assert.equal(publicMarkers.low_confidence, false);
  assert.equal(publicMarkers.candidates[0]?.id, 'public-data/cellmarker-fetch');

  const publicCommunication = await suggestProblemSkills(projectRoot, {
    domain: 'public-data',
    stage: 'acquisition',
    tags: ['communication'],
  });
  assert.equal(publicCommunication.low_confidence, false);
  assert.equal(publicCommunication.candidates[0]?.id, 'public-data/lrdb-fetch');

  const publicDatasets = await suggestProblemSkills(projectRoot, {
    domain: 'public-data',
    stage: 'acquisition',
    tags: ['datasets'],
  });
  assert.equal(publicDatasets.low_confidence, false);
  assert.ok(publicDatasets.candidates.some((candidate) => candidate.id === 'public-data/cellxgene-discover'));
  assert.ok(publicDatasets.candidates.some((candidate) => candidate.id === 'public-data/geo-candidate-capture'));

  const publicLiterature = await suggestProblemSkills(projectRoot, {
    domain: 'public-data',
    stage: 'acquisition',
    tags: ['literature'],
  });
  assert.equal(publicLiterature.low_confidence, false);
  assert.equal(publicLiterature.candidates[0]?.id, 'public-data/pubmed-evidence-capture');

  const spatialClustering = await suggestProblemSkills(projectRoot, {
    domain: 'spatial',
    stage: 'clustering',
    tags: [],
  });
  assert.equal(spatialClustering.low_confidence, false);
  assert.ok(spatialClustering.candidates.some((candidate) => candidate.id === 'spatial/spatial-clustering'));
  assert.ok(spatialClustering.candidates.some((candidate) => candidate.id === 'spatial/spatial-marker-annotation'));

  const communication = await suggestProblemSkills(projectRoot, {
    domain: 'singlecell',
    stage: 'downstream',
    tags: ['communication'],
  });
  assert.equal(communication.low_confidence, false);
  assert.equal(communication.candidates[0]?.id, 'singlecell/scrna/sc-cell-communication');
});

test('qdd init can install codex prompts without reintroducing old protocol language', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-codex-'));
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-codex-home-'));
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;

  try {
    await initCommand(projectRoot, { tools: ['claude', 'codex'] });

    const codexPrompt = await fs.readFile(path.join(codexHome, 'prompts', 'qdd-close.md'), 'utf-8');
    assert.match(codexPrompt, /evolution\.yaml/);
    assert.match(codexPrompt, /context\/memory/);
    assert.doesNotMatch(codexPrompt, /question_delta/);
    assert.doesNotMatch(codexPrompt, /boundary-updates\.yaml/);
  } finally {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
  }
});
