import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { __testOnly, runConcludeEval } from '../services/conclude-eval.js';
import { loadConcludeEvalOracle } from '../services/conclude-eval-oracle.js';
import { generateConcludeStoryCandidates } from '../services/conclude.js';
const PARKINSON_CASE_ENV = 'QDD_CONCLUDE_EVAL_CASE';
const ORACLE_FIXTURE_DIR = path.resolve('src/test/fixtures/conclude/parkinson-oracle');
test('Parkinson story-plan gate accepts one canonical dossier-backed spine when case path is configured', async (t) => {
    const casePath = process.env[PARKINSON_CASE_ENV]?.trim();
    if (!casePath) {
        await t.skip(`Set ${PARKINSON_CASE_ENV} to run the Parkinson story-plan gate.`);
        return;
    }
    const result = await generateConcludeStoryCandidates(casePath, {
        outputDir: 'conclusions/symphony-bil-23-story-plan-gate-20260710T183000Z',
        runId: 'symphony-bil-23-story-plan-gate-20260710T183000Z',
        now: new Date('2026-07-10T10:30:00.000Z'),
    });
    const story = result.storyPlan.story;
    assert.equal(result.storyPlan.status, 'ready-for-review');
    assert.equal(result.storyPlan.audit.status, 'pass');
    assert.equal(result.storyPlan.audit.violations.length, 0);
    assert.equal(result.nextStep, 'review-story');
    assert.ok(story);
    assert.equal(result.candidates.length, 1);
    assert.equal(story.id, 'canonical-story');
    assert.equal(story.viability.narrativeClosure.status, 'closed');
    assert.equal(story.resultsBeats.at(-1)?.transition, 'closes');
    assert.equal(story.resultsBeats.at(-1)?.nextQuestion, null);
    assert.match(story.centralContribution, /astrocyte.*QKI\/CELF2.*transcriptome-wide.*autophagy.*transcript-architecture/i);
    const beatText = story.resultsBeats.map((beat) => `${beat.question} ${beat.answer}`).join('\n');
    const expectedRelationshipCoverage = [
        /astrocyte.*RNA-processing/i,
        /assay.*transcript-level|isoforms.*transcript-level/i,
        /candidate.*transcript-usage/i,
        /transcriptome-wide/i,
        /autophagy|mitochondrial-quality-control/i,
        /transcript architecture|transcript-boundary/i,
    ].map((pattern) => pattern.test(beatText));
    assert.ok(expectedRelationshipCoverage.every(Boolean));
    const roleSet = new Set(story.evidenceRoleAssignments.map((assignment) => assignment.role));
    assert.ok(['core', 'bridge', 'validation', 'boundary', 'supplementary', 'excluded'].every((role) => roleSet.has(role)));
    const excludedSpatial = story.omissionLedger.some((entry) => {
        if (entry.role !== 'excluded') {
            return false;
        }
        const unit = result.evidenceDossier.evidenceUnits.find((candidate) => candidate.id === entry.claimId);
        return /spatial|KNN|clustering/i.test(unit?.narrative.scientificStatement ?? '');
    });
    assert.equal(excludedSpatial, true);
    const visibleFields = story.resultsBeats.flatMap((beat) => [beat.question, beat.answer, beat.boundedInterpretation, beat.nextQuestion ?? '']);
    assert.ok([story.centralContribution, story.scientificQuestion, ...visibleFields].every((value) => !/STUDY-|TASK-|ART-|QDD|workflow|task status/i.test(value)));
    assert.equal(await FileSystemUtils.fileExists(result.storyPlanPath), true);
    assert.equal(await FileSystemUtils.fileExists(result.storyPlanMarkdownPath), true);
    assert.equal(await FileSystemUtils.fileExists(result.storyCandidatesJsonPath), true);
});
test('Parkinson conclude golden-case eval writes JSON and Markdown reports when case path is configured', async (t) => {
    const casePath = process.env[PARKINSON_CASE_ENV]?.trim();
    if (!casePath) {
        await t.skip(`Set ${PARKINSON_CASE_ENV} to run the Parkinson golden-case conclude eval harness.`);
        return;
    }
    const runId = `parkinson-eval-${new Date('2026-07-07T06:00:00.000Z').toISOString().replace(/[:.]/g, '-')}`;
    const report = await runConcludeEval({
        casePath,
        runId,
        now: new Date('2026-07-07T06:00:00.000Z'),
        selectedStoryId: 'canonical-story',
    });
    assert.equal(report.runId, runId);
    assert.equal(report.oracle.schemaVersion, 1);
    assert.equal(report.oracle.caseId, 'parkinson-rna-processing');
    assert.equal(report.dimensions.length, 7);
    assert.equal(report.summary.scoreMaximum, 35);
    assert.ok(report.summary.scoreTotal >= 7);
    assert.ok(report.keyImprovements.length >= 3);
    assert.ok(report.keyImprovements.length <= 5);
    assert.equal(await FileSystemUtils.fileExists(report.outputs.concludeEvalJsonPath), true);
    assert.equal(await FileSystemUtils.fileExists(report.outputs.concludeEvalMarkdownPath), true);
    const concludeEvalJson = JSON.parse(await FileSystemUtils.readFile(report.outputs.concludeEvalJsonPath));
    const concludeEvalMarkdown = await FileSystemUtils.readFile(report.outputs.concludeEvalMarkdownPath);
    assert.equal(concludeEvalJson.summary.scoreTotal, report.summary.scoreTotal);
    assert.equal(concludeEvalJson.oracle.schemaVersion, 1);
    assert.equal(concludeEvalJson.oracle.caseId, 'parkinson-rna-processing');
    assert.equal(concludeEvalJson.gate.status, report.gate.status);
    assert.equal(concludeEvalJson.gate.passing, report.gate.passing);
    assert.equal(concludeEvalJson.dimensions.length, 7);
    assert.ok(concludeEvalJson.dimensions.every((dimension) => dimension.score >= 1 && dimension.score <= 5));
    assert.ok(concludeEvalJson.hardFails.some((hardFail) => hardFail.id === 'missing-result-anchor'));
    assert.ok(concludeEvalJson.keyImprovements.length >= 3);
    assert.match(concludeEvalMarkdown, /# Conclude Eval/);
    assert.match(concludeEvalMarkdown, /## Oracle/);
    assert.match(concludeEvalMarkdown, /parkinson-rna-processing/);
    assert.match(concludeEvalMarkdown, /## Quality Gate/);
    assert.match(concludeEvalMarkdown, /Gate status:/);
    assert.match(concludeEvalMarkdown, /## Diagnostic Summary/);
    assert.match(concludeEvalMarkdown, /## Dimension Scores/);
    assert.match(concludeEvalMarkdown, /logical_coherence/);
    assert.match(concludeEvalMarkdown, /## Hard Fails/);
    assert.match(concludeEvalMarkdown, /## Key Improvements/);
    assert.match(concludeEvalMarkdown, /conclude_eval\.json/);
    assert.match(concludeEvalMarkdown, /conclude_eval\.md/);
    const expectedOutputPaths = [
        report.concludeRun.storyCandidatesPath,
        report.concludeRun.evidenceAuditPath,
        report.concludeRun.claimSafetyAuditPath,
        report.concludeRun.reviewerRiskAuditPath,
        report.concludeRun.renderStatusPath,
        report.concludeRun.mainTexPath,
    ].filter((value) => Boolean(value));
    for (const outputPath of expectedOutputPaths) {
        assert.equal(await FileSystemUtils.fileExists(outputPath), true, `Expected output to exist: ${outputPath}`);
    }
    assert.equal(path.dirname(report.outputs.concludeEvalJsonPath), report.outputs.outputDir);
    assert.equal(path.dirname(report.outputs.concludeEvalMarkdownPath), report.outputs.outputDir);
});
test('versioned Parkinson Oracle hard-fails the repository known bad-case fixture', async () => {
    const badDraftPath = path.join(ORACLE_FIXTURE_DIR, 'bad-draft-excerpts.md');
    const badDraftFixture = await FileSystemUtils.readFile(badDraftPath);
    const badDraftVisibleText = badDraftFixture
        .split('\n')
        .map((line) => line.startsWith('> ') ? line.slice(2) : '')
        .join('\n');
    const { oracle, oraclePath } = await loadConcludeEvalOracle();
    const quality = __testOnly.evaluateManuscriptQuality({
        oracle,
        mainTexContent: badDraftVisibleText,
        referencesBibContent: '',
        mainTexPath: badDraftPath,
        referencesBibPath: path.join(ORACLE_FIXTURE_DIR, 'references.bib'),
        resultsClaims: [],
        figureAssets: [],
    });
    const triggeredIds = new Set(quality.hardFails.filter((hardFail) => hardFail.triggered).map((hardFail) => hardFail.id));
    const logicalCoherence = __testOnly.scoreLogicalCoherence(badDraftVisibleText, quality.hardFails);
    assert.equal(oracle.schemaVersion, 1);
    assert.equal(oracle.caseId, 'parkinson-rna-processing');
    assert.equal(oraclePath, path.join(ORACLE_FIXTURE_DIR, 'oracle.json'));
    assert.equal(quality.gate.status, 'fail');
    assert.equal(quality.gate.passing, false);
    assert.ok(triggeredIds.has('evidence-inventory-prose'));
    assert.ok(triggeredIds.has('fragmented-or-metadata-prose'));
    assert.ok(triggeredIds.has('meta-writing'));
    assert.ok(triggeredIds.has('missing-result-anchor'));
    assert.ok(triggeredIds.has('invalid-citation'));
    assert.ok(logicalCoherence.score < 5);
    assert.ok(quality.hardFails
        .filter((hardFail) => hardFail.triggered)
        .every((hardFail) => hardFail.findings.every((finding) => finding.filePath.length > 0
        && finding.line > 0
        && finding.column > 0
        && finding.excerpt.length > 0
        && finding.reason.length > 0)));
});
test('conclude eval visible-text detectors catch raw leakage and report-tone scaffolding', () => {
    const visibleText = __testOnly.extractVisibleManuscriptText(`
    \\section{Results}
    The discussion should explain how the selected story remains bounded. TASK-999 remained blocked.
    % TASK-001 in comment should be ignored
    \\section{Discussion}
  `);
    const rawLeakageSignals = __testOnly.collectRawTaskStudyLeakage(visibleText);
    const reportToneSignals = __testOnly.collectReportToneSignals(visibleText);
    assert.ok(rawLeakageSignals.some((signal) => /TASK-999/.test(signal)));
    assert.ok(reportToneSignals.some((signal) => /the discussion should/i.test(signal)));
    assert.ok(rawLeakageSignals.every((signal) => !/TASK-001/.test(signal)));
});
test('QDD provenance identifiers are ignored in comments and rejected in visible prose', async () => {
    const { oracle } = await loadConcludeEvalOracle();
    const mainTexPath = path.join(ORACLE_FIXTURE_DIR, 'visible-leakage.tex');
    const quality = __testOnly.evaluateManuscriptQuality({
        oracle,
        mainTexContent: `
      \\section{Results}
      The visible result cites STUDY-999 as its source.
      % Provenance only: STUDY-001 TASK-002 ART-003
    `,
        referencesBibContent: '@article{verified,\n  title={Verified source}\n}\n',
        mainTexPath,
        referencesBibPath: path.join(ORACLE_FIXTURE_DIR, 'references.bib'),
        resultsClaims: [],
        figureAssets: [],
    });
    const metadataFailure = quality.hardFails.find((hardFail) => hardFail.id === 'fragmented-or-metadata-prose');
    assert.equal(metadataFailure?.triggered, true);
    assert.ok(metadataFailure?.findings.some((finding) => /STUDY-999/.test(finding.excerpt)));
    assert.ok(metadataFailure?.findings.every((finding) => !/STUDY-001|TASK-002|ART-003/.test(finding.excerpt)));
});
//# sourceMappingURL=conclude-eval.test.js.map