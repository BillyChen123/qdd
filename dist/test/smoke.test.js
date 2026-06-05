import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { initCommand } from '../commands/init.js';
import { buildStatus } from '../runtime/status.js';
import { buildInstructions } from '../runtime/instructions.js';
import { closeStudy, createStudy, createTask, recordArtifactCandidate } from '../runtime/lifecycle.js';
import { listArtifacts, validateProject } from '../runtime/inspection.js';
import { suggestProblemSkills } from '../runtime/local-skills.js';
import { readMarkdownDocument, readYamlFile, writeMarkdownDocument, writeYamlFile } from '../runtime/store.js';
async function createTempProject(prefix, options = {}) {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    await initCommand(projectRoot, { tools: options.tools ?? ['claude'] });
    return projectRoot;
}
async function setTaskCompleted(projectRoot, studyId, taskId) {
    const relativePath = `studies/${studyId}/tasks/${taskId}.md`;
    const document = await readMarkdownDocument(projectRoot, relativePath);
    await writeMarkdownDocument(projectRoot, relativePath, {
        ...document.frontmatter,
        status: 'completed',
        updated_at: new Date().toISOString(),
    }, document.body);
}
test('qdd init creates the new protocol scaffold and bootstrap assets', async () => {
    const projectRoot = await createTempProject('qdd-init-');
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'contract.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'evolution.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'context', 'resources.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'context', 'memory')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'research-map.html')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'instructions.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'bootstrap.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'layer-policy.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'skills-catalog.json')));
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
    assert.doesNotMatch(closeCommand, /boundary-updates\.yaml/);
    assert.doesNotMatch(closeCommand, /question_delta/);
    const catalog = JSON.parse(await fs.readFile(path.join(projectRoot, '.qdd', 'skills-catalog.json'), 'utf-8'));
    assert.ok(catalog.skills.some((entry) => entry.id === 'singlecell/scrna/sc-batch-integration'));
    assert.ok(catalog.skills.some((entry) => entry.id === 'singlecell/public-data/cellxgene-discover'));
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
    assert.ok(studyInstructions.read.includes('evolution.yaml'));
    assert.ok(studyInstructions.read.includes(`studies/${studyId}/study.md`));
    assert.ok(studyInstructions.read.includes(`studies/${studyId}/tasks/${taskId}.md`));
    assert.ok(studyInstructions.write.includes('evolution.yaml'));
    assert.ok(studyInstructions.write.includes('context/resources.md'));
    assert.ok(studyInstructions.write.includes('context/memory/'));
    assert.ok(studyInstructions.write.includes('research-map.html'));
    assert.ok(!studyInstructions.write.includes(`studies/${studyId}/output/boundary-updates.yaml`));
    assert.ok(studyInstructions.required_skills.includes('singlecell/scrna/sc-batch-integration'));
    const proposeInstructions = await buildInstructions(projectRoot, studyId, { command: 'qdd-propose' });
    assert.equal(proposeInstructions.role, 'study-brain');
    assert.ok(proposeInstructions.required_skills.includes('brain/singlecell/scrna-planning'));
    assert.ok(proposeInstructions.rules.includes('Keep human propose as the highest semantic authority; treat prior candidates in evolution.yaml only as suggestions.'));
    const taskInstructions = await buildInstructions(projectRoot, taskId, { command: 'qdd-apply' });
    assert.equal(taskInstructions.role, 'executor');
    assert.ok(taskInstructions.read.includes('evolution.yaml'));
    assert.ok(taskInstructions.read.includes(`studies/${studyId}/tasks/${taskId}.md`));
    assert.ok(taskInstructions.rules.includes('You may read the current project evolution state for alignment, but you must not mutate project-level evolution state from task-level apply.'));
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
    });
    const scriptPath = path.join(projectRoot, 'studies', studyId, 'output', 'code', 'integration.py');
    await fs.writeFile(scriptPath, 'print("integration")\n', 'utf-8');
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
    await closeStudy(projectRoot, studyId, {
        questionAfter: 'Should we validate the narrowed integration result in a second dataset?',
        changeType: 'refinement',
        changeDriver: 'The first-pass integration run narrowed the next comparison question.',
        openBoundaries: ['Validate the narrowed result in a second dataset'],
    });
    const artifacts = await listArtifacts(projectRoot);
    assert.equal(artifacts.artifacts.length, 1);
    assert.equal(artifacts.artifacts[0]?.type, 'code');
    assert.match(artifacts.artifacts[0]?.path ?? '', /^artifacts\/code\/ART-\d{3}-/);
    assert.equal(artifacts.artifacts[0]?.produced_by, `${studyId}/${taskId}`);
    const evolution = await readYamlFile(projectRoot, 'evolution.yaml');
    assert.equal(evolution.studies.length, 1);
    assert.equal(evolution.studies[0]?.id, studyId);
    assert.equal(evolution.studies[0]?.question, 'Does one integration pass narrow the comparison question?');
    assert.equal(evolution.studies[0]?.kind, 'refinement');
    assert.deepEqual(evolution.studies[0]?.candidates, ['Should we validate the narrowed integration result in a second dataset?']);
    assert.equal(evolution.boundaries.length, 2);
    assert.equal(evolution.boundaries.find((entry) => entry.id === 'B001')?.state, 'resolved');
    assert.equal(evolution.boundaries.find((entry) => entry.text === 'Validate the narrowed result in a second dataset')?.state, 'open');
    const memoryPath = path.join(projectRoot, 'context', 'memory', `${studyId}.md`);
    const memory = await fs.readFile(memoryPath, 'utf-8');
    assert.match(memory, new RegExp(`# ${studyId} Memory`));
    assert.match(memory, /Validate the narrowed result in a second dataset/);
    const studyDocument = await readMarkdownDocument(projectRoot, `studies/${studyId}/study.md`);
    assert.equal(studyDocument.frontmatter.status, 'closed');
    assert.ok(studyDocument.frontmatter.closed_at);
    const status = await buildStatus(projectRoot);
    assert.deepEqual(status.studies.closed, [studyId]);
    assert.equal(status.question_state.last_kind, 'refinement');
    assert.deepEqual(status.question_state.next_candidates, ['Should we validate the narrowed integration result in a second dataset?']);
    assert.equal(status.memory.recent[0], `context/memory/${studyId}.md`);
    assert.equal(status.boundaries.open, 1);
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
    const studyDocument = await readMarkdownDocument(projectRoot, studyPath);
    await writeMarkdownDocument(projectRoot, studyPath, {
        ...studyDocument.frontmatter,
        status: 'closed',
        closed_at: new Date().toISOString(),
    }, studyDocument.body);
    const validation = await validateProject(projectRoot);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some((issue) => issue.code === 'missing_study_memory'));
    assert.ok(!('boundaries' in validation.checked));
});
test('qdd skills suggest returns executor-facing candidates and excludes brain skills from the catalog', async () => {
    const projectRoot = await createTempProject('qdd-skills-');
    const catalog = JSON.parse(await fs.readFile(path.join(projectRoot, '.qdd', 'skills-catalog.json'), 'utf-8'));
    assert.ok(catalog.skills.some((entry) => entry.id === 'singlecell/scatac/scatac-preprocess-lsi'));
    assert.ok(!catalog.skills.some((entry) => entry.id === 'brain/singlecell/public-data-planning'));
    const integration = await suggestProblemSkills(projectRoot, {
        domain: 'singlecell',
        stage: 'integration',
        tags: ['multi-sample', 'batch-correction'],
    });
    assert.equal(integration.low_confidence, false);
    assert.ok(integration.candidates.some((candidate) => candidate.id === 'singlecell/scrna/sc-batch-integration'));
    assert.ok(integration.candidates.some((candidate) => candidate.id === 'singlecell/scatac/scatac-batch-latent'));
    const publicData = await suggestProblemSkills(projectRoot, {
        domain: 'singlecell',
        stage: 'acquisition',
        tags: ['public-data', 'cellxgene'],
    });
    assert.equal(publicData.low_confidence, false);
    assert.equal(publicData.candidates[0]?.id, 'singlecell/public-data/cellxgene-discover');
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
    }
    finally {
        if (previousCodexHome === undefined) {
            delete process.env.CODEX_HOME;
        }
        else {
            process.env.CODEX_HOME = previousCodexHome;
        }
    }
});
//# sourceMappingURL=smoke.test.js.map