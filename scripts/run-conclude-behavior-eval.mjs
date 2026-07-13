#!/usr/bin/env node

import path from 'node:path';
import { recheckConcludeBehaviorEval, runConcludeBehaviorEval, runConcludeManuscriptEval } from '../dist/test-support/conclude-behavior-eval.js';

const args = process.argv.slice(2);
const mode = args.includes('--live') ? 'live' : 'fake';
const outputIndex = args.indexOf('--output');
const modelIndex = args.indexOf('--model');
const providerIndex = args.indexOf('--provider');
const caseIndex = args.indexOf('--case');
const projectIndex = args.indexOf('--project');
const runIdIndex = args.indexOf('--run-id');
const recheckIndex = args.indexOf('--recheck');
const stageIndex = args.indexOf('--stage');
const resumeConclusionIndex = args.indexOf('--resume-conclusion');
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
const stage = stageIndex >= 0 ? args[stageIndex + 1] : undefined;
const resumeConclusion = resumeConclusionIndex >= 0 ? args[resumeConclusionIndex + 1] : undefined;

if (projectPath && mode !== 'live') {
  throw new Error('--project is supported only with --live so a real QDD project is never treated as a fixture.');
}
if (recheckOutput && (args.includes('--live') || projectPath || model || provider || casePath || runId)) {
  throw new Error('--recheck only accepts an existing evaluation output directory.');
}
if (stage && stage !== 'manuscript') throw new Error('--stage currently supports only manuscript.');
if (stage === 'manuscript' && (!args.includes('--live') || !projectPath || !resumeConclusion)) {
  throw new Error('--stage manuscript requires --live --project <QDD-project> and --resume-conclusion <accepted-conclusion-dir>.');
}
if (resumeConclusion && stage !== 'manuscript') throw new Error('--resume-conclusion requires --stage manuscript.');

const report = recheckOutput
  ? await recheckConcludeBehaviorEval(path.resolve(recheckOutput))
  : stage === 'manuscript'
    ? await runConcludeManuscriptEval({
      projectPath: path.resolve(projectPath),
      resumeConclusion: path.resolve(resumeConclusion),
      outputRoot,
      model,
      provider,
    })
    : await runConcludeBehaviorEval({ mode, outputRoot, model, provider, casePath, projectPath, runId });
console.log(JSON.stringify({
  status: report.status,
  stage: stage ?? 'two-gate',
  ...(stage === 'manuscript'
    ? {
      report: report.report_markdown,
      transcript: report.transcript,
      final_paper: report.final_paper,
      pdf_status: report.pdf_status,
      validation: report.manuscript_validation?.checks ?? null,
    }
    : {
      mode: report.mode,
      harness: report.harness.status,
      semantic_review: report.semantic_review.verdict,
      case: report.case.id,
      report: report.outputs.report_markdown,
      transcript: report.outputs.transcript,
      research_synthesis: report.outputs.research_synthesis,
      story: report.outputs.story,
    }),
  blockers: report.environment_blockers,
}, null, 2));

if (report.status === 'failed') process.exitCode = 1;
