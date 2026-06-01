import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { initCommand } from '../commands/init.js';
import { buildStatus } from '../runtime/status.js';
import { buildInstructions } from '../runtime/instructions.js';
import { createStudy, createTask, registerArtifact, closeStudy, recordArtifactCandidate } from '../runtime/lifecycle.js';
import { listArtifacts, listContext, validateProject } from '../runtime/inspection.js';
import { suggestProblemSkills } from '../runtime/local-skills.js';
import { parseYaml } from '../utils/yaml.js';
test('qdd init creates minimal project structure', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-init-'));
    await initCommand(projectRoot);
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'contract.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'evolution.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'context')));
    await assert.rejects(fs.access(path.join(projectRoot, 'data')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'artifacts', 'data')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'context', 'resources.md')));
    await assert.rejects(fs.access(path.join(projectRoot, 'context', 'datasets.yaml')));
    await assert.rejects(fs.access(path.join(projectRoot, 'context', 'environment.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'instructions.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'bootstrap.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'layer-policy.yaml')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.qdd', 'skills-catalog.json')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-start.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-propose.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-explore.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-apply.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'commands', 'qdd-close.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd', 'qdd-start', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd', 'qdd-propose', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd', 'qdd-explore', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd', 'qdd-apply', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.claude', 'skills', 'qdd', 'qdd-close', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-start', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-propose', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-explore', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-apply', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-close', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, '.codex', 'skills', 'brain', 'singlecell', 'scrna-planning', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, '.claude', 'skills', 'brain', 'singlecell', 'scrna-planning', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, '.codex', 'skills', 'singlecell', 'scrna', 'sc-preprocess-qc', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, '.codex', 'skills', 'singlecell', 'scrna', 'sc-batch-integration', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, '.codex', 'skills', 'singlecell', 'scrna', 'sc-clustering', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, '.codex', 'skills', 'singlecell', 'scrna', 'sc-marker-annotation', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, 'domain-skills', 'brain', 'singlecell', 'scrna-planning', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, 'domain-skills', 'singlecell', 'scrna', 'sc-preprocess-qc', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(projectRoot, 'domain-skills', 'singlecell', 'scrna', 'sc-batch-integration', 'SKILL.md')));
    const status = await buildStatus(projectRoot);
    assert.equal(status.project.mode, 'human');
    assert.equal(status.artifacts.count, 0);
    assert.deepEqual(status.studies.completed, []);
    assert.deepEqual(status.tasks.completed, []);
    assert.deepEqual(status.tasks.promotion_pending, []);
    assert.deepEqual(status.output_review.studies_with_unpackaged_output, []);
    const instructions = await fs.readFile(path.join(projectRoot, '.qdd', 'instructions.md'), 'utf-8');
    assert.match(instructions, /## Quick Reference/);
    assert.match(instructions, /## Workflow/);
    assert.match(instructions, /## Validation Checklist/);
    assert.match(instructions, /context\/resources\.md/);
    assert.match(instructions, /qdd-start/);
    assert.match(instructions, /qdd-propose/);
    assert.match(instructions, /qdd-explore/);
    assert.match(instructions, /qdd-apply/);
    assert.match(instructions, /qdd-close/);
    assert.match(instructions, /domain-skills\//);
    assert.match(instructions, /qdd instructions PROJECT --command qdd-start --json/);
    assert.match(instructions, /qdd instructions <id> --command <qdd-\.\.\.> --json/);
    assert.match(instructions, /\.qdd\/layer-policy\.yaml/);
    assert.match(instructions, /\.qdd\/skills-catalog\.json/);
    const resources = await fs.readFile(path.join(projectRoot, 'context', 'resources.md'), 'utf-8');
    assert.match(resources, /## Research Theme/);
    assert.match(resources, /## Biological Background/);
    assert.match(resources, /## Data Resources/);
    assert.match(resources, /## Runtime Environments/);
    assert.match(resources, /## Analyst Preferences/);
    assert.match(resources, /## Local Skills/);
    const bootstrapConfig = await fs.readFile(path.join(projectRoot, '.qdd', 'bootstrap.yaml'), 'utf-8');
    assert.match(bootstrapConfig, /tool: claude/);
    assert.match(bootstrapConfig, /tool: codex/);
    assert.match(bootstrapConfig, /workflow: qdd-start/);
    assert.match(bootstrapConfig, /workflow: qdd-propose/);
    assert.match(bootstrapConfig, /domain_skills_root:/);
    const startCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-start.md'), 'utf-8');
    assert.match(startCommand, /qdd instructions PROJECT --command qdd-start --json/);
    assert.match(startCommand, /ln -s/);
    assert.match(startCommand, /artifacts\/data\/source\.h5ad/);
    assert.match(startCommand, /domain-skills\//);
    assert.match(startCommand, /durable analyst preferences/);
    const proposeCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-propose.md'), 'utf-8');
    assert.match(proposeCommand, /qdd add-study/);
    assert.match(proposeCommand, /qdd add-task STUDY-XXX/);
    assert.match(proposeCommand, /qdd init/);
    assert.match(proposeCommand, /complete `qdd-start` first/);
    assert.match(proposeCommand, /By default, create \*\*2-4\*\* initial tasks/);
    assert.match(proposeCommand, /## How To Write The Initial Tasks/);
    assert.match(proposeCommand, /rewrite the scaffold into task-specific executable steps/);
    assert.match(proposeCommand, /never write `qdd\/\*` workflow skills or `brain\/\*` planning skills into a task record/);
    assert.match(proposeCommand, /qdd skills suggest/);
    assert.match(proposeCommand, /This is part of propose, not something to leave for apply to invent later/);
    assert.match(proposeCommand, /record the chosen skills directly in task frontmatter and in the task body `## Skills` section/);
    assert.match(proposeCommand, /qdd instructions STUDY-XXX --command qdd-propose --json/);
    const exploreCommand = await fs.readFile(path.join(projectRoot, '.claude', 'commands', 'qdd-explore.md'), 'utf-8');
    assert.match(exploreCommand, /qdd instructions STUDY-XXX --command qdd-explore --json/);
    assert.match(exploreCommand, /In `human` and `assist` mode, do not modify `study.md` or `task` files until the user confirms/);
    assert.match(exploreCommand, /## The Stance/);
    const applySkill = await fs.readFile(path.join(projectRoot, '.claude', 'skills', 'qdd', 'qdd-apply', 'SKILL.md'), 'utf-8');
    assert.match(applySkill, /name: qdd-apply/);
    assert.match(applySkill, /qdd instructions STUDY-XXX --command qdd-apply --json/);
    assert.match(applySkill, /qdd instructions TASK-XXX --command qdd-apply --json/);
    assert.match(applySkill, /Treat the study, not the single task, as the execution unit/);
    assert.match(applySkill, /continue across the planned task graph instead of stopping after the first completed task/);
    assert.match(applySkill, /Rewrite the weak checklist scaffold into task-specific steps/);
    assert.match(applySkill, /If task-local executor skills are listed in the task instructions, read those skill files before deciding how to run the task/);
    assert.match(applySkill, /If a task already declares executor skills, do not skip them and jump straight to unconstrained ad hoc coding/);
    assert.match(applySkill, /Treat local skills as execution guidance, not optional decoration/);
    assert.match(applySkill, /output\/code/);
    assert.match(applySkill, /artifact-candidates\.yaml/);
    assert.match(applySkill, /hard-blocked/);
    assert.match(applySkill, /promotion_status/);
    assert.match(applySkill, /output\/tmp/);
    assert.match(applySkill, /Slow clustering, UMAP, integration, large h5ad/);
    const closeSkill = await fs.readFile(path.join(projectRoot, '.claude', 'skills', 'qdd', 'qdd-close', 'SKILL.md'), 'utf-8');
    assert.match(closeSkill, /qdd instructions STUDY-XXX --command qdd-close --json/);
    assert.match(closeSkill, /question_delta/);
    const catalog = JSON.parse(await fs.readFile(path.join(projectRoot, '.qdd', 'skills-catalog.json'), 'utf-8'));
    assert.ok(catalog.skills.some((entry) => entry.id === 'singlecell/scrna/sc-batch-integration'));
    assert.ok(catalog.skills.some((entry) => entry.id === 'singlecell/scatac/scatac-preprocess-lsi'));
    assert.ok(!catalog.skills.some((entry) => entry.id === 'brain/singlecell/scrna-planning'));
    assert.ok(!catalog.skills.some((entry) => entry.id === 'brain/singlecell/scatac-planning'));
});
test('qdd init can install codex prompts and refresh bootstrap assets', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-bootstrap-'));
    const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-codex-home-'));
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = codexHome;
    try {
        await initCommand(projectRoot, { tools: ['claude', 'codex'] });
        await assert.doesNotReject(fs.access(path.join(codexHome, 'prompts', 'qdd-start.md')));
        await assert.doesNotReject(fs.access(path.join(codexHome, 'prompts', 'qdd-propose.md')));
        await assert.doesNotReject(fs.access(path.join(codexHome, 'prompts', 'qdd-close.md')));
        await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-start', 'SKILL.md')));
        await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-propose', 'SKILL.md')));
        await assert.doesNotReject(fs.access(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-close', 'SKILL.md')));
        const codexPrompt = await fs.readFile(path.join(codexHome, 'prompts', 'qdd-apply.md'), 'utf-8');
        assert.match(codexPrompt, /description: Execute the current approved study\/task set until the study reaches a decision point/);
        assert.match(codexPrompt, /continue across the planned task graph instead of stopping after the first completed task/);
        assert.match(codexPrompt, /qdd register-artifact/);
        assert.match(codexPrompt, /promotion_status/);
        assert.match(codexPrompt, /output\/tmp/);
        const codexSkill = await fs.readFile(path.join(projectRoot, '.codex', 'skills', 'qdd', 'qdd-explore', 'SKILL.md'), 'utf-8');
        assert.match(codexSkill, /name: qdd-explore/);
        assert.match(codexSkill, /## The Stance/);
        assert.match(codexSkill, /Discussion comes first/);
        await fs.writeFile(path.join(projectRoot, '.qdd', 'instructions.md'), 'stale instructions\n', 'utf-8');
        await initCommand(projectRoot, { tools: ['claude', 'codex'], refreshBootstrap: true });
        const refreshedInstructions = await fs.readFile(path.join(projectRoot, '.qdd', 'instructions.md'), 'utf-8');
        assert.match(refreshedInstructions, /## Mode Contract/);
        assert.match(refreshedInstructions, /workflow prompt source may live in repo-local Markdown files/);
        assert.match(refreshedInstructions, /task graph rather than one vague starter task/);
        assert.doesNotMatch(refreshedInstructions, /stale instructions/);
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
test('qdd init records central domain skills source without projecting domain skills into project tool directories', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-domain-skills-project-'));
    const domainSkillsSourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-domain-skills-source-'));
    const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-domain-skills-codex-home-'));
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = codexHome;
    try {
        await fs.mkdir(path.join(domainSkillsSourceDir, 'singlecell', 'scrna', 'custom-qc', 'scripts'), { recursive: true });
        await fs.writeFile(path.join(domainSkillsSourceDir, 'singlecell', 'scrna', 'custom-qc', 'SKILL.md'), [
            '---',
            'name: singlecell/scrna/custom-qc',
            'description: Custom qc skill',
            'domain: singlecell',
            'stage: preprocess',
            'tags:',
            '  - scanpy',
            '  - qc',
            '---',
            '',
            '# singlecell/scrna/custom-qc',
            '',
            'Use this skill to run project-specific QC.',
            '',
        ].join('\n'), 'utf-8');
        await fs.writeFile(path.join(domainSkillsSourceDir, 'singlecell', 'scrna', 'custom-qc', 'scripts', 'run.py'), 'print("custom qc")\n', 'utf-8');
        await initCommand(projectRoot, {
            tools: ['claude', 'codex'],
            domainSkillsSourceDir,
        });
        await assert.rejects(fs.access(path.join(projectRoot, '.codex', 'skills', 'singlecell', 'scrna', 'custom-qc', 'SKILL.md')));
        await assert.rejects(fs.access(path.join(projectRoot, '.claude', 'skills', 'singlecell', 'scrna', 'custom-qc', 'SKILL.md')));
        const bootstrapConfig = await fs.readFile(path.join(projectRoot, '.qdd', 'bootstrap.yaml'), 'utf-8');
        assert.match(bootstrapConfig, /domain_skills_root:/);
        assert.match(bootstrapConfig, /qdd-domain-skills-source-/);
        const instructions = await buildInstructions(projectRoot, 'PROJECT', { command: 'qdd-start' });
        assert.ok(instructions.read.some((entry) => entry.endsWith('singlecell/scrna/custom-qc/SKILL.md')));
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
test('qdd status aggregates study/task frontmatter from the prototype layout', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-status-'));
    await initCommand(projectRoot);
    await fs.mkdir(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'studies', 'STUDY-001', 'study.md'), [
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
    ].join('\n'), 'utf-8');
    await fs.writeFile(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks', 'TASK-001.md'), [
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
    ].join('\n'), 'utf-8');
    const status = await buildStatus(projectRoot);
    assert.deepEqual(status.studies.active, ['STUDY-001']);
    assert.deepEqual(status.studies.blocked, []);
    assert.deepEqual(status.studies.completed, []);
    assert.deepEqual(status.tasks.pending, ['TASK-001']);
    assert.deepEqual(status.tasks.completed, []);
});
test('qdd skills suggest returns deterministic problem-level candidates', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-suggest-'));
    await initCommand(projectRoot);
    const integration = await suggestProblemSkills(projectRoot, {
        domain: 'singlecell',
        stage: 'integration',
        tags: ['multi-sample', 'batch-correction'],
    });
    assert.equal(integration.low_confidence, false);
    assert.ok(integration.candidates.some((candidate) => candidate.id === 'singlecell/scrna/sc-batch-integration'));
    assert.ok(integration.candidates.some((candidate) => candidate.id === 'singlecell/scatac/scatac-batch-latent'));
    const weakQuery = await suggestProblemSkills(projectRoot, {
        domain: 'singlecell',
        stage: 'clustering',
        tags: ['multi-sample'],
    });
    assert.equal(weakQuery.candidates[0]?.id, 'singlecell/scrna/sc-clustering');
    assert.equal(weakQuery.low_confidence, true);
    const scatac = await suggestProblemSkills(projectRoot, {
        domain: 'singlecell',
        stage: 'preprocess',
        tags: ['peak-matrix', 'lsi'],
    });
    assert.equal(scatac.low_confidence, false);
    assert.equal(scatac.candidates[0]?.id, 'singlecell/scatac/scatac-preprocess-lsi');
    assert.deepEqual(scatac.candidates[0]?.matched_tags, ['peak-matrix', 'lsi']);
});
test('scatac executor skills expose coherent parameter contracts and entry scripts', async () => {
    const repoRoot = process.cwd();
    const skillRoots = [
        'domain-skills/singlecell/scatac/scatac-preprocess-lsi',
        'domain-skills/singlecell/scatac/scatac-batch-latent',
        'domain-skills/singlecell/scatac/scatac-annotation-geneactivity',
        'domain-skills/singlecell/scatac/scatac-dar',
    ];
    for (const relativeRoot of skillRoots) {
        const skillRoot = path.join(repoRoot, relativeRoot);
        const skillMarkdown = await fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf-8');
        assert.match(skillMarkdown, /^---[\s\S]+^---/m);
        const parameters = parseYaml(await fs.readFile(path.join(skillRoot, 'parameters.yaml'), 'utf-8'));
        assert.ok(parameters.entry_script);
        assert.ok(parameters.output_contract?.main_h5ad);
        assert.ok(parameters.output_contract?.report);
        assert.ok(parameters.output_contract?.result);
        const entryScriptPath = path.join(skillRoot, parameters.entry_script);
        await assert.doesNotReject(fs.access(entryScriptPath));
    }
});
test('qdd instructions returns project, study, and task guidance for existing prototype records', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-instr-'));
    await initCommand(projectRoot);
    await fs.writeFile(path.join(projectRoot, 'context', 'datasets.yaml'), ['datasets:', '  - id: DS-001', '    type: table', '    status: ready', '    path: /tmp/data.csv', ''].join('\n'), 'utf-8');
    const sourceDatasetPath = path.join(projectRoot, 'external-source.h5ad');
    await fs.writeFile(sourceDatasetPath, 'fake-data', 'utf-8');
    await fs.symlink(sourceDatasetPath, path.join(projectRoot, 'artifacts', 'data', 'study-source.h5ad'));
    await fs.mkdir(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'studies', 'STUDY-001', 'study.md'), [
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
    ].join('\n'), 'utf-8');
    await fs.writeFile(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks', 'TASK-001.md'), [
        '---',
        'task_id: TASK-001',
        'study_id: STUDY-001',
        'goal: Produce one evidence artifact.',
        'status: pending',
        'skills:',
        '  - singlecell/scrna/sc-batch-integration',
        'expected_outputs:',
        '  - report',
        '---',
        '',
        '## Expected Output',
        '',
        'A report artifact.',
        '',
        '## Skills',
        '',
        '- singlecell/scrna/sc-batch-integration',
        '',
    ].join('\n'), 'utf-8');
    const projectInstructions = await buildInstructions(projectRoot, 'PROJECT', { command: 'qdd-start' });
    assert.equal(projectInstructions.target.kind, 'project');
    assert.equal(projectInstructions.command, 'qdd-start');
    assert.equal(projectInstructions.role, 'thesis-manager');
    assert.ok(projectInstructions.read.includes('contract.yaml'));
    assert.ok(projectInstructions.read.includes('context/resources.md'));
    assert.ok(projectInstructions.read.includes('artifacts/data/'));
    assert.ok(projectInstructions.read.includes('domain-skills/'));
    assert.ok(projectInstructions.read.includes('.codex/skills/qdd/'));
    assert.ok(projectInstructions.read.includes('.claude/skills/qdd/'));
    assert.ok(projectInstructions.read.includes('.qdd/layer-policy.yaml'));
    assert.ok(projectInstructions.read.includes('.qdd/skills-catalog.json'));
    assert.ok(projectInstructions.write.includes('artifacts/data/'));
    assert.ok(projectInstructions.write.includes('.qdd/layer-policy.yaml'));
    assert.ok(projectInstructions.rules.includes('Create dataset entrypoints under artifacts/data/ as symlinks rather than copying raw data by default.'));
    const studyApplyInstructions = await buildInstructions(projectRoot, 'STUDY-001', { command: 'qdd-apply' });
    assert.equal(studyApplyInstructions.target.kind, 'study');
    assert.equal(studyApplyInstructions.command, 'qdd-apply');
    assert.equal(studyApplyInstructions.role, 'executor');
    assert.ok(studyApplyInstructions.write.includes('studies/STUDY-001/study.md'));
    assert.ok(studyApplyInstructions.write.includes('studies/STUDY-001/tasks/'));
    assert.ok(studyApplyInstructions.write.includes('studies/STUDY-001/output/artifact-candidates.yaml'));
    assert.ok(studyApplyInstructions.read.includes('context/resources.md'));
    assert.ok(studyApplyInstructions.read.includes('artifacts/data/study-source.h5ad'));
    assert.ok(studyApplyInstructions.read.some((entry) => entry.endsWith('domain-skills/singlecell/scrna/sc-batch-integration/SKILL.md')));
    assert.deepEqual(studyApplyInstructions.required_skills, ['singlecell/scrna/sc-batch-integration']);
    assert.deepEqual(studyApplyInstructions.optional_skills, []);
    assert.ok(studyApplyInstructions.rules.includes('qdd-propose owns the first-pass study and task-graph creation.'));
    assert.ok(studyApplyInstructions.rules.includes('In human or assist mode, qdd-explore must discuss and confirm before modifying study/task artifacts.'));
    assert.ok(studyApplyInstructions.rules.includes('Do not return to qdd-explore just because one task finished; keep moving while the next planned study-local task is clear.'));
    assert.ok(studyApplyInstructions.rules.includes('Use studies/STUDY-XXX/output/artifact-candidates.yaml as the explicit promotion boundary for reusable study outputs.'));
    assert.ok(studyApplyInstructions.rules.includes('Include task_id in artifact candidates whenever one task clearly produced the reusable output.'));
    assert.ok(studyApplyInstructions.rules.includes('Use studies/STUDY-XXX/output/tmp only as scratch space; package final outputs back into the canonical study output directories before treating work as complete.'));
    assert.ok(studyApplyInstructions.rules.includes('Treat studies/STUDY-XXX/output/data, code, figures, tables, and reports as the canonical final study output surface.'));
    const studyCloseInstructions = await buildInstructions(projectRoot, 'STUDY-001', { command: 'qdd-close' });
    assert.equal(studyCloseInstructions.target.kind, 'study');
    assert.equal(studyCloseInstructions.command, 'qdd-close');
    assert.equal(studyCloseInstructions.role, 'thesis-manager');
    assert.ok(studyCloseInstructions.write.includes('evolution.yaml'));
    assert.ok(studyCloseInstructions.write.includes('context/resources.md'));
    assert.ok(studyCloseInstructions.rules.includes('For qdd-close, the target is the study but the final promotion and carry-forward judgment belongs to the thesis-manager role.'));
    assert.ok(studyCloseInstructions.rules.includes('Refuse closure when any completed task still has promotion_status pending.'));
    const taskInstructions = await buildInstructions(projectRoot, 'TASK-001', { command: 'qdd-apply' });
    assert.equal(taskInstructions.target.kind, 'task');
    assert.equal(taskInstructions.command, 'qdd-apply');
    assert.equal(taskInstructions.role, 'executor');
    assert.ok(taskInstructions.write.includes('studies/STUDY-001/tasks/TASK-001.md'));
    assert.ok(taskInstructions.write.includes('studies/STUDY-001/output/artifact-candidates.yaml'));
    assert.ok(taskInstructions.read.includes('studies/STUDY-001/tasks/TASK-001.md'));
    assert.ok(taskInstructions.read.includes('context/resources.md'));
    assert.ok(taskInstructions.read.includes('context/datasets.yaml'));
    assert.ok(taskInstructions.read.includes('artifacts/data/study-source.h5ad'));
    assert.ok(taskInstructions.read.some((entry) => entry.endsWith('domain-skills/singlecell/scrna/sc-batch-integration/SKILL.md')));
    assert.deepEqual(taskInstructions.required_skills, ['singlecell/scrna/sc-batch-integration']);
    assert.deepEqual(taskInstructions.optional_skills, []);
    assert.ok(taskInstructions.rules.includes('Keep task checklist progress in the task Markdown body.'));
    assert.ok(taskInstructions.rules.includes('Rewrite the weak checklist scaffold into task-specific executable steps before or during execution.'));
    assert.ok(taskInstructions.rules.includes('Keep the task minimal and evidence-producing.'));
    assert.ok(taskInstructions.rules.includes('Only rely on domain task skills that exist under the QDD root domain-skills/ library.'));
    assert.ok(taskInstructions.rules.includes('qdd-apply consumes the declared task-local problem-level skills only; it must not reopen broad skill search.'));
    assert.ok(taskInstructions.rules.includes('If task-local executor skills are present, read them first and use them as the primary execution guidance for this task.'));
    assert.ok(taskInstructions.rules.includes('Do not bypass declared task-local executor skills with unconstrained ad hoc coding unless you make the gap explicit.'));
    assert.ok(taskInstructions.rules.includes('Add only promotion-worthy outputs to studies/STUDY-XXX/output/artifact-candidates.yaml; do not treat all local outputs as artifacts.'));
    assert.ok(taskInstructions.rules.includes('Include task_id in artifact candidates whenever this task clearly produced the reusable output.'));
    assert.ok(taskInstructions.rules.includes('Before a completed task is left in place, set promotion_status explicitly to none, candidate-recorded, or registered; completed tasks must not remain promotion-pending.'));
    assert.ok(taskInstructions.rules.includes('Treat slow clustering, UMAP, integration, and large h5ad processing as normal long-running work unless there is explicit evidence of failure.'));
    const studyExploreInstructions = await buildInstructions(projectRoot, 'STUDY-001', { command: 'qdd-explore' });
    assert.equal(studyExploreInstructions.role, 'study-brain');
    assert.ok(studyExploreInstructions.read.some((entry) => entry.endsWith('domain-skills/brain/singlecell/scrna-planning/SKILL.md')));
    assert.ok(studyExploreInstructions.read.some((entry) => entry.endsWith('domain-skills/brain/singlecell/scatac-planning/SKILL.md')));
    assert.ok(studyExploreInstructions.read.includes('.qdd/skills-catalog.json'));
    assert.ok(studyExploreInstructions.rules.includes('Use study-brain skills plus qdd skills suggest --domain <domain> --stage <stage> --tag <tag> --json when problem-level skill selection is needed.'));
    assert.ok(studyExploreInstructions.rules.includes('When a task clearly belongs to a known executor problem class, choose and write the task-local skill bundle during planning instead of deferring the decision to qdd-apply.'));
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
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'data')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'tmp')));
    await assert.doesNotReject(fs.access(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'artifact-candidates.yaml')));
    const createdTask = await createTask(projectRoot, createdStudy.studyId, {
        goal: 'Produce a summary report',
        expectedOutputs: ['report.md'],
        skills: ['singlecell/scrna/sc-clustering'],
    });
    const taskPath = path.join(projectRoot, createdTask.relativePath);
    const originalTaskContent = await fs.readFile(taskPath, 'utf-8');
    assert.match(originalTaskContent, /## Depends On/);
    assert.match(originalTaskContent, /## Checklist/);
    assert.match(originalTaskContent, /Replace this scaffold with 3-7 task-specific executable steps/);
    assert.match(originalTaskContent, /output\/code/);
    assert.match(originalTaskContent, /output\/\{data,code,figures,tables,reports\}/);
    assert.match(originalTaskContent, /artifact-candidates\.yaml/);
    assert.match(originalTaskContent, /promotion review explicitly to none, candidate-recorded, or registered/);
    assert.match(originalTaskContent, /include `task_id` when this task clearly produced them/);
    assert.match(originalTaskContent, /## Skills/);
    assert.match(originalTaskContent, /- singlecell\/scrna\/sc-clustering/);
    assert.match(originalTaskContent, /promotion_status: pending/);
    const completedTaskContent = originalTaskContent
        .replace('status: pending', 'status: completed')
        .replace('- [ ] Reconfirm the concrete success signal for this task', '- [x] Reconfirm the concrete success signal for this task')
        .replace('- [ ] Prepare the real inputs, dependencies, and execution method', '- [x] Prepare the real inputs, dependencies, and execution method')
        .replace('- [ ] Produce the expected evidence or record the blocker explicitly', '- [x] Produce the expected evidence or record the blocker explicitly')
        .replace('- [ ] Write study-local evidence into `studies/STUDY-001/output/` and summarize what changed', '- [x] Write study-local evidence into `studies/STUDY-001/output/` and summarize what changed')
        .replace('- [ ] Package final reusable outputs into `studies/STUDY-001/output/{data,code,figures,tables,reports}/` before marking the task complete', '- [x] Package final reusable outputs into `studies/STUDY-001/output/{data,code,figures,tables,reports}/` before marking the task complete')
        .replace('- [ ] Preserve readable analysis scripts in `studies/STUDY-001/output/code/` when this task runs substantive analysis', '- [x] Preserve readable analysis scripts in `studies/STUDY-001/output/code/` when this task runs substantive analysis')
        .replace('- [ ] Save at least one key figure in `studies/STUDY-001/output/figures/` when the task conclusion depends on visual evidence, or record why no figure was needed', '- [x] Save at least one key figure in `studies/STUDY-001/output/figures/` when the task conclusion depends on visual evidence, or record why no figure was needed')
        .replace('- [ ] Add only promotion-worthy outputs to `studies/STUDY-001/output/artifact-candidates.yaml` and include `task_id` when this task clearly produced them', '- [x] Add only promotion-worthy outputs to `studies/STUDY-001/output/artifact-candidates.yaml` and include `task_id` when this task clearly produced them')
        .replace('- [ ] Set promotion review explicitly to none, candidate-recorded, or registered before leaving the task as completed', '- [x] Set promotion review explicitly to none, candidate-recorded, or registered before leaving the task as completed')
        .replace('promotion_status: pending', 'promotion_status: candidate-recorded');
    await fs.writeFile(taskPath, completedTaskContent, 'utf-8');
    const scriptPath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'code', 'summary-analysis.py');
    const figurePath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'figures', 'summary-plot.png');
    const artifactFilePath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'reports', 'summary.md');
    const candidatesPath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'artifact-candidates.yaml');
    await fs.writeFile(scriptPath, 'print("summary")\n', 'utf-8');
    await fs.writeFile(figurePath, 'fake-png', 'utf-8');
    await fs.writeFile(artifactFilePath, '# Summary\n', 'utf-8');
    await fs.writeFile(candidatesPath, [
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
        '    description: Key summary figure',
        '    schema: png-figure',
        '  - path: studies/STUDY-001/output/reports/summary.md',
        '    type: report',
        '    task_id: TASK-001',
        '    reusable: true',
        '    description: Study summary report',
        '    schema: markdown-report',
        '',
    ].join('\n'), 'utf-8');
    await closeStudy(projectRoot, createdStudy.studyId, {
        questionAfter: 'What follow-up question remains after the summary?',
        changeType: 'refinement',
        changeDriver: 'The first pass narrowed the scope.',
        openBoundaries: ['Need a second dataset'],
    });
    const status = await buildStatus(projectRoot);
    assert.deepEqual(status.studies.closed, [createdStudy.studyId]);
    assert.equal(status.tasks.completed[0], createdTask.taskId);
    assert.deepEqual(status.tasks.promotion_pending, []);
    assert.deepEqual(status.tasks.registered, []);
    assert.deepEqual(status.output_review.studies_with_unpackaged_output, []);
    assert.equal(status.artifacts.count, 3);
    assert.equal(status.question_state.last_change_type, 'refinement');
    assert.deepEqual(status.question_state.open_boundaries, ['Need a second dataset']);
    const evolution = await fs.readFile(path.join(projectRoot, 'evolution.yaml'), 'utf-8');
    assert.match(evolution, /question_after: What follow-up question remains after the summary\?/);
    const artifactIndex = await fs.readFile(path.join(projectRoot, 'artifacts', 'index.yaml'), 'utf-8');
    assert.match(artifactIndex, /artifacts\/code\/ART-001-summary-analysis\.py/);
    assert.match(artifactIndex, /artifacts\/figures\/ART-002-summary-plot\.png/);
    assert.match(artifactIndex, /artifacts\/reports\/ART-003-summary\.md/);
    assert.match(artifactIndex, /produced_by: STUDY-001\/TASK-001/);
    const artifactList = await listArtifacts(projectRoot);
    assert.equal(artifactList.artifacts.find((entry) => entry.path === 'artifacts/code/ART-001-summary-analysis.py')?.scope, 'task');
    assert.equal(artifactList.artifacts.find((entry) => entry.path === 'artifacts/figures/ART-002-summary-plot.png')?.scope, 'study');
    assert.equal(artifactList.artifacts.find((entry) => entry.path === 'artifacts/reports/ART-003-summary.md')?.scope, 'study');
    assert.equal(artifactList.artifacts.find((entry) => entry.path === 'artifacts/reports/ART-003-summary.md')?.produced_by, 'STUDY-001/TASK-001');
    const scriptStats = await fs.lstat(scriptPath);
    const figureStats = await fs.lstat(figurePath);
    const reportStats = await fs.lstat(artifactFilePath);
    assert.equal(scriptStats.isSymbolicLink(), true);
    assert.equal(figureStats.isSymbolicLink(), true);
    assert.equal(reportStats.isSymbolicLink(), true);
    assert.equal(await fs.realpath(scriptPath), path.join(projectRoot, 'artifacts', 'code', 'ART-001-summary-analysis.py'));
    assert.equal(await fs.realpath(figurePath), path.join(projectRoot, 'artifacts', 'figures', 'ART-002-summary-plot.png'));
    assert.equal(await fs.realpath(artifactFilePath), path.join(projectRoot, 'artifacts', 'reports', 'ART-003-summary.md'));
    const updatedTaskContent = await fs.readFile(taskPath, 'utf-8');
    assert.match(updatedTaskContent, /promotion_status: candidate-recorded/);
    assert.match(updatedTaskContent, /artifact_ids:\n  - ART-001/);
    assert.match(updatedTaskContent, /artifact_ids:\n  - ART-001\n  - ART-002\n  - ART-003/);
});
test('qdd closeStudy promotes artifacts before writing question_delta', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-close-order-'));
    await initCommand(projectRoot);
    const createdStudy = await createStudy(projectRoot, {
        question: 'Can closure fail safely when promotion is invalid?',
        hypothesis: 'Promotion errors should stop question_delta writes.',
    });
    const createdTask = await createTask(projectRoot, createdStudy.studyId, {
        goal: 'Produce one reusable report',
        expectedOutputs: ['report.md'],
    });
    const taskPath = path.join(projectRoot, createdTask.relativePath);
    const originalTaskContent = await fs.readFile(taskPath, 'utf-8');
    await fs.writeFile(taskPath, originalTaskContent.replace('status: pending', 'status: completed').replace('promotion_status: pending', 'promotion_status: candidate-recorded'), 'utf-8');
    const reportPath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'reports', 'closure-report.md');
    await fs.writeFile(reportPath, '# closure\n', 'utf-8');
    await fs.writeFile(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'artifact-candidates.yaml'), [
        'artifact_candidates:',
        '  - path: studies/STUDY-001/output/reports/closure-report.md',
        '    type: report',
        '    task_id: TASK-999',
        '    reusable: true',
        '    description: Invalid provenance to force promotion failure',
        '    schema: markdown-report',
        '',
    ].join('\n'), 'utf-8');
    await assert.rejects(closeStudy(projectRoot, createdStudy.studyId, {
        questionAfter: 'Should not be written',
        changeType: 'refinement',
        changeDriver: 'Promotion should fail first.',
        openBoundaries: [],
    }), /does not belong to study/);
    const evolution = await fs.readFile(path.join(projectRoot, 'evolution.yaml'), 'utf-8');
    assert.doesNotMatch(evolution, /Should not be written/);
    const artifactList = await listArtifacts(projectRoot);
    assert.equal(artifactList.artifacts.length, 0);
});
test('qdd recordArtifactCandidate can promote a code candidate through closeStudy', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-code-candidate-'));
    await initCommand(projectRoot);
    const createdStudy = await createStudy(projectRoot, {
        question: 'Can a preserved analysis script be promoted as a code artifact?',
        hypothesis: 'The executed study-local script should promote through the normal candidate path.',
    });
    const createdTask = await createTask(projectRoot, createdStudy.studyId, {
        goal: 'Run one substantive analysis script',
        expectedOutputs: ['analysis.py'],
        skills: ['singlecell/scrna/sc-clustering'],
    });
    const taskPath = path.join(projectRoot, createdTask.relativePath);
    const originalTaskContent = await fs.readFile(taskPath, 'utf-8');
    await fs.writeFile(taskPath, originalTaskContent.replace('status: pending', 'status: completed'), 'utf-8');
    const scriptPath = path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'code', 'cluster-analysis.py');
    await fs.writeFile(scriptPath, 'print("cluster analysis")\n', 'utf-8');
    await recordArtifactCandidate(projectRoot, scriptPath, {
        artifactType: 'code',
        description: 'Main executed clustering script',
        studyId: createdStudy.studyId,
        taskId: createdTask.taskId,
        schema: 'python-script',
        promotionStatus: 'candidate-recorded',
    });
    await closeStudy(projectRoot, createdStudy.studyId, {
        questionAfter: 'Which clustering result deserves follow-up validation?',
        changeType: 'refinement',
        changeDriver: 'The executed script produced a stable first-pass clustering surface.',
        openBoundaries: ['Need annotation validation'],
    });
    const artifactList = await listArtifacts(projectRoot);
    assert.equal(artifactList.artifacts.length, 1);
    assert.equal(artifactList.artifacts[0].type, 'code');
    assert.match(artifactList.artifacts[0].path, /^artifacts\/code\/ART-001-cluster-analysis\.py$/);
    const updatedTaskContent = await fs.readFile(taskPath, 'utf-8');
    assert.match(updatedTaskContent, /promotion_status: candidate-recorded/);
    assert.match(updatedTaskContent, /artifact_ids:\n  - ART-001/);
    assert.equal((await fs.lstat(scriptPath)).isSymbolicLink(), true);
    assert.equal(await fs.realpath(scriptPath), path.join(projectRoot, 'artifacts', 'code', 'ART-001-cluster-analysis.py'));
});
test('qdd inspection commands expose artifacts and context without mutating state', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-inspect-'));
    await initCommand(projectRoot);
    await fs.writeFile(path.join(projectRoot, 'context', 'datasets.yaml'), ['datasets:', '  - id: DS-001', '    status: ready', ''].join('\n'), 'utf-8');
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
    assert.equal(artifactList.artifacts[0].path, 'artifacts/reports/ART-001-report.md');
    assert.equal((await fs.lstat(artifactFilePath)).isSymbolicLink(), true);
    assert.equal(await fs.realpath(artifactFilePath), path.join(projectRoot, 'artifacts', 'reports', 'ART-001-report.md'));
    const contextList = await listContext(projectRoot);
    assert.equal(contextList.context.length, 2);
    assert.ok(contextList.context.some((entry) => entry.path === 'context/resources.md'));
    assert.ok(contextList.context.some((entry) => entry.path === 'context/datasets.yaml'));
    const resourcesEntry = contextList.context.find((entry) => entry.path === 'context/resources.md');
    assert.equal(typeof resourcesEntry?.data, 'string');
    const datasetsEntry = contextList.context.find((entry) => entry.path === 'context/datasets.yaml');
    assert.equal(typeof datasetsEntry?.data, 'object');
});
test('qdd createTask rejects missing or workflow task skills', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-task-skill-'));
    await initCommand(projectRoot);
    const createdStudy = await createStudy(projectRoot, {
        question: 'Can task skill validation stay strict?',
        hypothesis: 'Invalid task skills should be rejected before task creation.',
    });
    await assert.rejects(createTask(projectRoot, createdStudy.studyId, {
        goal: 'Use a missing domain skill',
        skills: ['singlecell/scrna/missing-skill'],
    }), /must already exist under/);
    await assert.rejects(createTask(projectRoot, createdStudy.studyId, {
        goal: 'Try to use a workflow skill',
        skills: ['qdd/qdd-apply', 'singlecell/scrna/sc-clustering'],
    }), /must not include workflow skills/);
    await assert.rejects(createTask(projectRoot, createdStudy.studyId, {
        goal: 'Try to use a planning skill',
        skills: ['brain/singlecell/scrna-planning'],
    }), /planning-only brain skills/);
});
test('qdd validate warns on placeholder onboarding state and reports broken links / missing local skills', async () => {
    const placeholderProjectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-validate-placeholders-'));
    await initCommand(placeholderProjectRoot);
    const placeholderValidation = await validateProject(placeholderProjectRoot);
    assert.equal(placeholderValidation.valid, true);
    assert.ok(placeholderValidation.issues.some((issue) => issue.code === 'placeholder_theme'));
    assert.ok(placeholderValidation.issues.some((issue) => issue.code === 'placeholder_initial_question'));
    assert.ok(placeholderValidation.issues.some((issue) => issue.code === 'placeholder_project_resources'));
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-validate-'));
    await initCommand(projectRoot);
    await fs.mkdir(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'studies', 'STUDY-001', 'study.md'), [
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
    ].join('\n'), 'utf-8');
    await fs.writeFile(path.join(projectRoot, 'studies', 'STUDY-001', 'tasks', 'TASK-001.md'), [
        '---',
        'task_id: TASK-001',
        'study_id: STUDY-001',
        'goal: Keep one task pending',
        'status: pending',
        'promotion_status: pending',
        'skills:',
        '  - singlecell/scrna/missing-skill',
        '---',
        '',
        '## Skills',
        '',
        '- singlecell/scrna/missing-skill',
        '',
        '## Checklist',
        '',
        '- [ ] pending',
        '',
    ].join('\n'), 'utf-8');
    await fs.writeFile(path.join(projectRoot, 'context', 'bad.yaml'), 'not: [valid', 'utf-8');
    await fs.symlink('/tmp/definitely-missing-qdd-dataset.h5ad', path.join(projectRoot, 'artifacts', 'data', 'broken-dataset.h5ad'));
    await fs.writeFile(path.join(projectRoot, '.qdd', 'layer-policy.yaml'), [
        'commands:',
        '  qdd-start: thesis-manager',
        '  qdd-propose: study-brain',
        '  qdd-explore: study-brain',
        '  qdd-apply: executor',
        '  qdd-close: thesis-manager',
        'roles:',
        '  thesis-manager:',
        '    default_skills:',
        '      - qdd/qdd-apply',
        '  study-brain:',
        '    default_skills:',
        '      - brain/singlecell/scrna-planning',
        '      - brain/singlecell/scatac-planning',
        '  executor:',
        '    default_skills:',
        '      - brain/singlecell/scrna-planning',
        '',
    ].join('\n'), 'utf-8');
    await fs.mkdir(path.join(projectRoot, 'studies', 'STUDY-001', 'output'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'studies', 'STUDY-001', 'output', 'artifact-candidates.yaml'), [
        'artifact_candidates:',
        '  - path: studies/STUDY-001/output/report.md',
        '    type: invalid',
        '  - path: studies/STUDY-001/output/local-figure.png',
        '    type: figure',
        '    reusable: true',
        '    scope: task',
        '    description: Missing task provenance',
        '    schema: png-figure',
        '  - path: studies/STUDY-001/output/study-note.md',
        '    type: report',
        '    reusable: true',
        '    description: Study-level note without task provenance',
        '    schema: markdown-report',
        '',
    ].join('\n'), 'utf-8');
    const validation = await validateProject(projectRoot);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some((issue) => issue.code === 'closed_study_with_open_tasks'));
    assert.ok(validation.issues.some((issue) => issue.code === 'invalid_context_yaml' && issue.path === 'context/bad.yaml'));
    assert.ok(validation.issues.some((issue) => issue.code === 'invalid_artifact_candidate_type'));
    assert.ok(validation.issues.some((issue) => issue.code === 'missing_artifact_candidate_task_id'));
    assert.ok(validation.issues.some((issue) => issue.code === 'artifact_candidate_missing_task_provenance'));
    assert.ok(validation.issues.some((issue) => issue.code === 'broken_data_link' && issue.path === 'artifacts/data/broken-dataset.h5ad'));
    assert.ok(validation.issues.some((issue) => issue.code === 'missing_local_skill_reference'));
    assert.ok(validation.issues.some((issue) => issue.code === 'workflow_skill_not_allowed_in_layer_policy'));
    assert.ok(validation.issues.some((issue) => issue.code === 'planning_skill_not_allowed_in_task_layer_policy'));
});
test('qdd validate and close enforce promotion review and canonical study output packaging', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qdd-promotion-packaging-'));
    await initCommand(projectRoot);
    const createdStudy = await createStudy(projectRoot, {
        question: 'Does apply leave reviewable packaging?',
        hypothesis: 'Close should fail when review or packaging is incomplete.',
    });
    const createdTask = await createTask(projectRoot, createdStudy.studyId, {
        goal: 'Produce one report but leave packaging incomplete',
        expectedOutputs: ['report.md'],
    });
    const taskPath = path.join(projectRoot, createdTask.relativePath);
    const originalTaskContent = await fs.readFile(taskPath, 'utf-8');
    await fs.writeFile(taskPath, originalTaskContent.replace('status: pending', 'status: completed'), 'utf-8');
    await fs.mkdir(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'task001_misc'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'task001_misc', 'note.md'), '# temp\n', 'utf-8');
    const validation = await validateProject(projectRoot);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some((issue) => issue.code === 'completed_task_pending_promotion_review'));
    assert.ok(validation.issues.some((issue) => issue.code === 'noncanonical_study_output_entries'));
    await assert.rejects(closeStudy(projectRoot, createdStudy.studyId, {
        questionAfter: 'Should not close yet',
        changeType: 'refinement',
        changeDriver: 'Promotion review not done.',
        openBoundaries: [],
    }), /completed tasks with pending promotion review/);
    const fixedTaskContent = (await fs.readFile(taskPath, 'utf-8')).replace('promotion_status: pending', 'promotion_status: none');
    await fs.writeFile(taskPath, fixedTaskContent, 'utf-8');
    await assert.rejects(closeStudy(projectRoot, createdStudy.studyId, {
        questionAfter: 'Should still not close yet',
        changeType: 'refinement',
        changeDriver: 'Packaging not cleaned.',
        openBoundaries: [],
    }), /unpackaged non-canonical study outputs/);
    await fs.rm(path.join(projectRoot, 'studies', createdStudy.studyId, 'output', 'task001_misc'), { recursive: true, force: true });
    await closeStudy(projectRoot, createdStudy.studyId, {
        questionAfter: 'Packaging and review are now complete.',
        changeType: 'confirmation',
        changeDriver: 'No reusable outputs and no unpackaged material remain.',
        openBoundaries: [],
    });
});
//# sourceMappingURL=smoke.test.js.map