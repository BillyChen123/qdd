#!/usr/bin/env node

import path from 'node:path';
import { recheckConcludeBehaviorEval, runConcludeBehaviorEval } from '../dist/test-support/conclude-behavior-eval.js';

const args = process.argv.slice(2);
const mode = args.includes('--live') ? 'live' : 'fake';
const outputIndex = args.indexOf('--output');
const modelIndex = args.indexOf('--model');
const providerIndex = args.indexOf('--provider');
const caseIndex = args.indexOf('--case');
const projectIndex = args.indexOf('--project');
const runIdIndex = args.indexOf('--run-id');
const recheckIndex = args.indexOf('--recheck');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.resolve(
  outputIndex >= 0 && args[outputIndex + 1]
    ? args[outputIndex + 1]
    : path.join('tmp', 'conclude-evals', `${mode}-${timestamp}`)
);
const model = modelIndex >= 0 ? args[modelIndex + 1] : undefined;
const provider = providerIndex >= 0 ? args[providerIndex + 1] : undefined;
const casePath = caseIndex >= 0 ? args[caseIndex + 1] : undefined;
const projectPath = projectIndex >= 0 ? args[projectIndex + 1] : undefined;
const runId = runIdIndex >= 0 ? args[runIdIndex + 1] : undefined;
const recheckOutput = recheckIndex >= 0 ? args[recheckIndex + 1] : undefined;

if (projectPath && mode !== 'live') {
  throw new Error('--project is supported only with --live so a real QDD project is never treated as a fixture.');
}
if (recheckOutput && (args.includes('--live') || projectPath || model || provider || casePath || runId)) {
  throw new Error('--recheck only accepts an existing evaluation output directory.');
}

const report = recheckOutput
  ? await recheckConcludeBehaviorEval(path.resolve(recheckOutput))
  : await runConcludeBehaviorEval({ mode, outputRoot, model, provider, casePath, projectPath, runId });
console.log(JSON.stringify({
  status: report.status,
  mode: report.mode,
  harness: report.harness.status,
  semantic_review: report.semantic_review.verdict,
  case: report.case.id,
  report: report.outputs.report_markdown,
  transcript: report.outputs.transcript,
  research_synthesis: report.outputs.research_synthesis,
  story: report.outputs.story,
  blockers: report.environment_blockers,
}, null, 2));

if (report.status === 'failed') process.exitCode = 1;
