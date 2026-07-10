import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcludeStoryPlan } from '../services/conclude-story.js';
import type {
  ConcludeClaimStrength,
  ConcludeEvidenceAssetCandidate,
  ConcludeEvidenceDossier,
  ConcludeEvidenceDossierUnit,
  ConcludeEvidenceEligibility,
} from '../types.js';

function makeUnit(options: {
  id: string;
  statement: string;
  sourcePath: string;
  assetId?: string;
  eligibility?: ConcludeEvidenceEligibility;
  claimStrength?: ConcludeClaimStrength;
}): ConcludeEvidenceDossierUnit {
  return {
    id: options.id,
    eligibility: options.eligibility ?? 'results',
    narrative: {
      scientificStatement: options.statement,
      population: null,
      comparison: null,
      effect: { name: 'effect', value: '1.2' },
      statistics: [{ name: 'fdr', value: '0.01' }],
      uncertainty: [],
      claimStrength: options.claimStrength ?? 'associative',
      allowedVerbs: ['associated with', 'supports'],
      forbiddenVerbs: ['drives', 'proves'],
    },
    provenance: {
      sources: [{
        role: options.eligibility === 'boundary' ? 'boundary' : 'supporting',
        sourceType: 'artifact-content',
        locator: {
          kind: 'table-row',
          path: options.sourcePath,
          row: 2,
          selector: {},
          columns: ['effect', 'fdr'],
        },
        artifactIds: [],
        studyIds: [],
        taskIds: [],
        registrations: ['artifact-candidate'],
      }],
      extraction: {
        format: 'csv',
        bounded: true,
        bytesRead: 100,
        truncated: false,
      },
    },
    assetCandidateIds: options.assetId ? [options.assetId] : [],
    exclusionReason: null,
  };
}

function makeAsset(id: string, sourcePath: string, linkedEvidenceUnitIds: string[]): ConcludeEvidenceAssetCandidate {
  return {
    id,
    kind: 'table',
    format: 'csv',
    caption: 'Quantitative scientific comparison.',
    recommendedUse: 'Anchor the corresponding Results claim.',
    width: null,
    height: null,
    linkedEvidenceUnitIds,
    provenance: {
      source: {
        role: 'supporting',
        sourceType: 'artifact-content',
        locator: {
          kind: 'file',
          path: sourcePath,
          byteStart: 0,
          byteEnd: 100,
        },
        artifactIds: [],
        studyIds: [],
        taskIds: [],
        registrations: ['artifact-candidate'],
      },
      catalogDescriptions: [],
    },
  };
}

function makeDossier(
  evidenceUnits: ConcludeEvidenceDossierUnit[],
  assetCandidates: ConcludeEvidenceAssetCandidate[]
): ConcludeEvidenceDossier {
  return {
    schemaVersion: 1,
    kind: 'qdd-manuscript-evidence-dossier',
    generatedAt: '2026-07-10T00:00:00.000Z',
    readLimits: {
      maxBytesPerTextSource: 2_000_000,
      maxRowsPerTable: 5_000,
      maxEvidenceUnitsPerSource: 24,
    },
    summary: {
      uniqueSources: new Set(evidenceUnits.map((unit) => unit.provenance.sources[0]?.locator.path)).size,
      resultUnits: evidenceUnits.filter((unit) => unit.eligibility === 'results').length,
      boundaryUnits: evidenceUnits.filter((unit) => unit.eligibility === 'boundary').length,
      excludedUnits: evidenceUnits.filter((unit) => unit.eligibility === 'excluded').length,
      figureCandidates: assetCandidates.filter((asset) => asset.kind === 'figure').length,
      tableCandidates: assetCandidates.filter((asset) => asset.kind === 'table').length,
    },
    evidenceUnits,
    assetCandidates,
    gaps: [],
    audit: { status: 'pass', violations: [] },
  };
}

test('story planner stops at insufficient-evidence instead of creating a workflow fallback', () => {
  const dossier = makeDossier([
    makeUnit({
      id: 'DOS-EV-0001',
      statement: 'The quality-controlled analysis matrix is reusable for downstream execution.',
      sourcePath: 'results/readiness.csv',
    }),
  ], []);

  const plan = buildConcludeStoryPlan(dossier);

  assert.equal(plan.status, 'insufficient-evidence');
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.audit.status, 'pass');
  assert.match(plan.diagnostics[0], /No dossier-only claim route/);
});

test('story planner emits one candidate and insufficient-story-diversity for one claim bundle', () => {
  const units = [
    makeUnit({
      id: 'DOS-EV-0001',
      statement: 'QKI was elevated in protective-like astrocytes relative to the reference state with strong statistical support.',
      sourcePath: 'results/astrocyte-state.csv',
      assetId: 'DOS-ASSET-0001',
    }),
    makeUnit({
      id: 'DOS-EV-0002',
      statement: 'CELF2 was elevated in the same protective-like astrocyte comparison and supported the shared RNA-processing state.',
      sourcePath: 'results/astrocyte-state.csv',
      assetId: 'DOS-ASSET-0001',
    }),
  ];
  const dossier = makeDossier(units, [makeAsset('DOS-ASSET-0001', 'results/astrocyte-state.csv', units.map((unit) => unit.id))]);

  const plan = buildConcludeStoryPlan(dossier);

  assert.equal(plan.status, 'insufficient-story-diversity');
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.audit.status, 'pass');
  assert.deepEqual(plan.candidates[0].claimGraph.resultOrdering, ['DOS-EV-0001', 'DOS-EV-0002']);
  assert.equal(plan.candidates[0].viabilityBlockers.length, 0);
  assert.equal(plan.candidates[0].viability.noveltyRisk.level, 'unassessed');
});

test('story planner excludes an unsupported causal boundary from the claim graph', () => {
  const resultUnits = [
    makeUnit({
      id: 'DOS-EV-0001',
      statement: 'QKI was elevated in protective-like astrocytes relative to the reference state with strong statistical support.',
      sourcePath: 'results/astrocyte-state.csv',
      assetId: 'DOS-ASSET-0001',
    }),
    makeUnit({
      id: 'DOS-EV-0002',
      statement: 'CELF2 was elevated in the same astrocyte comparison and supported a coordinated RNA-processing state.',
      sourcePath: 'results/astrocyte-state.csv',
      assetId: 'DOS-ASSET-0001',
    }),
  ];
  const unsupportedBoundary = makeUnit({
    id: 'DOS-EV-0003',
    statement: 'QKI directly drives Parkinson disease through an established molecular mechanism.',
    sourcePath: 'reports/unsupported-mechanism.md',
    eligibility: 'boundary',
    claimStrength: 'causal',
  });
  const dossier = makeDossier(
    [...resultUnits, unsupportedBoundary],
    [makeAsset('DOS-ASSET-0001', 'results/astrocyte-state.csv', resultUnits.map((unit) => unit.id))]
  );

  const plan = buildConcludeStoryPlan(dossier);

  assert.equal(plan.status, 'insufficient-story-diversity');
  assert.equal(plan.audit.status, 'pass');
  assert.equal(plan.candidates.length, 1);
  assert.ok(!plan.candidates[0].includedClaimIds.includes(unsupportedBoundary.id));
  assert.ok(!plan.candidates[0].claimGraph.nodes.some((node) => node.claimId === unsupportedBoundary.id));
});

test('story planner creates machine-verifiably distinct scientific claim routes', () => {
  const groups = [
    {
      sourcePath: 'results/astrocyte-state.csv',
      assetId: 'DOS-ASSET-0001',
      statements: [
        'QKI and CELF2 were elevated in protective-like astrocytes relative to the reference state.',
        'The astrocyte comparison identified a coordinated RNA-processing factor state with quantitative support.',
      ],
    },
    {
      sourcePath: 'results/mitochondrial-pathways.csv',
      assetId: 'DOS-ASSET-0002',
      statements: [
        'Differential transcript usage was enriched in mitochondrial quality-control and autophagy programs.',
        'Proteostasis and vesicle-trafficking pathways accompanied the mitochondrial transcript-usage foreground.',
      ],
    },
    {
      sourcePath: 'results/spatial-modules.csv',
      assetId: 'DOS-ASSET-0003',
      statements: [
        'Expression-based clustering identified cross-section spatial modules shared across substantia nigra tissue sections.',
        'Coordinate-only clustering fragmented tissue into section-specific patches despite higher spatial coherence.',
      ],
    },
  ];
  const units = groups.flatMap((group, groupIndex) => group.statements.map((statement, statementIndex) =>
    makeUnit({
      id: `DOS-EV-${String(groupIndex * 2 + statementIndex + 1).padStart(4, '0')}`,
      statement,
      sourcePath: group.sourcePath,
      assetId: group.assetId,
    })
  ));
  const assets = groups.map((group) => makeAsset(
    group.assetId,
    group.sourcePath,
    units.filter((unit) => unit.provenance.sources[0]?.locator.path === group.sourcePath).map((unit) => unit.id)
  ));

  const plan = buildConcludeStoryPlan(makeDossier(units, assets));

  assert.equal(plan.status, 'ready-for-selection');
  assert.ok(plan.candidates.length >= 2 && plan.candidates.length <= 3);
  assert.equal(plan.audit.status, 'pass');
  assert.equal(new Set(plan.candidates.map((candidate) => candidate.centralContribution)).size, plan.candidates.length);
  assert.equal(new Set(plan.candidates.map((candidate) => candidate.includedClaimIds.join('|'))).size, plan.candidates.length);
  assert.equal(new Set(plan.candidates.map((candidate) => candidate.claimGraph.resultOrdering.join('|'))).size, plan.candidates.length);
  assert.equal(new Set(plan.candidates.map((candidate) => candidate.figureTableSequence.map((entry) => entry.assetId).join('|'))).size, plan.candidates.length);
  assert.ok(plan.candidates.every((candidate) => !['method', 'audit-report'].includes(candidate.framing)));
  const narrativeFields = plan.candidates.flatMap((candidate) => [
    candidate.scientificQuestion,
    candidate.centralContribution,
    candidate.story,
    ...candidate.resultsArc.map((entry) => entry.statement),
    ...candidate.claimGraph.nodes.map((node) => node.statement),
  ]);
  assert.ok(narrativeFields.every((value) => !/STUDY-|TASK-|ART-|status|checklist|execution|QDD workflow/i.test(value)));
});
