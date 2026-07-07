import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { runConcludeEval } from '../services/conclude-eval.js';
const PARKINSON_CASE_ENV = 'QDD_CONCLUDE_EVAL_CASE';
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
        selectedStoryId: 'story-1',
    });
    assert.equal(report.runId, runId);
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
    assert.equal(concludeEvalJson.dimensions.length, 7);
    assert.ok(concludeEvalJson.dimensions.every((dimension) => dimension.score >= 1 && dimension.score <= 5));
    assert.ok(concludeEvalJson.hardFails.some((hardFail) => hardFail.id === 'missing_internal_evidence_anchor'));
    assert.ok(concludeEvalJson.keyImprovements.length >= 3);
    assert.match(concludeEvalMarkdown, /# Conclude Eval/);
    assert.match(concludeEvalMarkdown, /## Summary/);
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
//# sourceMappingURL=conclude-eval.test.js.map