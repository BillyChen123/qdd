import { runConcludeEval } from '../dist/services/conclude-eval.js';

const casePath = process.env.QDD_CONCLUDE_EVAL_CASE?.trim();

if (!casePath) {
  console.log('Parkinson conclude eval skipped: set QDD_CONCLUDE_EVAL_CASE to a local QDD project path.');
  process.exit(0);
}

const report = await runConcludeEval({
  casePath,
  selectedStoryId: 'story-1',
});

console.log(JSON.stringify({
  casePath: report.casePath,
  runId: report.runId,
  outputDir: report.outputs.outputDir,
  concludeEvalJsonPath: report.outputs.concludeEvalJsonPath,
  concludeEvalMarkdownPath: report.outputs.concludeEvalMarkdownPath,
  scoreTotal: report.summary.scoreTotal,
  scoreMaximum: report.summary.scoreMaximum,
  scorePercent: report.summary.scorePercent,
  hardFailTriggered: report.summary.hardFailTriggered,
  triggeredHardFailCount: report.summary.triggeredHardFailCount,
  keyImprovements: report.keyImprovements,
}, null, 2));
