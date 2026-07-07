import path from 'node:path';
import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type {
  ArtifactIndex,
  ConcludeClaimSafetyAuditEntry,
  ConcludeDraftArtifactStatus,
  ConcludeEvidenceFocus,
  ConcludeClaimStrength,
  ConcludeEvidenceItem,
  ConcludeEvidencePacket,
  ConcludeExternalCitationEntry,
  ConcludeFigureAssetMapEntry,
  ConcludeFinalArtifactStatus,
  ConcludeFinalPaperArtifactPaths,
  ConcludeFinalPaperPackage,
  ConcludePathStatus,
  ConcludePlanningArtifactPaths,
  ConcludePreflightOptions,
  ConcludePreflightResult,
  ConcludeRenderStatus,
  ConcludeRenderTargetStatus,
  ConcludeRenderToolName,
  ConcludeRenderToolStatus,
  ConcludeResultsClaim,
  ConcludeStoryCandidate,
  ConcludeStoryClaimBundleEntry,
  ConcludeStoryFraming,
  ConcludeStoryGenerationResult,
  ConcludeStudyMemorySnapshot,
  ConcludeStudySnapshot,
  ConcludeTaskSnapshot,
  EvolutionState,
  GenerateConcludeStoryCandidatesOptions,
  ResearchContract,
  RunConcludeOptions,
  RunConcludeResult,
  StudyRecord,
  TaskRecord,
} from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { parseYaml } from '../utils/yaml.js';
import { PATHS } from '../runtime/constants.js';
import { discoverStudies } from '../runtime/discovery.js';
import { getStudyArtifactCandidatesPath, getStudyOutputDir, getStudyPublicDataRequestPath, readArtifactCandidateManifest } from '../runtime/evidence.js';
import { listStudyMemoryPaths, readEvolutionState } from '../runtime/evolution.js';
import { isQddProjectRoot } from '../runtime/paths.js';
import { readMarkdownDocument, readYamlFile, serializeMarkdownDocument } from '../runtime/store.js';

const FRONTMATTER_STUDY_ID_PATTERN = /^#\s*(STUDY-\d{3})\s+Memory\b/m;
const RENDER_TOOL_ORDER: ConcludeRenderToolName[] = ['latexmk', 'xelatex', 'pdflatex', 'pandoc'];
const ASSOCIATIVE_SIGNAL_PATTERN = /\b(associate|associated|association|correlate|correlated|correlation|candidate state|candidate marker|proxy|trend)\b/i;
const CAUSAL_SIGNAL_PATTERN = /\b(driver|drives|cause|causal|mechanism|mechanistic|proof|prove|proves|define|defines|defined|effect)\b/i;
const NEGATIVE_SIGNAL_PATTERN = /\b(block|blocked|negative|failed|failure|dissolv|downgrad|avoid|limit|boundary)\b/i;
const SELECTED_STORY_FIELD_PATTERN = /\bselected(?:[_ -]?story)?[_ -]?id\b\s*[:=]\s*(story-\d+)\b/i;
const STORY_ID_PATTERN = /\b(story-\d+)\b/i;
const MARKDOWN_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const BIBTEX_ENTRY_PATTERN = /@\s*([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,[\s\S]*?\n\}/g;
const TITLE_STYLE_BY_FRAMING: Record<ConcludeStoryFraming, string> = {
  discovery: 'Discovery-first with bounded biological scope',
  method: 'Method-forward with validation framing',
  'case-study': 'Case-study framing with project-grounded lessons',
  benchmark: 'Benchmark framing with explicit comparison criteria',
  'audit-report': 'Audit-report framing centered on evidence quality and limits',
  'bounded-hypothesis': 'Hypothesis-bounded framing with conservative verbs',
};
const CONCLUDE_SELECTED_STORY_KIND = 'qdd-conclude-selected-story';
const CONCLUDE_SELECTED_STORY_VERSION = 1;

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

function normalizeTextValue(value: unknown): string {
  if (typeof value === 'string') {
    return sentenceCaseTrim(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return sentenceCaseTrim(value.map((entry) => normalizeTextValue(entry)).filter((entry) => entry.length > 0).join(', '));
  }
  if (typeof value === 'object') {
    return sentenceCaseTrim(JSON.stringify(value));
  }
  return sentenceCaseTrim(String(value));
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
}

function resolveProjectLocalPath(projectRoot: string, targetPath: string, label: string): string {
  const absoluteTargetPath = path.isAbsolute(targetPath) ? path.resolve(targetPath) : path.resolve(projectRoot, targetPath);
  const relativeToProject = path.relative(projectRoot, absoluteTargetPath);
  if (relativeToProject.startsWith('..') || path.isAbsolute(relativeToProject)) {
    throw new Error(`${label} must stay within the current QDD project directory.`);
  }
  return absoluteTargetPath;
}

function toProjectRelativePath(projectRoot: string, absolutePath: string): string {
  const relativePath = normalizeRelativePath(path.relative(projectRoot, absolutePath));
  return relativePath.length > 0 ? relativePath : '.';
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

function normalizeMarkdownSummaryLine(line: string): string {
  return stripExecutionLeakage(
    line
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+\.\s+/, '')
      .replace(/^\s*\[[ xX]\]\s+/, '')
      .replace(/^\s*>\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
  );
}

function extractMarkdownSection(content: string, heading: string, level = 2): string | null {
  const lines = content.split('\n');
  const expectedPrefix = `${'#'.repeat(level)} `;
  let start = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith(expectedPrefix)) {
      continue;
    }
    const currentHeading = sentenceCaseTrim(line.slice(expectedPrefix.length));
    if (currentHeading.toLowerCase() === heading.toLowerCase()) {
      start = index + 1;
      break;
    }
  }

  if (start < 0) {
    return null;
  }

  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^#{1,6}\s+/.test(line)) {
      end = index;
      break;
    }
  }

  const section = lines.slice(start, end).join('\n').trim();
  return section.length > 0 ? section : null;
}

function collectMarkdownSummaryCandidates(content: string): string[] {
  const candidates: string[] = [];

  for (const rawLine of content.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      continue;
    }
    if (/^\|/.test(trimmed) || /^[\s|:-]+$/.test(trimmed)) {
      continue;
    }
    const normalized = normalizeMarkdownSummaryLine(trimmed);
    if (!normalized) {
      continue;
    }
    candidates.push(normalized);
  }

  return uniqueNonEmpty(candidates);
}

function summarizeMarkdownSection(
  content: string | null,
  options: {
    maxLines?: number;
    prioritizedPatterns?: RegExp[];
  } = {}
): string {
  if (!content) {
    return '';
  }

  const candidates = collectMarkdownSummaryCandidates(content);
  if (candidates.length === 0) {
    return '';
  }

  const prioritizedPatterns = options.prioritizedPatterns ?? [
    /\b(significant|validated|confirm|confirmed|detected|enriched|generated|produced|resolved|blocked|not feasible|limitation|supports?|supporting|coherent|available|usable|compatible)\b/i,
  ];
  const prioritized = candidates.filter((candidate) => prioritizedPatterns.some((pattern) => pattern.test(candidate)));
  const ordered = uniqueNonEmpty([...prioritized, ...candidates]);
  return ordered.slice(0, options.maxLines ?? 2).join(' ');
}

function convertGoalToOutcome(goal: string): string {
  return sentenceCaseTrim(
    goal
      .replace(/^Download\b/i, 'Downloaded')
      .replace(/^Perform\b/i, 'Performed')
      .replace(/^Quantify\b/i, 'Quantified')
      .replace(/^Characterize\b/i, 'Characterized')
      .replace(/^Set up\b/i, 'Set up')
      .replace(/^Summarize\b/i, 'Summarized')
      .replace(/^Capture\b/i, 'Captured')
      .replace(/^Record\b/i, 'Recorded')
      .replace(/^Test\b/i, 'Tested')
      .replace(/^Map\b/i, 'Mapped')
      .replace(/^Integrate\b/i, 'Integrated')
      .replace(/^Synthesize\b/i, 'Synthesized')
      .replace(/^Build\b/i, 'Built')
      .replace(/^Assess\b/i, 'Assessed')
      .replace(/^Validate\b/i, 'Validated')
  );
}

function summarizeFirstMeaningfulLine(content: string, fallback: string): string {
  const line = splitBulletLikeLines(content).find((candidate) => !candidate.startsWith('#') && !candidate.startsWith('##'));
  return sentenceCaseTrim(line ?? fallback);
}

function stripExecutionLeakage(text: string): string {
  return sentenceCaseTrim(
    text
      .replace(/\*\*(TASK|STUDY|ART)-\d+\*\*:?\s*/gi, '')
      .replace(/\b(TASK|STUDY|ART)-\d+\b/gi, '')
      .replace(/\bB\d{3}\b/gi, '')
      .replace(/\bstatus\s+(created|confirmed|running|blocked|completed|closed)\b/gi, '')
      .replace(/\bexpected_artifacts?\b/gi, '')
      .replace(/\bNone\.\s*/g, '')
      .replace(/`/g, '')
      .replace(/\*\*/g, '')
      .replace(/✓/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\.\s*\./g, '. ')
  );
}

function lowerCaseLead(text: string): string {
  return text.length > 0 ? `${text.slice(0, 1).toLowerCase()}${text.slice(1)}` : text;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => sentenceCaseTrim(value)).filter((value) => value.length > 0))];
}

function buildStudyEvidenceSummary(study: ConcludeStudySnapshot): string {
  const verdictSummary = summarizeMarkdownSection(extractMarkdownSection(study.body, 'Study Verdict'), {
    maxLines: 2,
    prioritizedPatterns: [
      /\b(validated|blocked|not possible|not feasible|resolved|supported|judgeable|complete)\b/i,
    ],
  });
  const keyFindingsSummary = summarizeMarkdownSection(extractMarkdownSection(study.body, 'Key Findings'), {
    maxLines: 2,
  });
  const question = stripExecutionLeakage(normalizeTextValue(study.record.question));
  const hypothesis = stripExecutionLeakage(normalizeTextValue(study.record.hypothesis));
  const blockers = uniqueNonEmpty((study.record.blockers ?? []).map((value) => stripExecutionLeakage(normalizeTextValue(value))));
  const status = study.record.status ?? 'created';
  const bodySummary = verdictSummary || keyFindingsSummary;

  if (status === 'blocked' || blockers.length > 0) {
    const boundary = bodySummary || blockers[0] || 'key follow-up validation remains unavailable';
    return sentenceCaseTrim(`Boundary evidence remains visible because ${lowerCaseLead(boundary)}.`);
  }

  if (bodySummary.length > 0) {
    return bodySummary;
  }

  if (hypothesis.length > 0) {
    return sentenceCaseTrim(`The study contributes a bounded result around ${lowerCaseLead(question)} and keeps the working interpretation at ${lowerCaseLead(hypothesis)}.`);
  }

  return sentenceCaseTrim(`The study contributes reusable internal evidence for manuscript drafting around ${lowerCaseLead(question)}.`);
}

function buildTaskEvidenceSummary(task: ConcludeTaskSnapshot): string {
  const goal = stripExecutionLeakage(normalizeTextValue(task.record.goal));
  const resultSummary = stripExecutionLeakage(normalizeTextValue(task.record.result_summary));
  const resultSectionSummary = summarizeMarkdownSection(extractMarkdownSection(task.body, 'Result Summary'), {
    maxLines: 2,
    prioritizedPatterns: [
      /\b(significant|validated|confirmed|detected|enriched|generated|produced|blocked|not feasible|usable|available|compatible)\b/i,
    ],
  });
  const bodySummary = resultSectionSummary || stripExecutionLeakage(summarizeFirstMeaningfulLine(task.body, goal));
  const status = task.record.status ?? 'pending';

  if (status === 'blocked') {
    const boundary = resultSummary || bodySummary || convertGoalToOutcome(goal);
    return sentenceCaseTrim(`Follow-up validation remained incomplete: ${lowerCaseLead(boundary)}.`);
  }

  if (resultSummary.length > 0) {
    return sentenceCaseTrim(resultSummary);
  }

  if (bodySummary.length > 0) {
    return bodySummary;
  }

  return sentenceCaseTrim(convertGoalToOutcome(goal));
}

function summarizeArtifactDescription(summary: string): string {
  return stripExecutionLeakage(summary)
    .replace(/\bQC-filtered\b/gi, 'quality-controlled')
    .replace(/\bAnnData\b/g, 'analysis matrix');
}

function summarizeEvidenceForManuscript(evidence: ConcludeEvidenceItem): string {
  const cleaned = stripExecutionLeakage(evidence.summary);
  if (cleaned.length === 0) {
    return 'Internal evidence is available but still needs a clearer manuscript-facing summary.';
  }
  if (evidence.sourceType === 'artifact') {
    return summarizeArtifactDescription(cleaned);
  }
  return cleaned;
}

function inferEvidenceFocus(evidence: ConcludeEvidenceItem): ConcludeEvidenceFocus {
  const combined = `${evidence.summary} ${evidence.tags.join(' ')}`;
  if (evidence.sourceType === 'resource') {
    return 'resource-context';
  }
  if (evidence.kind !== 'supporting') {
    if (/\b(failed|failure|blocked|did not|does not|unable|unavailable|prevent|prevents)\b/i.test(combined)) {
      return 'negative-validation';
    }
    return 'claim-boundary';
  }
  if (/\b(download|dataset|data quality|preprocess|preprocessing|qc|coverage|annotat|abundance|usable|cohort)\b/i.test(combined)) {
    return 'data-readiness';
  }
  if (/\b(method|pipeline|workflow|protocol|reproducible|compatibility|benchmark)\b/i.test(combined)) {
    return 'workflow-validation';
  }
  if (/\b(signal|expression|splicing|isoform|cluster|state|marker|association|associated|correlation|transition)\b/i.test(combined)) {
    return 'biological-signal';
  }
  return evidence.kind === 'supporting' ? 'workflow-validation' : 'claim-boundary';
}

function buildEvidencePacketId(index: number): string {
  return `packet-${index}`;
}

function focusLabel(focus: ConcludeEvidenceFocus): string {
  switch (focus) {
    case 'data-readiness':
      return 'Data readiness packet';
    case 'biological-signal':
      return 'Biological signal packet';
    case 'workflow-validation':
      return 'Workflow validation packet';
    case 'claim-boundary':
      return 'Claim boundary packet';
    case 'negative-validation':
      return 'Negative validation packet';
    case 'resource-context':
      return 'Resource context packet';
  }
}

function buildPacketSummary(
  focus: ConcludeEvidenceFocus,
  kind: ConcludeEvidenceItem['kind'],
  items: ConcludeEvidenceItem[]
): string {
  const summaries = uniqueNonEmpty(items.map((item) => summarizeEvidenceForManuscript(item))).slice(0, 2);
  const summaryText = summaries.join(' ');
  switch (focus) {
    case 'data-readiness':
      return sentenceCaseTrim(`The project has a usable analysis substrate for drafting: ${summaryText}`);
    case 'biological-signal':
      return sentenceCaseTrim(`Internal results support a bounded biological signal: ${summaryText}`);
    case 'workflow-validation':
      return sentenceCaseTrim(`Reusable workflow outputs validate the current analysis path: ${summaryText}`);
    case 'claim-boundary':
      return sentenceCaseTrim(`Boundary evidence narrows the manuscript claim: ${summaryText}`);
    case 'negative-validation':
      return sentenceCaseTrim(`Negative or failed validation evidence prevents stronger wording: ${summaryText}`);
    case 'resource-context':
      return sentenceCaseTrim(`Project context remains relevant but should stay outside central Results claims: ${summaryText}`);
  }
}

function buildPacketRationale(
  focus: ConcludeEvidenceFocus,
  kind: ConcludeEvidenceItem['kind']
): string {
  const visibility = kind === 'supporting' ? 'supporting' : 'boundary';
  return `Compressed manuscript-facing ${visibility} evidence grouped around ${focus.replace(/-/g, ' ')}.`;
}

function rankEvidenceForPacket(item: ConcludeEvidenceItem, focus: ConcludeEvidenceFocus): number {
  const sourcePriority: Record<ConcludeEvidenceItem['sourceType'], number> = {
    artifact: 0,
    task: 1,
    memory: focus === 'negative-validation' || focus === 'claim-boundary' ? 3 : 2,
    evolution: focus === 'negative-validation' || focus === 'claim-boundary' ? 2 : 3,
    study: 4,
    resource: 5,
  };
  return sourcePriority[item.sourceType];
}

function buildEvidencePackets(evidence: ConcludeEvidenceItem[]): ConcludeEvidencePacket[] {
  const grouped = new Map<ConcludeEvidenceFocus, ConcludeEvidenceItem[]>();
  for (const item of evidence) {
    const focus = inferEvidenceFocus(item);
    const existing = grouped.get(focus) ?? [];
    existing.push(item);
    grouped.set(focus, existing);
  }

  const focusOrder: ConcludeEvidenceFocus[] = [
    'data-readiness',
    'biological-signal',
    'workflow-validation',
    'claim-boundary',
    'negative-validation',
    'resource-context',
  ];

  return focusOrder.flatMap((focus, index) => {
    const items = grouped.get(focus) ?? [];
    if (items.length === 0) {
      return [];
    }
    const kind =
      items.some((item) => item.kind === 'negative') ? 'negative' :
      items.some((item) => item.kind === 'boundary') ? 'boundary' :
      'supporting';
    const primaryItems = [...items]
      .sort((left, right) => rankEvidenceForPacket(left, focus) - rankEvidenceForPacket(right, focus))
      .slice(0, 4);
    return [{
      id: buildEvidencePacketId(index + 1),
      kind,
      focus,
      label: focusLabel(focus),
      manuscriptSummary: buildPacketSummary(focus, kind, primaryItems),
      rationale: buildPacketRationale(focus, kind),
      claimStrength: primaryItems.some((item) => item.claimStrength === 'causal')
        ? 'causal'
        : primaryItems.some((item) => item.claimStrength === 'associative')
          ? 'associative'
          : 'bounded',
      evidenceIds: primaryItems.map((item) => item.id),
      sourcePaths: uniqueNonEmpty(primaryItems.map((item) => item.sourcePath)),
      studyIds: uniqueNonEmpty(primaryItems.map((item) => item.studyId ?? '')),
      tags: uniqueNonEmpty(primaryItems.flatMap((item) => item.tags)),
    }];
  });
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

function formatEvidencePacketReferences(packets: ConcludeEvidencePacket[]): string[] {
  return packets.map((packet) => `- [${packet.id}] ${packet.manuscriptSummary}`);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => sentenceCaseTrim(value)).filter((value) => value.length > 0))];
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function latexEscape(value: string): string {
  return value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}%$#&_])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}

function toTexRelativePath(value: string): string {
  return normalizeRelativePath(value).replace(/_/g, '\\_');
}

function uniqueEvidenceItems(values: ConcludeEvidenceItem[]): ConcludeEvidenceItem[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.id)) {
      return false;
    }
    seen.add(value.id);
    return true;
  });
}

function normalizeStoryId(value: string): string {
  return sentenceCaseTrim(value).toLowerCase();
}

function parseSelectedStoryFrontmatter(content: string): {
  kind?: string;
  version?: number;
  story_id?: string;
} | null {
  const match = content.match(MARKDOWN_FRONTMATTER_PATTERN);
  if (!match) {
    return null;
  }

  try {
    return parseYaml(match[1]) as {
      kind?: string;
      version?: number;
      story_id?: string;
    };
  } catch {
    return null;
  }
}

function parseSelectedStoryId(content: string): string | null {
  const frontmatter = parseSelectedStoryFrontmatter(content);
  if (frontmatter?.kind === CONCLUDE_SELECTED_STORY_KIND && typeof frontmatter.story_id === 'string') {
    return normalizeStoryId(frontmatter.story_id);
  }

  const labeledMatch = content.match(SELECTED_STORY_FIELD_PATTERN);
  if (labeledMatch) {
    return normalizeStoryId(labeledMatch[1]);
  }

  const storyIdMatch = content.match(STORY_ID_PATTERN);
  return storyIdMatch ? normalizeStoryId(storyIdMatch[1]) : null;
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
  if ((study.record.blockers ?? []).length > 0 || /\b(blocked|not feasible|cannot|unable|unavailable|limitation|requires)\b/i.test(content)) {
    return 'boundary';
  }
  return status === 'completed' || status === 'closed' ? 'supporting' : 'boundary';
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
    const summary = summarizeArtifactDescription(sentenceCaseTrim(artifact.description));
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
    const studySummary = buildStudyEvidenceSummary(study);
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
      const taskSummary = buildTaskEvidenceSummary(task);
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
    const summary = stripExecutionLeakage(summarizeFirstMeaningfulLine(memory.content, 'Study memory captured without an explicit summary line.'));
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
      const summary = sentenceCaseTrim([
        stripExecutionLeakage(normalizeTextValue(studyEvent.question)),
        studyEvent.kind === 'dissolution'
          ? 'The question frontier was dissolved or narrowed after conflicting evidence.'
          : studyEvent.resolves.length > 0
            ? `The project resolved ${studyEvent.resolves.join(', ')}.`
            : '',
        studyEvent.opens.length > 0
          ? `The project opened follow-up boundaries around ${studyEvent.opens.join(', ')}.`
          : '',
      ].filter((value) => value.length > 0).join(' '));
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
    const summary = stripExecutionLeakage(summarizeFirstMeaningfulLine(result.snapshot.resourcesMarkdown, 'Project resource summary available.'));
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
      const summary = summarizeArtifactDescription(sentenceCaseTrim(artifact.description));
      evidence.push({
        id: buildEvidenceId('EV-IDX', evidenceIndex++),
        kind: NEGATIVE_SIGNAL_PATTERN.test(summary) ? 'boundary' : 'supporting',
        sourceType: 'artifact',
        sourcePath: artifact.path,
        studyId: artifact.produced_by.split('/')[0] || null,
        summary,
        rationale: `Registered artifact ${artifact.id} is authoritative reusable project evidence.`,
        claimStrength: detectClaimStrength(summary),
        tags: inferEvidenceTags(`${summary} ${artifact.schema}`),
      });
    }
  }

  return evidence;
}

function collectClaimSafetyAudit(evidence: ConcludeEvidenceItem[]): ConcludeClaimSafetyAuditEntry[] {
  return evidence.map((item) => buildClaimSafetyAuditEntry(item.summary, item.claimStrength));
}

function getPacketsByFocus(
  packets: ConcludeEvidencePacket[],
  focus: ConcludeEvidenceFocus
): ConcludeEvidencePacket[] {
  return packets.filter((packet) => packet.focus === focus);
}

function packetRefs(packets: ConcludeEvidencePacket[]): string[] {
  return packets.map((packet) => packet.id);
}

function summarizePacketForNarrative(packet: ConcludeEvidencePacket | undefined, fallback: string): string {
  if (!packet) {
    return fallback;
  }

  return sentenceCaseTrim(packet.manuscriptSummary.replace(/^[^:]+:\s*/, ''));
}

function selectEvidenceFromPackets(packets: ConcludeEvidencePacket[], evidence: ConcludeEvidenceItem[]): ConcludeEvidenceItem[] {
  const ids = packets.flatMap((packet) => packet.evidenceIds);
  return uniqueEvidenceItems(selectEvidenceByIds(evidence, ids));
}

function buildStoryClaimBundle(
  supportingPackets: ConcludeEvidencePacket[],
  boundaryPackets: ConcludeEvidencePacket[],
  narrativeFocus: 'biological' | 'audit' | 'method'
): ConcludeStoryClaimBundleEntry[] {
  const primary = supportingPackets[0];
  const secondary = supportingPackets[1];
  const boundary = boundaryPackets[0];

  const claims: ConcludeStoryClaimBundleEntry[] = [];

  if (primary) {
    claims.push({
      id: 'bundle-1',
      statement:
        narrativeFocus === 'method'
          ? 'The manuscript can open from a reproducible workflow output that already carries reusable evidence.'
          : narrativeFocus === 'audit'
            ? 'The opening claim should show what the project can responsibly say, not just what it hoped to prove.'
            : 'The opening Results claim should stay bounded to the strongest internal biological signal.',
      evidencePacketRefs: [primary.id],
      boundaryPacketRefs: boundary ? [boundary.id] : [],
      validationFocus:
        narrativeFocus === 'method'
          ? 'Show why the workflow output is reusable and where its biological scope stops.'
          : narrativeFocus === 'audit'
            ? 'Keep the first claim modest and immediately pair it with reviewer-visible limits.'
            : 'Use association-level wording unless stronger intervention evidence exists.',
    });
  }

  if (secondary) {
    claims.push({
      id: 'bundle-2',
      statement:
        narrativeFocus === 'method'
          ? 'A second claim should validate how the workflow packages evidence into manuscript-ready assets.'
          : narrativeFocus === 'audit'
            ? 'A second claim should explain how evidence convergence happened despite unresolved boundaries.'
            : 'A second claim should explain how data readiness and reproducibility support the biological interpretation.',
      evidencePacketRefs: [secondary.id],
      boundaryPacketRefs: boundary ? [boundary.id] : [],
      validationFocus:
        narrativeFocus === 'method'
          ? 'Tie the pipeline output to concrete reusable reports, figures, or processed matrices.'
          : narrativeFocus === 'audit'
            ? 'Show that the negative evidence narrows scope rather than invalidating the whole story.'
            : 'Keep the manuscript arc anchored in internal evidence rather than aspiration or external context.',
    });
  }

  if (boundary) {
    claims.push({
      id: 'bundle-3',
      statement:
        narrativeFocus === 'method'
          ? 'The discussion must explicitly state which missing validations prevent a stronger biological conclusion.'
          : narrativeFocus === 'audit'
            ? 'Boundary and failed validation evidence should be treated as part of the contribution, not hidden cleanup.'
            : 'Boundary evidence should explain why the story remains a bounded hypothesis instead of a mechanistic claim.',
      evidencePacketRefs: [],
      boundaryPacketRefs: [boundary.id],
      validationFocus: 'Preserve reviewer-facing limits and keep stronger causal verbs out of the final prose.',
    });
  }

  return claims;
}

function buildCandidateNarrative(
  framing: ConcludeStoryFraming,
  supportingPackets: ConcludeEvidencePacket[],
  boundaryPackets: ConcludeEvidencePacket[],
  contract: ResearchContract | null
): {
  centralClaim: string;
  story: string;
  narrativeArc: string[];
  claimsAllowed: string[];
  claimSafetyLimits: string[];
  claimsToSoftenOrAvoid: string[];
} {
  const thematicScope = contract?.theme ? `within the project theme "${contract.theme}"` : 'within the current QDD project scope';
  const leadPacket = supportingPackets[0];
  const secondPacket = supportingPackets[1];
  const boundaryPacket = boundaryPackets[0];
  const leadSummary = summarizePacketForNarrative(leadPacket, 'the available QDD evidence supports a bounded synthesis-ready story');
  const secondSummary = summarizePacketForNarrative(secondPacket, 'reusable internal evidence supports a coherent second Results step');
  const boundarySummary = summarizePacketForNarrative(boundaryPacket, 'current boundary evidence should remain visible throughout drafting');

  if (framing === 'audit-report') {
    return {
      centralClaim: `The current evidence package ${thematicScope} supports an auditable, bounded conclusion rather than a broad mechanistic claim.`,
      story: sentenceCaseTrim(`This story is organized as a reviewer-facing evidence audit: start from ${lowerCaseLead(leadSummary)}, then show how ${lowerCaseLead(secondSummary)} supports a cautious manuscript backbone. The final arc must keep ${lowerCaseLead(boundarySummary)} visible so the contribution reads as honest evidence-bounding rather than overreach.`),
      narrativeArc: [
        'Open by stating what the project can already support with reusable internal evidence.',
        'Translate the main evidence packets into a compact Results chain without replaying raw execution logs.',
        'Use boundary and failed validation packets to explain why the claim remains deliberately bounded.',
      ],
      claimsAllowed: [
        'The project converged on a bounded interpretation supported by reusable internal evidence.',
        'Negative and blocked studies narrowed the final claim and improved reviewer-facing honesty.',
      ],
      claimSafetyLimits: [
        'Keep the central claim at the level of bounded conclusion rather than broad biological mechanism.',
        'Do not let unresolved validations disappear into future-work language if they still define the current boundary.',
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
      story: sentenceCaseTrim(`Lead with ${lowerCaseLead(leadSummary)} as the validation backbone, then use ${lowerCaseLead(secondSummary)} to show why the workflow outputs are manuscript-ready. Keep ${lowerCaseLead(boundarySummary)} explicit so the paper reads as reproducible and conservative rather than workflow triumphalism.`),
      narrativeArc: [
        'Introduce the workflow contribution as a reproducible path that yielded reusable outputs.',
        'Show one or two manuscript-ready evidence packets that validate the workflow without claiming mechanism.',
        'Close the Results arc by naming the biological scope limits and the validation still missing.',
      ],
      claimsAllowed: [
        'The workflow produced reusable scripts, reports, or figures that support project-level synthesis.',
        'The biological interpretation should remain bounded to the observed evidence package.',
      ],
      claimSafetyLimits: [
        'Method reliability does not by itself prove a biological mechanism.',
        'Generalization claims should stay narrower than one-project-slice hype.',
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
      story: sentenceCaseTrim(`Present a conservative biological arc anchored by ${lowerCaseLead(leadSummary)} and reinforced by ${lowerCaseLead(secondSummary)}. Then make the limiting evidence explicit: ${lowerCaseLead(boundarySummary)}. This keeps the story manuscript-native while remaining claim-safe.`),
      narrativeArc: [
        'Open from the strongest internal biological signal using association-level wording.',
        'Use data-readiness and reproducibility packets to show the signal is not an isolated anecdote.',
        'End by making the limiting evidence explicit so the hypothesis stays bounded.',
      ],
      claimsAllowed: [
        'Use association or candidate-state language for the central biological signal.',
        'State that the evidence narrows the hypothesis frontier instead of proving mechanism.',
      ],
      claimSafetyLimits: [
        'Mechanistic language is not allowed unless intervention or functional validation exists.',
        'Proxy or correlation evidence should be framed as candidate support, not proof.',
      ],
      claimsToSoftenOrAvoid: [
        'Avoid verbs such as drives, defines, proves, or establishes mechanism.',
        'Avoid presenting proxy or correlation evidence as causal validation.',
      ],
    };
  }

  return {
    centralClaim: `The evidence package ${thematicScope} supports a coherent project story grounded in reusable internal results and explicit boundaries.`,
    story: sentenceCaseTrim(`Build the story around ${lowerCaseLead(leadSummary)} and ${lowerCaseLead(secondSummary)}. Keep the Results arc focused on evidence QDD actually produced, then use ${lowerCaseLead(boundarySummary)} to define the limits of interpretation.`),
    narrativeArc: [
      'Lead with the strongest reusable internal result.',
      'Sequence supporting packets into a compact Results chain.',
      'Use reviewer-facing limits to keep the contribution bounded and credible.',
    ],
    claimsAllowed: [
      'The evidence package supports a coherent and bounded manuscript story.',
      'Project evolution and reusable artifacts reinforce the final narrative arc.',
    ],
    claimSafetyLimits: [
      'Novelty language must remain tied to internal evidence rather than aspiration.',
      'Failed or blocked studies should remain visible when they define claim boundaries.',
    ],
    claimsToSoftenOrAvoid: [
      'Avoid broad novelty claims that are not grounded in internal evidence.',
      'Avoid hiding failed or blocked studies when they explain claim boundaries.',
    ],
  };
}

function selectCandidatePackets(
  packets: ConcludeEvidencePacket[],
  mode: 'balanced' | 'audit-heavy' | 'method-heavy'
): { supportingPackets: ConcludeEvidencePacket[]; boundaryPackets: ConcludeEvidencePacket[] } {
  const supportingPackets = packets.filter((packet) => packet.kind === 'supporting');
  const boundaryPackets = packets.filter((packet) => packet.kind !== 'supporting');

  if (mode === 'audit-heavy') {
    return {
      supportingPackets: [
        ...getPacketsByFocus(supportingPackets, 'biological-signal'),
        ...getPacketsByFocus(supportingPackets, 'data-readiness'),
      ].slice(0, 2),
      boundaryPackets: [
        ...getPacketsByFocus(boundaryPackets, 'negative-validation'),
        ...getPacketsByFocus(boundaryPackets, 'claim-boundary'),
        ...boundaryPackets,
      ].slice(0, 3),
    };
  }

  if (mode === 'method-heavy') {
    return {
      supportingPackets: [
        ...getPacketsByFocus(supportingPackets, 'workflow-validation'),
        ...getPacketsByFocus(supportingPackets, 'data-readiness'),
        ...getPacketsByFocus(supportingPackets, 'biological-signal'),
      ].slice(0, 3),
      boundaryPackets: [
        ...getPacketsByFocus(boundaryPackets, 'claim-boundary'),
        ...getPacketsByFocus(boundaryPackets, 'negative-validation'),
      ].slice(0, 2),
    };
  }

  return {
    supportingPackets: [
      ...getPacketsByFocus(supportingPackets, 'biological-signal'),
      ...getPacketsByFocus(supportingPackets, 'data-readiness'),
      ...getPacketsByFocus(supportingPackets, 'workflow-validation'),
      ...supportingPackets,
    ].slice(0, 3),
    boundaryPackets: [
      ...getPacketsByFocus(boundaryPackets, 'negative-validation'),
      ...getPacketsByFocus(boundaryPackets, 'claim-boundary'),
      ...boundaryPackets,
    ].slice(0, 2),
  };
}

function buildStoryCandidates(
  evidence: ConcludeEvidenceItem[],
  packets: ConcludeEvidencePacket[],
  contract: ResearchContract | null
): ConcludeStoryCandidate[] {
  const modes: Array<{ id: string; mode: 'balanced' | 'audit-heavy' | 'method-heavy'; framing: ConcludeStoryFraming; narrativeFocus: 'biological' | 'audit' | 'method' }> = [
    { id: 'story-1', mode: 'balanced', framing: packets.some((packet) => packet.claimStrength === 'associative') ? 'bounded-hypothesis' : 'discovery', narrativeFocus: 'biological' },
    { id: 'story-2', mode: 'audit-heavy', framing: 'audit-report', narrativeFocus: 'audit' },
    { id: 'story-3', mode: 'method-heavy', framing: 'method', narrativeFocus: 'method' },
  ];

  return modes.map(({ id, mode, framing, narrativeFocus }) => {
    const { supportingPackets, boundaryPackets } = selectCandidatePackets(packets, mode);
    const supportingEvidence = selectEvidenceFromPackets(supportingPackets, evidence);
    const negatives = selectEvidenceFromPackets(boundaryPackets, evidence);
    const narrative = buildCandidateNarrative(framing, supportingPackets, boundaryPackets, contract);
    const claimBundle = buildStoryClaimBundle(supportingPackets, boundaryPackets, narrativeFocus);
    const relevantClaims = [...supportingPackets, ...boundaryPackets].map((packet) => buildClaimSafetyAuditEntry(packet.manuscriptSummary, packet.claimStrength));

    return {
      id,
      framing,
      centralClaim: narrative.centralClaim,
      story: narrative.story,
      narrativeArc: narrative.narrativeArc,
      claimBundle,
      supportingPacketRefs: packetRefs(supportingPackets),
      boundaryPacketRefs: packetRefs(boundaryPackets),
      supportingEvidence,
      negativeOrBoundaryEvidence: negatives,
      reviewerObjections: buildReviewerObjections(framing, supportingEvidence, negatives),
      claimsAllowed: uniqueStrings(narrative.claimsAllowed),
      claimSafetyLimits: uniqueStrings(narrative.claimSafetyLimits),
      claimsToSoftenOrAvoid: uniqueStrings([
        ...narrative.claimsToSoftenOrAvoid,
        ...relevantClaims.filter((entry) => entry.action !== 'allow').map((entry) => `${entry.claim} (${entry.action})`),
      ]),
      suitabilityScore: scoreStoryCandidate(framing, supportingEvidence, negatives, relevantClaims),
      recommendedTitleStyle: TITLE_STYLE_BY_FRAMING[framing],
    };
  });
}

function selectEvidenceByIds(evidence: ConcludeEvidenceItem[], ids: string[]): ConcludeEvidenceItem[] {
  const idSet = new Set(ids);
  return evidence.filter((item) => idSet.has(item.id));
}

function buildResultsClaims(
  candidate: ConcludeStoryCandidate,
  evidence: ConcludeEvidenceItem[],
  packets: ConcludeEvidencePacket[],
  claimSafetyAudit: ConcludeClaimSafetyAuditEntry[]
): ConcludeResultsClaim[] {
  const packetById = new Map(packets.map((packet) => [packet.id, packet] as const));

  return candidate.claimBundle.filter((bundle) => bundle.evidencePacketRefs.length > 0).slice(0, 3).map((bundle, index) => {
    const supportingPackets = bundle.evidencePacketRefs.map((id) => packetById.get(id)).filter((value): value is ConcludeEvidencePacket => Boolean(value));
    const boundaryPackets = bundle.boundaryPacketRefs.map((id) => packetById.get(id)).filter((value): value is ConcludeEvidencePacket => Boolean(value));
    const supportingEvidence = uniqueEvidenceItems(selectEvidenceFromPackets(supportingPackets, evidence)).slice(0, 4);
    const boundaryEvidence = uniqueEvidenceItems(selectEvidenceFromPackets(boundaryPackets, evidence)).slice(0, 3);
    const safetyEntries = claimSafetyAudit.filter((entry) => normalizeLine(entry.claim).toLowerCase() === normalizeLine(candidate.centralClaim).toLowerCase())
      .concat(
        supportingPackets.flatMap((packet) =>
          claimSafetyAudit.filter((entry) => normalizeLine(entry.claim).toLowerCase() === normalizeLine(packet.manuscriptSummary).toLowerCase())
        )
      );
    const claimStrength =
      supportingPackets.some((packet) => packet.claimStrength === 'causal')
        ? 'causal'
        : supportingPackets.some((packet) => packet.claimStrength === 'associative')
          ? 'associative'
          : 'bounded';
    const leadPacket = supportingPackets[0] ?? boundaryPackets[0];
    return {
      id: `claim-${index + 1}`,
      heading: `Result ${index + 1}`,
      claim: leadPacket?.manuscriptSummary ?? bundle.statement,
      claimStrength,
      supportingPacketRefs: bundle.evidencePacketRefs,
      boundaryPacketRefs: bundle.boundaryPacketRefs,
      supportingEvidence,
      boundaryEvidence,
      validationFocus: bundle.validationFocus,
      claimSafetyNotes: uniqueStrings(
        safetyEntries.length > 0
          ? safetyEntries.map((entry) => `${entry.action.toUpperCase()}: ${entry.rationale}`)
          : ['ALLOW: Current wording is already bounded to the available evidence.']
      ),
      reviewerRisk:
        candidate.reviewerObjections[index]
        ?? candidate.reviewerObjections[0]
        ?? 'Reviewers may ask for a stronger explanation of why this claim remains bounded.',
    };
  });
}

function renderResultsClaimEvidence(evidence: ConcludeEvidenceItem[]): string[] {
  return evidence.map((item) => `- [${item.id}] ${item.summary} Source: \`${item.sourcePath}\`.`);
}

function renderConfirmedContributionMarkdown(candidate: ConcludeStoryCandidate, selectedStoryPath: string): string {
  return [
    '# Confirmed Contribution',
    '',
    `- Selected story: ${candidate.id}`,
    `- Selection source: \`${selectedStoryPath}\``,
    `- Framing: ${candidate.framing}`,
    `- Recommended title style: ${candidate.recommendedTitleStyle}`,
    '',
    '## Confirmed Contribution',
    '',
    candidate.centralClaim,
    '',
    '## Why This Story Survives Review',
    '',
    candidate.story,
    '',
    '## Narrative Arc',
    '',
    ...candidate.narrativeArc.map((value) => `- ${value}`),
    '',
    '## Claim Bundle',
    '',
    ...candidate.claimBundle.map((bundle) => `- ${bundle.id}: ${bundle.statement}`),
    '',
    '## Claims Allowed',
    '',
    ...candidate.claimsAllowed.map((value) => `- ${value}`),
    '',
    '## Claim Safety Limits',
    '',
    ...candidate.claimSafetyLimits.map((value) => `- ${value}`),
    '',
    '## Claims To Soften Or Avoid',
    '',
    ...candidate.claimsToSoftenOrAvoid.map((value) => `- ${value}`),
    '',
  ].join('\n');
}

function renderResultsValidationMarkdown(candidate: ConcludeStoryCandidate, claims: ConcludeResultsClaim[]): string {
  const lines: string[] = [
    '# Results Validation',
    '',
    `- Selected story: ${candidate.id}`,
    '- Every Results claim must stay traceable to QDD internal evidence.',
    '',
  ];

  for (const claim of claims) {
    lines.push(`## ${claim.heading}`);
    lines.push('');
    lines.push(`- Claim ID: ${claim.id}`);
    lines.push(`- Claim strength: ${claim.claimStrength}`);
    lines.push(`- Validation focus: ${claim.validationFocus}`);
    lines.push(`- Supporting packet refs: ${claim.supportingPacketRefs.join(', ') || 'n/a'}`);
    lines.push(`- Boundary packet refs: ${claim.boundaryPacketRefs.join(', ') || 'n/a'}`);
    lines.push('');
    lines.push(claim.claim);
    lines.push('');
    lines.push('### Supporting Evidence');
    lines.push('');
    lines.push(...renderResultsClaimEvidence(claim.supportingEvidence));
    lines.push('');
    lines.push('### Boundary Evidence');
    lines.push('');
    lines.push(...renderResultsClaimEvidence(claim.boundaryEvidence));
    lines.push('');
    lines.push('### Claim Safety Notes');
    lines.push('');
    lines.push(...claim.claimSafetyNotes.map((value) => `- ${value}`));
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function renderReviewerAuditMarkdown(candidate: ConcludeStoryCandidate, claims: ConcludeResultsClaim[]): string {
  const lines: string[] = [
    '# Reviewer Audit',
    '',
    `- Selected story: ${candidate.id}`,
    '- Reviewer risk is preserved as a standalone audit trail for drafting and revision.',
    '',
    '## Story-Level Risks',
    '',
    ...candidate.reviewerObjections.map((value) => `- ${value}`),
    '',
    '## Claim-Level Risks',
    '',
  ];

  for (const claim of claims) {
    lines.push(`### ${claim.heading}`);
    lines.push('');
    lines.push(`- ${claim.reviewerRisk}`);
    lines.push(...claim.claimSafetyNotes.map((value) => `- ${value}`));
    lines.push('');
  }

  return lines.join('\n');
}

function renderCitationSupportBankMarkdown(candidate: ConcludeStoryCandidate, claims: ConcludeResultsClaim[]): string {
  const lines: string[] = [
    '# Citation Support Bank',
    '',
    `- Selected story: ${candidate.id}`,
    '- Internal evidence is authoritative for Results claims; external literature remains to be attached during manuscript drafting.',
    '',
  ];

  for (const claim of claims) {
    lines.push(`## ${claim.heading}`);
    lines.push('');
    lines.push(`- Results claim: ${claim.claim}`);
    lines.push(`- Supporting packet refs: ${claim.supportingPacketRefs.join(', ') || 'n/a'}`);
    lines.push(`- Boundary packet refs: ${claim.boundaryPacketRefs.join(', ') || 'n/a'}`);
    lines.push('- Internal evidence support:');
    lines.push(...renderResultsClaimEvidence(claim.supportingEvidence));
    if (claim.boundaryEvidence.length > 0) {
      lines.push('- Boundary evidence support:');
      lines.push(...renderResultsClaimEvidence(claim.boundaryEvidence));
    }
    lines.push('- External citation need: add real literature support for background or field context only; do not use literature to invent this result.');
    lines.push('');
  }

  return lines.join('\n');
}

function renderSectionBlueprintsMarkdown(candidate: ConcludeStoryCandidate, claims: ConcludeResultsClaim[]): string {
  return [
    '# Section Blueprints',
    '',
    `- Selected story: ${candidate.id}`,
    '',
    '## Abstract Blueprint',
    '',
    `- Lead with: ${candidate.centralClaim}`,
    '- Keep the abstract bounded to internal evidence and explicit negative evidence.',
    '',
    '## Introduction Blueprint',
    '',
    '- Define the question and why the QDD evidence package matters.',
    '- Reserve external citations for field context, not Results support.',
    '',
    '## Results Blueprint',
    '',
    ...claims.map((claim) => `- ${claim.heading}: ${claim.claim}`),
    '',
    '## Discussion Blueprint',
    '',
    '- Explain how negative and blocked studies narrowed the interpretation.',
    '- Call out why stronger mechanism claims were not made.',
    '',
  ].join('\n');
}

function renderWritingRationaleMatrixMarkdown(candidate: ConcludeStoryCandidate, claims: ConcludeResultsClaim[]): string {
  const lines: string[] = [
    '# Writing Rationale Matrix',
    '',
    `- Selected story: ${candidate.id}`,
    '',
    '| Section | Narrative job | Evidence anchor | Safety / reviewer rationale |',
    '| --- | --- | --- | --- |',
    `| Contribution | State the confirmed contribution | ${candidate.supportingPacketRefs[0] ?? candidate.supportingEvidence[0]?.id ?? 'n/a'} | ${candidate.claimSafetyLimits[0] ?? candidate.claimsToSoftenOrAvoid[0] ?? 'Keep wording bounded.'} |`,
  ];

  for (const claim of claims) {
    lines.push(
      `| ${claim.heading} | Validate one Results claim | ${claim.supportingPacketRefs.join(', ') || claim.supportingEvidence.map((item) => item.id).join(', ')} | ${sentenceCaseTrim(`${claim.reviewerRisk} ${claim.claimSafetyNotes[0] ?? ''}`)} |`
    );
  }

  lines.push(`| Discussion | Bound scope and future work | ${claims.flatMap((claim) => claim.boundaryPacketRefs).slice(0, 3).join(', ') || claims.flatMap((claim) => claim.boundaryEvidence.map((item) => item.id)).slice(0, 3).join(', ') || 'n/a'} | Negative evidence stays visible so the story remains auditable. |`);
  lines.push('');
  return lines.join('\n');
}

function buildPlanningArtifactPaths(outputDir: string, selectedStoryPath: string): ConcludePlanningArtifactPaths {
  const paperRewritingOutputDir = path.join(outputDir, 'paper_rewriting_output');
  return {
    paperRewritingOutputDir,
    selectedStoryPath,
    confirmedContributionPath: path.join(paperRewritingOutputDir, 'confirmed_contribution.md'),
    resultsValidationPath: path.join(paperRewritingOutputDir, 'results_validation.md'),
    reviewerAuditPath: path.join(paperRewritingOutputDir, 'reviewer_audit.md'),
    citationSupportBankPath: path.join(paperRewritingOutputDir, 'citation_support_bank.md'),
    sectionBlueprintsPath: path.join(paperRewritingOutputDir, 'section_blueprints.md'),
    writingRationaleMatrixPath: path.join(paperRewritingOutputDir, 'writing_rationale_matrix.md'),
  };
}

function buildFinalPaperArtifactPaths(artifactPaths: ConcludePlanningArtifactPaths): ConcludeFinalPaperArtifactPaths {
  const finalPaperDir = path.join(artifactPaths.paperRewritingOutputDir, 'final_paper');
  const figuresDir = path.join(finalPaperDir, 'figures');
  return {
    finalArtifactAuditPath: path.join(artifactPaths.paperRewritingOutputDir, 'final_artifact_audit.md'),
    finalPaperDir,
    mainTexPath: path.join(finalPaperDir, 'main.tex'),
    referencesBibPath: path.join(finalPaperDir, 'references.bib'),
    figuresDir,
    figureAssetMapPath: path.join(figuresDir, 'asset_map.md'),
    paperPdfPath: path.join(finalPaperDir, 'paper.pdf'),
    paperDocxPath: path.join(finalPaperDir, 'paper.docx'),
    pdfRenderLogPath: path.join(finalPaperDir, 'pdf_render.log'),
    wordRenderLogPath: path.join(finalPaperDir, 'word_render.log'),
  };
}

async function writePlanningArtifacts(
  candidate: ConcludeStoryCandidate,
  claims: ConcludeResultsClaim[],
  artifactPaths: ConcludePlanningArtifactPaths
): Promise<void> {
  await FileSystemUtils.createDirectory(artifactPaths.paperRewritingOutputDir);
  await Promise.all([
    FileSystemUtils.writeFile(
      artifactPaths.confirmedContributionPath,
      renderConfirmedContributionMarkdown(candidate, artifactPaths.selectedStoryPath)
    ),
    FileSystemUtils.writeFile(
      artifactPaths.resultsValidationPath,
      renderResultsValidationMarkdown(candidate, claims)
    ),
    FileSystemUtils.writeFile(
      artifactPaths.reviewerAuditPath,
      renderReviewerAuditMarkdown(candidate, claims)
    ),
    FileSystemUtils.writeFile(
      artifactPaths.citationSupportBankPath,
      renderCitationSupportBankMarkdown(candidate, claims)
    ),
    FileSystemUtils.writeFile(
      artifactPaths.sectionBlueprintsPath,
      renderSectionBlueprintsMarkdown(candidate, claims)
    ),
    FileSystemUtils.writeFile(
      artifactPaths.writingRationaleMatrixPath,
      renderWritingRationaleMatrixMarkdown(candidate, claims)
    ),
  ]);
}

function buildFinalArtifactStatus(
  status: ConcludeDraftArtifactStatus,
  pathValue: string | null,
  details: string,
  notes: string[] = []
): ConcludeFinalArtifactStatus {
  return {
    status,
    path: pathValue,
    details,
    notes,
  };
}

function extractCitationEntries(text: string): ConcludeExternalCitationEntry[] {
  const matches = text.matchAll(BIBTEX_ENTRY_PATTERN);
  return [...matches].map((match) => ({
    key: match[2],
    entryType: match[1].toLowerCase(),
    rawBibtex: match[0].trim(),
  }));
}

async function collectCitationEntries(artifactPaths: ConcludePlanningArtifactPaths): Promise<ConcludeExternalCitationEntry[]> {
  const candidatePaths = [
    artifactPaths.citationSupportBankPath,
    artifactPaths.confirmedContributionPath,
    artifactPaths.resultsValidationPath,
    artifactPaths.reviewerAuditPath,
    artifactPaths.sectionBlueprintsPath,
    artifactPaths.writingRationaleMatrixPath,
  ];

  const entries: ConcludeExternalCitationEntry[] = [];
  for (const candidatePath of candidatePaths) {
    if (!(await FileSystemUtils.fileExists(candidatePath))) {
      continue;
    }
    const content = await FileSystemUtils.readFile(candidatePath);
    entries.push(...extractCitationEntries(content));
  }

  const uniqueByKey = new Map<string, ConcludeExternalCitationEntry>();
  for (const entry of entries) {
    if (!uniqueByKey.has(entry.key)) {
      uniqueByKey.set(entry.key, entry);
    }
  }
  return [...uniqueByKey.values()];
}

async function materializeFigureAssets(
  projectRoot: string,
  claims: ConcludeResultsClaim[],
  finalPaths: ConcludeFinalPaperArtifactPaths
): Promise<ConcludeFigureAssetMapEntry[]> {
  await FileSystemUtils.createDirectory(finalPaths.figuresDir);
  const figureAssets: ConcludeFigureAssetMapEntry[] = [];
  let figureIndex = 1;

  for (const claim of claims) {
    const figureEvidence = uniqueEvidenceItems(claim.supportingEvidence)
      .filter((item) => item.sourceType === 'artifact' && /\.(png|jpe?g|pdf|svg)$/i.test(item.sourcePath))
      .slice(0, 1);

    if (figureEvidence.length === 0) {
      figureAssets.push({
        label: `Figure ${figureIndex}`,
        resultClaimId: claim.id,
        evidenceId: null,
        sourcePath: null,
        targetPath: null,
        status: 'placeholder',
        recommendedUse: `Add one figure for ${claim.heading} to visualize the internal evidence anchor.`,
        notes: ['No figure-like internal artifact was detected for this claim; placeholder only.'],
      });
      figureIndex += 1;
      continue;
    }

    for (const evidence of figureEvidence) {
      const sourceAbsolutePath = path.join(projectRoot, evidence.sourcePath);
      const extension = path.extname(evidence.sourcePath) || '.dat';
      const targetFileName = `figure-${String(figureIndex).padStart(2, '0')}${extension}`;
      const targetAbsolutePath = path.join(finalPaths.figuresDir, targetFileName);
      let status: 'available' | 'placeholder' = 'available';
      const notes: string[] = [];

      if (await FileSystemUtils.fileExists(sourceAbsolutePath)) {
        await fs.copyFile(sourceAbsolutePath, targetAbsolutePath);
      } else {
        status = 'placeholder';
        notes.push(`Source artifact was referenced at \`${evidence.sourcePath}\` but not found during final package generation.`);
      }

      figureAssets.push({
        label: `Figure ${figureIndex}`,
        resultClaimId: claim.id,
        evidenceId: evidence.id,
        sourcePath: evidence.sourcePath,
        targetPath: status === 'available' ? path.join('figures', targetFileName) : null,
        status,
        recommendedUse: `Use this asset to support ${claim.heading} without introducing claims beyond the internal evidence.`,
        notes,
      });
      figureIndex += 1;
    }
  }

  if (figureAssets.length === 0) {
    figureAssets.push({
      label: 'Figure 1',
      resultClaimId: 'none',
      evidenceId: null,
      sourcePath: null,
      targetPath: null,
      status: 'placeholder',
      recommendedUse: 'Add a minimal figure or table placeholder before external submission.',
      notes: ['No Results claims were available to map into figure assets.'],
    });
  }

  return figureAssets;
}

function renderFigureAssetMapMarkdown(figureAssets: ConcludeFigureAssetMapEntry[]): string {
  const lines: string[] = [
    '# Figure Asset Map',
    '',
    '| Label | Result Claim | Evidence ID | Source Path | Final Paper Path | Status | Recommended Use | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const asset of figureAssets) {
    lines.push(
      `| ${asset.label} | ${asset.resultClaimId} | ${asset.evidenceId ?? 'n/a'} | ${asset.sourcePath ?? 'n/a'} | ${asset.targetPath ?? 'placeholder'} | ${asset.status.toUpperCase()} | ${asset.recommendedUse} | ${asset.notes.join(' ') || 'n/a'} |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

function renderReferencesBib(citationEntries: ConcludeExternalCitationEntry[]): string {
  if (citationEntries.length === 0) {
    return '% No verified external BibTeX entries were available. Keep bibliography empty until real citations are added.\n';
  }
  return `${citationEntries.map((entry) => entry.rawBibtex).join('\n\n')}\n`;
}

function buildAbstractParagraph(candidate: ConcludeStoryCandidate, claims: ConcludeResultsClaim[]): string {
  const leadClaim = claims[0]?.claim ?? candidate.centralClaim;
  return sentenceCaseTrim(
    `${candidate.centralClaim} We summarize the selected QDD storyline as a submission-oriented draft grounded in internal evidence. The current abstract remains intentionally conservative: ${leadClaim} Negative and blocked studies stay visible to explain why stronger mechanistic language is not used.`
  );
}

function buildIntroductionParagraph(candidate: ConcludeStoryCandidate, hasExternalCitations: boolean): string {
  const citationSuffix = hasExternalCitations
    ? 'External literature citations may be added here for background and related work using the verified bibliography entries.'
    : 'External background citations are currently unavailable and must be added later using verified BibTeX entries.';
  return sentenceCaseTrim(
    `${candidate.story} The introduction should motivate the biological or methodological question, explain why the QDD evidence package matters, and clearly separate internal results from field context. ${citationSuffix}`
  );
}

function buildDiscussionParagraph(candidate: ConcludeStoryCandidate, claims: ConcludeResultsClaim[]): string {
  const boundarySummary = uniqueStrings(
    claims.flatMap((claim) => claim.boundaryEvidence.map((item) => item.summary))
  ).slice(0, 3);
  return sentenceCaseTrim(
    `The discussion should explain how the selected story remains bounded by the available evidence, surface reviewer-facing limitations, and preserve negative evidence as a strength rather than a hidden weakness. ${boundarySummary.length > 0 ? `Key boundary evidence includes ${boundarySummary.join('; ')}.` : 'Boundary evidence should be expanded as the draft matures.'}`
  );
}

function renderMainTex(options: {
  candidate: ConcludeStoryCandidate;
  claims: ConcludeResultsClaim[];
  figureAssets: ConcludeFigureAssetMapEntry[];
  citationEntries: ConcludeExternalCitationEntry[];
  citationGaps: string[];
  selectedStoryPath: string;
}): string {
  const { candidate, claims, figureAssets, citationEntries, citationGaps, selectedStoryPath } = options;
  const bibliographyKeys = citationEntries.map((entry) => entry.key);
  const bibliographyLine = bibliographyKeys.length > 0
    ? `Background citations available: \\cite{${bibliographyKeys.join(',')}}.`
    : 'Background citations are intentionally omitted until verified BibTeX support is available.';
  const placeholderFigures = figureAssets.filter((asset) => asset.status === 'placeholder').length;
  const figureIntro = placeholderFigures === 0
    ? 'Figure assets have been mapped from internal QDD artifacts.'
    : `${placeholderFigures} figure slot(s) remain placeholders because no reusable figure asset was available for every Results claim.`;

  const lines: string[] = [
    '\\documentclass[11pt]{article}',
    '\\usepackage[margin=1in]{geometry}',
    '\\usepackage{graphicx}',
    '\\usepackage{booktabs}',
    '\\usepackage[hidelinks]{hyperref}',
    '\\title{' + latexEscape(candidate.centralClaim) + '}',
    '\\author{QDD Conclude Draft}',
    '\\date{}',
    '',
    '\\begin{document}',
    '\\maketitle',
    '',
    '\\begin{abstract}',
    latexEscape(buildAbstractParagraph(candidate, claims)),
    '\\end{abstract}',
    '',
    '\\section{Introduction}',
    latexEscape(buildIntroductionParagraph(candidate, citationEntries.length > 0)),
    '',
    latexEscape(bibliographyLine),
    '',
    '\\section{Results}',
    latexEscape(figureIntro),
    '',
  ];

  for (const claim of claims) {
    const figureAsset = figureAssets.find((asset) => asset.resultClaimId === claim.id);
    lines.push(`\\subsection{${latexEscape(claim.heading)}}`);
    lines.push(latexEscape(claim.claim));
    lines.push('');
    lines.push('\\paragraph{Internal Evidence Anchors.}');
    lines.push('\\begin{itemize}');
    for (const evidence of claim.supportingEvidence) {
      lines.push(`  \\item [${latexEscape(evidence.id)}] ${latexEscape(evidence.summary)} Source: \\texttt{${toTexRelativePath(evidence.sourcePath)}}.`);
    }
    lines.push('\\end{itemize}');
    lines.push('');
    lines.push('\\paragraph{Boundary Evidence.}');
    lines.push('\\begin{itemize}');
    const boundaryEvidence = claim.boundaryEvidence.length > 0
      ? claim.boundaryEvidence
      : [{
          id: 'n/a',
          summary: 'No explicit boundary evidence was mapped; keep the wording bounded until more reviewer-facing limits are documented.',
          sourcePath: 'n/a',
        } as ConcludeEvidenceItem];
    for (const evidence of boundaryEvidence) {
      lines.push(`  \\item [${latexEscape(evidence.id)}] ${latexEscape(evidence.summary)} Source: \\texttt{${toTexRelativePath(evidence.sourcePath)}}.`);
    }
    lines.push('\\end{itemize}');
    lines.push('');
    lines.push('\\paragraph{Claim Safety.}');
    lines.push(latexEscape(claim.claimSafetyNotes.join(' ')));
    lines.push('');
    if (figureAsset?.targetPath) {
      lines.push('\\begin{figure}[ht]');
      lines.push('  \\centering');
      lines.push(`  \\includegraphics[width=0.8\\linewidth]{${toTexRelativePath(figureAsset.targetPath)}}`);
      lines.push(`  \\caption{${latexEscape(`${figureAsset.label}. Internal evidence asset mapped to ${claim.heading}.`)}`);
      lines.push(`  \\label{fig:${latexEscape(claim.id)}}`);
      lines.push('\\end{figure}');
      lines.push('');
    } else {
      lines.push(`% ${claim.heading} currently has no reusable figure asset; see figures/asset_map.md.`);
      lines.push('');
    }
  }

  lines.push('\\section{Discussion}');
  lines.push(latexEscape(buildDiscussionParagraph(candidate, claims)));
  lines.push('');
  if (citationGaps.length > 0) {
    lines.push('% Citation gaps remain:');
    for (const gap of citationGaps) {
      lines.push(`% - ${gap}`);
    }
    lines.push('');
  }
  lines.push(`% Selected story source: ${toTexRelativePath(selectedStoryPath)}`);
  lines.push('\\bibliographystyle{plain}');
  lines.push('\\bibliography{references}');
  lines.push('\\end{document}');
  lines.push('');
  return lines.join('\n');
}

function determineOverallFinalStatus(statuses: ConcludeFinalArtifactStatus[]): ConcludeDraftArtifactStatus {
  if (statuses.some((status) => status.status === 'blocked')) {
    return 'blocked';
  }
  if (statuses.some((status) => status.status === 'gap')) {
    return 'gap';
  }
  return 'complete';
}

async function tryRenderPdf(
  finalPaths: ConcludeFinalPaperArtifactPaths,
  preflight: ConcludePreflightResult
): Promise<ConcludeFinalArtifactStatus> {
  if (preflight.render.pdf.status !== 'available') {
    return buildFinalArtifactStatus(
      'blocked',
      null,
      'PDF rendering is blocked because the local TeX toolchain is incomplete.',
      preflight.render.pdf.reasons
    );
  }

  const command = preflight.render.tools.latexmk.available ? 'latexmk' : preflight.render.tools.xelatex.available ? 'xelatex' : 'pdflatex';
  const args = command === 'latexmk'
    ? ['-pdf', '-interaction=nonstopmode', '-halt-on-error', 'main.tex']
    : ['-interaction=nonstopmode', '-halt-on-error', 'main.tex'];

  const execution = await runCommand(command, args, {
    cwd: finalPaths.finalPaperDir,
    env: process.env,
  });
  await FileSystemUtils.writeFile(finalPaths.pdfRenderLogPath, execution.combinedOutput);

  if (execution.exitCode !== 0 || !(await FileSystemUtils.fileExists(finalPaths.paperPdfPath))) {
    return buildFinalArtifactStatus(
      'blocked',
      null,
      `PDF rendering failed when running ${command}.`,
      [`See \`${path.basename(finalPaths.pdfRenderLogPath)}\` for details.`]
    );
  }

  return buildFinalArtifactStatus(
    'complete',
    finalPaths.paperPdfPath,
    `PDF rendering succeeded via ${command}.`,
    [`Render log: \`${path.basename(finalPaths.pdfRenderLogPath)}\`.`]
  );
}

async function tryRenderWord(
  finalPaths: ConcludeFinalPaperArtifactPaths,
  preflight: ConcludePreflightResult
): Promise<ConcludeFinalArtifactStatus> {
  if (preflight.render.word.status !== 'available') {
    return buildFinalArtifactStatus(
      'blocked',
      null,
      'Word rendering is blocked because pandoc is unavailable.',
      preflight.render.word.reasons
    );
  }

  const execution = await runCommand('pandoc', ['main.tex', '-o', 'paper.docx'], {
    cwd: finalPaths.finalPaperDir,
    env: process.env,
  });
  await FileSystemUtils.writeFile(finalPaths.wordRenderLogPath, execution.combinedOutput);

  if (execution.exitCode !== 0 || !(await FileSystemUtils.fileExists(finalPaths.paperDocxPath))) {
    return buildFinalArtifactStatus(
      'blocked',
      null,
      'Word rendering failed when running pandoc.',
      [`See \`${path.basename(finalPaths.wordRenderLogPath)}\` for details.`]
    );
  }

  return buildFinalArtifactStatus(
    'complete',
    finalPaths.paperDocxPath,
    'Word rendering succeeded via pandoc.',
    [`Render log: \`${path.basename(finalPaths.wordRenderLogPath)}\`.`]
  );
}

function renderFinalArtifactAuditMarkdown(finalPaper: ConcludeFinalPaperPackage): string {
  const lines: string[] = [
    '# Final Artifact Audit',
    '',
    `- Overall status: ${finalPaper.overallStatus.toUpperCase()}`,
    '',
    '## Package Outputs',
    '',
    `- main.tex: ${finalPaper.mainTex.status.toUpperCase()} - ${finalPaper.mainTex.details}`,
    `- references.bib: ${finalPaper.referencesBib.status.toUpperCase()} - ${finalPaper.referencesBib.details}`,
    `- figures asset map: ${finalPaper.figures.status.toUpperCase()} - ${finalPaper.figures.details}`,
    `- citation integrity: ${finalPaper.citationIntegrity.status.toUpperCase()} - ${finalPaper.citationIntegrity.details}`,
    `- PDF render: ${finalPaper.pdf.status.toUpperCase()} - ${finalPaper.pdf.details}`,
    `- Word render: ${finalPaper.word.status.toUpperCase()} - ${finalPaper.word.details}`,
    '',
    '## Citation Support',
    '',
    `- Verified BibTeX entries: ${finalPaper.citationEntries.length}`,
  ];

  if (finalPaper.citationEntries.length > 0) {
    lines.push(...finalPaper.citationEntries.map((entry) => `- ${entry.key} (${entry.entryType})`));
  }
  if (finalPaper.citationGaps.length > 0) {
    lines.push('');
    lines.push('## Citation Gaps');
    lines.push('');
    lines.push(...finalPaper.citationGaps.map((gap) => `- ${gap}`));
  }

  lines.push('');
  lines.push('## Figure Assets');
  lines.push('');
  lines.push(...finalPaper.figureAssets.map((asset) => `- ${asset.label}: ${asset.status.toUpperCase()} (${asset.resultClaimId}) ${asset.targetPath ?? 'placeholder only'}`));
  lines.push('');

  const noteSections: Array<{ title: string; notes: string[] }> = [
    { title: 'main.tex notes', notes: finalPaper.mainTex.notes },
    { title: 'references.bib notes', notes: finalPaper.referencesBib.notes },
    { title: 'figures notes', notes: finalPaper.figures.notes },
    { title: 'PDF notes', notes: finalPaper.pdf.notes },
    { title: 'Word notes', notes: finalPaper.word.notes },
  ];

  for (const section of noteSections) {
    if (section.notes.length === 0) {
      continue;
    }
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(...section.notes.map((note) => `- ${note}`));
    lines.push('');
  }

  return lines.join('\n');
}

async function generateFinalPaperPackage(
  projectRoot: string,
  candidate: ConcludeStoryCandidate,
  claims: ConcludeResultsClaim[],
  artifactPaths: ConcludePlanningArtifactPaths,
  preflight: ConcludePreflightResult
): Promise<ConcludeFinalPaperPackage> {
  const finalPaths = buildFinalPaperArtifactPaths(artifactPaths);
  await FileSystemUtils.createDirectory(finalPaths.finalPaperDir);
  await FileSystemUtils.createDirectory(finalPaths.figuresDir);

  const citationEntries = await collectCitationEntries(artifactPaths);
  const citationGaps = citationEntries.length > 0
    ? []
    : [
        'No verified BibTeX entries were found in the selected-story planning artifacts.',
        'Background, related work, and discussion citations must be added manually before submission.',
      ];
  const figureAssets = await materializeFigureAssets(projectRoot, claims, finalPaths);

  const mainTexContent = renderMainTex({
    candidate,
    claims,
    figureAssets,
    citationEntries,
    citationGaps,
    selectedStoryPath: artifactPaths.selectedStoryPath,
  });
  const referencesBibContent = renderReferencesBib(citationEntries);
  const figureAssetMapMarkdown = renderFigureAssetMapMarkdown(figureAssets);

  await Promise.all([
    FileSystemUtils.writeFile(finalPaths.mainTexPath, mainTexContent),
    FileSystemUtils.writeFile(finalPaths.referencesBibPath, referencesBibContent),
    FileSystemUtils.writeFile(finalPaths.figureAssetMapPath, figureAssetMapMarkdown),
  ]);

  const mainTex = buildFinalArtifactStatus(
    'complete',
    finalPaths.mainTexPath,
    'Generated a reviewable TeX manuscript skeleton with Abstract, Introduction, Results, and Discussion.',
    claims.length > 0
      ? ['Every Results subsection includes internal evidence anchors drawn from QDD artifacts.']
      : ['No Results claims were available; inspect upstream story selection and evidence harvest.']
  );
  const referencesBib = citationEntries.length > 0
    ? buildFinalArtifactStatus(
        'complete',
        finalPaths.referencesBibPath,
        `Generated references.bib with ${citationEntries.length} verified BibTeX entr${citationEntries.length === 1 ? 'y' : 'ies'}.`,
        ['Only verified BibTeX entries were emitted; no placeholder citations were fabricated.']
      )
    : buildFinalArtifactStatus(
        'gap',
        finalPaths.referencesBibPath,
        'Generated an empty bibliography scaffold because no verified BibTeX entries were available.',
        citationGaps
      );
  const figures = figureAssets.some((asset) => asset.status === 'placeholder')
    ? buildFinalArtifactStatus(
        'gap',
        finalPaths.figureAssetMapPath,
        'Generated a figure asset map, but one or more Results claims still rely on placeholders.',
        ['Review `figures/asset_map.md` before submission packaging.']
      )
    : buildFinalArtifactStatus(
        'complete',
        finalPaths.figureAssetMapPath,
        'Generated figure asset map with reusable internal evidence assets.',
        [`Mapped ${figureAssets.length} figure asset entr${figureAssets.length === 1 ? 'y' : 'ies'}.`]
      );
  const citationIntegrity = citationGaps.length > 0
    ? buildFinalArtifactStatus(
        'gap',
        finalPaths.referencesBibPath,
        'Citation integrity is incomplete because verified external bibliography support is missing.',
        citationGaps
      )
    : buildFinalArtifactStatus(
        'complete',
        finalPaths.referencesBibPath,
        'Citation integrity is currently satisfied for external statements that use verified BibTeX support.',
        ['Results claims remain anchored to internal QDD evidence only.']
      );

  const pdf = await tryRenderPdf(finalPaths, preflight);
  const word = await tryRenderWord(finalPaths, preflight);

  const finalPaper: ConcludeFinalPaperPackage = {
    paths: finalPaths,
    overallStatus: determineOverallFinalStatus([mainTex, referencesBib, figures, pdf, word, citationIntegrity]),
    mainTex,
    referencesBib,
    figures,
    pdf,
    word,
    citationIntegrity,
    citationEntries,
    citationGaps,
    figureAssets,
  };

  await FileSystemUtils.writeFile(finalPaths.finalArtifactAuditPath, renderFinalArtifactAuditMarkdown(finalPaper));
  return finalPaper;
}

async function writeSelectedStoryOutput(
  outputDir: string,
  candidate: ConcludeStoryCandidate,
  inputSource: string
): Promise<void> {
  await FileSystemUtils.writeFile(
    path.join(outputDir, 'selected_story.md'),
    renderSelectedStoryMarkdown(candidate, { inputSource })
  );
}

function renderSelectedStoryMarkdown(
  candidate: ConcludeStoryCandidate,
  options: {
    inputSource: string;
  }
): string {
  return serializeMarkdownDocument({
    kind: CONCLUDE_SELECTED_STORY_KIND,
    version: CONCLUDE_SELECTED_STORY_VERSION,
    story_id: candidate.id,
    framing: candidate.framing,
    input_source: options.inputSource,
    supporting_packet_refs: candidate.supportingPacketRefs,
    boundary_packet_refs: candidate.boundaryPacketRefs,
  }, [
    '# Selected Story',
    '',
    `Selected Story ID: ${candidate.id}`,
    `Input Source: ${options.inputSource}`,
    `Framing: ${candidate.framing}`,
    `Recommended Title Style: ${candidate.recommendedTitleStyle}`,
    '',
    '## Central Claim',
    '',
    candidate.centralClaim,
    '',
    '## Story',
    '',
    candidate.story,
    '',
    '## Narrative Arc',
    '',
    ...candidate.narrativeArc.map((value) => `- ${value}`),
    '',
    '## Claim Bundle',
    '',
    ...candidate.claimBundle.map((bundle) => `- ${bundle.id}: ${bundle.statement}`),
    '',
    '## Supporting Packet Refs',
    '',
    ...candidate.supportingPacketRefs.map((value) => `- ${value}`),
    '',
    '## Boundary Packet Refs',
    '',
    ...candidate.boundaryPacketRefs.map((value) => `- ${value}`),
    '',
    '## Reviewer Objections',
    '',
    ...candidate.reviewerObjections.map((value) => `- ${value}`),
    '',
    '## Claim Safety Limits',
    '',
    ...candidate.claimSafetyLimits.map((value) => `- ${value}`),
    '',
  ].join('\n'));
}

async function resolveSelectedStory(
  projectRoot: string,
  outputDir: string,
  options: GenerateConcludeStoryCandidatesOptions,
  candidates: ConcludeStoryCandidate[]
): Promise<{
  selectedStoryId: string | null;
  selectedStoryPath: string | null;
  selectedCandidate: ConcludeStoryCandidate | null;
  selectedStoryInputSource: string | null;
  selectedStoryMarkdown: string | null;
}> {
  const candidateById = new Map(candidates.map((candidate) => [normalizeStoryId(candidate.id), candidate] as const));
  const directSelectedStoryId = options.selectedStoryId ? normalizeStoryId(options.selectedStoryId) : null;
  const selectedStoryPathInput = options.selectedStoryPath?.trim();
  const auditSelectedStoryPath = path.join(outputDir, 'selected_story.md');
  const defaultSelectedStoryPath = path.join(outputDir, 'selected_story.md');
  const absoluteSelectedStoryPath = selectedStoryPathInput
    ? resolveProjectLocalPath(projectRoot, selectedStoryPathInput, 'Selected story path')
    : defaultSelectedStoryPath;
  const selectedStoryPathExists = await FileSystemUtils.fileExists(absoluteSelectedStoryPath);

  let parsedSelectedStoryId: string | null = null;
  if (selectedStoryPathExists) {
    const content = await FileSystemUtils.readFile(absoluteSelectedStoryPath);
    parsedSelectedStoryId = parseSelectedStoryId(content);
  } else if (selectedStoryPathInput) {
    throw new Error(`Selected story file was not found at '${toProjectRelativePath(projectRoot, absoluteSelectedStoryPath)}'.`);
  }

  const selectedStoryId = directSelectedStoryId ?? parsedSelectedStoryId;
  if (!selectedStoryId) {
    if (options.selectedStoryId || options.selectedStoryPath) {
      throw new Error('Selected story input is present but no valid story id such as story-1 could be resolved.');
    }
    return {
      selectedStoryId: null,
      selectedStoryPath: null,
      selectedCandidate: null,
      selectedStoryInputSource: null,
      selectedStoryMarkdown: null,
    };
  }

  const selectedCandidate = candidateById.get(selectedStoryId);
  if (!selectedCandidate) {
    throw new Error(`Selected story '${selectedStoryId}' does not match any generated candidate.`);
  }

  const selectionInputSource =
    selectedStoryPathExists
      ? toProjectRelativePath(projectRoot, absoluteSelectedStoryPath)
      : options.selectedStoryId
        ? 'inline-selected-story-id'
        : 'unknown-selection-input';

  return {
    selectedStoryId,
    selectedStoryPath: toProjectRelativePath(projectRoot, auditSelectedStoryPath),
    selectedCandidate,
    selectedStoryInputSource: selectionInputSource,
    selectedStoryMarkdown: renderSelectedStoryMarkdown(selectedCandidate, {
      inputSource: selectionInputSource,
    }),
  };
}

function renderStoryCandidatesMarkdown(result: ConcludeStoryGenerationResult): string {
  const lines: string[] = [
    '# Story Candidates',
    '',
    `- Run ID: ${result.runId}`,
    result.selectionRequired
      ? '- Selection gate: STOP here until a human selects one story candidate.'
      : `- Selected story: ${result.selectedStoryId ?? 'unknown'}`,
    result.selectionRequired
      ? '- V1 behavior: do not auto-select the highest score and do not generate manuscript planning artifacts yet.'
      : '- Manuscript planning artifacts have been generated for the selected story; final manuscript drafting is the next step.',
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
    lines.push('### Narrative Arc');
    lines.push('');
    lines.push(...candidate.narrativeArc.map((value) => `- ${value}`));
    lines.push('');
    lines.push('### Claim Bundle');
    lines.push('');
    for (const bundle of candidate.claimBundle) {
      lines.push(`- ${bundle.id}: ${bundle.statement}`);
      lines.push(`  Packet refs: ${bundle.evidencePacketRefs.join(', ') || 'n/a'}`);
      lines.push(`  Boundary refs: ${bundle.boundaryPacketRefs.join(', ') || 'n/a'}`);
      lines.push(`  Validation focus: ${bundle.validationFocus}`);
    }
    lines.push('');
    lines.push('### Supporting Packet Refs');
    lines.push('');
    lines.push(...candidate.supportingPacketRefs.map((value) => `- ${value}`));
    lines.push('');
    lines.push('### Boundary Packet Refs');
    lines.push('');
    lines.push(...candidate.boundaryPacketRefs.map((value) => `- ${value}`));
    lines.push('');
    lines.push('### Reviewer Objections');
    lines.push('');
    lines.push(...candidate.reviewerObjections.map((value) => `- ${value}`));
    lines.push('');
    lines.push('### Claims Allowed');
    lines.push('');
    lines.push(...candidate.claimsAllowed.map((value) => `- ${value}`));
    lines.push('');
    lines.push('### Claim Safety Limits');
    lines.push('');
    lines.push(...candidate.claimSafetyLimits.map((value) => `- ${value}`));
    lines.push('');
    lines.push('### Claims To Soften Or Avoid');
    lines.push('');
    lines.push(...candidate.claimsToSoftenOrAvoid.map((value) => `- ${value}`));
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function renderEvidencePacketsMarkdown(packets: ConcludeEvidencePacket[]): string {
  const lines: string[] = ['# Evidence Packets', ''];

  for (const packet of packets) {
    lines.push(`## ${packet.id}`);
    lines.push('');
    lines.push(`- Label: ${packet.label}`);
    lines.push(`- Kind: ${packet.kind}`);
    lines.push(`- Focus: ${packet.focus}`);
    lines.push(`- Claim strength: ${packet.claimStrength}`);
    lines.push(`- Evidence refs: ${packet.evidenceIds.join(', ') || 'n/a'}`);
    lines.push(`- Source paths: ${packet.sourcePaths.join(', ') || 'n/a'}`);
    lines.push('');
    lines.push(packet.manuscriptSummary);
    lines.push('');
    lines.push(`- Rationale: ${packet.rationale}`);
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
    FileSystemUtils.writeFile(path.join(result.outputDir, 'evidence_packets.md'), renderEvidencePacketsMarkdown(result.evidencePackets)),
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

  return resolveProjectLocalPath(projectRoot, requested, 'Conclude output directory');
}

export async function generateConcludeStoryCandidates(
  projectRoot: string,
  options: GenerateConcludeStoryCandidatesOptions = {}
): Promise<ConcludeStoryGenerationResult> {
  const preflight = await inspectConcludePreflight(projectRoot, options);
  if (preflight.projectStatus === 'blocked') {
    throw new Error(`Conclude preflight is blocked: ${preflight.projectBlockers.join(' ')}`);
  }

  const evidence = await harvestConcludeEvidence(preflight);
  const evidencePackets = buildEvidencePackets(evidence);
  const candidates = buildStoryCandidates(evidence, evidencePackets, preflight.snapshot.contract).slice(0, 3);
  const claimSafetyAudit = collectClaimSafetyAudit(evidence);
  const runId = options.runId ?? slugifyConcludeTimestamp(options.now ?? new Date());
  const outputDir = resolveConcludeOutputDir(preflight.projectRoot, options.outputDir, runId);
  const selectedStory = await resolveSelectedStory(preflight.projectRoot, outputDir, options, candidates);
  const resultsClaims = selectedStory.selectedCandidate
    ? buildResultsClaims(selectedStory.selectedCandidate, evidence, evidencePackets, claimSafetyAudit)
    : [];
  const planningArtifacts = selectedStory.selectedCandidate && selectedStory.selectedStoryPath
    ? buildPlanningArtifactPaths(outputDir, selectedStory.selectedStoryPath)
    : null;

  const result: ConcludeStoryGenerationResult = {
    runId,
    outputDir,
    storyCandidatesPath: path.join(outputDir, 'story_candidates.md'),
    evidencePacketsPath: path.join(outputDir, 'evidence_packets.md'),
    evidenceAuditPath: path.join(outputDir, 'evidence_audit.md'),
    claimSafetyAuditPath: path.join(outputDir, 'claim_safety_audit.md'),
    reviewerRiskAuditPath: path.join(outputDir, 'reviewer_risk_audit.md'),
    selectionRequired: selectedStory.selectedCandidate === null,
    selectedStoryId: selectedStory.selectedStoryId,
    selectedStoryPath: selectedStory.selectedStoryPath,
    selectedCandidate: selectedStory.selectedCandidate,
    planningArtifacts,
    resultsClaims,
    candidates,
    evidence,
    evidencePackets,
    claimSafetyAudit,
    nextStep: selectedStory.selectedCandidate ? 'draft-manuscript' : 'select-story',
  };

  await writeConcludeStoryOutputs(result);
  if (selectedStory.selectedCandidate && selectedStory.selectedStoryInputSource) {
    await writeSelectedStoryOutput(
      outputDir,
      selectedStory.selectedCandidate,
      selectedStory.selectedStoryInputSource
    );
  }
  if (selectedStory.selectedCandidate && planningArtifacts) {
    await writePlanningArtifacts(selectedStory.selectedCandidate, resultsClaims, planningArtifacts);
  }
  return result;
}

export async function runConclude(projectRoot: string, options: RunConcludeOptions = {}): Promise<RunConcludeResult> {
  const preflight = await inspectConcludePreflight(projectRoot, options);
  if (preflight.projectStatus === 'blocked') {
    throw new Error(`Conclude preflight is blocked: ${preflight.projectBlockers.join(' ')}`);
  }

  const baseResult = await generateConcludeStoryCandidates(projectRoot, options);
  const finalPaperArtifacts = baseResult.selectedCandidate && baseResult.planningArtifacts
    ? await generateFinalPaperPackage(
        preflight.projectRoot,
        baseResult.selectedCandidate,
        baseResult.resultsClaims,
        baseResult.planningArtifacts,
        preflight
      )
    : null;
  const renderStatusPath = path.join(baseResult.outputDir, 'render_status.md');
  await FileSystemUtils.writeFile(renderStatusPath, renderConcludeRenderStatusMarkdown(preflight, finalPaperArtifacts));

  return {
    ...baseResult,
    nextStep: finalPaperArtifacts ? 'review-final-draft' : baseResult.nextStep,
    preflight,
    renderStatusPath,
    finalPaperArtifacts,
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

export function renderConcludeRenderStatusMarkdown(
  result: ConcludePreflightResult,
  finalPaper: ConcludeFinalPaperPackage | null = null
): string {
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
    ...(finalPaper
      ? [
          '## Final Paper Package',
          '',
          `- Overall: ${finalPaper.overallStatus.toUpperCase()}`,
          `- main.tex: ${finalPaper.mainTex.status.toUpperCase()} - ${finalPaper.mainTex.details}`,
          `- references.bib: ${finalPaper.referencesBib.status.toUpperCase()} - ${finalPaper.referencesBib.details}`,
          `- figures asset map: ${finalPaper.figures.status.toUpperCase()} - ${finalPaper.figures.details}`,
          `- citation integrity: ${finalPaper.citationIntegrity.status.toUpperCase()} - ${finalPaper.citationIntegrity.details}`,
          `- PDF render: ${finalPaper.pdf.status.toUpperCase()} - ${finalPaper.pdf.details}`,
          `- Word render: ${finalPaper.word.status.toUpperCase()} - ${finalPaper.word.details}`,
          '',
        ]
      : []),
  ].join('\n');
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  }
): Promise<{ exitCode: number; stdout: string; stderr: string; combinedOutput: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      const errorMessage = (error as Error).message;
      resolve({
        exitCode: 1,
        stdout,
        stderr: `${stderr}${stderr.endsWith('\n') || stderr.length === 0 ? '' : '\n'}${errorMessage}\n`,
        combinedOutput: [stdout, stderr, errorMessage].filter((value) => value.length > 0).join('\n'),
      });
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        combinedOutput: [stdout, stderr].filter((value) => value.length > 0).join('\n'),
      });
    });
  });
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
