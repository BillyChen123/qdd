import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { initCommand } from '../commands/init.js';
import { buildStatus } from '../runtime/status.js';
import { buildInstructions } from '../runtime/instructions.js';
import { createStudy, createTask, registerArtifact, closeStudy } from '../runtime/lifecycle.js';
import { listArtifacts, listContext, validateProject } from '../runtime/inspection.js';

test('qdd init creates minimal project structure', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-init-'));

  await initCommand(projectRoot);

  await assert.doesNotReject(fs.access(path.join(projectRoot, 'contract.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'evolution.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'context')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'context', 'resources.md')));
  await assert.rejects(fs.access(path.join(projectRoot, 'context', 'datasets.yaml')));
  await assert.rejects(fs.access(path.join(projectRoot, 'context', 'environment.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'instructions.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'bootstrap.yaml')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-propose.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-explore.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-apply.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-close.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd-propose', 'SKILL.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd-explore', 'SKILL.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd-apply', 'SKILL.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd-close', 'SKILL.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd-propose', 'SKILL.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd-explore', 'SKILL.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd-apply', 'SKILL.md')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd-close', 'SKILL.md')));

  const status = await buildStatus(projectRoot);
  assert.equal(status.project.mode, 'human');
  assert.equal(status.artifacts.count, 0);
  assert.deepEqual(status.studies.completed, []);
  assert.deepEqual(status.tasks.completed, []);

  const instructions = await fs.readFile(path.join(projectRoot, '.qdd', 'instructions.md'), 'utf-8');
  assert.match(instructions, /## Quick Reference/);
  assert.match(instructions, /## Workflow/);
  assert.match(instructions, /## Validation Checklist/);
  assert.match(instructions, /context\/resources\.md/);
  assert.match(instructions, /qdd-propose/);
  assert.match(instructions, /qdd-explore/);
  assert.match(instructions, /qdd-apply/);
  assert.match(instructions, /qdd-close/);

  const resources = await fs.readFile(path.join(projectRoot, 'context', 'resources.md'), 'utf-8');
  assert.match(resources, /## Runtime Environments/);
  assert.match(resources, /## Biological Background/);
  assert.match(resources, /## Data/);

  const bootstrapConfig = await fs.readFile(path.join(projectRoot, '.qdd', 'bootstrap.yaml'), 'utf-8');
  assert.match(bootstrapConfig, /tool: claude/);
  assert.match(bootstrapConfig, /tool: codex/);
  assert.match(bootstrapConfig, /workflow: qdd-propose/);

  const proposeCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-propose.md'), 'utf-8');
  assert.match(proposeCommand, /qdd add-study/);
  assert.match(proposeCommand, /qdd add-task STUDY-XXX/);
  assert.match(proposeCommand, /qdd init/);
  assert.match(proposeCommand, /## How To Write The Initial Task/);
  assert.match(proposeCommand, /rewrite the scaffold into task-specific executable steps/);

  const exploreCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-explore.md'), 'utf-8');
  assert.match(exploreCommand, /qdd instructions STUDY-XXX --json/);
  assert.match(exploreCommand, /In `human` and `assist` mode, do not modify `study.md` or `task` files until the user confirms/);
  assert.match(exploreCommand, /## The Stance/);

  const applySkill = await fs.readFile(path.join(projectRoot, '.claude', 'skills', 'qdd-apply', 'SKILL.md'), 'utf-8');
  assert.match(applySkill, /name: qdd-apply/);
  assert.match(applySkill, /Treat the study, not the single task, as the execution unit/);
  assert.match(applySkill, /Rewrite the weak checklist scaffold into task-specific steps/);
  assert.match(applySkill, /output\/code/);
  assert.match(applySkill, /artifact-candidates\.yaml/);
});

test('qdd init can install codex prompts and refresh bootstrap assets', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-bootstrap-'));
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-codex-home-'));
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;

  try {
    await initCommand(projectRoot, { tools: ['claude', 'codex'] });

    await assert.doesNotReject(fs.access(path.join(codexHome, 'prompts', 'qdd-propose.md')));
    await assert.doesNotReject(fs.access(path.join(codexHome, 'prompts', 'qdd-close.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd-propose', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd-close', 'SKILL.md')));

    const codexPrompt = await fs.readFile(path.join(codexHome, 'prompts', 'qdd-apply.md'), 'utf-8');
    assert.match(codexPrompt, /description: Execute the current approved study\/task set until the study reaches a decision point/);
    assert.match(codexPrompt, /qdd register-artifact/);

    const codexSkill = await fs.readFile(path.join(projectRoot, '.codex', 'skills', 'qdd-explore', 'SKILL.md'), 'utf-8');
    assert.match(codexSkill, /name: qdd-explore/);
    assert.match(codexSkill, /## The Stance/);
    assert.match(codexSkill, /Discussion comes first/);

    await fs.writeFile(path.join(projectRoot, '.qdd', 'instructions.md'), 'stale instructions\n', 'utf-8');
    await initCommand(projectRoot, { tools: ['claude', 'codex'], refreshBootstrap: true });

    const refreshedInstructions = await fs.readFile(path.join(projectRoot, '.qdd', 'instructions.md'), 'utf-8');
    assert.match(refreshedInstructions, /## Mode Contract/);
    assert.match(refreshedInstructions, /workflow prompt source may live in repo-local Markdown files/);
    assert.doesNotMatch(refreshedInstructions, /stale instructions/);
  } finally {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
  }
});

test('qdd status aggregates study/task frontmatter from the prototype layout', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-status-'));
  await initCommand(projectRoot);

  await fs.mkdir(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks'), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, 'studies', 'STUDY-001', 'study.md'),
    [
      '---',
      'study_id: STUDY-001',
      'question: What is the bounded question?',
      'hypothesis: The question can be narrowed.',
      'status: created',
      'task_ids:',
      '  - TASK-001',
      '---',
      '',
      '## Question',
      '',
      'What is the bounded question?',
      '',
    ].join('\n'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(projectRoot, 'studies', 'STUDY-001', 'tasks', 'TASK-001.md'),
    [
      '---',
      'task_id: TASK-001',
      'study_id: STUDY-001',
      'goal: Produce one evidence artifact.',
      'status: pending',
      'expected_outputs:',
      '  - report',
      '---',
      '',
      '## Checklist',
      '',
      '- [ ] produce output',
      '',
    ].join('\n'),
    'utf-8'
  );

  const status = await buildStatus(projectRoot);
  assert.deepEqual(status.studies.active, ['STUDY-001']);
  assert.deepEqual(status.studies.blocked, []);
  assert.deepEqual(status.studies.completed, []);
  assert.deepEqual(status.tasks.pending, ['TASK-001']);
  assert.deepEqual(status.tasks.completed, []);
});

test('qdd instructions returns study and task guidance for existing prototype records', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-instr-'));
  await initCommand(projectRoot);

  await fs.writeFile(
    path.join(projectRoot, 'context', 'datasets.yaml'),
    ['datasets:', '  - id: DS-001', '    type: table', '    status: ready', '    path: /tmp/data.csv', ''].join('\n'),
    'utf-8'
  );

  await fs.mkdir(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks'), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, 'studies', 'STUDY-001', 'study.md'),
    [
      '---',
      'study_id: STUDY-001',
      'question: What is the bounded question?',
      'hypothesis: The question can be narrowed.',
      'status: created',
      'task_ids:',
      '  - TASK-001',
      '---',
      '',
      '## Question',
      '',
      'What is the bounded question?',
      '',
    ].join('\n'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(projectRoot, 'studies', 'STUDY-001', 'tasks', 'TASK-001.md'),
    [
      '---',
      'task_id: TASK-001',
      'study_id: STUDY-001',
      'goal: Produce one evidence artifact.',
      'status: pending',
      'expected_outputs:',
      '  - report',
      '---',
      '',
      '## Expected Output',
      '',
      'A report artifact.',
      '',
    ].join('\n'),
    'utf-8'
  );

  const studyInstructions = await buildInstructions(projectRoot, 'STUDY-001');
  assert.equal(studyInstructions.target.kind, 'study');
  assert.equal(studyInstructions.write[0], 'studies/STUDY-001/study.md');
  assert.equal(studyInstructions.write[1], 'studies/STUDY-001/tasks/');
  assert.ok(studyInstructions.write.includes('studies/STUDY-001/output/artifact-candidates.yaml'));
  assert.ok(studyInstructions.read.includes('context/resources.md'));
  assert.ok(studyInstructions.rules.includes('qdd-propose owns the first-pass study and initial task creation.'));
  assert.ok(studyInstructions.rules.includes('In human or assist mode, qdd-explore must discuss and confirm before modifying study/task artifacts.'));
  assert.ok(studyInstructions.rules.includes('Use studies/STUDY-XXX/output/artifact-candidates.yaml as the explicit promotion boundary for reusable study outputs.'));

  const taskInstructions = await buildInstructions(projectRoot, 'TASK-001');
  assert.equal(taskInstructions.target.kind, 'task');
  assert.equal(taskInstructions.write[0], 'studies/STUDY-001/tasks/TASK-001.md');
  assert.ok(taskInstructions.write.includes('studies/STUDY-001/output/artifact-candidates.yaml'));
  assert.ok(taskInstructions.read.includes('studies/STUDY-001/tasks/TASK-001.md'));
  assert.ok(taskInstructions.read.includes('context/resources.md'));
  assert.ok(taskInstructions.read.includes('context/datasets.yaml'));
  assert.ok(taskInstructions.rules.includes('Keep task checklist progress in the task Markdown body.'));
  assert.ok(taskInstructions.rules.includes('Rewrite the weak checklist scaffold into task-specific executable steps before or during execution.'));
  assert.ok(taskInstructions.rules.includes('Keep the task minimal and evidence-producing.'));
  assert.ok(taskInstructions.rules.includes('Add only promotion-worthy outputs to studies/STUDY-XXX/output/artifact-candidates.yaml; do not treat all local outputs as artifacts.'));
});

test('qdd lifecycle scaffolds studies/tasks, registers artifacts, and closes a study', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-lifecycle-'));
  await initCommand(projectRoot);

  const createdStudy = await createStudy(projectRoot, {
    question: 'What evidence supports the first bounded question?',
    hypothesis: 'A small task can produce one reusable report.',
    blockers: ['No blocker yet'],
    expectedArtifacts: ['summary report'],
  });

  const studyMarkdown = await fs.readFile(path.join(projectRoot, createdStudy.relativePath), 'utf-8');
  assert.match(studyMarkdown, /## Question/);
  assert.match(studyMarkdown, /## Why Now/);
  assert.match(studyMarkdown, /## Resource Fit/);
  assert.match(studyMarkdown, /## Evidence Plan/);
  assert.match(studyMarkdown, /## Expected Artifacts/);
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'code')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'figures')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'tables')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'reports')));
  await assert.doesNotReject(fs.access(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'artifact-candidates.yaml')));

  const createdTask = await createTask(projectRoot, createdStudy.studyId, {
    goal: 'Produce a summary report',
    expectedOutputs: ['report.md'],
    skills: ['analysis/reporting'],
  });

  const taskPath = path.join(projectRoot, createdTask.relativePath);
  const originalTaskContent = await fs.readFile(taskPath, 'utf-8');
  assert.match(originalTaskContent, /## Depends On/);
  assert.match(originalTaskContent, /## Checklist/);
  assert.match(originalTaskContent, /Replace this scaffold with 3-7 task-specific executable steps/);
  assert.match(originalTaskContent, /output\/code/);
  assert.match(originalTaskContent, /artifact-candidates\.yaml/);

  const completedTaskContent = originalTaskContent
    .replace('status: pending', 'status: completed')
    .replace('- [ ] Reconfirm the concrete success signal for this task', '- [x] Reconfirm the concrete success signal for this task')
    .replace('- [ ] Prepare the real inputs, dependencies, and execution method', '- [x] Prepare the real inputs, dependencies, and execution method')
    .replace('- [ ] Produce the expected evidence or record the blocker explicitly', '- [x] Produce the expected evidence or record the blocker explicitly')
    .replace('- [ ] Write study-local evidence into `studies/STUDY-001/output/` and summarize what changed', '- [x] Write study-local evidence into `studies/STUDY-001/output/` and summarize what changed')
    .replace('- [ ] Preserve readable analysis scripts in `studies/STUDY-001/output/code/` when this task runs substantive analysis', '- [x] Preserve readable analysis scripts in `studies/STUDY-001/output/code/` when this task runs substantive analysis')
    .replace('- [ ] Save at least one key figure in `studies/STUDY-001/output/figures/` when the task conclusion depends on visual evidence, or record why no figure was needed', '- [x] Save at least one key figure in `studies/STUDY-001/output/figures/` when the task conclusion depends on visual evidence, or record why no figure was needed')
    .replace('- [ ] Add only promotion-worthy outputs to `studies/STUDY-001/output/artifact-candidates.yaml`', '- [x] Add only promotion-worthy outputs to `studies/STUDY-001/output/artifact-candidates.yaml`');
  await fs.writeFile(taskPath, completedTaskContent, 'utf-8');

  const scriptPath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'code', 'summary-analysis.py');
  const figurePath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'figures', 'summary-plot.png');
  const artifactFilePath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'reports', 'summary.md');
  const candidatesPath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'artifact-candidates.yaml');

  await fs.writeFile(scriptPath, 'print("summary")\n', 'utf-8');
  await fs.writeFile(figurePath, 'fake-png', 'utf-8');
  await fs.writeFile(artifactFilePath, '# Summary\n', 'utf-8');
  await fs.writeFile(
    candidatesPath,
    [
      'artifact_candidates:',
      '  - path: studies/STUDY-001/output/code/summary-analysis.py',
      '    type: code',
      '    task_id: TASK-001',
      '    reusable: true',
      '    scope: task',
      '    description: Main analysis script',
      '    schema: python-script',
      '  - path: studies/STUDY-001/output/figures/summary-plot.png',
      '    type: figure',
      '    task_id: TASK-001',
      '    reusable: true',
      '    scope: study',
      '    description: Key summary figure',
      '    schema: png-figure',
      '  - path: studies/STUDY-001/output/reports/summary.md',
      '    type: report',
      '    task_id: TASK-001',
      '    reusable: true',
      '    scope: study',
      '    description: Study summary report',
      '    schema: markdown-report',
      '',
    ].join('\n'),
    'utf-8'
  );

  await closeStudy(projectRoot, createdStudy.studyId, {
    questionAfter: 'What follow-up question remains after the summary?',
    changeType: 'refinement',
    changeDriver: 'The first pass narrowed the scope.',
    openBoundaries: ['Need a second dataset'],
  });

  const status = await buildStatus(projectRoot);
  assert.deepEqual(status.studies.closed, [createdStudy.studyId]);
  assert.equal(status.tasks.completed[0], createdTask.taskId);
  assert.equal(status.artifacts.count, 3);
  assert.equal(status.question_state.last_change_type, 'refinement');
  assert.deepEqual(status.question_state.open_boundaries, ['Need a second dataset']);

  const evolution = await fs.readFile(path.join(projectRoot, 'evolution.yaml'), 'utf-8');
  assert.match(evolution, /question_after: What follow-up question remains after the summary\?/);

  const artifactIndex = await fs.readFile(path.join(projectRoot, 'artifacts', 'index.yaml'), 'utf-8');
  assert.match(artifactIndex, /summary-analysis\.py/);
  assert.match(artifactIndex, /summary-plot\.png/);
  assert.match(artifactIndex, /reports\/summary\.md/);

  const updatedTaskContent = await fs.readFile(taskPath, 'utf-8');
  assert.match(updatedTaskContent, /artifact_ids:\n  - ART-001/);
  assert.match(updatedTaskContent, /artifact_ids:\n  - ART-001\n  - ART-002\n  - ART-003/);
});

test('qdd inspection commands expose artifacts and context without mutating state', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-inspect-'));
  await initCommand(projectRoot);

  await fs.writeFile(
    path.join(projectRoot, 'context', 'datasets.yaml'),
    ['datasets:', '  - id: DS-001', '    status: ready', ''].join('\n'),
    'utf-8'
  );

  const createdStudy = await createStudy(projectRoot, {
    question: 'What reusable output can be listed?',
    hypothesis: 'One report is enough.',
  });
  const createdTask = await createTask(projectRoot, createdStudy.studyId, {
    goal: 'Produce one report',
    expectedOutputs: ['report.md'],
  });

  const taskPath = path.join(projectRoot, createdTask.relativePath);
  const taskContent = await fs.readFile(taskPath, 'utf-8');
  await fs.writeFile(taskPath, taskContent.replace('status: pending', 'status: completed'), 'utf-8');

  const artifactFilePath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'report.md');
  await fs.writeFile(artifactFilePath, '# Report\n', 'utf-8');
  await registerArtifact(projectRoot, artifactFilePath, {
    artifactType: 'report',
    description: 'Reusable report',
    reusable: true,
    studyId: createdStudy.studyId,
    taskId: createdTask.taskId,
  });

  const artifactList = await listArtifacts(projectRoot);
  assert.equal(artifactList.artifacts.length, 1);
  assert.equal(artifactList.artifacts[0].id, 'ART-001');

  const contextList = await listContext(projectRoot);
  assert.equal(contextList.context.length, 2);
  assert.ok(contextList.context.some((entry) => entry.path === 'context/resources.md'));
  assert.ok(contextList.context.some((entry) => entry.path === 'context/datasets.yaml'));

  const resourcesEntry = contextList.context.find((entry) => entry.path === 'context/resources.md');
  assert.equal(typeof resourcesEntry?.data, 'string');

  const datasetsEntry = contextList.context.find((entry) => entry.path === 'context/datasets.yaml');
  assert.equal(typeof datasetsEntry?.data, 'object');
});

test('qdd validate reports malformed state and closed studies with open tasks', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-validate-'));
  await initCommand(projectRoot);

  await fs.mkdir(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks'), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, 'studies', 'STUDY-001', 'study.md'),
    [
      '---',
      'study_id: STUDY-001',
      'question: Broken closure check',
      'hypothesis: Should fail validation',
      'status: closed',
      'task_ids:',
      '  - TASK-001',
      '---',
      '',
      '## Question',
      '',
      'Broken closure check',
      '',
    ].join('\n'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(projectRoot, 'studies', 'STUDY-001', 'tasks', 'TASK-001.md'),
    [
      '---',
      'task_id: TASK-001',
      'study_id: STUDY-001',
      'goal: Keep one task pending',
      'status: pending',
      '---',
      '',
      '## Checklist',
      '',
      '- [ ] pending',
      '',
    ].join('\n'),
    'utf-8'
  );

  await fs.writeFile(path.join(projectRoot, 'context', 'bad.yaml'), 'not: [valid', 'utf-8');
  await fs.mkdir(path.join(projectRoot, 'studies', 'STUDY-001', 'output'), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, 'studies', 'STUDY-001', 'output', 'artifact-candidates.yaml'),
    ['artifact_candidates:', '  - path: studies/STUDY-001/output/report.md', '    type: invalid', ''].join('\n'),
    'utf-8'
  );

  const validation = await validateProject(projectRoot);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === 'closed_study_with_open_tasks'));
  assert.ok(validation.issues.some((issue) => issue.code === 'invalid_context_yaml' && issue.path === 'context/bad.yaml'));
  assert.ok(validation.issues.some((issue) => issue.code === 'invalid_artifact_candidate_type'));
});
