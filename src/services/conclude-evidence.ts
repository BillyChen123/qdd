import path from 'node:path';
import * as fs from 'node:fs/promises';
import type {
  ArtifactCandidateEntry,
  ArtifactIndexEntry,
  ArtifactType,
  ConcludeClaimStrength,
  ConcludeEvidenceAssetCandidate,
  ConcludeEvidenceDossier,
  ConcludeEvidenceDossierAudit,
  ConcludeEvidenceDossierAuditViolation,
  ConcludeEvidenceDossierGap,
  ConcludeEvidenceDossierUnit,
  ConcludeEvidenceEligibility,
  ConcludeEvidenceNarrative,
  ConcludeEvidenceProvenanceRef,
  ConcludeEvidenceRegistration,
  ConcludeEvidenceSourceRole,
  ConcludeEvidenceStatistic,
  ConcludePreflightResult,
} from '../types.js';
import { readArtifactCandidateManifest } from '../runtime/evidence.js';

export const CONCLUDE_EVIDENCE_READ_LIMITS = {
  maxBytesPerTextSource: 2 * 1024 * 1024,
  maxRowsPerTable: 5000,
  maxEvidenceUnitsPerSource: 24,
} as const;

const FIGURE_HEADER_READ_LIMIT = 64 * 1024;
const QDD_ID_PATTERN = /\b(?:ART|STUDY|TASK)-\d{3}\b/i;
const EXECUTION_LANGUAGE_PATTERN = /\b(?:reusable for|useful for (?:filtering|downstream)|loads?|extracts?|exports?|artifact description|artifact candidate|execution status|output files?|task status)\b/i;
const BOUNDARY_PATTERN = /\b(?:limitations?|limited|underpowered|insufficient|does not support|not supported|unsupported|failed|failure|no significant|cannot|could not|boundary|claim ceiling|caveat|single-donor|n\s*=\s*1)\b/i;
const CONTRADICTING_PATTERN = /\b(?:does not support|not supported|unsupported|failed|failure|no significant|weakened|contradict)\b/i;
const RESULT_HEADING_PATTERN = /\b(?:result|finding|summary|comparison|biological|localization|assessment|conclusion|evidence|what this case)\b/i;
const BOUNDARY_HEADING_PATTERN = /\b(?:limitations?|boundary|claim ceiling|caveat|negative|unsupported|adjudication)\b/i;
const METHODS_HEADING_PATTERN = /\b(?:method|input|output|file|implementation|workflow|recommendation|data source|resource|question|hypothesis|background|context|objective|goal)\b/i;
const SCIENTIFIC_SIGNAL_PATTERN = /(?:\b(?:fdr|p\s*[<=>]|log2?fc|fold change|correlat|enrich|higher|lower|increase|decrease|significant|transcript|gene|loci|donor|cluster|cohort|condition|proportion|mean|median)\b|\d)/i;
const RESULT_ASSERTION_PATTERN = /\b(?:identified|showed|higher|lower|increased|decreased|significant|enriched|localized|remained|retained|revealed|found|observed|supported|weakened|spanned|reached|yielded|converged|associated)\b/i;
const DEFAULT_ALLOWED_VERBS = ['showed', 'was associated with', 'was higher than', 'was lower than'];
const DEFAULT_FORBIDDEN_VERBS = ['caused', 'drove', 'proved', 'established a mechanism'];

interface ArtifactSource {
  key: string;
  sourcePath: string;
  type: ArtifactType;
  format: string;
  artifactIds: string[];
  studyIds: string[];
  taskIds: string[];
  registrations: ConcludeEvidenceRegistration[];
  catalogDescriptions: string[];
  hasArtifactIndexEntry: boolean;
}

interface BoundedReadResult {
  content: string;
  bytesRead: number;
  truncated: boolean;
}

interface DelimitedRow {
  values: string[];
  line: number;
}

interface TableField {
  name: string;
  value: string;
}

interface TableRowCandidate {
  row: DelimitedRow;
  record: Record<string, string>;
  narrative: ConcludeEvidenceNarrative;
  selector: Record<string, string>;
  score: number;
}

interface MarkdownParagraph {
  text: string;
  startLine: number;
  endLine: number;
  heading: string | null;
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function humanizeField(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sentenceCase(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

function parseProducedBy(value: string): { studyIds: string[]; taskIds: string[] } {
  const parts = value.split('/').map((entry) => entry.trim());
  return {
    studyIds: parts.filter((entry) => /^STUDY-\d{3}$/.test(entry)),
    taskIds: parts.filter((entry) => /^TASK-\d{3}$/.test(entry)),
  };
}

async function buildSourceKey(projectRoot: string, relativePath: string): Promise<string> {
  try {
    return `real:${await fs.realpath(path.join(projectRoot, relativePath))}`;
  } catch {
    return `logical:${normalizeRelativePath(relativePath)}`;
  }
}

function mergeSource(target: ArtifactSource, incoming: ArtifactSource): ArtifactSource {
  const preferIncoming = incoming.hasArtifactIndexEntry && !target.hasArtifactIndexEntry;
  return {
    ...target,
    sourcePath: preferIncoming ? incoming.sourcePath : target.sourcePath,
    type: preferIncoming ? incoming.type : target.type,
    format: preferIncoming ? incoming.format : target.format,
    artifactIds: unique([...target.artifactIds, ...incoming.artifactIds]),
    studyIds: unique([...target.studyIds, ...incoming.studyIds]),
    taskIds: unique([...target.taskIds, ...incoming.taskIds]),
    registrations: unique([...target.registrations, ...incoming.registrations]) as ConcludeEvidenceRegistration[],
    catalogDescriptions: unique([...target.catalogDescriptions, ...incoming.catalogDescriptions]),
    hasArtifactIndexEntry: target.hasArtifactIndexEntry || incoming.hasArtifactIndexEntry,
  };
}

async function sourceFromIndex(projectRoot: string, artifact: ArtifactIndexEntry): Promise<ArtifactSource> {
  const sourcePath = normalizeRelativePath(artifact.path);
  const producedBy = parseProducedBy(artifact.produced_by);
  return {
    key: await buildSourceKey(projectRoot, sourcePath),
    sourcePath,
    type: artifact.type,
    format: artifact.format.replace(/^\./, '') || path.extname(sourcePath).replace(/^\./, ''),
    artifactIds: [artifact.id],
    studyIds: producedBy.studyIds,
    taskIds: producedBy.taskIds,
    registrations: ['artifact-index'],
    catalogDescriptions: [artifact.description.trim()].filter(Boolean),
    hasArtifactIndexEntry: true,
  };
}

async function sourceFromCandidate(
  projectRoot: string,
  studyId: string,
  candidate: ArtifactCandidateEntry
): Promise<ArtifactSource> {
  const sourcePath = normalizeRelativePath(candidate.path);
  return {
    key: await buildSourceKey(projectRoot, sourcePath),
    sourcePath,
    type: candidate.type,
    format: path.extname(sourcePath).replace(/^\./, '') || candidate.schema,
    artifactIds: [],
    studyIds: [studyId],
    taskIds: candidate.task_id ? [candidate.task_id] : [],
    registrations: ['artifact-candidate'],
    catalogDescriptions: [candidate.description.trim()].filter(Boolean),
    hasArtifactIndexEntry: false,
  };
}

async function collectArtifactSources(result: ConcludePreflightResult): Promise<ArtifactSource[]> {
  const sources = new Map<string, ArtifactSource>();

  for (const artifact of result.snapshot.artifactIndex?.artifacts ?? []) {
    const source = await sourceFromIndex(result.projectRoot, artifact);
    sources.set(source.key, sources.has(source.key) ? mergeSource(sources.get(source.key)!, source) : source);
  }

  for (const study of result.snapshot.studies) {
    if (!study.artifactCandidatesPath) {
      continue;
    }
    const manifest = await readArtifactCandidateManifest(result.projectRoot, study.studyId);
    for (const candidate of manifest.artifact_candidates ?? []) {
      const source = await sourceFromCandidate(result.projectRoot, study.studyId, candidate);
      sources.set(source.key, sources.has(source.key) ? mergeSource(sources.get(source.key)!, source) : source);
    }
  }

  return [...sources.values()].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

async function readBoundedText(absolutePath: string, maxBytes = CONCLUDE_EVIDENCE_READ_LIMITS.maxBytesPerTextSource): Promise<BoundedReadResult> {
  const handle = await fs.open(absolutePath, 'r');
  try {
    const stats = await handle.stat();
    const requestedBytes = Math.min(stats.size, maxBytes);
    const buffer = Buffer.alloc(requestedBytes);
    const { bytesRead } = await handle.read(buffer, 0, requestedBytes, 0);
    const truncated = stats.size > bytesRead;
    let content = buffer.subarray(0, bytesRead).toString('utf-8');
    if (truncated) {
      const lastNewline = content.lastIndexOf('\n');
      content = lastNewline >= 0 ? content.slice(0, lastNewline + 1) : '';
    }
    return { content, bytesRead, truncated };
  } finally {
    await handle.close();
  }
}

function parseDelimitedRows(content: string, delimiter: string): DelimitedRow[] {
  const rows: DelimitedRow[] = [];
  let values: string[] = [];
  let current = '';
  let quoted = false;
  let line = 1;
  let rowStartLine = 1;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') {
        index += 1;
      }
      values.push(current.trim());
      current = '';
      if (values.some((value) => value.length > 0)) {
        rows.push({ values, line: rowStartLine });
        if (rows.length >= CONCLUDE_EVIDENCE_READ_LIMITS.maxRowsPerTable + 1) {
          return rows;
        }
      }
      values = [];
      line += 1;
      rowStartLine = line;
      continue;
    }
    current += character;
    if (character === '\n') {
      line += 1;
    }
  }

  values.push(current.trim());
  if (values.some((value) => value.length > 0) && rows.length < CONCLUDE_EVIDENCE_READ_LIMITS.maxRowsPerTable + 1) {
    rows.push({ values, line: rowStartLine });
  }
  return rows;
}

function isNumeric(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Number(value));
}

function findHeader(headers: string[], patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = headers.find((header) => pattern.test(header));
    if (match) {
      return match;
    }
  }
  return null;
}

function collectFields(record: Record<string, string>, patterns: RegExp[]): TableField[] {
  return Object.entries(record)
    .filter(([name, value]) => value.length > 0 && patterns.some((pattern) => pattern.test(name)))
    .map(([name, value]) => ({ name, value }));
}

function buildTableNarrative(headers: string[], record: Record<string, string>): ConcludeEvidenceNarrative | null {
  const effectHeader = findHeader(headers, [
    /^(?:avg_)?log2?fc$/i,
    /fold[_ -]?change/i,
    /^(?:effect|estimate|beta|odds[_ -]?ratio)$/i,
    /(?:correlation|spearman|pearson|rho)$/i,
    /^(?:mean|median)(?:_|$)/i,
    /(?:_mean|_median|proportion|fraction|score)$/i,
  ]);
  if (!effectHeader || !isNumeric(record[effectHeader] ?? '')) {
    return null;
  }

  const entityFields = collectFields(record, [
    /^(?:gene_symbol|gene|symbol|feature_id|transcript_id|transcript|protein|term|pathway|dimension|feature)$/i,
  ]).slice(0, 2);
  const populationFields = collectFields(record, [
    /^(?:population|cell_type|celltype|subcluster|cluster|cohort|tissue|region|sample_group|group)$/i,
  ]).slice(0, 2);
  const comparisonFields = collectFields(record, [
    /^(?:comparison|contrast|condition|direction|dtu_direction)$/i,
  ]).slice(0, 2);
  const statisticFields = collectFields(record, [
    /(?:^|_)(?:pvalue|p_value|pval|fdr|qvalue|q_value|adj_pvalue|padj|z_score|statistic|lr|n|count)(?:$|_)/i,
    /^(?:fdr|p|n)$/i,
  ]).filter((field) => isNumeric(field.value)).slice(0, 6);
  const uncertaintyFields = collectFields(record, [/(?:^|_)(?:ci|se|stderr|std|sd)(?:$|_)/i])
    .filter((field) => isNumeric(field.value))
    .slice(0, 4);
  const effect = { name: effectHeader, value: record[effectHeader] };
  const population = populationFields.length > 0
    ? populationFields.map((field) => `${humanizeField(field.name)} ${field.value}`).join(', ')
    : null;
  const comparison = comparisonFields.length > 0
    ? comparisonFields.map((field) => humanizeField(field.value)).join(', ')
    : null;
  const entity = entityFields.map((field) => field.value).filter((value, index, values) => values.indexOf(value) === index).join(' ');
  const context = population ? ` in ${population}` : '';
  const comparisonClause = comparison ? ` (${comparison})` : '';
  const statisticClause = statisticFields.length > 0
    ? `, with ${statisticFields.map((field) => `${humanizeField(field.name)}=${field.value}`).join(', ')}`
    : '';
  const statement = entity.length > 0
    ? `${entity}${context} showed ${humanizeField(effect.name)}=${effect.value}${comparisonClause}${statisticClause}.`
    : population
      ? `In ${population}, ${humanizeField(effect.name)} was ${effect.value}${comparisonClause}${statisticClause}.`
      : `${sentenceCase(humanizeField(effect.name))} was ${effect.value}${statisticClause}.`;

  return {
    scientificStatement: sentenceCase(statement),
    population,
    comparison,
    effect,
    statistics: statisticFields.map((field) => ({ name: field.name, value: field.value })),
    uncertainty: uncertaintyFields.map((field) => `${field.name}=${field.value}`),
    claimStrength: 'associative',
    allowedVerbs: [...DEFAULT_ALLOWED_VERBS],
    forbiddenVerbs: [...DEFAULT_FORBIDDEN_VERBS],
  };
}

function buildRowSelector(record: Record<string, string>, headers: string[]): Record<string, string> {
  const selectorHeaders = headers.filter((header) =>
    /^(?:gene_symbol|gene|symbol|feature_id|transcript_id|transcript|term|pathway|dimension|subcluster|cluster|population|comparison|condition)$/i.test(header)
  );
  const selected = selectorHeaders.filter((header) => (record[header] ?? '').length > 0).slice(0, 3);
  if (selected.length === 0) {
    const fallback = headers.find((header) => (record[header] ?? '').length > 0);
    return fallback ? { [fallback]: record[fallback] } : {};
  }
  return Object.fromEntries(selected.map((header) => [header, record[header]]));
}

function scoreTableRow(record: Record<string, string>, narrative: ConcludeEvidenceNarrative): number {
  let score = Object.values(record).some((value) => /^(?:true|yes|significant)$/i.test(value)) ? 20 : 0;
  const effectValue = Number(narrative.effect?.value ?? 0);
  score += Math.min(Math.abs(effectValue), 10) * 2;
  for (const statistic of narrative.statistics) {
    if (/(?:p|fdr|q)/i.test(statistic.name)) {
      const value = Number(statistic.value);
      if (value > 0 && value < 1) {
        score += Math.min(-Math.log10(value), 20);
      }
    }
  }
  if (/\b(?:qki|celf2)\b/i.test(narrative.scientificStatement ?? '')) {
    score += 2;
  }
  return score;
}

function makeSourceRef(
  source: ArtifactSource,
  role: ConcludeEvidenceSourceRole,
  sourceType: ConcludeEvidenceProvenanceRef['sourceType'],
  locator: ConcludeEvidenceProvenanceRef['locator']
): ConcludeEvidenceProvenanceRef {
  return {
    role,
    sourceType,
    locator,
    artifactIds: [...source.artifactIds],
    studyIds: [...source.studyIds],
    taskIds: [...source.taskIds],
    registrations: [...source.registrations],
  };
}

function emptyNarrative(claimStrength: ConcludeClaimStrength = 'bounded'): ConcludeEvidenceNarrative {
  return {
    scientificStatement: null,
    population: null,
    comparison: null,
    effect: null,
    statistics: [],
    uncertainty: [],
    claimStrength,
    allowedVerbs: [...DEFAULT_ALLOWED_VERBS],
    forbiddenVerbs: [...DEFAULT_FORBIDDEN_VERBS],
  };
}

function buildTableUnits(source: ArtifactSource, read: BoundedReadResult, delimiter: string): ConcludeEvidenceDossierUnit[] {
  const parsedRows = parseDelimitedRows(read.content, delimiter);
  const headerRow = parsedRows[0];
  if (!headerRow || parsedRows.length < 2) {
    return [buildContextUnit(source, 'The table has no readable data rows.', read, delimiter === '\t' ? 'tsv' : 'csv')];
  }
  const headers = headerRow.values.map((value, index) => value.replace(/^\uFEFF/, '').trim() || `column_${index + 1}`);
  const candidates: TableRowCandidate[] = [];

  for (const row of parsedRows.slice(1)) {
    const record = Object.fromEntries(headers.map((header, index) => [header, row.values[index] ?? '']));
    const narrative = buildTableNarrative(headers, record);
    if (!narrative || !narrative.scientificStatement || EXECUTION_LANGUAGE_PATTERN.test(narrative.scientificStatement)) {
      continue;
    }
    candidates.push({
      row,
      record,
      narrative,
      selector: buildRowSelector(record, headers),
      score: scoreTableRow(record, narrative),
    });
  }

  if (candidates.length === 0) {
    return [buildContextUnit(source, 'No row contained a supported effect or statistic field.', read, delimiter === '\t' ? 'tsv' : 'csv')];
  }

  return candidates
    .sort((left, right) => right.score - left.score || left.row.line - right.row.line)
    .slice(0, CONCLUDE_EVIDENCE_READ_LIMITS.maxEvidenceUnitsPerSource)
    .map((candidate) => ({
      id: '',
      eligibility: 'results',
      narrative: candidate.narrative,
      provenance: {
        sources: [makeSourceRef(source, 'supporting', 'artifact-content', {
          kind: 'table-row',
          path: source.sourcePath,
          row: candidate.row.line,
          selector: candidate.selector,
          columns: unique([
            candidate.narrative.effect?.name ?? '',
            ...candidate.narrative.statistics.map((statistic) => statistic.name),
          ]),
        })],
        extraction: {
          format: delimiter === '\t' ? 'tsv' : 'csv',
          bounded: true,
          bytesRead: read.bytesRead,
          truncated: read.truncated || parsedRows.length >= CONCLUDE_EVIDENCE_READ_LIMITS.maxRowsPerTable + 1,
        },
      },
      assetCandidateIds: [],
      exclusionReason: null,
    }));
}

function buildContextUnit(
  source: ArtifactSource,
  reason: string,
  read: BoundedReadResult,
  format: 'csv' | 'tsv' | 'markdown'
): ConcludeEvidenceDossierUnit {
  return {
    id: '',
    eligibility: 'methods-context',
    narrative: emptyNarrative(),
    provenance: {
      sources: [makeSourceRef(source, 'boundary', 'artifact-content', {
        kind: 'file',
        path: source.sourcePath,
        byteStart: 0,
        byteEnd: read.bytesRead,
      })],
      extraction: {
        format,
        bounded: true,
        bytesRead: read.bytesRead,
        truncated: read.truncated,
      },
    },
    assetCandidateIds: [],
    exclusionReason: reason,
  };
}

function parseMarkdownParagraphs(content: string): MarkdownParagraph[] {
  const lines = content.split(/\r?\n/);
  const paragraphs: MarkdownParagraph[] = [];
  let heading: string | null = null;
  let text: string[] = [];
  let startLine = 1;

  const flush = (endLine: number): void => {
    if (text.length > 0) {
      paragraphs.push({ text: text.join(' '), startLine, endLine, heading });
      text = [];
    }
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      flush(lineNumber - 1);
      heading = headingMatch[1].trim();
      return;
    }
    if (/^\s*$/.test(line)) {
      flush(lineNumber - 1);
      return;
    }
    if (/^\s*\|/.test(line)) {
      flush(lineNumber - 1);
      return;
    }
    const isListItem = /^\s*(?:[-*+] |\d+[.)]\s+)/.test(line);
    if (isListItem) {
      flush(lineNumber - 1);
      startLine = lineNumber;
      text = [line];
      flush(lineNumber);
      return;
    }
    if (text.length === 0) {
      startLine = lineNumber;
    }
    text.push(line);
  });
  flush(lines.length);
  return paragraphs;
}

function cleanMarkdownNarrative(value: string): string {
  const withoutMarkdown = value
    .replace(/^\s*(?:[-*+] |\d+[.)]\s+)/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .replace(/\b(?:ART|STUDY|TASK)-\d{3}(?:'s)?\b/gi, 'the prior analysis')
    .replace(/\s+/g, ' ')
    .trim();
  const safeSentences = withoutMarkdown
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !EXECUTION_LANGUAGE_PATTERN.test(sentence));
  return sentenceCase(safeSentences.join(' '));
}

function extractTextStatistics(text: string): ConcludeEvidenceStatistic[] {
  const statistics: ConcludeEvidenceStatistic[] = [];
  const pattern = /\b(FDR|q(?:-?value)?|p(?:-?value)?|log2?FC|rho|r|N)\s*([=<>&≤≥]+)\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi;
  for (const match of text.matchAll(pattern)) {
    statistics.push({ name: match[1], value: `${match[2]}${match[3]}` });
    if (statistics.length >= 6) {
      break;
    }
  }
  return statistics;
}

function inferTextPopulation(text: string): string | null {
  const match = text.match(/\b(?:within|across|in)\s+([^.;]{3,80}?(?:donors?|astrocytes?|cells?|nuclei|cohort|cluster|subcluster|tissue|loci))\b/i);
  return match ? match[1].trim() : null;
}

function inferTextComparison(text: string): string | null {
  const match = text.match(/\b([A-Za-z0-9+_-]+(?:\s+[A-Za-z0-9+_-]+){0,3})\s+(?:vs\.?|versus|compared with|compared to)\s+([A-Za-z0-9+_-]+(?:\s+[A-Za-z0-9+_-]+){0,3})\b/i);
  return match ? `${match[1]} versus ${match[2]}` : null;
}

function buildMarkdownNarrative(statement: string, eligibility: ConcludeEvidenceEligibility): ConcludeEvidenceNarrative {
  const statistics = extractTextStatistics(statement);
  const effect = statistics.find((statistic) => /log2?fc|rho|^r$/i.test(statistic.name)) ?? null;
  return {
    scientificStatement: statement,
    population: inferTextPopulation(statement),
    comparison: inferTextComparison(statement),
    effect,
    statistics: effect ? statistics.filter((statistic) => statistic !== effect) : statistics,
    uncertainty: eligibility === 'boundary' ? [statement] : [],
    claimStrength: eligibility === 'results' ? 'associative' : 'bounded',
    allowedVerbs: [...DEFAULT_ALLOWED_VERBS],
    forbiddenVerbs: [...DEFAULT_FORBIDDEN_VERBS],
  };
}

function buildMarkdownUnits(source: ArtifactSource, read: BoundedReadResult): ConcludeEvidenceDossierUnit[] {
  const units: ConcludeEvidenceDossierUnit[] = [];
  for (const paragraph of parseMarkdownParagraphs(read.content)) {
    const statement = cleanMarkdownNarrative(paragraph.text);
    if (!statement || QDD_ID_PATTERN.test(statement) || EXECUTION_LANGUAGE_PATTERN.test(statement)) {
      continue;
    }
    const heading = paragraph.heading ?? '';
    const isBoundary = BOUNDARY_HEADING_PATTERN.test(heading) || BOUNDARY_PATTERN.test(statement);
    const isMethods = METHODS_HEADING_PATTERN.test(heading);
    const isResult = !isMethods
      && RESULT_HEADING_PATTERN.test(heading)
      && SCIENTIFIC_SIGNAL_PATTERN.test(statement)
      && RESULT_ASSERTION_PATTERN.test(statement);
    if (!isBoundary && !isResult) {
      continue;
    }
    const eligibility: ConcludeEvidenceEligibility = isBoundary ? 'boundary' : 'results';
    const role: ConcludeEvidenceSourceRole = isBoundary
      ? CONTRADICTING_PATTERN.test(statement) ? 'contradicting' : 'boundary'
      : 'supporting';
    units.push({
      id: '',
      eligibility,
      narrative: buildMarkdownNarrative(statement, eligibility),
      provenance: {
        sources: [makeSourceRef(source, role, 'artifact-content', {
          kind: 'markdown-lines',
          path: source.sourcePath,
          startLine: paragraph.startLine,
          endLine: paragraph.endLine,
          heading: paragraph.heading,
        })],
        extraction: {
          format: 'markdown',
          bounded: true,
          bytesRead: read.bytesRead,
          truncated: read.truncated,
        },
      },
      assetCandidateIds: [],
      exclusionReason: null,
    });
    if (units.length >= CONCLUDE_EVIDENCE_READ_LIMITS.maxEvidenceUnitsPerSource) {
      break;
    }
  }
  return units.length > 0 ? units : [buildContextUnit(source, 'No explicit scientific result or boundary paragraph was found.', read, 'markdown')];
}

function safeCatalogCaption(descriptions: string[]): string | null {
  for (const description of descriptions) {
    const cleaned = cleanMarkdownNarrative(description);
    if (cleaned && !QDD_ID_PATTERN.test(cleaned) && !EXECUTION_LANGUAGE_PATTERN.test(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

async function readFigureDimensions(absolutePath: string, format: string): Promise<{ width: number | null; height: number | null; bytesRead: number }> {
  const handle = await fs.open(absolutePath, 'r');
  try {
    const stats = await handle.stat();
    const requestedBytes = Math.min(stats.size, FIGURE_HEADER_READ_LIMIT);
    const buffer = Buffer.alloc(requestedBytes);
    const { bytesRead } = await handle.read(buffer, 0, requestedBytes, 0);
    if (/png/i.test(format) && bytesRead >= 24 && buffer.subarray(1, 4).toString('ascii') === 'PNG') {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytesRead };
    }
    if (/svg/i.test(format)) {
      const text = buffer.subarray(0, bytesRead).toString('utf-8');
      const viewBox = text.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)["']/i);
      const width = text.match(/\bwidth=["']([\d.]+)/i);
      const height = text.match(/\bheight=["']([\d.]+)/i);
      return {
        width: width ? Math.round(Number(width[1])) : viewBox ? Math.round(Number(viewBox[1])) : null,
        height: height ? Math.round(Number(height[1])) : viewBox ? Math.round(Number(viewBox[2])) : null,
        bytesRead,
      };
    }
    return { width: null, height: null, bytesRead };
  } finally {
    await handle.close();
  }
}

function buildTableAsset(source: ArtifactSource): ConcludeEvidenceAssetCandidate {
  const caption = safeCatalogCaption(source.catalogDescriptions);
  return {
    id: '',
    kind: 'table',
    format: source.format,
    caption,
    recommendedUse: 'Provide tabulated values with row-level source locators for linked claims.',
    width: null,
    height: null,
    linkedEvidenceUnitIds: [],
    provenance: {
      source: makeSourceRef(source, 'supporting', 'artifact-metadata', {
        kind: 'file',
        path: source.sourcePath,
        byteStart: 0,
        byteEnd: 0,
      }),
      catalogDescriptions: [...source.catalogDescriptions],
    },
  };
}

async function buildFigureAsset(projectRoot: string, source: ArtifactSource): Promise<ConcludeEvidenceAssetCandidate> {
  const absolutePath = path.join(projectRoot, source.sourcePath);
  const dimensions = await readFigureDimensions(absolutePath, source.format);
  const caption = safeCatalogCaption(source.catalogDescriptions);
  return {
    id: '',
    kind: 'figure',
    format: source.format,
    caption,
    recommendedUse: caption
      ? `Illustrate ${caption.replace(/[.]$/, '').replace(/^./, (value) => value.toLowerCase())}.`
      : 'Use as a figure candidate only after a source-backed caption is supplied.',
    width: dimensions.width,
    height: dimensions.height,
    linkedEvidenceUnitIds: [],
    provenance: {
      source: makeSourceRef(source, 'supporting', 'artifact-metadata', {
        kind: 'file',
        path: source.sourcePath,
        byteStart: 0,
        byteEnd: dimensions.bytesRead,
      }),
      catalogDescriptions: [...source.catalogDescriptions],
    },
  };
}

async function buildExcludedUnit(
  projectRoot: string,
  source: ArtifactSource,
  reason: string
): Promise<{ unit: ConcludeEvidenceDossierUnit; gap: ConcludeEvidenceDossierGap }> {
  let bytesRead = 0;
  try {
    const stats = await fs.stat(path.join(projectRoot, source.sourcePath));
    bytesRead = Math.min(stats.size, FIGURE_HEADER_READ_LIMIT);
  } catch {
    bytesRead = 0;
  }
  return {
    unit: {
      id: '',
      eligibility: 'excluded',
      narrative: emptyNarrative(),
      provenance: {
        sources: [makeSourceRef(source, 'boundary', 'artifact-metadata', {
          kind: 'file',
          path: source.sourcePath,
          byteStart: 0,
          byteEnd: bytesRead,
        })],
        extraction: {
          format: 'unsupported',
          bounded: true,
          bytesRead,
          truncated: false,
        },
      },
      assetCandidateIds: [],
      exclusionReason: reason,
    },
    gap: {
      sourcePath: source.sourcePath,
      artifactType: source.type,
      reason,
      artifactIds: [...source.artifactIds],
      studyIds: [...source.studyIds],
      taskIds: [...source.taskIds],
    },
  };
}

function sourceTokens(value: string): Set<string> {
  const stopwords = new Set([
    'art', 'task', 'study', 'table', 'figure', 'summary', 'result', 'results', 'analysis',
    'with', 'from', 'that', 'this', 'cluster', 'subcluster', 'astrocyte', 'cells', 'genes',
    'expression', 'score', 'state', 'substantia', 'nigra', 'control',
  ]);
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !stopwords.has(token) && !/^\d+$/.test(token))
  );
}

function sharesScientificToken(left: string, right: string): boolean {
  const leftTokens = sourceTokens(left);
  return [...sourceTokens(right)].some((token) => leftTokens.has(token));
}

function linkAssets(units: ConcludeEvidenceDossierUnit[], assets: ConcludeEvidenceAssetCandidate[]): void {
  for (const unit of units.filter((candidate) => candidate.eligibility === 'results')) {
    const statement = unit.narrative.scientificStatement ?? '';
    const unitSources = unit.provenance.sources;
    const unitStudies = unique(unitSources.flatMap((source) => source.studyIds));
    for (const asset of assets) {
      const assetSource = asset.provenance.source;
      const exactSource = unitSources.some((source) => source.locator.path === assetSource.locator.path);
      const sameStudy = assetSource.studyIds.some((studyId) => unitStudies.includes(studyId));
      const assetText = `${asset.caption ?? ''} ${assetSource.locator.path}`;
      if (!exactSource && !(asset.kind === 'figure' && sameStudy && sharesScientificToken(statement, assetText))) {
        continue;
      }
      unit.assetCandidateIds.push(asset.id);
      asset.linkedEvidenceUnitIds.push(unit.id);
    }
    unit.assetCandidateIds = unique(unit.assetCandidateIds);
  }
  for (const asset of assets) {
    asset.linkedEvidenceUnitIds = unique(asset.linkedEvidenceUnitIds);
  }
}

function collectNarrativeFields(unit: ConcludeEvidenceDossierUnit): Array<{ field: string; value: string }> {
  const narrative = unit.narrative;
  return [
    { field: 'scientificStatement', value: narrative.scientificStatement ?? '' },
    { field: 'population', value: narrative.population ?? '' },
    { field: 'comparison', value: narrative.comparison ?? '' },
    { field: 'effect.name', value: narrative.effect?.name ?? '' },
    { field: 'effect.value', value: narrative.effect?.value ?? '' },
    ...narrative.statistics.map((statistic, index) => ({ field: `statistics[${index}]`, value: `${statistic.name} ${statistic.value}` })),
    ...narrative.uncertainty.map((value, index) => ({ field: `uncertainty[${index}]`, value })),
  ].filter((entry) => entry.value.length > 0);
}

export function auditConcludeEvidenceDossier(dossier: Omit<ConcludeEvidenceDossier, 'audit'> | ConcludeEvidenceDossier): ConcludeEvidenceDossierAudit {
  const violations: ConcludeEvidenceDossierAuditViolation[] = [];
  for (const unit of dossier.evidenceUnits) {
    for (const field of collectNarrativeFields(unit)) {
      if (QDD_ID_PATTERN.test(field.value)) {
        violations.push({
          code: 'provenance-leak',
          evidenceUnitId: unit.id,
          field: field.field,
          details: 'Narrative content contains a QDD provenance identifier.',
        });
      }
      if (EXECUTION_LANGUAGE_PATTERN.test(field.value)) {
        violations.push({
          code: 'execution-language',
          evidenceUnitId: unit.id,
          field: field.field,
          details: 'Narrative content contains artifact or execution language.',
        });
      }
    }
    if (unit.eligibility === 'results' && unit.provenance.sources.some((source) => source.sourceType !== 'artifact-content')) {
      violations.push({
        code: 'invalid-result-source',
        evidenceUnitId: unit.id,
        field: 'provenance.sources',
        details: 'Results evidence must come from artifact content.',
      });
    }
    const hasQuantitativeNarrative = Boolean(unit.narrative.effect) || unit.narrative.statistics.length > 0;
    const hasVerifiableLocator = unit.provenance.sources.some((source) =>
      source.locator.kind === 'table-row' || source.locator.kind === 'markdown-lines'
    );
    if (hasQuantitativeNarrative && !hasVerifiableLocator) {
      violations.push({
        code: 'missing-quantitative-locator',
        evidenceUnitId: unit.id,
        field: 'provenance.sources',
        details: 'Quantitative narrative lacks a row or line locator.',
      });
    }
  }

  dossier.assetCandidates.forEach((asset) => {
    if (asset.caption && (QDD_ID_PATTERN.test(asset.caption) || EXECUTION_LANGUAGE_PATTERN.test(asset.caption))) {
      violations.push({
        code: QDD_ID_PATTERN.test(asset.caption) ? 'provenance-leak' : 'execution-language',
        evidenceUnitId: null,
        field: `assetCandidates.${asset.id}.caption`,
        details: 'Asset caption contains provenance or execution language.',
      });
    }
  });

  return { status: violations.length === 0 ? 'pass' : 'fail', violations };
}

export async function buildConcludeEvidenceDossier(
  result: ConcludePreflightResult,
  now = new Date()
): Promise<ConcludeEvidenceDossier> {
  const sources = await collectArtifactSources(result);
  const evidenceUnits: ConcludeEvidenceDossierUnit[] = [];
  const assetCandidates: ConcludeEvidenceAssetCandidate[] = [];
  const gaps: ConcludeEvidenceDossierGap[] = [];

  for (const source of sources) {
    const absolutePath = path.join(result.projectRoot, source.sourcePath);
    try {
      if (source.type === 'table' && /(?:csv|tsv|tab|txt)$/i.test(source.format || path.extname(source.sourcePath))) {
        const delimiter = /(?:tsv|tab)$/i.test(source.format) || /\.tsv$/i.test(source.sourcePath) ? '\t' : ',';
        const read = await readBoundedText(absolutePath);
        evidenceUnits.push(...buildTableUnits(source, read, delimiter));
        assetCandidates.push(buildTableAsset(source));
        continue;
      }
      if (source.type === 'report' && /(?:md|markdown)$/i.test(source.format || path.extname(source.sourcePath))) {
        const read = await readBoundedText(absolutePath);
        evidenceUnits.push(...buildMarkdownUnits(source, read));
        continue;
      }
      if (source.type === 'figure') {
        assetCandidates.push(await buildFigureAsset(result.projectRoot, source));
        continue;
      }
      const reason = source.type === 'data'
        ? 'Binary or non-tabular data is provenance/context only unless a companion report or table supplies the scientific result.'
        : `Artifact format '${source.format || 'unknown'}' is not eligible for scientific claim extraction.`;
      const excluded = await buildExcludedUnit(result.projectRoot, source, reason);
      evidenceUnits.push(excluded.unit);
      gaps.push(excluded.gap);
    } catch (error) {
      const reason = `Source could not be read within the dossier contract: ${(error as Error).message}`;
      const excluded = await buildExcludedUnit(result.projectRoot, source, reason);
      evidenceUnits.push(excluded.unit);
      gaps.push(excluded.gap);
    }
  }

  evidenceUnits.forEach((unit, index) => {
    unit.id = `DOS-EV-${String(index + 1).padStart(4, '0')}`;
  });
  assetCandidates.forEach((asset, index) => {
    asset.id = `DOS-ASSET-${String(index + 1).padStart(4, '0')}`;
  });
  linkAssets(evidenceUnits, assetCandidates);

  const withoutAudit: Omit<ConcludeEvidenceDossier, 'audit'> = {
    schemaVersion: 1,
    kind: 'qdd-manuscript-evidence-dossier',
    generatedAt: now.toISOString(),
    readLimits: { ...CONCLUDE_EVIDENCE_READ_LIMITS },
    summary: {
      uniqueSources: sources.length,
      resultUnits: evidenceUnits.filter((unit) => unit.eligibility === 'results').length,
      boundaryUnits: evidenceUnits.filter((unit) => unit.eligibility === 'boundary').length,
      excludedUnits: evidenceUnits.filter((unit) => unit.eligibility === 'excluded').length,
      figureCandidates: assetCandidates.filter((asset) => asset.kind === 'figure').length,
      tableCandidates: assetCandidates.filter((asset) => asset.kind === 'table').length,
    },
    evidenceUnits,
    assetCandidates,
    gaps,
  };
  return { ...withoutAudit, audit: auditConcludeEvidenceDossier(withoutAudit) };
}

function formatLocator(source: ConcludeEvidenceProvenanceRef): string {
  const locator = source.locator;
  if (locator.kind === 'table-row') {
    const selector = Object.entries(locator.selector).map(([key, value]) => `${key}=${value}`).join(', ');
    return `${locator.path}:row ${locator.row}${selector ? ` (${selector})` : ''}`;
  }
  if (locator.kind === 'markdown-lines') {
    return `${locator.path}:lines ${locator.startLine}-${locator.endLine}${locator.heading ? ` under ${locator.heading}` : ''}`;
  }
  return `${locator.path}:bytes ${locator.byteStart}-${locator.byteEnd}`;
}

export function renderConcludeEvidenceDossierMarkdown(dossier: ConcludeEvidenceDossier): string {
  const lines: string[] = [
    '# Evidence Dossier',
    '',
    `- Schema: ${dossier.kind} v${dossier.schemaVersion}`,
    `- Generated at: ${dossier.generatedAt}`,
    `- Unique sources: ${dossier.summary.uniqueSources}`,
    `- Result / boundary / excluded units: ${dossier.summary.resultUnits} / ${dossier.summary.boundaryUnits} / ${dossier.summary.excludedUnits}`,
    `- Figure / table candidates: ${dossier.summary.figureCandidates} / ${dossier.summary.tableCandidates}`,
    `- Narrative/provenance audit: ${dossier.audit.status.toUpperCase()}`,
    '',
    '## Manuscript Evidence',
    '',
  ];

  for (const unit of dossier.evidenceUnits.filter((candidate) => candidate.eligibility !== 'excluded')) {
    lines.push(`### ${unit.id}`);
    lines.push('');
    lines.push(`- Eligibility: ${unit.eligibility}`);
    lines.push(`- Scientific statement: ${unit.narrative.scientificStatement ?? 'Not eligible for scientific prose.'}`);
    lines.push(`- Population: ${unit.narrative.population ?? 'not specified'}`);
    lines.push(`- Comparison: ${unit.narrative.comparison ?? 'not specified'}`);
    lines.push(`- Effect: ${unit.narrative.effect ? `${unit.narrative.effect.name}=${unit.narrative.effect.value}` : 'not specified'}`);
    lines.push(`- Statistics: ${unit.narrative.statistics.map((statistic) => `${statistic.name}=${statistic.value}`).join(', ') || 'not specified'}`);
    lines.push(`- Claim strength: ${unit.narrative.claimStrength}`);
    lines.push(`- Allowed verbs: ${unit.narrative.allowedVerbs.join(', ')}`);
    lines.push(`- Forbidden verbs: ${unit.narrative.forbiddenVerbs.join(', ')}`);
    lines.push(`- Asset candidates: ${unit.assetCandidateIds.join(', ') || 'none'}`);
    lines.push('');
    lines.push('#### Provenance');
    lines.push('');
    unit.provenance.sources.forEach((source) => {
      lines.push(`- ${source.role}: ${formatLocator(source)}`);
      lines.push(`  - Artifact IDs: ${source.artifactIds.join(', ') || 'none'}`);
      lines.push(`  - Study IDs: ${source.studyIds.join(', ') || 'none'}`);
      lines.push(`  - Task IDs: ${source.taskIds.join(', ') || 'none'}`);
      lines.push(`  - Registrations: ${source.registrations.join(', ')}`);
    });
    lines.push('');
  }

  lines.push('## Figure And Table Plan');
  lines.push('');
  for (const asset of dossier.assetCandidates) {
    lines.push(`### ${asset.id}`);
    lines.push('');
    lines.push(`- Kind: ${asset.kind}`);
    lines.push(`- Caption: ${asset.caption ?? 'Source-backed caption gap.'}`);
    lines.push(`- Recommended use: ${asset.recommendedUse}`);
    lines.push(`- Dimensions: ${asset.width ?? 'unknown'} × ${asset.height ?? 'unknown'}`);
    lines.push(`- Linked evidence: ${asset.linkedEvidenceUnitIds.join(', ') || 'none'}`);
    lines.push('');
    lines.push('#### Provenance');
    lines.push('');
    lines.push(`- ${formatLocator(asset.provenance.source)}`);
    lines.push(`- Artifact IDs: ${asset.provenance.source.artifactIds.join(', ') || 'none'}`);
    lines.push(`- Study IDs: ${asset.provenance.source.studyIds.join(', ') || 'none'}`);
    lines.push(`- Task IDs: ${asset.provenance.source.taskIds.join(', ') || 'none'}`);
    lines.push('');
  }

  lines.push('## Excluded Sources And Gaps');
  lines.push('');
  if (dossier.gaps.length === 0) {
    lines.push('- None.');
  } else {
    dossier.gaps.forEach((gap) => lines.push(`- ${gap.sourcePath}: ${gap.reason}`));
  }
  lines.push('');
  lines.push('## Narrative And Provenance Audit');
  lines.push('');
  lines.push(`- Status: ${dossier.audit.status.toUpperCase()}`);
  if (dossier.audit.violations.length === 0) {
    lines.push('- No provenance leakage, execution-language leakage, invalid Results source, or unverifiable quantitative locator was detected.');
  } else {
    dossier.audit.violations.forEach((violation) => {
      lines.push(`- ${violation.code}: ${violation.evidenceUnitId ?? 'asset'} ${violation.field} — ${violation.details}`);
    });
  }
  lines.push('');
  return lines.join('\n');
}
