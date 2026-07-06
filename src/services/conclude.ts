import path from 'node:path';
import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type {
  ArtifactIndex,
  ConcludeClaimSafetyAuditEntry,
  ConcludeClaimStrength,
  ConcludeEvidenceItem,
  ConcludePathStatus,
  ConcludePreflightOptions,
  ConcludePreflightResult,
  ConcludeRenderStatus,
  ConcludeRenderTargetStatus,
  ConcludeRenderToolName,
  ConcludeRenderToolStatus,
  ConcludeStoryCandidate,
  ConcludeStoryFraming,
  ConcludeStoryGenerationResult,
  ConcludeStudyMemorySnapshot,
  ConcludeStudySnapshot,
  EvolutionState,
  GenerateConcludeStoryCandidatesOptions,
  ResearchContract,
  RunConcludeOptions,
  RunConcludeResult,
  StudyRecord,
  TaskRecord,
} from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from '../runtime/constants.js';
import { discoverStudies } from '../runtime/discovery.js';
import { getStudyArtifactCandidatesPath, getStudyOutputDir, getStudyPublicDataRequestPath, readArtifactCandidateManifest } from '../runtime/evidence.js';
import { listStudyMemoryPaths, readEvolutionState } from '../runtime/evolution.js';
import { isQddProjectRoot } from '../runtime/paths.js';
import { readMarkdownDocument, readYamlFile } from '../runtime/store.js';

const FRONTMATTER_STUDY_ID_PATTERN = /^#\s*(STUDY-\d{3})\s+Memory\b/m;
const RENDER_TOOL_ORDER: ConcludeRenderToolName[] = ['latexmk', 'xelatex', 'pdflatex', 'pandoc'];
const ASSOCIATIVE_SIGNAL_PATTERN = /\b(associate|associated|association|correlate|correlated|correlation|candidate state|candidate marker|proxy|trend)\b/i;
const CAUSAL_SIGNAL_PATTERN = /\b(driver|drives|cause|causal|mechanism|mechanistic|proof|prove|proves|define|defines|defined|effect)\b/i;
const NEGATIVE_SIGNAL_PATTERN = /\b(block|blocked|negative|failed|failure|dissolv|downgrad|avoid|limit|boundary)\b/i;
const TITLE_STYLE_BY_FRAMING: Record<ConcludeStoryFraming, string> = {
  discovery: 'Discovery-first with bounded biological scope',
  method: 'Method-forward with validation framing',
  'case-study': 'Case-study framing with project-grounded lessons',
  benchmark: 'Benchmark framing with explicit comparison criteria',
  'audit-report': 'Audit-report framing centered on evidence quality and limits',
  'bounded-hypothesis': 'Hypothesis-bounded framing with conservative verbs',
};

function buildPathStatus(options: {
  path: string;
  kind: 'file' | 'directory' | 'collection';
  required: boolean;
  available: boolean;
  details: string;
  count?: number;
}): ConcludePathStatus {
  return {
    path: options.path,
    kind: options.kind,
    required: options.required,
    status: options.available ? 'available' : 'blocked',
    details: options.details,
    count: options.count,
  };
}

function extractStudyIdFromMemory(content: string): string | null {
  const match = content.match(FRONTMATTER_STUDY_ID_PATTERN);
  return match ? match[1] : null;
}

function slugifyConcludeTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sentenceCaseTrim(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
}

function buildEvidenceId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

function detectClaimStrength(text: string): ConcludeClaimStrength {
  if (CAUSAL_SIGNAL_PATTERN.test(text)) {
    return 'causal';
  }
  if (ASSOCIATIVE_SIGNAL_PATTERN.test(text)) {
    return 'associative';
  }
  return 'bounded';
}

function inferEvidenceTags(text: string): string[] {
  const tags = new Set<string>();
  if (ASSOCIATIVE_SIGNAL_PATTERN.test(text)) {
    tags.add('associative');
  }
  if (CAUSAL_SIGNAL_PATTERN.test(text)) {
    tags.add('causal-risk');
  }
  if (NEGATIVE_SIGNAL_PATTERN.test(text)) {
    tags.add('negative-or-boundary');
  }
  if (/\b(method|pipeline|protocol|workflow|benchmark)\b/i.test(text)) {
    tags.add('method');
  }
  if (/\b(review|audit|risk|limit|limitation)\b/i.test(text)) {
    tags.add('audit');
  }
  return [...tags];
}

function splitBulletLikeLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line.length > 0);
}

function summarizeFirstMeaningfulLine(content: string, fallback: string): string {
  const line = splitBulletLikeLines(content).find((candidate) => !candidate.startsWith('#') && !candidate.startsWith('##'));
  return sentenceCaseTrim(line ?? fallback);
}

function summarizeStudyRecord(study: ConcludeStudySnapshot): string {
  const parts = [
    study.record.question,
    study.record.hypothesis,
    study.record.status ? `status ${study.record.status}` : '',
    ...(study.record.blockers ?? []),
    ...(study.record.expected_artifacts ?? []),
  ].filter((value) => value && value.trim().length > 0);
  return sentenceCaseTrim(parts.join('. '));
}

function buildClaimSafetyAuditEntry(claim: string, strength: ConcludeClaimStrength): ConcludeClaimSafetyAuditEntry {
  if (strength === 'causal') {
    return {
      claim,
      originalStrength: 'causal',
      safeStrength: 'associative',
      action: 'soften',
      rationale: 'Current evidence reads as associative or proxy-based, so causal or mechanistic verbs must be downgraded.',
    };
  }
  if (strength === 'associative') {
    return {
      claim,
      originalStrength: 'associative',
      safeStrength: 'associative',
      action: 'allow',
      rationale: 'Associative wording is acceptable when the evidence does not establish direct mechanism.',
    };
  }
  return {
    claim,
    originalStrength: 'bounded',
    safeStrength: 'bounded',
    action: 'allow',
    rationale: 'Bounded hypothesis language matches the current evidence strength.',
  };
}

function formatEvidenceLine(evidence: ConcludeEvidenceItem): string {
  const claimSuffix = evidence.claimStrength === 'causal' ? 'causal-risk' : evidence.claimStrength;
  return `- [${evidence.id}] (${evidence.kind}; ${claimSuffix}) ${evidence.summary} Source: \`${evidence.sourcePath}\`.`;
}

function formatEvidenceReferences(evidence: ConcludeEvidenceItem[]): string[] {
  return evidence.map((item) => `- [${item.id}] ${item.summary}`);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => sentenceCaseTrim(value)).filter((value) => value.length > 0))];
}

function buildReviewerObjections(framing: ConcludeStoryFraming, supporting: ConcludeEvidenceItem[], negatives: ConcludeEvidenceItem[]): string[] {
  const objections = [
    supporting.some((item) => item.claimStrength === 'associative')
      ? 'The central biological signal may be associative rather than mechanistic.'
      : 'The evidentiary chain may still be narrower than the title implies.',
    negatives.length > 0
      ? 'Negative and blocked results should be shown explicitly so the story reads as bounded rather than selective.'
      : 'Reviewers may ask why contradictory or boundary evidence is limited.',
  ];

  if (framing === 'method' || framing === 'benchmark') {
    objections.push('Method-oriented framing will need clearer evidence that the workflow generalizes beyond this project slice.');
  }
  if (framing === 'audit-report') {
    objections.push('Audit framing can look low-novelty unless the evidence-bounding lesson is made explicit.');
  }
  return uniqueStrings(objections);
}

function scoreStoryCandidate(
  framing: ConcludeStoryFraming,
  supporting: ConcludeEvidenceItem[],
  negatives: ConcludeEvidenceItem[],
  claimSafetyAudit: ConcludeClaimSafetyAuditEntry[]
): number {
  const supportiveBase = supporting.length * 18;
  const negativeBonus = Math.min(18, negatives.length * 6);
  const causalPenalty = claimSafetyAudit.filter((entry) => entry.action !== 'allow').length * 9;
  const framingBonus =
    framing === 'bounded-hypothesis' ? 12 :
    framing === 'audit-report' ? 10 :
    framing === 'method' ? 8 :
    framing === 'benchmark' ? 7 :
    framing === 'case-study' ? 6 :
    5;
  return clampScore(30 + supportiveBase + negativeBonus + framingBonus - causalPenalty);
}

function readStudyStatus(study: StudyRecord): string {
  return study.status ?? 'created';
}

function inferEvidenceKindFromStudy(study: ConcludeStudySnapshot, content: string): 'supporting' | 'negative' | 'boundary' {
  const status = readStudyStatus(study.record);
  if (status === 'blocked') {
    return 'negative';
  }
  return 'boundary';
}

function inferFramingFromEvidence(supporting: ConcludeEvidenceItem[], negatives: ConcludeEvidenceItem[]): ConcludeStoryFraming {
  const combined = [...supporting, ...negatives];
  const hasMethodSignal = combined.some((item) => item.tags.includes('method'));
  const hasAuditSignal = negatives.length >= supporting.length || combined.some((item) => item.tags.includes('audit'));
  const hasAssociativeSignal = supporting.some((item) => item.claimStrength === 'associative');

  if (hasAuditSignal) {
    return 'audit-report';
  }
  if (hasMethodSignal && supporting.length > 0) {
    return 'method';
  }
  if (hasAssociativeSignal) {
    return 'bounded-hypothesis';
  }
  return supporting.length >= 3 ? 'discovery' : 'case-study';
}

async function readArtifactEvidence(
  projectRoot: string,
  study: ConcludeStudySnapshot,
  startIndex: number
): Promise<ConcludeEvidenceItem[]> {
  const manifest = await readArtifactCandidateManifest(projectRoot, study.studyId);
  return manifest.artifact_candidates.map((artifact, index) => {
    const summary = sentenceCaseTrim(artifact.description);
    return {
      id: buildEvidenceId('EV-ART', startIndex + index),
      kind: summary.match(NEGATIVE_SIGNAL_PATTERN) ? 'boundary' : 'supporting',
      sourceType: 'artifact',
      sourcePath: artifact.path,
      studyId: study.studyId,
      summary,
      rationale: `Promoted candidate artifact from ${study.studyId}.`,
      claimStrength: detectClaimStrength(summary),
      tags: inferEvidenceTags(`${artifact.description} ${artifact.schema}`),
    };
  });
}

async function harvestConcludeEvidence(result: ConcludePreflightResult): Promise<ConcludeEvidenceItem[]> {
  const evidence: ConcludeEvidenceItem[] = [];
  let evidenceIndex = 1;

  for (const study of result.snapshot.studies) {
    const studySummary = summarizeStudyRecord(study);
    evidence.push({
      id: buildEvidenceId('EV-STUDY', evidenceIndex++),
      kind: inferEvidenceKindFromStudy(study, studySummary),
      sourceType: 'study',
      sourcePath: study.relativePath,
      studyId: study.studyId,
      summary: studySummary,
      rationale: `Study-level summary harvested from ${study.studyId}.`,
      claimStrength: detectClaimStrength(studySummary),
      tags: inferEvidenceTags(studySummary),
    });

    for (const task of study.tasks) {
      const taskStatus = task.record.status ?? 'pending';
      if (taskStatus === 'pending' || taskStatus === 'running') {
        continue;
      }
      const taskSummary = sentenceCaseTrim(`${task.record.goal}. ${task.record.result_summary ?? summarizeFirstMeaningfulLine(task.body, task.record.goal)}`);
      evidence.push({
        id: buildEvidenceId('EV-TASK', evidenceIndex++),
        kind: taskStatus === 'blocked' ? 'negative' : NEGATIVE_SIGNAL_PATTERN.test(taskSummary) ? 'boundary' : 'supporting',
        sourceType: 'task',
        sourcePath: task.relativePath,
        studyId: study.studyId,
        summary: taskSummary,
        rationale: `Task-level execution signal from ${task.taskId}.`,
        claimStrength: detectClaimStrength(taskSummary),
        tags: inferEvidenceTags(taskSummary),
      });
    }

    const artifactEvidence = await readArtifactEvidence(result.projectRoot, study, evidenceIndex);
    evidence.push(...artifactEvidence);
    evidenceIndex += artifactEvidence.length;
  }

  for (const memory of result.snapshot.studyMemories) {
    const summary = summarizeFirstMeaningfulLine(memory.content, 'Study memory captured without an explicit summary line.');
    evidence.push({
      id: buildEvidenceId('EV-MEM', evidenceIndex++),
      kind: NEGATIVE_SIGNAL_PATTERN.test(summary) ? 'boundary' : 'supporting',
      sourceType: 'memory',
      sourcePath: memory.relativePath,
      studyId: memory.studyId,
      summary,
      rationale: 'Recent study memory can preserve bounded interpretation and negative observations.',
      claimStrength: detectClaimStrength(summary),
      tags: inferEvidenceTags(summary),
    });
  }

  if (result.snapshot.evolution) {
    for (const studyEvent of result.snapshot.evolution.studies) {
      const summary = sentenceCaseTrim(
        `${studyEvent.question}. kind ${studyEvent.kind}. ${studyEvent.resolves.length > 0 ? `resolves ${studyEvent.resolves.join(', ')}` : ''} ${studyEvent.opens.length > 0 ? `opens ${studyEvent.opens.join(', ')}` : ''}`
      );
      evidence.push({
        id: buildEvidenceId('EV-EVO', evidenceIndex++),
        kind: studyEvent.kind === 'dissolution' ? 'negative' : studyEvent.opens.length > 0 ? 'boundary' : 'supporting',
        sourceType: 'evolution',
        sourcePath: PATHS.evolution,
        studyId: studyEvent.id,
        summary,
        rationale: 'Evolution trail shows whether the project converged, narrowed, or dissolved a hypothesis.',
        claimStrength: detectClaimStrength(summary),
        tags: inferEvidenceTags(summary),
      });
    }
  }

  if (result.snapshot.resourcesMarkdown) {
    const summary = summarizeFirstMeaningfulLine(result.snapshot.resourcesMarkdown, 'Project resource summary available.');
    evidence.push({
      id: buildEvidenceId('EV-RES', evidenceIndex++),
      kind: 'boundary',
      sourceType: 'resource',
      sourcePath: PATHS.contextResources,
      studyId: null,
      summary,
      rationale: 'Project resources give context and constraints but are not direct results evidence.',
      claimStrength: 'bounded',
      tags: inferEvidenceTags(summary),
    });
  }

  if (result.snapshot.artifactIndex) {
    for (const artifact of result.snapshot.artifactIndex.artifacts) {
      evidence.push({
        id: buildEvidenceId('EV-IDX', evidenceIndex++),
        kind: NEGATIVE_SIGNAL_PATTERN.test(artifact.description) ? 'boundary' : 'supporting',
        sourceType: 'artifact',
        sourcePath: artifact.path,
        studyId: artifact.produced_by.split('/')[0] || null,
        summary: sentenceCaseTrim(artifact.description),
        rationale: `Registered artifact ${artifact.id} is authoritative reusable project evidence.`,
        claimStrength: detectClaimStrength(artifact.description),
        tags: inferEvidenceTags(`${artifact.description} ${artifact.schema}`),
      });
    }
  }

  return evidence;
}

function collectClaimSafetyAudit(evidence: ConcludeEvidenceItem[]): ConcludeClaimSafetyAuditEntry[] {
  return evidence.map((item) => buildClaimSafetyAuditEntry(item.summary, item.claimStrength));
}

function buildCandidateNarrative(
  framing: ConcludeStoryFraming,
  supporting: ConcludeEvidenceItem[],
  negatives: ConcludeEvidenceItem[],
  contract: ResearchContract | null
): { centralClaim: string; story: string; claimsAllowed: string[]; claimsToSoftenOrAvoid: string[] } {
  const topSupporting = supporting.slice(0, 3);
  const topNegative = negatives.slice(0, 2);
  const primarySummary = topSupporting[0]?.summary ?? 'The available QDD evidence supports a bounded synthesis-ready story.';
  const thematicScope = contract?.theme ? `within the project theme "${contract.theme}"` : 'within the current QDD project scope';

  if (framing === 'audit-report') {
    return {
      centralClaim: `The current evidence package ${thematicScope} supports an auditable, bounded conclusion rather than a broad mechanistic claim.`,
      story: `Frame the manuscript as an evidence audit: show what reproducible signals exist, what negative or blocked studies constrained interpretation, and why the final claim should stay bounded. Lead with ${primarySummary.toLowerCase()} and explicitly surface ${topNegative.map((item) => item.summary).join('; ') || 'the current boundary evidence'}.`,
      claimsAllowed: [
        'The project converged on a bounded interpretation supported by reusable internal evidence.',
        'Negative and blocked studies narrowed the final claim and improved reviewer-facing honesty.',
      ],
      claimsToSoftenOrAvoid: [
        'Avoid discovery-first or mechanism-first verbs unless an intervention or functional validation is present.',
        'Avoid implying that missing evidence is merely future work if it is currently central to the claim.',
      ],
    };
  }

  if (framing === 'method') {
    return {
      centralClaim: `The strongest manuscript story ${thematicScope} is methodological: the QDD workflow and evidence packaging produce a reproducible, bounded result package.`,
      story: `Lead with workflow reliability and reusable outputs, then show how the biological interpretation remains intentionally bounded. Use ${topSupporting.map((item) => item.summary).join('; ')} as the validation arc, while keeping ${topNegative.map((item) => item.summary).join('; ') || 'claim limits'} visible as scope boundaries.`,
      claimsAllowed: [
        'The workflow produced reusable scripts, reports, or figures that support project-level synthesis.',
        'The biological interpretation should remain bounded to the observed evidence package.',
      ],
      claimsToSoftenOrAvoid: [
        'Avoid claiming that the workflow proves biological mechanism.',
        'Avoid overgeneralizing from one project slice to all future datasets.',
      ],
    };
  }

  if (framing === 'bounded-hypothesis') {
    return {
      centralClaim: `The available evidence ${thematicScope} supports a bounded biological hypothesis with associative, not mechanistic, wording.`,
      story: `Present a conservative biological arc anchored by ${topSupporting.map((item) => item.summary).join('; ')}. Then explain how ${topNegative.map((item) => item.summary).join('; ') || 'the current boundary evidence'} prevents stronger causal language. This keeps the narrative readable while staying claim-safe.`,
      claimsAllowed: [
        'Use association or candidate-state language for the central biological signal.',
        'State that the evidence narrows the hypothesis frontier instead of proving mechanism.',
      ],
      claimsToSoftenOrAvoid: [
        'Avoid verbs such as drives, defines, proves, or establishes mechanism.',
        'Avoid presenting proxy or correlation evidence as causal validation.',
      ],
    };
  }

  return {
    centralClaim: `The evidence package ${thematicScope} supports a coherent project story grounded in reusable internal results and explicit boundaries.`,
    story: `Build the story around ${topSupporting.map((item) => item.summary).join('; ')}. Keep the Results arc focused on evidence QDD actually produced, then use ${topNegative.map((item) => item.summary).join('; ') || 'boundary evidence'} to define the limits of interpretation.`,
    claimsAllowed: [
      'The evidence package supports a coherent and bounded manuscript story.',
      'Project evolution and reusable artifacts reinforce the final narrative arc.',
    ],
    claimsToSoftenOrAvoid: [
      'Avoid broad novelty claims that are not grounded in internal evidence.',
      'Avoid hiding failed or blocked studies when they explain claim boundaries.',
    ],
  };
}

function selectCandidateEvidence(
  evidence: ConcludeEvidenceItem[],
  mode: 'balanced' | 'audit-heavy' | 'method-heavy'
): { supporting: ConcludeEvidenceItem[]; negatives: ConcludeEvidenceItem[] } {
  const supporting = evidence.filter((item) => item.kind === 'supporting');
  const negatives = evidence.filter((item) => item.kind !== 'supporting');

  if (mode === 'audit-heavy') {
    return {
      supporting: supporting.slice(0, 2),
      negatives: negatives.slice(0, 4),
    };
  }

  if (mode === 'method-heavy') {
    return {
      supporting: supporting.filter((item) => item.tags.includes('method')).concat(supporting.filter((item) => !item.tags.includes('method'))).slice(0, 3),
      negatives: negatives.slice(0, 2),
    };
  }

  return {
    supporting: supporting.slice(0, 4),
    negatives: negatives.slice(0, 3),
  };
}

function buildStoryCandidates(
  evidence: ConcludeEvidenceItem[],
  contract: ResearchContract | null
): ConcludeStoryCandidate[] {
  const modes: Array<{ id: string; mode: 'balanced' | 'audit-heavy' | 'method-heavy'; framing: ConcludeStoryFraming }> = [
    { id: 'story-1', mode: 'balanced', framing: evidence.some((item) => item.claimStrength === 'associative') ? 'bounded-hypothesis' : 'discovery' },
    { id: 'story-2', mode: 'audit-heavy', framing: 'audit-report' },
    { id: 'story-3', mode: 'method-heavy', framing: 'method' },
  ];

  return modes.map(({ id, mode, framing }) => {
    const { supporting, negatives } = selectCandidateEvidence(evidence, mode);
    const narrative = buildCandidateNarrative(framing, supporting, negatives, contract);
    const relevantClaims = [...supporting, ...negatives].map((item) => buildClaimSafetyAuditEntry(item.summary, item.claimStrength));

    return {
      id,
      framing,
      centralClaim: narrative.centralClaim,
      story: narrative.story,
      supportingEvidence: supporting,
      negativeOrBoundaryEvidence: negatives,
      reviewerObjections: buildReviewerObjections(framing, supporting, negatives),
      claimsAllowed: uniqueStrings(narrative.claimsAllowed),
      claimsToSoftenOrAvoid: uniqueStrings([
        ...narrative.claimsToSoftenOrAvoid,
        ...relevantClaims.filter((entry) => entry.action !== 'allow').map((entry) => `${entry.claim} (${entry.action})`),
      ]),
      suitabilityScore: scoreStoryCandidate(framing, supporting, negatives, relevantClaims),
      recommendedTitleStyle: TITLE_STYLE_BY_FRAMING[framing],
    };
  });
}

function renderStoryCandidatesMarkdown(result: ConcludeStoryGenerationResult): string {
  const lines: string[] = [
    '# Story Candidates',
    '',
    `- Run ID: ${result.runId}`,
    '- Selection gate: STOP here until a human selects one story candidate.',
    '- V1 behavior: do not auto-select the highest score and do not generate manuscript planning artifacts yet.',
    '',
  ];

  for (const candidate of result.candidates) {
    lines.push(`## ${candidate.id}`);
    lines.push('');
    lines.push(`- Framing: ${candidate.framing}`);
    lines.push(`- Suitability score: ${candidate.suitabilityScore}/100`);
    lines.push(`- Recommended title style: ${candidate.recommendedTitleStyle}`);
    lines.push('');
    lines.push('### Central Claim');
    lines.push('');
    lines.push(candidate.centralClaim);
    lines.push('');
    lines.push('### Story');
    lines.push('');
    lines.push(candidate.story);
    lines.push('');
    lines.push('### Supporting Evidence');
    lines.push('');
    lines.push(...formatEvidenceReferences(candidate.supportingEvidence));
    lines.push('');
    lines.push('### Negative Or Boundary Evidence');
    lines.push('');
    lines.push(...formatEvidenceReferences(candidate.negativeOrBoundaryEvidence));
    lines.push('');
    lines.push('### Reviewer Objections');
    lines.push('');
    lines.push(...candidate.reviewerObjections.map((value) => `- ${value}`));
    lines.push('');
    lines.push('### Claims Allowed');
    lines.push('');
    lines.push(...candidate.claimsAllowed.map((value) => `- ${value}`));
    lines.push('');
    lines.push('### Claims To Soften Or Avoid');
    lines.push('');
    lines.push(...candidate.claimsToSoftenOrAvoid.map((value) => `- ${value}`));
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function renderEvidenceAuditMarkdown(evidence: ConcludeEvidenceItem[]): string {
  return [
    '# Evidence Audit',
    '',
    ...evidence.map(formatEvidenceLine),
    '',
  ].join('\n');
}

function renderClaimSafetyAuditMarkdown(audit: ConcludeClaimSafetyAuditEntry[]): string {
  return [
    '# Claim Safety Audit',
    '',
    ...audit.map((entry) => `- ${entry.action.toUpperCase()}: ${entry.claim} (from ${entry.originalStrength} to ${entry.safeStrength}) - ${entry.rationale}`),
    '',
  ].join('\n');
}

function renderReviewerRiskAuditMarkdown(candidates: ConcludeStoryCandidate[]): string {
  const lines: string[] = ['# Reviewer Risk Audit', ''];
  for (const candidate of candidates) {
    lines.push(`## ${candidate.id}`);
    lines.push('');
    lines.push(...candidate.reviewerObjections.map((objection) => `- ${objection}`));
    lines.push('');
  }
  return lines.join('\n');
}

async function writeConcludeStoryOutputs(result: ConcludeStoryGenerationResult): Promise<void> {
  await FileSystemUtils.createDirectory(result.outputDir);
  await Promise.all([
    FileSystemUtils.writeFile(path.join(result.outputDir, 'story_candidates.md'), renderStoryCandidatesMarkdown(result)),
    FileSystemUtils.writeFile(path.join(result.outputDir, 'evidence_audit.md'), renderEvidenceAuditMarkdown(result.evidence)),
    FileSystemUtils.writeFile(path.join(result.outputDir, 'claim_safety_audit.md'), renderClaimSafetyAuditMarkdown(result.claimSafetyAudit)),
    FileSystemUtils.writeFile(path.join(result.outputDir, 'reviewer_risk_audit.md'), renderReviewerRiskAuditMarkdown(result.candidates)),
  ]);
}

function resolveConcludeOutputDir(projectRoot: string, outputDir: string | undefined, runId: string): string {
  const requested = outputDir?.trim();
  if (!requested) {
    return path.join(projectRoot, 'conclusions', runId);
  }

  const normalizedRelative = normalizeRelativePath(requested);
  const absoluteOutputDir = path.resolve(projectRoot, normalizedRelative);
  const relativeToProject = normalizeRelativePath(path.relative(projectRoot, absoluteOutputDir));
  if (relativeToProject.startsWith('..') || path.isAbsolute(relativeToProject)) {
    throw new Error('Conclude output directory must stay within the current QDD project directory.');
  }
  return absoluteOutputDir;
}

export async function generateConcludeStoryCandidates(
  projectRoot: string,
  options: GenerateConcludeStoryCandidatesOptions = {}
): Promise<ConcludeStoryGenerationResult> {
  const preflight = await inspectConcludePreflight(projectRoot, options);
  if (preflight.projectStatus === 'blocked') {
    throw new Error(`Conclude preflight is blocked: ${preflight.projectBlockers.join(' ')}`);
  }

  if (options.selectedStoryId) {
    throw new Error('V1 selection gate only generates story candidates. Do not pass selectedStoryId before manuscript drafting is implemented.');
  }

  const evidence = await harvestConcludeEvidence(preflight);
  const candidates = buildStoryCandidates(evidence, preflight.snapshot.contract).slice(0, 3);
  const claimSafetyAudit = collectClaimSafetyAudit(evidence);
  const runId = options.runId ?? slugifyConcludeTimestamp(options.now ?? new Date());
  const outputDir = resolveConcludeOutputDir(preflight.projectRoot, options.outputDir, runId);

  const result: ConcludeStoryGenerationResult = {
    runId,
    outputDir,
    storyCandidatesPath: path.join(outputDir, 'story_candidates.md'),
    evidenceAuditPath: path.join(outputDir, 'evidence_audit.md'),
    claimSafetyAuditPath: path.join(outputDir, 'claim_safety_audit.md'),
    reviewerRiskAuditPath: path.join(outputDir, 'reviewer_risk_audit.md'),
    selectionRequired: true,
    selectedStoryId: null,
    candidates,
    evidence,
    claimSafetyAudit,
    nextStep: 'select-story',
  };

  await writeConcludeStoryOutputs(result);
  return result;
}

export async function runConclude(projectRoot: string, options: RunConcludeOptions = {}): Promise<RunConcludeResult> {
  const preflight = await inspectConcludePreflight(projectRoot, options);
  if (preflight.projectStatus === 'blocked') {
    throw new Error(`Conclude preflight is blocked: ${preflight.projectBlockers.join(' ')}`);
  }

  const baseResult = await generateConcludeStoryCandidates(projectRoot, options);
  const renderStatusPath = path.join(baseResult.outputDir, 'render_status.md');
  await FileSystemUtils.writeFile(renderStatusPath, renderConcludeRenderStatusMarkdown(preflight));

  return {
    ...baseResult,
    preflight,
    renderStatusPath,
  };
}

async function readStudyMemories(projectRoot: string, memoryPaths: string[]): Promise<ConcludeStudyMemorySnapshot[]> {
  return Promise.all(
    memoryPaths.map(async (relativePath) => {
      const content = await FileSystemUtils.readFile(path.join(projectRoot, relativePath));
      return {
        studyId: extractStudyIdFromMemory(content),
        relativePath,
        content,
      };
    })
  );
}

async function readStudyTasks(projectRoot: string, studyId: string): Promise<Array<{ taskId: string; relativePath: string; record: TaskRecord; body: string }>> {
  const tasksDir = path.join(projectRoot, PATHS.studiesDir, studyId, 'tasks');
  if (!(await FileSystemUtils.directoryExists(tasksDir))) {
    return [];
  }

  const entries = await fs.readdir(tasksDir, { withFileTypes: true });
  const taskFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    taskFiles.map(async (fileName) => {
      const taskId = fileName.replace(/\.md$/, '');
      const relativePath = `${PATHS.studiesDir}/${studyId}/tasks/${fileName}`;
      const document = await readMarkdownDocument<TaskRecord>(projectRoot, relativePath);
      return {
        taskId,
        relativePath,
        record: {
          ...document.frontmatter,
          task_id: document.frontmatter.task_id ?? taskId,
          study_id: document.frontmatter.study_id ?? studyId,
          expected_outputs: document.frontmatter.expected_outputs ?? [],
          depends_on: document.frontmatter.depends_on ?? [],
          skills: document.frontmatter.skills ?? [],
          artifact_ids: document.frontmatter.artifact_ids ?? [],
        },
        body: document.body,
      };
    })
  );
}

async function readStudySnapshots(projectRoot: string): Promise<ConcludeStudySnapshot[]> {
  const discoveredStudies = await discoverStudies(projectRoot);
  const sortedStudies = [...discoveredStudies].sort((left, right) => left.study_id.localeCompare(right.study_id));

  return Promise.all(
    sortedStudies.map(async (study) => {
      const relativePath = `${PATHS.studiesDir}/${study.study_id}/study.md`;
      const document = await readMarkdownDocument<StudyRecord>(projectRoot, relativePath);
      const outputDir = getStudyOutputDir(study.study_id);
      const outputDirExists = await FileSystemUtils.directoryExists(path.join(projectRoot, outputDir));
      const artifactCandidatesPath = getStudyArtifactCandidatesPath(study.study_id);
      const publicDataRequestPath = getStudyPublicDataRequestPath(study.study_id);

      return {
        studyId: study.study_id,
        relativePath,
        record: {
          ...document.frontmatter,
          study_id: document.frontmatter.study_id ?? study.study_id,
          target_boundaries: document.frontmatter.target_boundaries ?? [],
          task_ids: document.frontmatter.task_ids ?? [],
          blockers: document.frontmatter.blockers ?? [],
          expected_artifacts: document.frontmatter.expected_artifacts ?? [],
        },
        body: document.body,
        tasks: await readStudyTasks(projectRoot, study.study_id),
        outputDir,
        outputDirExists,
        artifactCandidatesPath: (await FileSystemUtils.fileExists(path.join(projectRoot, artifactCandidatesPath))) ? artifactCandidatesPath : null,
        publicDataRequestPath: (await FileSystemUtils.fileExists(path.join(projectRoot, publicDataRequestPath))) ? publicDataRequestPath : null,
      };
    })
  );
}

function toolMissingStatus(name: ConcludeRenderToolName): ConcludeRenderToolStatus {
  return {
    name,
    status: 'blocked',
    available: false,
    resolvedPath: null,
  };
}

async function detectExecutableWithShell(
  name: ConcludeRenderToolName,
  environment: NodeJS.ProcessEnv,
  shellPath: string
): Promise<ConcludeRenderToolStatus> {
  return new Promise((resolve) => {
    const child = spawn(shellPath, ['-c', `command -v ${name}`], {
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let settled = false;

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.on('error', () => {
      if (!settled) {
        settled = true;
        resolve(toolMissingStatus(name));
      }
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      const resolvedPath = stdout.trim() || null;
      const available = code === 0 && Boolean(resolvedPath);
      resolve({
        name,
        status: available ? 'available' : 'blocked',
        available,
        resolvedPath,
      });
    });
  });
}

async function detectRenderTools(
  environment: NodeJS.ProcessEnv,
  shellPath: string
): Promise<Record<ConcludeRenderToolName, ConcludeRenderToolStatus>> {
  const entries = await Promise.all(
    RENDER_TOOL_ORDER.map(async (toolName) => [toolName, await detectExecutableWithShell(toolName, environment, shellPath)] as const)
  );
  return Object.fromEntries(entries) as Record<ConcludeRenderToolName, ConcludeRenderToolStatus>;
}

function buildRenderTargetStatus(status: 'available' | 'blocked', reasons: string[], notes: string[]): ConcludeRenderTargetStatus {
  return {
    status,
    reasons,
    notes,
  };
}

function buildRenderStatus(tools: Record<ConcludeRenderToolName, ConcludeRenderToolStatus>): ConcludeRenderStatus {
  const pdfReasons: string[] = [];
  const pdfNotes: string[] = [];

  if (!tools.xelatex.available && !tools.pdflatex.available) {
    pdfReasons.push('Neither xelatex nor pdflatex is installed.');
  } else if (tools.xelatex.available) {
    pdfNotes.push(`PDF rendering can use xelatex at ${tools.xelatex.resolvedPath}.`);
  } else if (tools.pdflatex.available) {
    pdfNotes.push(`PDF rendering can fall back to pdflatex at ${tools.pdflatex.resolvedPath}.`);
  }
  if (tools.latexmk.available) {
    pdfNotes.push(`latexmk is available at ${tools.latexmk.resolvedPath}.`);
  } else {
    pdfNotes.push('latexmk is not installed; conclude should render PDF via the available TeX engine directly.');
  }

  const wordReasons = tools.pandoc.available ? [] : ['pandoc is not installed.'];
  const wordNotes = tools.pandoc.available ? [`Word rendering can use pandoc at ${tools.pandoc.resolvedPath}.`] : [];

  const pdf = buildRenderTargetStatus(pdfReasons.length === 0 ? 'available' : 'blocked', pdfReasons, pdfNotes);
  const word = buildRenderTargetStatus(wordReasons.length === 0 ? 'available' : 'blocked', wordReasons, wordNotes);

  const overallReasons = [...pdfReasons, ...wordReasons];
  const overallNotes = [
    pdf.status === 'available' ? 'PDF rendering is available in the current environment.' : 'PDF rendering is blocked in the current environment.',
    word.status === 'available' ? 'Word rendering is available in the current environment.' : 'Word rendering is blocked in the current environment.',
  ];

  return {
    status: overallReasons.length === 0 ? 'available' : 'blocked',
    reasons: overallReasons,
    notes: overallNotes,
    pdf,
    word,
    tools,
  };
}

function renderPathSummary(status: ConcludePathStatus): string {
  const countSuffix = typeof status.count === 'number' ? ` (${status.count})` : '';
  return `- ${status.path}: ${status.status.toUpperCase()}${countSuffix} - ${status.details}`;
}

export function renderConcludeRenderStatusMarkdown(result: ConcludePreflightResult): string {
  const render = result.render;
  return [
    '# Render Status',
    '',
    `- Overall status: ${render.status.toUpperCase()}`,
    `- Project preflight: ${result.projectStatus.toUpperCase()}`,
    '',
    '## QDD Preflight',
    '',
    renderPathSummary(result.checkedPaths.contract),
    renderPathSummary(result.checkedPaths.evolution),
    renderPathSummary(result.checkedPaths.resources),
    renderPathSummary(result.checkedPaths.memory),
    renderPathSummary(result.checkedPaths.artifactIndex),
    renderPathSummary(result.checkedPaths.studies),
    '',
    '## Rendering Targets',
    '',
    `- PDF: ${render.pdf.status.toUpperCase()}${render.pdf.reasons.length > 0 ? ` - ${render.pdf.reasons.join(' ')}` : ''}`,
    `- Word: ${render.word.status.toUpperCase()}${render.word.reasons.length > 0 ? ` - ${render.word.reasons.join(' ')}` : ''}`,
    '',
    '## Tool Detection',
    '',
    ...RENDER_TOOL_ORDER.map((toolName) => {
      const tool = render.tools[toolName];
      const suffix = tool.resolvedPath ? ` (${tool.resolvedPath})` : '';
      return `- ${tool.name}: ${tool.status.toUpperCase()}${suffix}`;
    }),
    '',
    ...(result.projectBlockers.length > 0
      ? [
          '## Blockers',
          '',
          ...result.projectBlockers.map((reason) => `- ${reason}`),
          '',
        ]
      : []),
    ...(result.warnings.length > 0
      ? [
          '## Warnings',
          '',
          ...result.warnings.map((warning) => `- ${warning}`),
          '',
        ]
      : []),
  ].join('\n');
}

export async function inspectConcludePreflight(projectRoot: string, options: ConcludePreflightOptions = {}): Promise<ConcludePreflightResult> {
  const environment = options.environment ?? process.env;
  const shellPath = options.shellPath ?? 'bash';
  const projectIsQddRoot = await isQddProjectRoot(projectRoot);
  const projectBlockers: string[] = [];
  const warnings: string[] = [];

  const contractPath = path.join(projectRoot, PATHS.contract);
  const evolutionPath = path.join(projectRoot, PATHS.evolution);
  const resourcesPath = path.join(projectRoot, PATHS.contextResources);
  const memoryDir = path.join(projectRoot, PATHS.contextMemoryDir);
  const artifactIndexPath = path.join(projectRoot, PATHS.artifactIndex);
  const studiesDir = path.join(projectRoot, PATHS.studiesDir);

  const hasContract = await FileSystemUtils.fileExists(contractPath);
  const hasEvolution = await FileSystemUtils.fileExists(evolutionPath);
  const hasResources = await FileSystemUtils.fileExists(resourcesPath);
  const hasMemoryDir = await FileSystemUtils.directoryExists(memoryDir);
  const hasArtifactIndex = await FileSystemUtils.fileExists(artifactIndexPath);
  const hasStudiesDir = await FileSystemUtils.directoryExists(studiesDir);

  if (!hasContract) {
    projectBlockers.push(`Missing required conclude input '${PATHS.contract}'.`);
  }
  if (!hasEvolution) {
    projectBlockers.push(`Missing required conclude input '${PATHS.evolution}'.`);
  }
  if (!hasResources) {
    projectBlockers.push(`Missing required conclude input '${PATHS.contextResources}'.`);
  }
  if (!hasMemoryDir) {
    projectBlockers.push(`Missing required conclude directory '${PATHS.contextMemoryDir}'.`);
  }
  if (!hasArtifactIndex) {
    projectBlockers.push(`Missing required conclude input '${PATHS.artifactIndex}'.`);
  }
  if (!hasStudiesDir) {
    projectBlockers.push(`Missing required conclude directory '${PATHS.studiesDir}'.`);
  }
  if (!projectIsQddRoot) {
    warnings.push(`Current directory is missing standard QDD root markers such as '${PATHS.contract}' or '${PATHS.qddDir}'.`);
  }

  let contract: ResearchContract | null = null;
  let evolution: EvolutionState | null = null;
  let resourcesMarkdown: string | null = null;
  let artifactIndex: ArtifactIndex | null = null;
  let studyMemories: ConcludeStudyMemorySnapshot[] = [];
  let studies: ConcludeStudySnapshot[] = [];

  try {
    if (hasContract) {
      contract = await readYamlFile<ResearchContract>(projectRoot, PATHS.contract);
    }
  } catch (error) {
    projectBlockers.push(`Failed to read '${PATHS.contract}': ${(error as Error).message}`);
  }

  try {
    if (hasEvolution) {
      evolution = await readEvolutionState(projectRoot);
    }
  } catch (error) {
    projectBlockers.push(`Failed to read '${PATHS.evolution}': ${(error as Error).message}`);
  }

  try {
    if (hasResources) {
      resourcesMarkdown = await FileSystemUtils.readFile(resourcesPath);
    }
  } catch (error) {
    projectBlockers.push(`Failed to read '${PATHS.contextResources}': ${(error as Error).message}`);
  }

  try {
    if (hasArtifactIndex) {
      artifactIndex = await readYamlFile<ArtifactIndex>(projectRoot, PATHS.artifactIndex);
    }
  } catch (error) {
    projectBlockers.push(`Failed to read '${PATHS.artifactIndex}': ${(error as Error).message}`);
  }

  let memoryPaths: string[] = [];
  if (hasMemoryDir) {
    try {
      memoryPaths = await listStudyMemoryPaths(projectRoot);
      studyMemories = await readStudyMemories(projectRoot, memoryPaths);
    } catch (error) {
      projectBlockers.push(`Failed to read '${PATHS.contextMemoryDir}': ${(error as Error).message}`);
    }
  }

  if (hasMemoryDir && memoryPaths.length === 0) {
    warnings.push(`No study memory files were found under '${PATHS.contextMemoryDir}'.`);
  }

  if (hasStudiesDir) {
    try {
      studies = await readStudySnapshots(projectRoot);
    } catch (error) {
      projectBlockers.push(`Failed to read '${PATHS.studiesDir}': ${(error as Error).message}`);
    }
  }

  if (hasStudiesDir && studies.length === 0) {
    warnings.push(`No study records were found under '${PATHS.studiesDir}'.`);
  }

  for (const study of studies) {
    if (!study.outputDirExists) {
      warnings.push(`Study '${study.studyId}' is missing its output directory '${study.outputDir}'.`);
    }
  }

  const checkedPaths = {
    contract: buildPathStatus({
      path: PATHS.contract,
      kind: 'file',
      required: true,
      available: hasContract,
      details: hasContract ? 'Research contract is present.' : 'Research contract is missing.',
    }),
    evolution: buildPathStatus({
      path: PATHS.evolution,
      kind: 'file',
      required: true,
      available: hasEvolution,
      details: hasEvolution ? 'Evolution state is present.' : 'Evolution state is missing.',
    }),
    resources: buildPathStatus({
      path: PATHS.contextResources,
      kind: 'file',
      required: true,
      available: hasResources,
      details: hasResources ? 'Durable project resources are present.' : 'Durable project resources are missing.',
    }),
    memory: buildPathStatus({
      path: PATHS.contextMemoryDir,
      kind: 'collection',
      required: true,
      available: hasMemoryDir,
      details: hasMemoryDir ? 'Study memory directory is present.' : 'Study memory directory is missing.',
      count: studyMemories.length,
    }),
    artifactIndex: buildPathStatus({
      path: PATHS.artifactIndex,
      kind: 'file',
      required: true,
      available: hasArtifactIndex,
      details: hasArtifactIndex ? 'Artifact index is present.' : 'Artifact index is missing.',
    }),
    studies: buildPathStatus({
      path: PATHS.studiesDir,
      kind: 'collection',
      required: true,
      available: hasStudiesDir,
      details: hasStudiesDir ? 'Study directory is present.' : 'Study directory is missing.',
      count: studies.length,
    }),
  };

  const renderTools = await detectRenderTools(environment, shellPath);
  const render = buildRenderStatus(renderTools);

  return {
    projectRoot: path.resolve(projectRoot),
    qddProjectRoot: projectIsQddRoot,
    projectStatus: projectBlockers.length === 0 ? 'available' : 'blocked',
    projectBlockers,
    warnings,
    checkedPaths,
    snapshot: {
      contract,
      evolution,
      resourcesMarkdown,
      artifactIndex,
      studyMemories,
      studies,
    },
    render,
  };
}
