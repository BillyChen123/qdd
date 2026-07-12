#!/usr/bin/env node

import path from 'node:path';
import { runConcludeBehaviorEval } from '../dist/test-support/conclude-behavior-eval.js';

const args = process.argv.slice(2);
const mode = args.includes('--live') ? 'live' : 'fake';
const outputIndex = args.indexOf('--output');
const modelIndex = args.indexOf('--model');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.resolve(
  outputIndex >= 0 && args[outputIndex + 1]
    ? args[outputIndex + 1]
    : path.join('tmp', 'conclude-evals', `${mode}-${timestamp}`)
);
const model = modelIndex >= 0 ? args[modelIndex + 1] : undefined;

const report = await runConcludeBehaviorEval({ mode, outputRoot, model });
console.log(JSON.stringify({
  status: report.status,
  mode: report.mode,
  harness: report.harness.status,
  report: report.outputs.report_markdown,
  transcript: report.outputs.transcript,
  research_synthesis: report.outputs.research_synthesis,
  story: report.outputs.story,
  blockers: report.environment_blockers,
}, null, 2));

if (report.status === 'failed') process.exitCode = 1;
