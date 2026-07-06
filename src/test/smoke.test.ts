import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { initCommand } from '../commands/init.js';
import { createDefaultResourcesMarkdown, createExampleResourcesMarkdown } from '../file-contracts/resources.js';
import { parseTaskSkillSection } from '../file-contracts/task.js';
import { executeAgentToolForTest, executeProjectBashForTest, parseClaudeSettings, resolveBashTimeoutForTest, resolveClaudeModel, truncateToolResultForModelForTest } from '../runtime/agent-runner.js';
import {
  captureManagedPathSnapshot,
  checkTermination,
  computeInitialPhase,
  computeNextPhaseAfterCompletedPhase,
  inferAutoVisibleLanguage,
  inspectAutoPhaseDrift,
  runAuto,
  safeReadAutoStatus,
} from '../runtime/orchestrator.js';
import { suggestProblemSkills } from '../runtime/local-skills.js';
import { readMarkdownDocument, readYamlFile, writeMarkdownDocument, writeYamlFile } from '../runtime/store.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { recordArtifactCandidate } from '../services/artifacts.js';
import { closeStudy } from '../services/closure.js';
import { generateConcludeStoryCandidates, inspectConcludePreflight, renderConcludeRenderStatusMarkdown } from '../services/conclude.js';
import { listArtifacts, validateProject } from '../services/inspection.js';
import { buildInstructions } from '../services/instructions.js';
import { buildStatus } from '../services/status.js';
import { createStudy } from '../services/studies.js';
import { createTask } from '../services/tasks.js';
import type { EvolutionState, StatusJson, StudyRecord, TaskRecord } from '../types.js';
import { autoCommand, parseAutoMaxIterationsForTest, parseAutoMaxTurnsForTest } from '../commands/auto.js';
import { createAutoConsoleRenderer, renderAutoConsoleFooter, renderAutoConsoleFrame } from '../ui/auto-stream.js';

const execFileAsync = promisify(execFile);

async function createTempProject(prefix: string, options: { tools?: string[] } = {}): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await initCommand(projectRoot, { tools: options.tools ?? ['claude'] });
  return projectRoot;
}

async function collectTextFiles(root: string, ignoredSegments: string[] = []): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    const normalized = absolutePath.split(path.sep).join('/');
    if (ignoredSegments.some((segment) => normalized.includes(segment))) {
      continue;
    }
    if (entry.isDirectory()) {
      const childFiles = await collectTextFiles(absolutePath, ignoredSegments);
      files.push(...childFiles);
      continue;
    }
    if (/\.(md|ts|py|ya?ml|json|mjs|js)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

class TestInputStream extends EventEmitter {
  isTTY = true;
  isRaw = false;

  setRawMode(mode: boolean): void {
    this.isRaw = mode;
  }

  resume(): void {
    // Test stream has no paused state.
  }
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

async function setTaskState(
  projectRoot: string,
  studyId: string,
  taskId: string,
  status: NonNullable<TaskRecord['status']>,
  resultSummary?: string,
  blockerReason?: string
): Promise<void> {
  const relativePath = `studies/${studyId}/tasks/${taskId}.md`;
  const document = await readMarkdownDocument<TaskRecord>(projectRoot, relativePath);
  const resultBody =
    status === 'completed'
      ? `- ${resultSummary ?? 'Completed and summarized for conclude evidence harvesting.'}`
      : status === 'blocked'
        ? `- Blocked: ${blockerReason ?? resultSummary ?? 'Blocking condition recorded for conclude boundary evidence.'}`
        : '- Not completed yet.';

  const nextBody = document.body.replace(/## Result Summary\n\n[\s\S]*?(?=\n## Skills\b)/, `## Result Summary\n\n${resultBody}\n\n`);
  await writeMarkdownDocument(
    projectRoot,
    relativePath,
    {
      ...document.frontmatter,
      status,
      result_summary: resultSummary,
      blocker_reason: blockerReason,
      promotion_status: status === 'completed' ? 'candidate-recorded' : document.frontmatter.promotion_status,
      updated_at: new Date().toISOString(),
    },
    nextBody
  );
}

async function prependStubCommands(binDir: string, commands: string[]): Promise<NodeJS.ProcessEnv> {
  await fs.mkdir(binDir, { recursive: true });

  for (const command of commands) {
    const commandPath = path.join(binDir, command);
    await fs.writeFile(commandPath, '#!/bin/sh\nexit 0\n', 'utf-8');
    await fs.chmod(commandPath, 0o755);
  }

  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
  };
}

async function createShellWithControlledPath(shellPath: string, pathValue: string): Promise<void> {
  const shellBody = `#!/bin/sh
PATH="${pathValue}"
export PATH
exec /bin/sh "$@"
`;
  await fs.writeFile(shellPath, shellBody, 'utf-8');
  await fs.chmod(shellPath, 0o755);
}

function statusFixture(overrides: Partial<StatusJson> = {}): StatusJson {
  return {
    project: {
      theme: 'Test theme',
      mode: 'auto',
      current_question: 'What should be tested?',
      ...overrides.project,
    },
    studies: {
      active: [],
      blocked: [],
      completed: [],
      closed: [],
      ...overrides.studies,
    },
    tasks: {
      pending: [],
      running: [],
      blocked: [],
      completed: [],
      promotion_pending: [],
      candidate_recorded: [],
      registered: [],
      ...overrides.tasks,
    },
    output_review: {
      studies_with_unpackaged_output: [],
      studies_with_invalid_candidate_paths: [],
      ...overrides.output_review,
    },
    close_preflight: {
      ready: [],
      blocked: [],
      ...overrides.close_preflight,
    },
    artifacts: {
      count: 0,
      latest: [],
      ...overrides.artifacts,
    },
    memory: {
      recent: [],
      ...overrides.memory,
    },
    boundaries: {
      total: 0,
      open: 0,
      resolved: 0,
      active: [],
      ...overrides.boundaries,
    },
    question_state: {
      last_kind: null,
      next_candidates: [],
      open_boundary_ids: [],
      ...overrides.question_state,
    },
  };
}

test('auto orchestrator computes phase from persisted QDD status', () => {
  assert.deepEqual(computeInitialPhase(statusFixture()), {
    phase: 'start',
    target: 'PROJECT',
    command: 'qdd-start',
  });

  assert.deepEqual(
    computeInitialPhase(
      statusFixture({
        studies: { active: ['STUDY-001'], blocked: [], completed: [], closed: [] },
      }),
      []
    ),
    { phase: 'propose', target: 'STUDY-001', command: 'qdd-propose' }
  );

  assert.deepEqual(
    computeInitialPhase(
      statusFixture({
        studies: { active: ['STUDY-001'], blocked: [], completed: [], closed: [] },
      }),
      [{ study_id: 'STUDY-001', task_id: 'TASK-001', status: 'pending' } as TaskRecord]
    ),
    { phase: 'apply', target: 'STUDY-001', command: 'qdd-apply' }
  );

  assert.deepEqual(
    computeInitialPhase(
      statusFixture({
        studies: { active: [], blocked: ['STUDY-001'], completed: [], closed: [] },
      }),
      [{ study_id: 'STUDY-001', task_id: 'TASK-001', status: 'blocked' } as TaskRecord]
    ),
    { phase: 'close', target: 'STUDY-001', command: 'qdd-close' }
  );

  assert.deepEqual(
    computeInitialPhase(
      statusFixture({
        studies: { active: [], blocked: [], completed: ['STUDY-001'], closed: [] },
      }),
      [{ study_id: 'STUDY-001', task_id: 'TASK-001', status: 'completed' } as TaskRecord]
    ),
    { phase: 'close', target: 'STUDY-001', command: 'qdd-close' }
  );

  assert.deepEqual(
    computeInitialPhase(
      statusFixture({
        studies: { active: [], blocked: [], completed: [], closed: ['STUDY-001'] },
        question_state: {
          last_kind: 'refinement',
          next_candidates: ['Run the next bounded study'],
          open_boundary_ids: ['B001'],
        },
      })
    ),
    { phase: 'propose', target: 'STUDY-002', command: 'qdd-propose' }
  );
});

test('auto orchestrator termination conditions are explicit', () => {
  assert.equal(checkTermination(statusFixture()).shouldTerminate, false);

  assert.equal(
    checkTermination(statusFixture({
      question_state: { last_kind: 'confirmation', next_candidates: ['ignored'], open_boundary_ids: ['B001'] },
    })).shouldTerminate,
    false
  );
  assert.equal(
    checkTermination(statusFixture({
      question_state: { last_kind: 'dissolution', next_candidates: ['ignored'], open_boundary_ids: ['B001'] },
    })).shouldTerminate,
    false
  );
  assert.equal(
    checkTermination(statusFixture({
      question_state: { last_kind: 'dissolution', next_candidates: ['validate in an independent cohort'], open_boundary_ids: [] },
    })).shouldTerminate,
    false
  );
  assert.equal(
    checkTermination(statusFixture({
      question_state: { last_kind: 'dissolution', next_candidates: [], open_boundary_ids: ['B001'] },
    })).shouldTerminate,
    true
  );
  assert.equal(
    checkTermination(statusFixture({
      question_state: { last_kind: 'dissolution', next_candidates: [], open_boundary_ids: [] },
    })).shouldTerminate,
    true
  );
  assert.equal(
    checkTermination(statusFixture({
      question_state: { last_kind: 'refinement', next_candidates: ['possible follow-up'], open_boundary_ids: [] },
    })).shouldTerminate,
    false
  );
  assert.equal(
    checkTermination(statusFixture({
      question_state: { last_kind: 'refinement', next_candidates: [], open_boundary_ids: ['B001'] },
    })).shouldTerminate,
    true
  );
  assert.equal(
    checkTermination(statusFixture({
      question_state: { last_kind: 'refinement', next_candidates: [], open_boundary_ids: [] },
    })).shouldTerminate,
    true
  );

  assert.deepEqual(
    computeInitialPhase(statusFixture({
      studies: { active: [], blocked: [], completed: [], closed: ['STUDY-001'] },
      question_state: { last_kind: 'confirmation', next_candidates: ['ignored'], open_boundary_ids: ['B001'] },
    })),
    { phase: 'propose', target: 'STUDY-002', command: 'qdd-propose' }
  );

  assert.deepEqual(
    computeInitialPhase(statusFixture({
      studies: { active: [], blocked: [], completed: [], closed: ['STUDY-001'] },
      question_state: { last_kind: 'dissolution', next_candidates: ['validate the replacement model'], open_boundary_ids: [] },
    })),
    { phase: 'propose', target: 'STUDY-002', command: 'qdd-propose' }
  );

  assert.deepEqual(
    computeInitialPhase(statusFixture({
      studies: { active: [], blocked: [], completed: [], closed: ['STUDY-001'] },
      question_state: { last_kind: 'dissolution', next_candidates: [], open_boundary_ids: ['B001'] },
    })),
    null
  );
});

test('conclude preflight reads required QDD inputs and reports render availability', async () => {
  const projectRoot = await createTempProject('qdd-conclude-preflight-');
  const study = await createStudy(projectRoot, {
    question: 'Does the promoted evidence package support a bounded conclusion?',
    hypothesis: 'One closed-loop study can seed conclude preflight inputs.',
    expectedArtifacts: ['One reusable report'],
  });
  const task = await createTask(projectRoot, study.studyId, {
    goal: 'Package one reusable evidence report',
    expectedOutputs: ['One markdown summary'],
  });

  await fs.writeFile(path.join(projectRoot, 'context', 'memory', `${study.studyId}.md`), `# ${study.studyId} Memory\n\n## Question\n\nTest memory\n`, 'utf-8');
  await fs.writeFile(path.join(projectRoot, 'studies', study.studyId, 'output', 'reports', 'summary.md'), '# Summary\n', 'utf-8');

  const binDir = path.join(projectRoot, '.tmp-bin-all');
  const toolEnv = await prependStubCommands(binDir, ['latexmk', 'xelatex', 'pandoc']);
  const shellPath = path.join(projectRoot, '.tmp-shell-all.sh');
  await createShellWithControlledPath(shellPath, binDir);
  const result = await inspectConcludePreflight(projectRoot, { environment: toolEnv, shellPath });
  const renderStatus = renderConcludeRenderStatusMarkdown(result);

  assert.equal(result.projectStatus, 'available');
  assert.equal(result.qddProjectRoot, true);
  assert.equal(result.checkedPaths.contract.status, 'available');
  assert.equal(result.checkedPaths.studies.count, 1);
  assert.equal(result.checkedPaths.memory.count, 1);
  assert.equal(result.snapshot.contract?.theme, 'Unspecified research theme');
  assert.equal(result.snapshot.studies.length, 1);
  assert.equal(result.snapshot.studies[0].studyId, study.studyId);
  assert.equal(result.snapshot.studies[0].tasks.length, 1);
  assert.equal(result.snapshot.studies[0].tasks[0].taskId, task.taskId);
  assert.equal(result.snapshot.studyMemories[0].relativePath, `context/memory/${study.studyId}.md`);
  assert.equal(result.render.status, 'available');
  assert.equal(result.render.pdf.status, 'available');
  assert.equal(result.render.word.status, 'available');
  assert.match(renderStatus, /Overall status: AVAILABLE/);
  assert.match(renderStatus, /PDF: AVAILABLE/);
  assert.match(renderStatus, /Word: AVAILABLE/);
});

test('conclude preflight blocks when required QDD structure is missing', async () => {
  const projectRoot = await createTempProject('qdd-conclude-preflight-missing-');

  await fs.rm(path.join(projectRoot, 'studies'), { recursive: true, force: true });
  await fs.rm(path.join(projectRoot, 'context', 'memory'), { recursive: true, force: true });

  const result = await inspectConcludePreflight(projectRoot);
  const renderStatus = renderConcludeRenderStatusMarkdown(result);

  assert.equal(result.projectStatus, 'blocked');
  assert.equal(result.checkedPaths.studies.status, 'blocked');
  assert.equal(result.checkedPaths.memory.status, 'blocked');
  assert.ok(result.projectBlockers.some((reason) => reason.includes("Missing required conclude directory 'studies'.")));
  assert.ok(result.projectBlockers.some((reason) => reason.includes("Missing required conclude directory 'context/memory'.")));
  assert.match(renderStatus, /Project preflight: BLOCKED/);
  assert.match(renderStatus, /studies: BLOCKED/);
});

test('conclude preflight warns when .qdd is missing but conclude inputs still exist', async () => {
  const projectRoot = await createTempProject('qdd-conclude-preflight-without-qdd-dir-');
  const study = await createStudy(projectRoot, {
    question: 'Can conclude preflight tolerate a missing bootstrap directory?',
    hypothesis: 'The conclude slice should key off required research inputs, not bootstrap state.',
  });

  await fs.writeFile(path.join(projectRoot, 'context', 'memory', `${study.studyId}.md`), `# ${study.studyId} Memory\n\n## Question\n\nRoot marker audit\n`, 'utf-8');
  await fs.rm(path.join(projectRoot, '.qdd'), { recursive: true, force: true });

  const result = await inspectConcludePreflight(projectRoot);

  assert.equal(result.qddProjectRoot, false);
  assert.equal(result.projectStatus, 'available');
  assert.equal(result.projectBlockers.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("Current directory is missing standard QDD root markers")));
});

test('conclude preflight marks rendering blocked when TeX or pandoc tools are missing', async () => {
  const projectRoot = await createTempProject('qdd-conclude-render-blocked-');
  const study = await createStudy(projectRoot, {
    question: 'Does tool detection preserve blocked rendering state?',
    hypothesis: 'Missing tools should not be reported as success.',
  });

  await fs.writeFile(path.join(projectRoot, 'context', 'memory', `${study.studyId}.md`), `# ${study.studyId} Memory\n\n## Question\n\nRender audit\n`, 'utf-8');

  const binDir = path.join(projectRoot, '.tmp-bin-pdf-only');
  const toolEnv = await prependStubCommands(binDir, ['pdflatex']);
  const shellPath = path.join(projectRoot, '.tmp-shell-pdf-only.sh');
  await createShellWithControlledPath(shellPath, binDir);
  const result = await inspectConcludePreflight(projectRoot, { environment: toolEnv, shellPath });
  const renderStatus = renderConcludeRenderStatusMarkdown(result);

  assert.equal(result.projectStatus, 'available');
  assert.equal(result.render.status, 'blocked');
  assert.equal(result.render.pdf.status, 'available');
  assert.equal(result.render.word.status, 'blocked');
  assert.equal(result.render.tools.pdflatex.available, true);
  assert.equal(result.render.tools.pandoc.available, false);
  assert.equal(result.render.tools.latexmk.available, false);
  assert.match(renderStatus, /PDF: AVAILABLE/);
  assert.match(renderStatus, /Word: BLOCKED - pandoc is not installed\./);
  assert.match(renderStatus, /pandoc: BLOCKED/);
});

test('conclude preflight marks PDF rendering blocked when no TeX engine is available', async () => {
  const projectRoot = await createTempProject('qdd-conclude-render-pdf-blocked-');
  const study = await createStudy(projectRoot, {
    question: 'Does render detection block PDF when no TeX engine is installed?',
    hypothesis: 'PDF rendering should stay blocked without xelatex or pdflatex.',
  });

  await fs.writeFile(path.join(projectRoot, 'context', 'memory', `${study.studyId}.md`), `# ${study.studyId} Memory\n\n## Question\n\nPDF audit\n`, 'utf-8');

  const binDir = path.join(projectRoot, '.tmp-bin-word-only');
  const toolEnv = await prependStubCommands(binDir, ['pandoc']);
  const shellPath = path.join(projectRoot, '.tmp-shell-word-only.sh');
  await createShellWithControlledPath(shellPath, binDir);
  const result = await inspectConcludePreflight(projectRoot, { environment: toolEnv, shellPath });
  const renderStatus = renderConcludeRenderStatusMarkdown(result);

  assert.equal(result.projectStatus, 'available');
  assert.equal(result.render.status, 'blocked');
  assert.equal(result.render.pdf.status, 'blocked');
  assert.equal(result.render.word.status, 'available');
  assert.equal(result.render.tools.xelatex.available, false);
  assert.equal(result.render.tools.pdflatex.available, false);
  assert.equal(result.render.tools.pandoc.available, true);
  assert.match(renderStatus, /PDF: BLOCKED - Neither xelatex nor pdflatex is installed\./);
  assert.match(renderStatus, /Word: AVAILABLE/);
});

test('conclude generates distinct story candidates and enforces selection gate before drafting', async () => {
  const projectRoot = await createTempProject('qdd-conclude-story-candidates-');

  const discoveryStudy = await createStudy(projectRoot, {
    question: 'Which evidence package supports a bounded manuscript claim?',
    hypothesis: 'A reusable internal evidence bundle can support a conservative story candidate set.',
    expectedArtifacts: ['One figure and one report suitable for synthesis'],
  });
  const discoveryTask = await createTask(projectRoot, discoveryStudy.studyId, {
    goal: 'Summarize the candidate-state evidence without overclaiming mechanism',
    expectedOutputs: ['One summary figure', 'One synthesis report'],
  });

  await setTaskState(
    projectRoot,
    discoveryStudy.studyId,
    discoveryTask.taskId,
    'completed',
    'Expression correlation is associated with a candidate state across the reusable cohort; no perturbation or mechanism test was performed.'
  );
  await fs.writeFile(
    path.join(projectRoot, 'context', 'memory', `${discoveryStudy.studyId}.md`),
    `# ${discoveryStudy.studyId} Memory\n\n## Notes\n\nAssociation signal replicated in the curated cohort, but mechanism remains untested.\n`,
    'utf-8'
  );
  const figurePath = path.join(projectRoot, 'studies', discoveryStudy.studyId, 'output', 'figures', 'association-summary.png');
  await fs.writeFile(figurePath, 'placeholder-figure', 'utf-8');
  await recordArtifactCandidate(projectRoot, figurePath, {
    studyId: discoveryStudy.studyId,
    taskId: discoveryTask.taskId,
    artifactType: 'figure',
    description: 'Association-focused summary figure for the candidate state signal.',
    schema: 'image',
    promotionStatus: 'candidate-recorded',
  });

  const boundaryStudy = await createStudy(projectRoot, {
    question: 'Do the failed validation passes meaningfully bound the final claim?',
    hypothesis: 'Negative validation evidence should narrow, not disappear from, the final story.',
    blockers: ['Independent perturbation data are not yet available.'],
  });
  const boundaryTask = await createTask(projectRoot, boundaryStudy.studyId, {
    goal: 'Record why the validation path failed to support a mechanistic conclusion',
    expectedOutputs: ['One blocker summary'],
  });

  await setTaskState(
    projectRoot,
    boundaryStudy.studyId,
    boundaryTask.taskId,
    'blocked',
    'Validation failed to reproduce a mechanistic effect in the follow-up cohort.',
    'Follow-up validation failed and leaves only associative evidence.'
  );
  await fs.writeFile(
    path.join(projectRoot, 'context', 'memory', `${boundaryStudy.studyId}.md`),
    `# ${boundaryStudy.studyId} Memory\n\n## Notes\n\nBlocked follow-up and failed validation are useful boundary evidence for conclude.\n`,
    'utf-8'
  );

  const result = await generateConcludeStoryCandidates(projectRoot, {
    runId: 'test-story-selection',
    now: new Date('2026-07-06T12:00:00.000Z'),
  });

  const storyCandidatesMarkdown = await fs.readFile(result.storyCandidatesPath, 'utf-8');
  const claimSafetyMarkdown = await fs.readFile(result.claimSafetyAuditPath, 'utf-8');
  const paperRewritingOutputPath = path.join(result.outputDir, 'paper_rewriting_output');

  assert.equal(result.selectionRequired, true);
  assert.equal(result.selectedStoryId, null);
  assert.equal(result.nextStep, 'select-story');
  assert.equal(result.candidates.length, 3);
  assert.equal(new Set(result.candidates.map((candidate) => candidate.framing)).size, 3);
  assert.ok(result.candidates.every((candidate) => candidate.supportingEvidence.length > 0));
  assert.ok(result.candidates.some((candidate) => candidate.negativeOrBoundaryEvidence.length > 0));
  assert.ok(result.claimSafetyAudit.some((entry) => entry.action === 'soften' && /mechanism|driver|effect/i.test(entry.rationale + entry.claim)));
  assert.match(storyCandidatesMarkdown, /Selection gate: STOP here until a human selects one story candidate\./);
  assert.match(storyCandidatesMarkdown, /do not auto-select the highest score/);
  assert.match(storyCandidatesMarkdown, /associated with/);
  assert.match(claimSafetyMarkdown, /SOFTEN:/);
  assert.equal(await FileSystemUtils.directoryExists(paperRewritingOutputPath), false);
});

test('qdd conclude CLI emits json, writes evidence audit, and reports selection gate next step', async () => {
  const projectRoot = await createTempProject('qdd-conclude-cli-');

  const discoveryStudy = await createStudy(projectRoot, {
    question: 'Can the CLI integrate story selection outputs without regressing evidence harvest?',
    hypothesis: 'The conclude command should reuse current service outputs and keep the selection gate explicit.',
    expectedArtifacts: ['One reusable report'],
  });
  const discoveryTask = await createTask(projectRoot, discoveryStudy.studyId, {
    goal: 'Record one bounded association result for conclude CLI smoke coverage',
    expectedOutputs: ['One markdown summary'],
  });

  await setTaskState(
    projectRoot,
    discoveryStudy.studyId,
    discoveryTask.taskId,
    'completed',
    'The cohort signal is associated with the candidate state, but mechanism remains untested.'
  );
  await fs.writeFile(
    path.join(projectRoot, 'context', 'memory', `${discoveryStudy.studyId}.md`),
    `# ${discoveryStudy.studyId} Memory\n\n## Notes\n\nThe evidence package supports a bounded conclusion and should stay association-only.\n`,
    'utf-8'
  );

  const outputDir = 'conclusions/cli-smoke';
  const { stdout } = await execFileAsync('node', [path.join(process.cwd(), 'bin', 'qdd.js'), 'conclude', '--json', '--output-dir', outputDir], {
    cwd: projectRoot,
  });
  const parsed = JSON.parse(stdout) as {
    outputDir: string;
    evidenceAuditPath: string;
    renderStatusPath: string;
    selectionRequired: boolean;
    nextStep: string;
    candidates: Array<{ id: string }>;
  };

  const evidenceAuditMarkdown = await fs.readFile(path.join(projectRoot, outputDir, 'evidence_audit.md'), 'utf-8');
  const renderStatusMarkdown = await fs.readFile(path.join(projectRoot, outputDir, 'render_status.md'), 'utf-8');

  assert.equal(parsed.outputDir, path.join(projectRoot, outputDir));
  assert.equal(parsed.evidenceAuditPath, path.join(projectRoot, outputDir, 'evidence_audit.md'));
  assert.equal(parsed.renderStatusPath, path.join(projectRoot, outputDir, 'render_status.md'));
  assert.equal(parsed.selectionRequired, true);
  assert.equal(parsed.nextStep, 'select-story');
  assert.ok(parsed.candidates.length >= 1);
  assert.match(evidenceAuditMarkdown, /# Evidence Audit/);
  assert.match(evidenceAuditMarkdown, /associated with/);
  assert.match(renderStatusMarkdown, /# Render Status/);
});

test('auto orchestrator lets thesis candidates drive continuation instead of open boundaries alone', () => {
  assert.deepEqual(
    computeInitialPhase(
      statusFixture({
        studies: { active: [], blocked: [], completed: [], closed: ['STUDY-001'] },
        question_state: {
          last_kind: 'refinement',
          next_candidates: ['Question: validate the central model. Expected signal: matched direction. Strategy: validation.'],
          open_boundary_ids: [],
        },
      })
    ),
    { phase: 'propose', target: 'STUDY-002', command: 'qdd-propose' }
  );

  assert.deepEqual(
    computeInitialPhase(
      statusFixture({
        studies: { active: ['STUDY-002'], blocked: [], completed: [], closed: ['STUDY-001'] },
        question_state: {
          last_kind: 'refinement',
          next_candidates: [],
          open_boundary_ids: ['B001'],
        },
      }),
      [{ study_id: 'STUDY-002', task_id: 'TASK-002', status: 'pending' } as TaskRecord]
    ),
    { phase: 'apply', target: 'STUDY-002', command: 'qdd-apply' }
  );
});

test('public-data capture scripts keep persisted NCBI URLs credential-free', async () => {
  const geoScript = await fs.readFile(
    path.join(process.cwd(), 'domain-skills/public-data/geo-candidate-capture/scripts/geo_candidate_capture.py'),
    'utf-8'
  );
  const pubmedScript = await fs.readFile(
    path.join(process.cwd(), 'domain-skills/public-data/pubmed-evidence-capture/scripts/pubmed_evidence_capture.py'),
    'utf-8'
  );

  for (const script of [geoScript, pubmedScript]) {
    assert.match(script, /SENSITIVE_PARAM_KEYS/);
    assert.match(script, /def public_request_params/);
    assert.match(script, /def build_ncbi_url/);
    assert.match(script, /credential_fields_redacted/);
    assert.doesNotMatch(script, /ncbi_esearch_url["']:\s*f["']\{EUTILS_BASE\}\/esearch\.fcgi\?\{urlencode/);
    assert.doesNotMatch(script, /return pmids,\s*f["']\{EUTILS_BASE\}\/esearch\.fcgi\?\{urlencode/);
  }
});

test('default resource examples allow task-specific GPU use without personal environment assumptions', () => {
  const defaultResources = createDefaultResourcesMarkdown();
  const exampleResources = createExampleResourcesMarkdown();
  const combined = `${defaultResources}\n${exampleResources}`;

  assert.match(defaultResources, /CPU: unspecified; qdd-start should record logical cores/);
  assert.match(defaultResources, /GPU: unknown; qdd-start should record only basic GPU availability/);
  assert.match(exampleResources, /GPU may be used by task-specific deep-learning backends when available/);
  assert.match(exampleResources, /prefer explicit `--threads`/);
  assert.match(exampleResources, /packaged example environment/);
  assert.doesNotMatch(combined, /GPU not required/);
  assert.doesNotMatch(combined, new RegExp(['CellFM', '_torch'].join('')));
  assert.doesNotMatch(combined, /CONDA_PREFIX|CUDA_VISIBLE_DEVICES=.*|sys\.executable/);
});

test('active public sources do not expose local developer paths or private project names', async () => {
  const roots = ['src', 'docs', 'domain-skills', 'envs', 'openspec/changes'].map((relativePath) =>
    path.join(process.cwd(), relativePath)
  );
  const files = (
    await Promise.all(roots.map((root) =>
      collectTextFiles(root, [
        '/dist/',
        '/node_modules/',
        '/openspec/changes/archive/',
      ])
    ))
  ).flat();
  const forbiddenPatterns = [
    ['/data', '/chenyz'].join(''),
    ['panrank', '_tmp'].join(''),
    ['CellFM', '_torch'].join(''),
  ];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        content.includes(pattern),
        false,
        `${path.relative(process.cwd(), file)} contains forbidden local marker ${pattern}`
      );
    }
  }
});

test('auto orchestrator recomputes next real phase from persisted state after start', () => {
  const startPhase = { phase: 'start' as const, target: 'PROJECT', command: 'qdd-start' as const };

  assert.deepEqual(
    computeNextPhaseAfterCompletedPhase(startPhase, statusFixture(), []),
    { phase: 'propose', target: 'STUDY-001', command: 'qdd-propose' }
  );

  assert.deepEqual(
    computeNextPhaseAfterCompletedPhase(
      startPhase,
      statusFixture({
        studies: { active: ['STUDY-001'], blocked: [], completed: [], closed: [] },
      }),
      []
    ),
    { phase: 'propose', target: 'STUDY-001', command: 'qdd-propose' }
  );

  assert.deepEqual(
    computeNextPhaseAfterCompletedPhase(
      startPhase,
      statusFixture({
        studies: { active: [], blocked: [], completed: ['STUDY-001'], closed: [] },
      }),
      [{ study_id: 'STUDY-001', task_id: 'TASK-001', status: 'completed' } as TaskRecord]
    ),
    { phase: 'close', target: 'STUDY-001', command: 'qdd-close' }
  );
});

test('qdd auto reports invalid_state for mixed-schema evolution.yaml', async () => {
  const projectRoot = await createTempProject('qdd-auto-invalid-evolution-');

  await writeYamlFile(projectRoot, 'evolution.yaml', {
    studies: [
      {
        study_id: 'STUDY-001',
        status: 'completed',
        outcome: 'refinement',
      },
    ],
    boundaries: [],
  });

  const statusRead = await safeReadAutoStatus(projectRoot);
  assert.equal(statusRead.ok, false);
  if (!statusRead.ok) {
    assert.equal(statusRead.invalidState.likelyPath, 'evolution.yaml');
    assert.match(statusRead.invalidState.message, /invalid id/);
  }

  const result = await runAuto(projectRoot, {
    model: 'dry-run-model',
    maxIterations: 1,
    maxTurnsPerAgent: 1,
    dryRun: true,
  });
  assert.equal(result.terminalCode, 'invalid_state');
  assert.match(result.terminalReason, /evolution\.yaml/);
});

test('qdd auto reports invalid_state for old artifact-candidates.yaml manifest shape', async () => {
  const projectRoot = await createTempProject('qdd-auto-invalid-candidates-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can old candidate manifests be detected?',
    hypothesis: 'Old top-level candidates should be invalid for auto continuation.',
  });
  const { taskId } = await createTask(projectRoot, studyId, {
    goal: 'Create a completed task with old candidate manifest shape.',
    skills: ['singlecell/scrna/sc-batch-integration'],
  });
  await setTaskCompleted(projectRoot, studyId, taskId);
  await writeYamlFile(projectRoot, `studies/${studyId}/output/artifact-candidates.yaml`, {
    candidates: [
      {
        artifact_id: 'ART-001',
        path: `studies/${studyId}/output/code/old.py`,
        promotion_note: 'old shape',
        promoted: false,
      },
    ],
  });

  const statusRead = await safeReadAutoStatus(projectRoot);
  assert.equal(statusRead.ok, false);
  if (!statusRead.ok) {
    assert.equal(statusRead.invalidState.likelyPath, `studies/${studyId}/output/artifact-candidates.yaml`);
    assert.match(statusRead.invalidState.message, /stale schema/);
    assert.match(statusRead.invalidState.message, /candidates/);
    assert.match(statusRead.invalidState.message, /artifact_candidates/);
  }

  const result = await runAuto(projectRoot, {
    model: 'dry-run-model',
    maxIterations: 1,
    maxTurnsPerAgent: 1,
    dryRun: true,
  });
  assert.equal(result.terminalCode, 'invalid_state');
  assert.match(result.terminalReason, /artifact-candidates\.yaml/);
  assert.match(result.terminalReason, /stale schema|artifact_candidates/);
});

test('auto phase drift flags qdd-start study and evolution writes', async () => {
  const projectRoot = await createTempProject('qdd-auto-drift-');
  const startPhase = { phase: 'start' as const, target: 'PROJECT', command: 'qdd-start' as const };
  const snapshotBefore = await captureManagedPathSnapshot(projectRoot);
  await createStudy(projectRoot, {
    question: 'Did start overreach?',
    hypothesis: 'Drift diagnostics should flag study writes.',
  });
  await writeYamlFile(projectRoot, 'evolution.yaml', {
    studies: [],
    boundaries: [],
  });
  const drift = await inspectAutoPhaseDrift(projectRoot, startPhase, snapshotBefore);
  assert.ok(drift.unexpectedPaths.some((entry) => entry.startsWith('studies/')));
  assert.ok(drift.unexpectedPaths.includes('evolution.yaml'));
});

test('auto phase drift flags direct evolution writes during propose and apply', async () => {
  const projectRoot = await createTempProject('qdd-auto-study-drift-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can study phases mutate evolution directly?',
    hypothesis: 'Direct evolution writes should be phase drift before close.',
  });

  for (const phase of ['propose', 'apply'] as const) {
    const snapshotBefore = await captureManagedPathSnapshot(projectRoot);
    await writeYamlFile(projectRoot, 'evolution.yaml', {
      studies: [
        {
          id: studyId,
          question: 'Can study phases mutate evolution directly?',
          kind: 'refinement',
          resolves: [],
          opens: [],
          candidates: [`This write is only for ${phase} drift detection.`],
          ts: new Date().toISOString(),
        },
      ],
      boundaries: [],
    });

    const drift = await inspectAutoPhaseDrift(
      projectRoot,
      { phase, target: studyId, command: phase === 'propose' ? 'qdd-propose' : 'qdd-apply' },
      snapshotBefore
    );
    assert.ok(drift.unexpectedPaths.includes('evolution.yaml'));
  }
});

test('Claude settings parser reads Claude Code env block', () => {
  const settings = parseClaudeSettings(JSON.stringify({
    env: {
      ANTHROPIC_AUTH_TOKEN: 'test-token',
      ANTHROPIC_BASE_URL: 'https://example.test/anthropic',
      ANTHROPIC_MODEL: 'test-model',
    },
  }));

  assert.equal(settings.ANTHROPIC_AUTH_TOKEN, 'test-token');
  assert.equal(settings.ANTHROPIC_BASE_URL, 'https://example.test/anthropic');
  assert.equal(settings.ANTHROPIC_MODEL, 'test-model');
});

test('Claude model resolution lets CLI override env and settings only when explicit', () => {
  assert.equal(
    resolveClaudeModel('cli-model', {
      env: { ANTHROPIC_MODEL: 'env-model' } as NodeJS.ProcessEnv,
      settings: { ANTHROPIC_MODEL: 'settings-model' },
    }),
    'cli-model'
  );

  assert.equal(
    resolveClaudeModel(undefined, {
      env: { ANTHROPIC_MODEL: 'env-model' } as NodeJS.ProcessEnv,
      settings: { ANTHROPIC_MODEL: 'settings-model' },
    }),
    'env-model'
  );

  assert.equal(
    resolveClaudeModel(undefined, {
      env: {} as NodeJS.ProcessEnv,
      settings: { ANTHROPIC_MODEL: 'settings-model' },
    }),
    'settings-model'
  );

  assert.equal(
    resolveClaudeModel(undefined, {
      env: {} as NodeJS.ProcessEnv,
      settings: {},
    }),
    'claude-sonnet-4-6'
  );
});

test('qdd auto defaults to unlimited agent turns while preserving explicit caps', () => {
  assert.equal(parseAutoMaxTurnsForTest(undefined), null);
  assert.equal(parseAutoMaxTurnsForTest('none'), null);
  assert.equal(parseAutoMaxTurnsForTest('unlimited'), null);
  assert.equal(parseAutoMaxTurnsForTest('7'), 7);
  assert.throws(() => parseAutoMaxTurnsForTest('0x10'), /--max-turns must be a positive integer/);
});

test('qdd auto defaults to unlimited loop iterations while preserving explicit caps', () => {
  assert.equal(parseAutoMaxIterationsForTest(undefined), null);
  assert.equal(parseAutoMaxIterationsForTest('none'), null);
  assert.equal(parseAutoMaxIterationsForTest('unlimited'), null);
  assert.equal(parseAutoMaxIterationsForTest('7'), 7);
  assert.throws(() => parseAutoMaxIterationsForTest('0x10'), /--max-iterations must be a positive integer/);
});

test('agent bash timeout presets map to bounded synchronous durations', () => {
  assert.deepEqual(resolveBashTimeoutForTest(undefined), {
    timeoutMs: 600_000,
    preset: 'normal',
    capped: false,
  });
  assert.equal(resolveBashTimeoutForTest('short').timeoutMs, 120_000);
  assert.equal(resolveBashTimeoutForTest(undefined, 'long').timeoutMs, 3_600_000);
  assert.deepEqual(resolveBashTimeoutForTest(3_700_000), {
    timeoutMs: 3_600_000,
    preset: 'custom',
    requestedMs: 3_700_000,
    capped: true,
  });
});

test('agent bash tool rejects commands that leave the project root', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-agent-bash-root-'));
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-agent-bash-outside-'));
  const nestedRoot = path.join(projectRoot, 'nested');
  await fs.mkdir(nestedRoot);

  const nestedOutput = await executeProjectBashForTest(projectRoot, 'cd nested && pwd -P');
  assert.equal(nestedOutput.split('\n')[0], await fs.realpath(nestedRoot));
  assert.match(nestedOutput, /"timed_out": false/);

  const blockedOutput = await executeProjectBashForTest(projectRoot, `cd ${JSON.stringify(outsideRoot)} && pwd -P`);
  assert.match(blockedOutput, /left QDD project root/);
  assert.match(blockedOutput, /\[exit code: 125\]/);

  const blockedSubshellOutput = await executeProjectBashForTest(projectRoot, `(cd ${JSON.stringify(outsideRoot)} && pwd -P)`);
  assert.match(blockedSubshellOutput, /left QDD project root/);
  assert.match(blockedSubshellOutput, /\[exit code: 125\]/);
});

test('agent bash timeout terminates descendant shell work', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-agent-bash-timeout-'));
  const markerPath = path.join(projectRoot, 'child-survived.txt');
  const command = '(sleep 1.2; echo survived > child-survived.txt) & wait';

  const result = await executeProjectBashForTest(projectRoot, command, 100);

  assert.match(result, /\[killed by timeout\]/);
  assert.match(result, /"timed_out": true/);
  assert.match(result, /"timeout_ms": 100/);
  await new Promise((resolve) => setTimeout(resolve, 1600));
  await assert.rejects(fs.access(markerPath));
});

test('agent bash output is bounded with explicit truncation metadata', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-agent-bash-output-'));
  const script = "process.stdout.write('x'.repeat(20000)); process.stderr.write('y'.repeat(20000));";

  const result = await executeProjectBashForTest(projectRoot, `node -e ${JSON.stringify(script)}`, 10_000);

  assert.match(result, /\[stdout truncated to last 16000 chars\]/);
  assert.match(result, /\[stderr\]\n\[stderr truncated to last 16000 chars\]/);
  assert.match(result, /"stdout_truncated": true/);
  assert.match(result, /"stderr_truncated": true/);
  assert.equal(result.length < 40_000, true);
});

test('model-facing tool truncation preserves tail metadata', () => {
  const result = [
    'x'.repeat(20_000),
    '[runtime]',
    '{',
    '  "timed_out": false,',
    '  "stdout_truncated": true',
    '}',
  ].join('\n');

  const truncated = truncateToolResultForModelForTest(result);

  assert.match(truncated, /\[tool result truncated:/);
  assert.match(truncated, /\[runtime\]/);
  assert.match(truncated, /"stdout_truncated": true/);
  assert.equal(truncated.length < 8_300, true);
});

test('agent read tool returns metadata for binary and oversized files', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-agent-read-'));
  await fs.writeFile(path.join(projectRoot, 'small.txt'), 'small text\n', 'utf-8');
  await fs.writeFile(path.join(projectRoot, 'matrix.h5ad'), Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a, 0]));
  await fs.writeFile(path.join(projectRoot, 'large.txt'), 'a'.repeat(600 * 1024), 'utf-8');

  const small = await executeAgentToolForTest(projectRoot, {
    id: 'tool-read-small',
    name: 'read',
    input: { path: 'small.txt' },
  });
  const binary = await executeAgentToolForTest(projectRoot, {
    id: 'tool-read-binary',
    name: 'read',
    input: { path: 'matrix.h5ad' },
  });
  const large = await executeAgentToolForTest(projectRoot, {
    id: 'tool-read-large',
    name: 'read',
    input: { path: 'large.txt' },
  });

  assert.equal(small, 'small text\n');
  assert.match(binary, /Read skipped: binary file content/);
  assert.match(binary, /"kind": "metadata_only"/);
  assert.match(binary, /"reason": "binary"/);
  assert.doesNotMatch(binary, /\x00/);
  assert.match(large, /Read skipped: too_large file content/);
  assert.match(large, /"reason": "too_large"/);
  assert.equal(large.length < 2000, true);
});

test('agent write tool rejects invalid managed Markdown without overwriting existing content', async () => {
  const projectRoot = await createTempProject('qdd-managed-write-md-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can managed writes reject invalid frontmatter?',
    hypothesis: 'Invalid managed Markdown should be rejected before disk mutation.',
  });
  const { taskId } = await createTask(projectRoot, studyId, {
    goal: 'Produce one valid task before attempting an invalid overwrite.',
    skills: ['singlecell/scrna/sc-batch-integration'],
  });
  const relativePath = `studies/${studyId}/tasks/${taskId}.md`;
  const before = await fs.readFile(path.join(projectRoot, relativePath), 'utf-8');
  const invalidContent = [
    '---',
    `task_id: ${taskId}`,
    `study_id: ${studyId}`,
    'goal: Produce one valid task before attempting an invalid overwrite.',
    'status: completed',
    'expected_outputs: []',
    'depends_on: []',
    'skills: []',
    'promotion_status: candidate-recorded',
    'artifact_ids: []',
    'result_summary: 32 publications captured. Key related work: Nature 2024 atlas.',
    '---',
    '',
    '## Result Summary',
    '',
    'Invalid frontmatter should never land on disk.',
    '',
  ].join('\n');

  const result = await executeAgentToolForTest(projectRoot, {
    id: 'tool-1',
    name: 'write',
    input: {
      path: relativePath,
      content: invalidContent,
    },
  });

  assert.match(result, /invalid YAML frontmatter/);
  assert.match(result, /Nested mappings are not allowed|bad indentation|implicit map keys/i);
  assert.equal(await fs.readFile(path.join(projectRoot, relativePath), 'utf-8'), before);
});

test('agent write tool rejects invalid managed YAML and allows non-managed outputs', async () => {
  const projectRoot = await createTempProject('qdd-managed-write-yaml-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can managed YAML writes be guarded?',
    hypothesis: 'Invalid managed YAML should be rejected while normal outputs stay writable.',
  });
  const candidatePath = `studies/${studyId}/output/artifact-candidates.yaml`;
  const before = await fs.readFile(path.join(projectRoot, candidatePath), 'utf-8');

  const invalidYamlResult = await executeAgentToolForTest(projectRoot, {
    id: 'tool-1',
    name: 'write',
    input: {
      path: candidatePath,
      content: [
        'artifact_candidates:',
        '  - path: studies/STUDY-001/output/tables/a.csv',
        '    type: table',
        '    description: Key related work: Nature 2024 atlas',
      ].join('\n'),
    },
  });

  assert.match(invalidYamlResult, /Managed YAML file/);
  assert.equal(await fs.readFile(path.join(projectRoot, candidatePath), 'utf-8'), before);

  const outputPath = `studies/${studyId}/output/reports/freeform.md`;
  const outputResult = await executeAgentToolForTest(projectRoot, {
    id: 'tool-2',
    name: 'write',
    input: {
      path: outputPath,
      content: [
        '# Freeform Report',
        '',
        'This ordinary output can contain malformed YAML-looking prose:',
        'result_summary: Key related work: Nature 2024 atlas',
        '',
      ].join('\n'),
    },
  });

  assert.match(outputResult, /File written:/);
  assert.match(await fs.readFile(path.join(projectRoot, outputPath), 'utf-8'), /Key related work: Nature 2024 atlas/);
});

test('qdd auto dry-run sequences two cycles without mutating project state', async () => {
  const projectRoot = await createTempProject('qdd-auto-dry-run-');

  const result = await runAuto(projectRoot, {
    model: 'dry-run-model',
    maxIterations: 7,
    maxTurnsPerAgent: 3,
    dryRun: true,
  });

  assert.equal(result.terminalCode, 'max_iterations');
  assert.equal(result.iterations, 7);
  assert.equal(result.studiesCompleted, 2);
  assert.deepEqual(
    result.phases.map((phase) => `${phase.phase}:${phase.target}:${phase.command}`),
    [
      'start:PROJECT:qdd-start',
      'propose:STUDY-001:qdd-propose',
      'apply:STUDY-001:qdd-apply',
      'close:STUDY-001:qdd-close',
      'propose:STUDY-002:qdd-propose',
      'apply:STUDY-002:qdd-apply',
      'close:STUDY-002:qdd-close',
    ]
  );
  await assert.rejects(fs.access(path.join(projectRoot, 'studies', 'STUDY-001', 'study.md')));
});

test('qdd auto verbose dry-run reports initial state', async () => {
  const projectRoot = await createTempProject('qdd-auto-verbose-dry-run-');
  const logs: string[] = [];

  await runAuto(projectRoot, {
    model: 'dry-run-model',
    maxIterations: 1,
    maxTurnsPerAgent: 3,
    dryRun: true,
    verbose: true,
    logger: (message) => logs.push(message),
  });

  assert.equal(logs.some((line) => line.startsWith('Initial state: studies active=')), true);
});

test('qdd auto dry-run reports supplied auto prompt', async () => {
  const projectRoot = await createTempProject('qdd-auto-prompt-dry-run-');
  const logs: string[] = [];

  await runAuto(projectRoot, {
    model: 'dry-run-model',
    maxIterations: 1,
    maxTurnsPerAgent: null,
    dryRun: true,
    prompt: 'Use /data/example.h5ad and evaluate with accuracy.py.',
    logger: (message) => logs.push(message),
  });

  assert.equal(logs.some((line) => line.includes('Max turns per agent: unlimited')), true);
  assert.equal(logs.some((line) => line.includes('Use /data/example.h5ad')), true);
});

test('qdd auto infers Chinese visible model output from prompt or env', () => {
  assert.equal(inferAutoVisibleLanguage('去读取 benchmark 文件夹', {} as NodeJS.ProcessEnv), 'zh');
  assert.equal(inferAutoVisibleLanguage('Read benchmark folders', {} as NodeJS.ProcessEnv), 'default');
  assert.equal(inferAutoVisibleLanguage('Read benchmark folders', { QDD_AUTO_MODEL_LANG: 'zh' } as NodeJS.ProcessEnv), 'zh');
  assert.equal(inferAutoVisibleLanguage('去读取 benchmark 文件夹', { QDD_AUTO_MODEL_LANG: 'en' } as NodeJS.ProcessEnv), 'default');
});

test('qdd auto console renderer emits compact non-tty output', async () => {
  const projectRoot = await createTempProject('qdd-auto-renderer-');
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    stdout: {
      columns: 100,
      isTTY: false,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  const result = await runAuto(projectRoot, {
    model: 'dry-run-model',
    maxIterations: 1,
    maxTurnsPerAgent: null,
    dryRun: true,
    prompt: 'Read benchmark README files before proposing work.',
    events: renderer.events,
    logger: () => undefined,
  });
  renderer.finish(result);

  const output = chunks.join('');
  assert.match(output, /qdd auto autonomous research loop/);
  assert.match(output, /mode    dry-run/);
  assert.match(output, /limits  1 phases, unlimited turns\/session/);
  assert.match(output, /🔵 \[Phase: Thesis Manager\] PROJECT/);
  assert.match(output, /├─ ▶ Thesis Manager \(qdd-start\)/);
  assert.match(output, /⌙ phase start  command qdd-start  role thesis-manager/);
  assert.match(output, /dry-run system prompt qdd-start\.md/);
  assert.match(output, /Result max_iterations/);
  assert.match(output, /log     \.qdd\/runs\/auto-/);
  assert.doesNotMatch(output, /\x1b\[/);
});

test('qdd auto console frame renders modern header phases and footer', () => {
  const output = renderAutoConsoleFrame({
    width: 92,
    version: '0.1.0',
    uptimeSeconds: 12,
    globalStatus: 'THINKING',
    logoStatus: 'thinking',
    logoDensity: 'compact',
    projectRoot: '/tmp/project',
    model: 'test-model',
    mode: 'live',
    propose: '评估当前研究方法是否包含潜在的循环论证风险？',
    actionStatus: 'THINKING',
    action: 'Brain is modeling the logic chains...',
    timerSeconds: 12,
    phases: [
      {
        alias: 'Thesis Manager',
        tone: 'cyan',
        role: 'thesis-manager',
        target: 'PROJECT',
        command: 'qdd-start',
        state: 'complete',
        rows: [
          { state: 'complete', text: '已解析当前 Prompt 的上下文结构' },
          { state: 'complete', text: '任务拆解完成，已移交 Study Brain' },
        ],
      },
      {
        alias: 'Study Brain',
        tone: 'violet',
        role: 'study-brain',
        target: 'STUDY-001',
        command: 'qdd-propose',
        state: 'active',
        rows: [
          { state: 'complete', text: '检索已有知识库完成 (100% Match)' },
          { state: 'active', text: '[Thinking] 正在构建多维特征关联图谱...', detail: '正在尝试寻找逻辑链路的最优解...' },
        ],
      },
      {
        alias: 'Executor',
        tone: 'mint',
        role: 'executor',
        target: 'TASK-001',
        command: 'qdd-apply',
        state: 'pending',
        rows: [],
      },
    ],
  }, { color: false });

  assert.match(output, /QDD AUTO modern multi-agent research loop/);
  assert.match(output, /v0\.1\.0  up 00:12  THINKING/);
  assert.match(output, /🔵 \[Phase: Thesis Manager\]/);
  assert.match(output, /🟣 \[Phase: Study Brain\]/);
  assert.match(output, /🟢 \[Phase: Executor\]/);
  assert.match(output, /├─ ✔ 已解析当前 Prompt 的上下文结构/);
  assert.match(output, /└─ ▶ \[Thinking\] 正在构建多维特征关联图谱/);
  assert.match(output, /⌙ 正在尝试寻找逻辑链路的最优解/);
  assert.match(output, / PROPOSE  评估当前研究方法/);
  assert.match(output, / THINKING   ⠹ Brain is modeling the logic chains... \[00:12\]/);
});

test('qdd auto console footer avoids writing into the terminal wrap column', () => {
  const footer = renderAutoConsoleFooter({
    width: 60,
    version: '0.1.0',
    uptimeSeconds: 12,
    globalStatus: 'THINKING',
    logoStatus: 'thinking',
    logoDensity: 'compact',
    propose: 'a very long current hypothesis that must be truncated before the wrap column',
    actionStatus: 'THINKING',
    action: 'a very long action that must not fill the terminal width',
    timerSeconds: 12,
    phases: [],
  }, { color: false });

  assert.equal(footer.length, 2);
  assert.equal(footer[0].length, 59);
  assert.equal(footer[1].length, 59);
});

test('qdd auto console renderer does not enable sticky footer by default', () => {
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    intro: false,
    stdout: {
      columns: 88,
      rows: 24,
      isTTY: true,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  renderer.events.runStart?.({
    projectRoot: '/tmp/qdd-project',
    phase: { phase: 'start', target: 'PROJECT', command: 'qdd-start' },
    model: 'test-model',
    maxIterations: 1,
    maxTurnsPerAgent: 3,
    dryRun: false,
    prompt: 'Investigate the current hypothesis.',
  });
  renderer.events.phaseStart?.({
    iteration: 1,
    phase: { phase: 'propose', target: 'STUDY-001', command: 'qdd-propose' },
    label: 'Study Brain (qdd-propose)',
    role: 'study-brain',
  });

  const output = chunks.join('');
  assert.match(output, /QDD AUTO modern multi-agent research loop/);
  assert.doesNotMatch(output, /qdd auto autonomous research loop/);
  assert.doesNotMatch(output, / PROPOSE  Investigate the current hypothesis\./);
  assert.doesNotMatch(output, /\x1b\[23;1H\x1b\[2K/);
  assert.match(output, /🟣 \[Phase: Study Brain\]/);
});

test('qdd auto console renderer can anchor sticky footer when explicitly enabled', () => {
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    intro: false,
    stickyFooter: true,
    stdout: {
      columns: 88,
      rows: 24,
      isTTY: true,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  renderer.events.runStart?.({
    projectRoot: '/tmp/qdd-project',
    phase: { phase: 'start', target: 'PROJECT', command: 'qdd-start' },
    model: 'test-model',
    maxIterations: 1,
    maxTurnsPerAgent: 3,
    dryRun: false,
    prompt: 'Investigate the current hypothesis.',
  });

  const output = chunks.join('');
  assert.match(output, / PROPOSE  Investigate the current hypothesis\./);
  assert.match(output, /\x1b\[23;1H\x1b\[2K/);
  assert.match(output, /\x1b\[\?7l/);
  assert.match(output, /\x1b\[\?7h/);
});

test('qdd auto console renderer shows active phase context above spinner', () => {
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    intro: false,
    stdout: {
      columns: 100,
      rows: 24,
      isTTY: true,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  renderer.events.runStart?.({
    projectRoot: '/tmp/qdd-project',
    phase: { phase: 'start', target: 'PROJECT', command: 'qdd-start' },
    model: 'test-model',
    maxIterations: 1,
    maxTurnsPerAgent: 3,
    dryRun: false,
    prompt: 'Inspect benchmark files.',
  });
  renderer.events.phaseStart?.({
    iteration: 1,
    phase: { phase: 'start', target: 'PROJECT', command: 'qdd-start' },
    label: 'Thesis Manager (qdd-start)',
    role: 'thesis-manager',
  });
  renderer.events.agent?.turnStart?.({ turn: 1 });
  renderer.finish({
    iterations: 1,
    studiesCompleted: 0,
    finalPhase: 'start',
    terminalCode: 'terminal_state',
    terminalReason: 'Done.',
    summary: 'Auto mode completed.',
    phases: [],
  });

  const output = chunks.join('');
  assert.match(output, /↳ Thesis Manager \(qdd-start\) -> PROJECT/);
  assert.match(output, /• ⠋ thinking turn 1/);
  assert.doesNotMatch(output, /\x1b\[23;1H\x1b\[2K/);
});

test('qdd auto console renderer shows study question above spinner during qdd-propose', () => {
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    intro: false,
    stdout: {
      columns: 120,
      rows: 24,
      isTTY: true,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  renderer.events.runStart?.({
    projectRoot: '/tmp/qdd-project',
    phase: { phase: 'propose', target: 'STUDY-001', command: 'qdd-propose' },
    model: 'test-model',
    maxIterations: 1,
    maxTurnsPerAgent: 3,
    dryRun: false,
    prompt: '评估当前研究方法是否包含潜在的循环论证风险？',
  });
  renderer.events.phaseStart?.({
    iteration: 1,
    phase: { phase: 'propose', target: 'STUDY-001', command: 'qdd-propose' },
    label: 'Study Brain (qdd-propose)',
    role: 'study-brain',
  });
  renderer.events.agent?.turnStart?.({ turn: 1 });
  renderer.events.agent?.toolUse?.({
    turn: 1,
    tool: { id: 'tool-1', name: 'read', input: { path: 'studies/STUDY-001/study.md' } },
  });
  renderer.events.agent?.toolResult?.({
    turn: 1,
    tool: { id: 'tool-1', name: 'read', input: { path: 'studies/STUDY-001/study.md' } },
    result: [
      '---',
      'study_id: STUDY-001',
      'question: Does the recovered CD8 TIL state graph support a bounded exhaustion progression study?',
      'hypothesis: To be refined.',
      'status: created',
      '---',
      '',
      '## Question',
      '',
      'Does the recovered CD8 TIL state graph support a bounded exhaustion progression study?',
    ].join('\n'),
  });
  renderer.events.agent?.turnStart?.({ turn: 2 });
  renderer.finish({
    iterations: 1,
    studiesCompleted: 0,
    finalPhase: 'propose',
    terminalCode: 'terminal_state',
    terminalReason: 'Done.',
    summary: 'Auto mode completed.',
    phases: [],
  });

  const output = chunks.join('');
  assert.match(output, /↳ Study Brain \(qdd-propose\) -> STUDY-001/);
  assert.match(output, /↳ PROPOSE：Does the recovered CD8 TIL state graph support a bounded exhaustion progression study\?/);
  assert.doesNotMatch(output, /↳ PROPOSE：评估当前研究方法是否包含潜在的循环论证风险？/);
  assert.doesNotMatch(output, / PROPOSE  评估当前研究方法是否包含潜在的循环论证风险？/);
  assert.doesNotMatch(output, /\x1b\[23;1H\x1b\[2K/);
});

test('qdd auto console renderer collapses long tool transcripts in compact mode', () => {
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    stdout: {
      columns: 100,
      isTTY: false,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  renderer.events.runStart?.({
    projectRoot: '/tmp/qdd-project',
    phase: { phase: 'apply', target: 'TASK-001', command: 'qdd-apply' },
    model: 'test-model',
    maxIterations: 1,
    maxTurnsPerAgent: 3,
    dryRun: false,
    prompt: 'Inspect data.',
  });
  renderer.events.phaseStart?.({
    iteration: 1,
    phase: { phase: 'apply', target: 'TASK-001', command: 'qdd-apply' },
    label: 'Executor (qdd-apply)',
    role: 'executor',
  });
  renderer.events.agent?.toolUse?.({
    turn: 1,
    tool: { id: 'tool-1', name: 'bash', input: { command: 'python inspect.py' } },
  });
  renderer.events.agent?.toolResult?.({
    turn: 1,
    tool: { id: 'tool-1', name: 'bash', input: { command: 'python inspect.py' } },
    result: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join('\n'),
  });

  const output = chunks.join('');
  assert.match(output, /Ran python inspect\.py/);
  assert.match(output, /└ ok line 1 line 2/);
  assert.match(output, /… \+3 lines \(ctrl \+ t to view transcript\)/);
  assert.doesNotMatch(output, /line 5/);
});

test('qdd auto console renderer truncates large tool results in run logs', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-auto-log-bound-'));
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    stdout: {
      columns: 100,
      isTTY: false,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  renderer.events.runStart?.({
    projectRoot,
    phase: { phase: 'apply', target: 'TASK-001', command: 'qdd-apply' },
    model: 'test-model',
    maxIterations: 1,
    maxTurnsPerAgent: null,
    dryRun: false,
    prompt: 'Inspect data.',
  });
  renderer.events.agent?.toolResult?.({
    turn: 1,
    tool: { id: 'tool-1', name: 'read', input: { path: 'large.txt' } },
    result: `head${'\0'.repeat(90_000)}tail`,
  });

  const runDir = path.join(projectRoot, '.qdd', 'runs');
  const [logName] = await fs.readdir(runDir);
  const log = await fs.readFile(path.join(runDir, logName), 'utf-8');

  assert.match(log, /\[log block truncated: omitted/);
  assert.match(log, /\\0/);
  assert.doesNotMatch(log, /\0/);
  assert.equal(log.length < 70_000, true);
});

test('qdd auto console renderer toggles latest collapsed transcript with ctrl+t', () => {
  const chunks: string[] = [];
  const stdin = new TestInputStream();
  const renderer = createAutoConsoleRenderer({
    color: false,
    intro: false,
    stdin,
    stdout: {
      columns: 100,
      rows: 24,
      isTTY: true,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  renderer.events.runStart?.({
    projectRoot: '/tmp/qdd-project',
    phase: { phase: 'apply', target: 'TASK-001', command: 'qdd-apply' },
    model: 'test-model',
    maxIterations: 1,
    maxTurnsPerAgent: 3,
    dryRun: false,
    prompt: 'Inspect data.',
  });
  renderer.events.phaseStart?.({
    iteration: 1,
    phase: { phase: 'apply', target: 'TASK-001', command: 'qdd-apply' },
    label: 'Executor (qdd-apply)',
    role: 'executor',
  });
  renderer.events.agent?.toolUse?.({
    turn: 1,
    tool: { id: 'tool-1', name: 'bash', input: { command: 'python inspect.py' } },
  });
  renderer.events.agent?.toolResult?.({
    turn: 1,
    tool: { id: 'tool-1', name: 'bash', input: { command: 'python inspect.py' } },
    result: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join('\n'),
  });

  const beforeShortcut = chunks.join('');
  assert.doesNotMatch(beforeShortcut, /│ line 5/);
  stdin.emit('data', Buffer.from('\u0014'));

  const output = chunks.join('');
  assert.equal(stdin.isRaw, true);
  assert.match(output, /Transcript 1\/1 \$ python inspect\.py/);
  assert.match(output, /expanded 3 folded lines/);
  assert.match(output, /│ line 5/);

  const chunkCountAfterExpand = chunks.length;
  stdin.emit('data', Buffer.from('\u0014'));
  const collapseOutput = chunks.slice(chunkCountAfterExpand).join('');
  assert.match(collapseOutput, /\x1b\[[0-9]+A/);
  assert.match(collapseOutput, /\x1b\[2K/);
});

test('qdd auto console renderer shows visible model notes without completion marker', async () => {
  const projectRoot = await createTempProject('qdd-auto-model-note-');
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    stdout: {
      columns: 100,
      isTTY: false,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  renderer.events.runStart?.({
    projectRoot,
    phase: { phase: 'start', target: 'PROJECT', command: 'qdd-start' },
    model: 'note-model',
    maxIterations: 1,
    maxTurnsPerAgent: 3,
    dryRun: false,
    prompt: 'Inspect benchmark files.',
  });
  renderer.events.phaseStart?.({
    iteration: 1,
    phase: { phase: 'start', target: 'PROJECT', command: 'qdd-start' },
    label: 'Thesis Manager (qdd-start)',
    role: 'thesis-manager',
  });
  renderer.events.agent?.turnStart?.({ turn: 1 });
  renderer.events.agent?.textDelta?.({ turn: 1, delta: 'I will inspect the benchmark README files first.' });
  renderer.events.agent?.textEnd?.({
    turn: 1,
    text: 'I will inspect the benchmark README files first.\nWORKFLOW_COMPLETE',
  });
  renderer.finish({
    iterations: 1,
    studiesCompleted: 0,
    finalPhase: 'start',
    terminalCode: 'terminal_state',
    terminalReason: 'Done.',
    summary: 'Auto mode completed: 1 iterations, 0 studies closed. Stop reason: Done.',
    phases: [],
  });

  const output = chunks.join('');
  assert.match(output, /Model/);
  assert.match(output, /└ I will inspect the benchmark README files first\./);
  assert.doesNotMatch(output, /WORKFLOW_COMPLETE/);
});

test('qdd auto console renderer supports Chinese labels', async () => {
  const projectRoot = await createTempProject('qdd-auto-zh-renderer-');
  const chunks: string[] = [];
  const renderer = createAutoConsoleRenderer({
    color: false,
    locale: 'zh',
    stdout: {
      columns: 100,
      isTTY: false,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
  });

  const result = await runAuto(projectRoot, {
    model: 'dry-run-model',
    maxIterations: 1,
    maxTurnsPerAgent: null,
    dryRun: true,
    events: renderer.events,
    logger: () => undefined,
  });
  renderer.finish(result);

  const output = chunks.join('');
  assert.match(output, /qdd auto 自主研究循环/);
  assert.match(output, /项目\s+\//);
  assert.match(output, /🔵 \[Phase: Thesis Manager\]/);
  assert.match(output, /⌙ 阶段 start  命令 qdd-start  角色 thesis-manager/);
  assert.match(output, /• 结果 max_iterations/);
});

test('qdd auto json command stays machine-readable without tui fields', async () => {
  const projectRoot = await createTempProject('qdd-auto-json-');
  const writes: string[] = [];
  const originalLog = console.log;
  console.log = (value?: unknown) => {
    writes.push(String(value));
  };
  try {
    await autoCommand(projectRoot, undefined, {
      model: 'dry-run-model',
      maxIterations: '1',
      maxTurns: 'none',
      dryRun: true,
      json: true,
    });
  } finally {
    console.log = originalLog;
  }

  const output = writes.join('\n');
  const parsed = JSON.parse(output) as { terminalCode: string; phases: unknown[] };
  assert.equal(parsed.terminalCode, 'max_iterations');
  assert.equal(Array.isArray(parsed.phases), true);
  assert.doesNotMatch(output, /\x1b\[/);
  assert.doesNotMatch(output, /PROPOSE/);
  assert.doesNotMatch(output, /QDD AUTO/);
});

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
  assert.match(instructions, /default durable project memory for data resources, runtime environments, compute capability, and analyst preferences/);
  assert.match(instructions, /Before running Python, R, conda, or other analysis commands, check `context\/resources\.md`/);
  assert.match(instructions, /best-effort CPU-core and basic GPU availability checks/);
  assert.match(instructions, /never persist personal paths, private environment names, credentials, or raw environment variable values/);
  assert.doesNotMatch(instructions, /boundaries\.yaml/);
  assert.doesNotMatch(instructions, /question_delta/);

  const schemaReference = await fs.readFile(path.join(projectRoot, '.qdd', 'schema-reference.md'), 'utf-8');
  assert.match(schemaReference, /contract\.yaml/);
  assert.match(schemaReference, /task\.example\.md/);
  assert.match(schemaReference, /Global YAML And Frontmatter Safety/);
  assert.match(schemaReference, /Keep managed Markdown frontmatter short and machine-readable/);
  assert.match(schemaReference, /block scalar such as `>-`/);
  assert.match(schemaReference, /Result Summary/);
  assert.match(schemaReference, /Optional human-readable descriptions may follow/);
  assert.match(schemaReference, /Use type=table for reusable tabular outputs/);

  const startCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-start.md'), 'utf-8');
  assert.match(startCommand, /contract\.yaml/);
  assert.match(startCommand, /context\/resources\.md/);
  assert.match(startCommand, /Durable resource memory/);
  assert.match(startCommand, /Do not overwrite user-declared runtime preferences/);
  assert.match(startCommand, /artifacts\/data\//);
  assert.match(startCommand, /Managed schema source/);
  assert.match(startCommand, /creating files under `studies\/`/);
  assert.match(startCommand, /mutating `evolution\.yaml`, `artifacts\/index\.yaml`, or study-local `artifact-candidates\.yaml`/);
  assert.match(startCommand, /Run best-effort local compute checks/);
  assert.match(startCommand, /nvidia-smi --query-gpu/);
  assert.doesNotMatch(startCommand, /torch_cuda_available|torch_installed|device_count/);
  assert.match(startCommand, /Do not record local executable paths/);
  assert.doesNotMatch(startCommand, /Auto Mode: Fork Next Agent/);
  assert.doesNotMatch(startCommand, /qdd boundaries apply --file/);
  assert.doesNotMatch(startCommand, /boundaries\.yaml/);
  assert.doesNotMatch(startCommand, /question_delta|evolution_trail/);

  const proposeCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-propose.md'), 'utf-8');
  assert.match(proposeCommand, /evolution\.yaml/);
  assert.match(proposeCommand, /Durable resource memory/);
  assert.match(proposeCommand, /context\/resources\.md/);
  assert.match(proposeCommand, /context\/memory/);
  assert.doesNotMatch(proposeCommand, /Auto Mode: Fork Next Agent/);
  assert.doesNotMatch(proposeCommand, /qdd boundaries score/);
  assert.doesNotMatch(proposeCommand, /question_delta|evolution_trail/);

  const applyCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-apply.md'), 'utf-8');
  assert.match(applyCommand, /Durable resource memory/);
  assert.match(applyCommand, /Before running Python, R, conda, or other analysis commands/);
  assert.match(applyCommand, /Keep managed Markdown frontmatter short and machine-readable/);
  assert.match(applyCommand, /Result Summary/);
  assert.match(applyCommand, /artifact_candidates:/);
  assert.match(applyCommand, /old invalid top-level key `candidates`/);
  assert.match(applyCommand, /`judgeable` is a reasoning concept, not a legal machine status/);
  assert.match(applyCommand, /use `status: completed`/);
  assert.doesNotMatch(applyCommand, /Auto Mode: Fork Next Agent/);
  assert.doesNotMatch(applyCommand, /question_delta|evolution_trail/);

  const closeCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-close.md'), 'utf-8');
  assert.match(closeCommand, /Durable resource memory/);
  assert.match(closeCommand, /context\/resources\.md/);
  assert.match(closeCommand, /context\/memory/);
  assert.match(closeCommand, /research-map\.html/);
  assert.match(closeCommand, /Do not hand-write `evolution\.yaml`/);
  assert.match(closeCommand, /qdd close-study/);
  assert.doesNotMatch(closeCommand, /Auto Mode: Fork Next Agent/);
  assert.doesNotMatch(closeCommand, /Get human approval before running `qdd close-study`\./);
  assert.doesNotMatch(closeCommand, /boundary-updates\.yaml/);
  assert.doesNotMatch(closeCommand, /question_delta|evolution_trail/);

  const autoSkill = await fs.readFile(path.join(projectRoot, '.claude', 'skills', 'qdd-auto', 'SKILL.md'), 'utf-8');
  assert.match(autoSkill, /qdd auto/);
  assert.match(autoSkill, /runtime is the orchestrator/);
  assert.doesNotMatch(autoSkill, /fork chain takes over/);
  assert.doesNotMatch(autoSkill, /Fork Instruction/);

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
  assert.ok(projectInstructions.required_skills.includes('thesis/frontier-planning'));
  assert.ok(projectInstructions.read.includes('.qdd/schema-reference.md'));
  assert.ok(projectInstructions.read.includes('.qdd/examples/contract.example.yaml'));
  assert.ok(projectInstructions.read.includes('contract.yaml'));
  assert.ok(projectInstructions.read.includes('evolution.yaml'));
  assert.ok(projectInstructions.read.includes('research-map.html'));
  assert.ok(projectInstructions.read.includes('context/resources.md'));
  assert.ok(projectInstructions.read.includes('context/memory/STUDY-000.md'));
  assert.ok(projectInstructions.write.includes('context/resources.md'));
  assert.ok(projectInstructions.write.includes('research-map.html'));
  assert.ok(
    projectInstructions.rules.includes(
      'Do not mutate evolution.yaml, studies/**, artifacts/index.yaml, or study-local artifact-candidates.yaml during qdd-start; those are later workflow surfaces.'
    )
  );
  assert.ok(
    projectInstructions.rules.includes(
      'During qdd-start, run best-effort CPU-core and basic GPU availability checks, then write only a concise capability summary into context/resources.md.'
    )
  );
  assert.ok(
    projectInstructions.rules.includes(
      'Do not record local executable paths, home directories, usernames, raw environment variable values, API keys, tokens, or private environment names in context/resources.md.'
    )
  );
  assert.ok(
    projectInstructions.rules.includes(
      'Treat context/resources.md as the default durable project memory for data resources, runtime environments, compute capability, and analyst preferences.'
    )
  );
  assert.ok(
    projectInstructions.rules.includes(
      'Before running Python, R, conda, or other analysis commands, check context/resources.md and prefer the declared project environment; if you do not use it, state why.'
    )
  );
  assert.ok(!projectInstructions.read.includes('boundaries.yaml'));
  assert.ok(!projectInstructions.write.includes('boundaries.yaml'));

  const studyInstructions = await buildInstructions(projectRoot, studyId, { command: 'qdd-close' });
  assert.equal(studyInstructions.role, 'thesis-manager');
  assert.ok(studyInstructions.required_skills.includes('thesis/frontier-planning'));
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
  assert.ok(
    studyInstructions.rules.includes(
      'qdd-close must write evolution state through qdd close-study; do not hand-edit evolution.yaml.'
    )
  );
  assert.ok(
    studyInstructions.rules.includes(
      'When editing artifact-candidates.yaml by hand, use top-level artifact_candidates exactly; the old top-level candidates key is invalid.'
    )
  );
  assert.ok(
    studyInstructions.rules.includes(
      'Do not write status: judgeable in study.md; judgeable is reasoning prose, while completed is the legal status for a study ready for close.'
    )
  );
  assert.ok(
    studyInstructions.rules.includes(
      'Treat context/resources.md as the default durable project memory for data resources, runtime environments, compute capability, and analyst preferences.'
    )
  );
  assert.ok(
    studyInstructions.rules.includes(
      'Before running Python, R, conda, or other analysis commands, check context/resources.md and prefer the declared project environment; if you do not use it, state why.'
    )
  );
  assert.ok(
    studyInstructions.rules.includes(
      'Use thesis/frontier-planning before qdd close-study to choose continue, stop, or needs-human at the project frontier.'
    )
  );
  assert.ok(!studyInstructions.write.includes(`studies/${studyId}/output/boundary-updates.yaml`));
  assert.ok(studyInstructions.required_skills.includes('singlecell/scrna/sc-batch-integration'));

  const proposeInstructions = await buildInstructions(projectRoot, studyId, { command: 'qdd-propose' });
  assert.equal(proposeInstructions.role, 'study-brain');
  assert.ok(proposeInstructions.required_skills.includes('brain/singlecell/scrna-planning'));
  assert.ok(!proposeInstructions.required_skills.includes('thesis/frontier-planning'));
  assert.ok(
    proposeInstructions.rules.includes(
      'Keep human propose as the highest semantic authority; treat prior candidates in evolution.yaml only as suggestions.'
    )
  );
  assert.ok(
    proposeInstructions.rules.includes(
      'Keep managed Markdown frontmatter short and machine-readable; put long natural-language rationale, blockers, evidence, and result summaries in Markdown body sections.'
    )
  );
  assert.ok(
    proposeInstructions.rules.includes(
      'When hand-writing natural-language YAML values in managed frontmatter or artifact-candidates.yaml, quote them or use a block scalar such as `>-`.'
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
  assert.ok(
    taskInstructions.rules.includes(
      'Keep task frontmatter short and machine-readable; put long task outcomes in the Markdown body `Result Summary` section.'
    )
  );
  assert.ok(
    taskInstructions.rules.includes(
      'When hand-writing natural-language YAML values in task frontmatter or artifact-candidates.yaml, quote them or use a block scalar such as `>-`.'
    )
  );
  assert.ok(
    taskInstructions.rules.includes(
      'When editing artifact-candidates.yaml by hand, use top-level artifact_candidates exactly; the old top-level candidates key is invalid.'
    )
  );
  assert.ok(taskInstructions.rules.some((rule) => rule.includes('Minimal artifact-candidates.yaml shape: artifact_candidates:')));
  assert.ok(
    taskInstructions.rules.includes(
      'Do not write status: judgeable in study.md; judgeable is reasoning prose, while completed is the legal status for a study ready for close.'
    )
  );
  assert.ok(
    taskInstructions.rules.includes(
      'Treat context/resources.md as the default durable project memory for data resources, runtime environments, compute capability, and analyst preferences.'
    )
  );
  assert.ok(
    taskInstructions.rules.includes(
      'Before running Python, R, conda, or other analysis commands, check context/resources.md and prefer the declared project environment; if you do not use it, state why.'
    )
  );
  assert.ok(!taskInstructions.read.includes('boundaries.yaml'));
});

test('qdd task skills reject thesis planning skills', async () => {
  const projectRoot = await createTempProject('qdd-task-thesis-skill-');
  const { studyId } = await createStudy(projectRoot, {
    question: 'Can task skills include thesis planning?',
    hypothesis: 'They should be rejected because thesis skills are role-level only.',
  });

  await assert.rejects(
    createTask(projectRoot, studyId, {
      goal: 'Incorrectly try to execute a thesis planning skill.',
      skills: ['thesis/frontier-planning'],
    }),
    /Task skills must not include planning-only skills: thesis\/frontier-planning/
  );
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
  assert.match(taskDocument.body, /## Result Summary/);

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
  assert.ok(!catalog.skills.some((entry) => entry.id === 'thesis/frontier-planning'));

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
