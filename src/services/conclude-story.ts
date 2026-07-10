import type {
  ConcludeClaimStrength,
  ConcludeEvidenceAssetCandidate,
  ConcludeEvidenceDossier,
  ConcludeEvidenceDossierUnit,
  ConcludeEvidenceItem,
  ConcludeManuscriptClaimGraph,
  ConcludeStoryCandidate,
  ConcludeStoryClaimGraphNode,
  ConcludeStoryFigureTablePlanEntry,
  ConcludeStoryPlan,
  ConcludeStoryPlanAuditViolation,
  ConcludeStoryResultsArcEntry,
  ConcludeStoryViabilityDiagnostics,
} from '../types.js';

const PROVENANCE_ID_PATTERN = /\b(?:STUDY|TASK|ART)-\d+\b/i;
const EXECUTION_LANGUAGE_PATTERN = /\b(?:QDD|workflow|task status|study status|checklist|artifact description|output files?|reusable for|loads?|extracts?|exports?)\b/i;
const DATA_READINESS_PATTERN = /\b(?:data[- ]readiness|analysis matrix|quality[- ]control(?:led)?|QC packet|reusable|workflow|task|status|checklist|output files?|pipeline validated|nuclei count and fraction|underpowered flags?)\b/i;
const INCOMPLETE_STATEMENT_PATTERN = /(?:[:;]\s*$)|^(?:however|but|and|or|significant\s*\()\b/i;
const CONTRADICTION_PATTERN = /\b(?:not supported|unsupported|contradict|failed|failure|cannot|could not|no significant|not significant)\b/i;
const UNSAFE_CAUSAL_ASSERTION_PATTERN = /\b(?:proven|direct drivers?|drives|causes?|establishes? mechanism)\b/i;
const TOKEN_STOPWORDS = new Set([
  'about', 'across', 'after', 'again', 'against', 'also', 'among', 'analysis', 'available', 'because', 'been', 'before',
  'biological',
  'between', 'both', 'candidate', 'claim', 'compared', 'current', 'data', 'does', 'during', 'each', 'evidence',
  'expression', 'from', 'have', 'into', 'more', 'most', 'nigra', 'only', 'other', 'pattern', 'patterns', 'result', 'results', 'showed', 'shows', 'significant', 'substantia',
  'study', 'than', 'that', 'their', 'there', 'these', 'this', 'those', 'through', 'using', 'with', 'within', 'without',
]);

interface ClaimGroup {
  sourceKey: string;
  units: ConcludeEvidenceDossierUnit[];
  score: number;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeComparison(value: string): string {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function claimStatement(unit: ConcludeEvidenceDossierUnit): string {
  return normalizeText((unit.narrative.scientificStatement ?? '').replace(/>\s*/g, ' '));
}

function sourceKey(unit: ConcludeEvidenceDossierUnit): string {
  return unit.provenance.sources[0]?.locator.path ?? unit.id;
}

function claimTokens(value: string): Set<string> {
  return new Set(
    normalizeComparison(value)
      .split(' ')
      .filter((token) => token.length >= 3 && !TOKEN_STOPWORDS.has(token) && !/^\d+$/.test(token))
      .map((token) => token.length > 5 && token.endsWith('s') ? token.slice(0, -1) : token)
  );
}

function tokenOverlap(left: Set<string>, right: Set<string>): { shared: number; similarity: number } {
  const shared = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return { shared, similarity: union === 0 ? 0 : shared / union };
}

function isNarrativeEligible(unit: ConcludeEvidenceDossierUnit): boolean {
  const statement = claimStatement(unit);
  return unit.eligibility === 'results'
    && statement.length >= 35
    && /[.!?]["']?$/.test(statement)
    && !INCOMPLETE_STATEMENT_PATTERN.test(statement)
    && !DATA_READINESS_PATTERN.test(statement)
    && !PROVENANCE_ID_PATTERN.test(statement)
    && !EXECUTION_LANGUAGE_PATTERN.test(statement);
}

function isBoundaryEligible(unit: ConcludeEvidenceDossierUnit): boolean {
  const statement = claimStatement(unit);
  return unit.eligibility === 'boundary'
    && statement.length >= 35
    && /[.!?]["']?$/.test(statement)
    && !INCOMPLETE_STATEMENT_PATTERN.test(statement)
    && !(UNSAFE_CAUSAL_ASSERTION_PATTERN.test(statement) && !CONTRADICTION_PATTERN.test(statement))
    && !(!CONTRADICTION_PATTERN.test(statement) && unit.narrative.claimStrength === 'causal')
    && !PROVENANCE_ID_PATTERN.test(statement)
    && !EXECUTION_LANGUAGE_PATTERN.test(statement);
}

function unitScore(unit: ConcludeEvidenceDossierUnit, assetById: Map<string, ConcludeEvidenceAssetCandidate>): number {
  const statement = claimStatement(unit);
  const assets = unit.assetCandidateIds
    .map((assetId) => assetById.get(assetId))
    .filter((asset): asset is ConcludeEvidenceAssetCandidate => Boolean(asset));
  const sourceFormat = unit.provenance.extraction.format;
  let score = sourceFormat === 'markdown' ? 3 : 1;
  score += unit.narrative.effect || unit.narrative.statistics.length > 0 ? 3 : 0;
  score += assets.some((asset) => asset.kind === 'figure') ? 3 : 0;
  score += assets.some((asset) => asset.kind === 'table') ? 2 : 0;
  score += statement.length >= 80 && statement.length <= 700 ? 2 : 1;
  score -= CONTRADICTION_PATTERN.test(statement) ? 2 : 0;
  return score;
}

function deduplicateUnits(
  units: ConcludeEvidenceDossierUnit[],
  assetById: Map<string, ConcludeEvidenceAssetCandidate>
): ConcludeEvidenceDossierUnit[] {
  const bestByStatement = new Map<string, ConcludeEvidenceDossierUnit>();
  for (const unit of units) {
    const key = normalizeComparison(claimStatement(unit));
    const existing = bestByStatement.get(key);
    if (!existing || unitScore(unit, assetById) > unitScore(existing, assetById)) {
      bestByStatement.set(key, unit);
    }
  }
  return [...bestByStatement.values()];
}

function buildClaimGroups(
  units: ConcludeEvidenceDossierUnit[],
  assetById: Map<string, ConcludeEvidenceAssetCandidate>
): ClaimGroup[] {
  const grouped = new Map<string, ConcludeEvidenceDossierUnit[]>();
  for (const unit of units) {
    const key = sourceKey(unit);
    grouped.set(key, [...(grouped.get(key) ?? []), unit]);
  }
  return [...grouped.entries()]
    .map(([key, groupUnits]) => {
      const sorted = [...groupUnits].sort((left, right) => unitScore(right, assetById) - unitScore(left, assetById));
      return {
        sourceKey: key,
        units: sorted,
        score: unitScore(sorted[0], assetById)
          + (sorted[0].provenance.extraction.format === 'markdown' ? 6 : 0)
          + Math.min(3, sorted.length),
      };
    })
    .sort((left, right) => right.score - left.score || left.sourceKey.localeCompare(right.sourceKey));
}

function selectRouteUnits(
  primary: ClaimGroup,
  groups: ClaimGroup[],
  assetById: Map<string, ConcludeEvidenceAssetCandidate>
): ConcludeEvidenceDossierUnit[] {
  const selected = primary.units.slice(0, 3);
  const relatedLimit = Math.max(0, 3 - selected.length);
  if (relatedLimit === 0) {
    return selected;
  }
  const routeTokens = claimTokens(selected.map(claimStatement).join(' '));
  const related = groups
    .filter((group) => group.sourceKey !== primary.sourceKey)
    .map((group) => {
      const unit = group.units[0];
      const overlap = tokenOverlap(routeTokens, claimTokens(claimStatement(unit)));
      return {
        unit,
        shared: overlap.shared,
        similarity: overlap.similarity,
        score: unitScore(unit, assetById) + overlap.similarity * 10,
      };
    })
    .filter((entry) => entry.shared >= 4 || entry.similarity >= 0.15)
    .sort((left, right) => right.score - left.score)
    .slice(0, relatedLimit)
    .map((entry) => entry.unit);
  return [...selected, ...related].slice(0, 5);
}

function selectBoundaryUnits(
  resultUnits: ConcludeEvidenceDossierUnit[],
  boundaries: ConcludeEvidenceDossierUnit[]
): ConcludeEvidenceDossierUnit[] {
  const resultTokens = claimTokens(resultUnits.map(claimStatement).join(' '));
  const resultSources = new Set(resultUnits.map(sourceKey));
  return boundaries
    .map((unit) => {
      const overlap = tokenOverlap(resultTokens, claimTokens(claimStatement(unit)));
      const sameSource = resultSources.has(sourceKey(unit));
      return {
        unit,
        shared: overlap.shared,
        similarity: overlap.similarity,
        sameSource,
        score: overlap.similarity * 10 + overlap.shared + (sameSource ? 5 : 0),
      };
    })
    .filter((entry) => entry.sameSource || entry.shared >= 3 || (entry.shared >= 2 && entry.similarity >= 0.08))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.unit);
}

function buildFigureTablePlan(
  resultUnits: ConcludeEvidenceDossierUnit[],
  assetById: Map<string, ConcludeEvidenceAssetCandidate>
): ConcludeStoryFigureTablePlanEntry[] {
  const plan: ConcludeStoryFigureTablePlanEntry[] = [];
  const seen = new Set<string>();
  for (const unit of resultUnits) {
    const assets = unit.assetCandidateIds
      .map((assetId) => assetById.get(assetId))
      .filter((asset): asset is ConcludeEvidenceAssetCandidate => Boolean(asset))
      .sort((left, right) => Number(right.kind === 'figure') - Number(left.kind === 'figure'));
    for (const asset of assets) {
      if (seen.has(asset.id)) {
        const existing = plan.find((entry) => entry.assetId === asset.id);
        if (existing) {
          existing.claimIds = uniqueStrings([...existing.claimIds, unit.id]);
        }
        continue;
      }
      seen.add(asset.id);
      plan.push({
        sequence: plan.length + 1,
        assetId: asset.id,
        kind: asset.kind,
        claimIds: [unit.id],
        role: `Supports the scientific observation in ${unit.id}.`,
      });
      if (plan.length >= 4) {
        return plan;
      }
    }
  }
  return plan;
}

function buildMissingValidation(
  resultUnits: ConcludeEvidenceDossierUnit[],
  boundaryUnits: ConcludeEvidenceDossierUnit[]
): string[] {
  const uncertainty = resultUnits.flatMap((unit) =>
    unit.narrative.uncertainty.map((value) => `[${unit.id}] ${normalizeText(value)}`)
  );
  const boundaries = boundaryUnits.map((unit) => `[${unit.id}] ${claimStatement(unit)}`);
  const missing = uniqueStrings([...uncertainty, ...boundaries]).slice(0, 4);
  if (missing.length > 0) {
    return missing;
  }
  return [`[${resultUnits[0].id}] Independent validation is not represented in the current evidence dossier.`];
}

function buildReviewerRisk(
  resultUnits: ConcludeEvidenceDossierUnit[],
  boundaryUnits: ConcludeEvidenceDossierUnit[],
  figurePlan: ConcludeStoryFigureTablePlanEntry[]
): string[] {
  const risks = [
    boundaryUnits.length > 0
      ? `[${boundaryUnits[0].id}] Reviewers may challenge whether the boundary evidence narrows the lead claim sufficiently.`
      : `[${resultUnits[0].id}] Reviewers may request independent validation of the lead observation.`,
  ];
  if (figurePlan.length < resultUnits.length) {
    risks.push(`[${resultUnits.map((unit) => unit.id).join(', ')}] Some Results claims share an asset and may need a clearer visual anchor.`);
  }
  if (resultUnits.some((unit) => unit.narrative.claimStrength === 'causal')) {
    risks.push(`[${resultUnits.filter((unit) => unit.narrative.claimStrength === 'causal').map((unit) => unit.id).join(', ')}] Causal wording requires direct functional evidence.`);
  }
  return risks;
}

function dossierUnitToEvidence(unit: ConcludeEvidenceDossierUnit, kind: 'supporting' | 'boundary'): ConcludeEvidenceItem {
  return {
    id: unit.id,
    kind,
    sourceType: 'artifact',
    sourcePath: sourceKey(unit),
    studyId: null,
    summary: claimStatement(unit),
    rationale: `Scientific narrative is carried by dossier claim ${unit.id}; QDD provenance remains in the dossier sidecar.`,
    claimStrength: unit.narrative.claimStrength,
    tags: [],
  };
}

function buildClaimGraph(
  resultUnits: ConcludeEvidenceDossierUnit[],
  boundaryUnits: ConcludeEvidenceDossierUnit[],
  figureTablePlan: ConcludeStoryFigureTablePlanEntry[],
  missingValidation: string[],
  reviewerRisk: string[]
): ConcludeManuscriptClaimGraph {
  const lead = resultUnits[0];
  const resultNodes: ConcludeStoryClaimGraphNode[] = resultUnits.map((unit, index) => ({
    claimId: unit.id,
    role: index === 0 ? 'lead' : 'supporting',
    statement: claimStatement(unit),
    claimStrength: unit.narrative.claimStrength,
    assetCandidateIds: [...unit.assetCandidateIds],
    allowedVerbs: [...unit.narrative.allowedVerbs],
    forbiddenVerbs: [...unit.narrative.forbiddenVerbs],
  }));
  const boundaryNodes: ConcludeStoryClaimGraphNode[] = boundaryUnits.map((unit) => ({
    claimId: unit.id,
    role: CONTRADICTION_PATTERN.test(claimStatement(unit)) ? 'contradiction' : 'boundary',
    statement: claimStatement(unit),
    claimStrength: unit.narrative.claimStrength,
    assetCandidateIds: [...unit.assetCandidateIds],
    allowedVerbs: [...unit.narrative.allowedVerbs],
    forbiddenVerbs: [...unit.narrative.forbiddenVerbs],
  }));
  const edges = [
    ...resultUnits.slice(1).map((unit) => ({
      fromClaimId: unit.id,
      toClaimId: lead.id,
      relation: 'supports' as const,
      rationale: `${unit.id} provides a distinct supporting observation for ${lead.id}.`,
    })),
    ...boundaryNodes.map((node) => ({
      fromClaimId: node.claimId,
      toClaimId: lead.id,
      relation: node.role === 'contradiction' ? 'contradicts' as const : 'bounds' as const,
      rationale: `${node.claimId} limits the interpretation of ${lead.id}.`,
    })),
  ];
  const claimSafety = uniqueStrings(resultUnits.flatMap((unit) => [
    `[${unit.id}] Allowed verbs: ${unit.narrative.allowedVerbs.join(', ') || 'bounded descriptive wording'}.`,
    `[${unit.id}] Forbidden verbs: ${unit.narrative.forbiddenVerbs.join(', ') || 'none recorded'}.`,
  ]));
  return {
    schemaVersion: 1,
    leadClaimId: lead.id,
    nodes: [...resultNodes, ...boundaryNodes],
    edges,
    resultOrdering: resultUnits.map((unit) => unit.id),
    figureTablePlan,
    claimSafety,
    missingValidation,
    reviewerRisk,
  };
}

function buildViabilityDiagnostics(
  resultUnits: ConcludeEvidenceDossierUnit[],
  availableResultClaims: number,
  boundaryUnits: ConcludeEvidenceDossierUnit[],
  figurePlan: ConcludeStoryFigureTablePlanEntry[],
  missingValidation: string[]
): ConcludeStoryViabilityDiagnostics {
  const sourceGroups = new Set(resultUnits.map(sourceKey)).size;
  const coherenceLevel = resultUnits.length >= 3 && sourceGroups >= 2 ? 'strong' : resultUnits.length >= 2 ? 'moderate' : 'weak';
  const figureStatus = figurePlan.length >= Math.min(2, resultUnits.length) ? 'ready' : figurePlan.length > 0 ? 'partial' : 'missing';
  const reviewRequired = resultUnits.some((unit) => unit.narrative.claimStrength === 'causal') || boundaryUnits.length === 0;
  return {
    coherence: {
      level: coherenceLevel,
      rationale: `${resultUnits.map((unit) => unit.id).join(', ')} form a ${sourceGroups}-source Results route.`,
    },
    evidenceCoverage: {
      includedResultClaims: resultUnits.length,
      availableResultClaims,
      sourceGroups,
      rationale: `The route includes ${resultUnits.length} of ${availableResultClaims} eligible dossier result claims across ${sourceGroups} source groups.`,
    },
    figureReadiness: {
      status: figureStatus,
      plannedAssets: figurePlan.length,
      rationale: `${figurePlan.length} dossier figure/table assets are mapped to the ordered claim set.`,
    },
    claimSafety: {
      status: reviewRequired ? 'review-required' : 'bounded',
      boundaryClaims: boundaryUnits.length,
      rationale: boundaryUnits.length > 0
        ? `${boundaryUnits.map((unit) => unit.id).join(', ')} explicitly bound the Results route.`
        : `${resultUnits[0].id} has no matched boundary claim in the dossier.`,
    },
    noveltyRisk: {
      level: 'unassessed',
      rationale: 'The internal dossier does not contain an external novelty comparison; user judgment remains required.',
    },
    missingValidation,
  };
}

function buildCandidate(
  candidateIndex: number,
  resultUnits: ConcludeEvidenceDossierUnit[],
  boundaryUnits: ConcludeEvidenceDossierUnit[],
  allResultUnits: ConcludeEvidenceDossierUnit[],
  assetById: Map<string, ConcludeEvidenceAssetCandidate>,
  dossierAuditPassed: boolean
): ConcludeStoryCandidate {
  const lead = resultUnits[0];
  const figureTableSequence = buildFigureTablePlan(resultUnits, assetById);
  const missingValidation = buildMissingValidation(resultUnits, boundaryUnits);
  const reviewerRisk = buildReviewerRisk(resultUnits, boundaryUnits, figureTableSequence);
  const claimGraph = buildClaimGraph(resultUnits, boundaryUnits, figureTableSequence, missingValidation, reviewerRisk);
  const resultsArc: ConcludeStoryResultsArcEntry[] = resultUnits.map((unit, index) => ({
    sequence: index + 1,
    claimId: unit.id,
    statement: claimStatement(unit),
    role: index === 0 ? 'lead' : 'supporting',
  }));
  const viabilityBlockers = uniqueStrings([
    ...(!dossierAuditPassed ? ['The evidence dossier audit failed.'] : []),
    ...(resultUnits.length < 2 ? [`${lead.id} lacks a second connected Results claim.`] : []),
    ...(figureTableSequence.length === 0 ? [`${lead.id} has no linked figure or table candidate.`] : []),
  ]);
  const centralContribution = resultUnits.slice(0, 3).map(claimStatement).join(' ');
  const scientificQuestion = `Does the available evidence support the observation that ${centralContribution.replace(/[.!?]+$/, '').replace(/^./, (value) => value.toLowerCase())}?`;
  const limitationPlacement = boundaryUnits.map((unit, index) => ({
    claimIds: [lead.id],
    boundaryClaimIds: [unit.id],
    placement: index === 0 ? 'results' as const : 'discussion' as const,
    rationale: `[${unit.id}] This limitation directly bounds ${lead.id}.`,
  }));
  const storyParts = [
    `[${lead.id}] Begin with ${centralContribution}`,
    ...resultUnits.slice(1).map((unit) => `[${unit.id}] Then establish ${claimStatement(unit)}`),
    ...boundaryUnits.slice(0, 1).map((unit) => `[${unit.id}] Bound the interpretation with ${claimStatement(unit)}`),
  ];

  return {
    schemaVersion: 1,
    id: `story-${candidateIndex}`,
    framing: resultUnits.some((unit) => unit.narrative.claimStrength === 'associative') ? 'bounded-hypothesis' : 'discovery',
    scientificQuestion,
    scientificQuestionClaimIds: [lead.id],
    centralContribution,
    centralClaim: centralContribution,
    story: storyParts.join(' '),
    resultsArc,
    narrativeArc: resultsArc.map((entry) => `[${entry.claimId}] ${entry.statement}`),
    claimGraph,
    claimBundle: resultsArc.map((entry, index) => ({
      id: `claim-${index + 1}`,
      statement: entry.statement,
      evidencePacketRefs: [entry.claimId],
      boundaryPacketRefs: boundaryUnits.map((unit) => unit.id),
      validationFocus: missingValidation[index] ?? `[${entry.claimId}] Preserve the dossier claim strength and linked asset.`,
    })),
    includedClaimIds: claimGraph.nodes.map((node) => node.claimId),
    excludedClaimIds: allResultUnits
      .map((unit) => unit.id)
      .filter((claimId) => !resultUnits.some((unit) => unit.id === claimId)),
    figureTableSequence,
    limitationPlacement,
    viabilityBlockers,
    viability: buildViabilityDiagnostics(
      resultUnits,
      allResultUnits.length,
      boundaryUnits,
      figureTableSequence,
      missingValidation
    ),
    supportingPacketRefs: resultUnits.map((unit) => unit.id),
    boundaryPacketRefs: boundaryUnits.map((unit) => unit.id),
    supportingEvidence: resultUnits.map((unit) => dossierUnitToEvidence(unit, 'supporting')),
    negativeOrBoundaryEvidence: boundaryUnits.map((unit) => dossierUnitToEvidence(unit, 'boundary')),
    reviewerObjections: reviewerRisk,
    claimsAllowed: resultUnits.map((unit) =>
      `[${unit.id}] Use ${unit.narrative.allowedVerbs.join(', ') || 'bounded descriptive wording'} for this claim.`
    ),
    claimSafetyLimits: claimGraph.claimSafety,
    claimsToSoftenOrAvoid: resultUnits.map((unit) =>
      `[${unit.id}] Avoid ${unit.narrative.forbiddenVerbs.join(', ') || 'language stronger than the recorded claim strength'}.`
    ),
    recommendedTitleStyle: `Contribution-first title anchored to ${lead.id}`,
  };
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 1 : intersection / union;
}

function candidatesAreDistinct(left: ConcludeStoryCandidate, right: ConcludeStoryCandidate): boolean {
  const leftResultClaims = left.resultsArc.map((entry) => entry.claimId);
  const rightResultClaims = right.resultsArc.map((entry) => entry.claimId);
  const leftAssets = left.figureTableSequence.map((entry) => entry.assetId);
  const rightAssets = right.figureTableSequence.map((entry) => entry.assetId);
  const claimSetDistinct = jaccard(leftResultClaims, rightResultClaims) <= 0.5;
  const orderDistinct = left.claimGraph.resultOrdering.join('|') !== right.claimGraph.resultOrdering.join('|');
  const assetDistinct = jaccard(leftAssets, rightAssets) <= 0.5;
  return normalizeComparison(left.centralContribution) !== normalizeComparison(right.centralContribution)
    && claimSetDistinct
    && orderDistinct
    && assetDistinct;
}

function collectNarrativeFields(candidate: ConcludeStoryCandidate): Array<{ field: string; value: string }> {
  return [
    { field: 'scientificQuestion', value: candidate.scientificQuestion },
    { field: 'centralContribution', value: candidate.centralContribution },
    { field: 'story', value: candidate.story },
    ...candidate.resultsArc.map((entry, index) => ({ field: `resultsArc[${index}]`, value: entry.statement })),
    ...candidate.claimGraph.nodes.map((node, index) => ({ field: `claimGraph.nodes[${index}]`, value: node.statement })),
    ...candidate.reviewerObjections.map((value, index) => ({ field: `reviewerObjections[${index}]`, value })),
    ...candidate.claimSafetyLimits.map((value, index) => ({ field: `claimSafetyLimits[${index}]`, value })),
  ];
}

export function auditConcludeStoryPlan(candidates: ConcludeStoryCandidate[]): ConcludeStoryPlan['audit'] {
  const violations: ConcludeStoryPlanAuditViolation[] = [];
  for (const candidate of candidates) {
    for (const field of collectNarrativeFields(candidate)) {
      if (PROVENANCE_ID_PATTERN.test(field.value)) {
        violations.push({
          code: 'provenance-leak',
          candidateId: candidate.id,
          field: field.field,
          details: 'Reader-visible story planning text contains a QDD provenance identifier.',
        });
      }
      if (EXECUTION_LANGUAGE_PATTERN.test(field.value)) {
        violations.push({
          code: 'execution-language',
          candidateId: candidate.id,
          field: field.field,
          details: 'Reader-visible story planning text contains execution or workflow language.',
        });
      }
    }
    if (candidate.scientificQuestionClaimIds.length === 0
      || candidate.resultsArc.some((entry) => !candidate.includedClaimIds.includes(entry.claimId))) {
      violations.push({
        code: 'missing-claim-reference',
        candidateId: candidate.id,
        field: 'claim references',
        details: 'Every scientific question and Results statement must reference a dossier claim ID.',
      });
    }
    if (DATA_READINESS_PATTERN.test(candidate.resultsArc[0]?.statement ?? '')) {
      violations.push({
        code: 'invalid-leading-claim',
        candidateId: candidate.id,
        field: 'resultsArc[0]',
        details: 'The leading Results claim is data readiness, QC, or execution state rather than a scientific result.',
      });
    }
    if (candidate.framing === 'method' || candidate.framing === 'audit-report' || /\bQDD workflow\b/i.test(candidate.centralContribution)) {
      violations.push({
        code: 'unsupported-workflow-story',
        candidateId: candidate.id,
        field: 'centralContribution',
        details: 'A workflow or audit contribution cannot be introduced unless it is itself a scientific dossier claim.',
      });
    }
  }
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      if (!candidatesAreDistinct(left, right)) {
        violations.push({
          code: 'candidate-not-distinct',
          candidateId: null,
          field: `${left.id}/${right.id}`,
          details: 'Candidates must differ in central contribution, included claim set, Results ordering, and figure/table sequence.',
        });
      }
    }
  }
  return { status: violations.length === 0 ? 'pass' : 'fail', violations };
}

export function buildConcludeStoryPlan(dossier: ConcludeEvidenceDossier): ConcludeStoryPlan {
  const assetById = new Map(dossier.assetCandidates.map((asset) => [asset.id, asset] as const));
  const resultUnits = deduplicateUnits(dossier.evidenceUnits.filter(isNarrativeEligible), assetById);
  const boundaryUnits = deduplicateUnits(dossier.evidenceUnits.filter(isBoundaryEligible), assetById);
  const groups = buildClaimGroups(resultUnits, assetById);
  const candidates: ConcludeStoryCandidate[] = [];

  for (const group of groups) {
    const routeUnits = selectRouteUnits(group, groups, assetById);
    const matchedBoundaries = selectBoundaryUnits(routeUnits, boundaryUnits);
    const candidate = buildCandidate(
      candidates.length + 1,
      routeUnits,
      matchedBoundaries,
      resultUnits,
      assetById,
      dossier.audit.status === 'pass'
    );
    if (candidate.viabilityBlockers.length > 0) {
      continue;
    }
    if (candidates.some((existing) => !candidatesAreDistinct(existing, candidate))) {
      continue;
    }
    candidates.push(candidate);
    if (candidates.length === 3) {
      break;
    }
  }

  const audit = auditConcludeStoryPlan(candidates);
  const safeCandidates = audit.status === 'pass' ? candidates : [];
  const status = audit.status === 'fail' || safeCandidates.length === 0
    ? 'insufficient-evidence'
    : safeCandidates.length === 1
      ? 'insufficient-story-diversity'
      : 'ready-for-selection';
  const diagnostics = audit.status === 'fail'
    ? [`Story-plan audit rejected the generated candidates: ${audit.violations.map((violation) => violation.code).join(', ')}.`]
    : status === 'insufficient-evidence'
    ? ['No dossier-only claim route passed the scientific-result, connected-claim, figure/table, and claim-safety viability gates.']
    : status === 'insufficient-story-diversity'
      ? ['The dossier supports one viable scientific story, but not a second substantively distinct claim bundle and figure/table route.']
      : [`The dossier supports ${safeCandidates.length} substantively distinct scientific claim routes for human selection.`];
  return {
    schemaVersion: 1,
    kind: 'qdd-manuscript-story-plan',
    status,
    diagnostics,
    candidates: safeCandidates,
    audit,
  };
}

export function dossierClaimToEvidence(
  dossier: ConcludeEvidenceDossier,
  claimId: string,
  kind: 'supporting' | 'boundary'
): ConcludeEvidenceItem[] {
  const unit = dossier.evidenceUnits.find((candidate) => candidate.id === claimId);
  if (!unit) {
    return [];
  }
  const evidence = [dossierUnitToEvidence(unit, kind)];
  if (kind === 'supporting') {
    const assetById = new Map(dossier.assetCandidates.map((asset) => [asset.id, asset] as const));
    for (const assetId of unit.assetCandidateIds) {
      const asset = assetById.get(assetId);
      if (!asset || asset.kind !== 'figure') {
        continue;
      }
      evidence.push({
        id: `${unit.id}:${asset.id}`,
        kind: 'supporting',
        sourceType: 'artifact',
        sourcePath: asset.provenance.source.locator.path,
        studyId: null,
        summary: claimStatement(unit),
        rationale: `${asset.id} is the dossier figure anchor for ${unit.id}.`,
        claimStrength: unit.narrative.claimStrength,
        tags: ['figure'],
      });
    }
  }
  return evidence;
}

export function strongestClaimStrength(units: ConcludeEvidenceDossierUnit[]): ConcludeClaimStrength {
  if (units.some((unit) => unit.narrative.claimStrength === 'causal')) {
    return 'causal';
  }
  if (units.some((unit) => unit.narrative.claimStrength === 'associative')) {
    return 'associative';
  }
  return 'bounded';
}
