import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcludeStoryPlan } from '../services/conclude-story.js';
function makeUnit(options) {
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
function makeAsset(id, sourcePath, linkedEvidenceUnitIds) {
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
function makeDossier(evidenceUnits, assetCandidates) {
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
function makeSemanticFixture() {
    const units = [
        makeUnit({
            id: 'DOS-EV-0001',
            statement: 'QKI was elevated in protective-like astrocytes with log2FC=1.24.',
            sourcePath: 'results/astrocyte-state.csv',
            assetId: 'DOS-ASSET-0001',
        }),
        makeUnit({
            id: 'DOS-EV-0002',
            statement: 'The initial assay cannot resolve complete transcripts and requires transcript-level resolution.',
            sourcePath: 'reports/resolution-boundary.md',
            eligibility: 'boundary',
        }),
        makeUnit({
            id: 'DOS-EV-0003',
            statement: 'Transcriptome-wide testing identified 674 significant transcripts beyond the candidate panel.',
            sourcePath: 'results/global-dtu.csv',
            assetId: 'DOS-ASSET-0002',
        }),
        makeUnit({
            id: 'DOS-EV-0004',
            statement: 'The association does not establish a single-factor causal mechanism.',
            sourcePath: 'reports/claim-limit.md',
            eligibility: 'boundary',
        }),
    ];
    const assets = [
        makeAsset('DOS-ASSET-0001', 'results/astrocyte-state.csv', ['DOS-EV-0001']),
        makeAsset('DOS-ASSET-0002', 'results/global-dtu.csv', ['DOS-EV-0003']),
    ];
    const proposal = {
        centralContribution: 'An astrocyte RNA-processing signal connects to widespread transcript-usage remodeling under a bounded non-causal model.',
        scientificQuestion: 'Does the astrocyte signal extend to a broader transcript-usage program?',
        beats: [
            {
                question: 'Does an astrocyte state nominate an RNA-processing question?',
                answer: 'QKI was elevated in protective-like astrocytes with log2FC=1.24.',
                answerClaimIds: ['DOS-EV-0001'],
                evidence: { coreClaimIds: ['DOS-EV-0001'], bridgeClaimIds: [], validationClaimIds: [], boundaryClaimIds: [] },
                assetIds: ['DOS-ASSET-0001'],
                boundedInterpretation: 'The association nominates a transcript-level question without establishing causality.',
                transition: 'motivates',
                nextQuestion: 'Can the assay resolve complete transcripts?',
                evolutionTransitionIds: [],
            },
            {
                question: 'Can the assay resolve complete transcripts?',
                answer: 'The initial assay cannot resolve complete transcripts and requires transcript-level resolution.',
                answerClaimIds: ['DOS-EV-0002'],
                evidence: { coreClaimIds: [], bridgeClaimIds: ['DOS-EV-0002'], validationClaimIds: [], boundaryClaimIds: [] },
                assetIds: [],
                boundedInterpretation: 'The modality boundary explains why a transcript-level test follows.',
                transition: 'motivates',
                nextQuestion: 'Does the signal extend transcriptome-wide?',
                evolutionTransitionIds: [],
            },
            {
                question: 'Does the signal extend transcriptome-wide?',
                answer: 'Transcriptome-wide testing identified 674 significant transcripts beyond the candidate panel.',
                answerClaimIds: ['DOS-EV-0003'],
                evidence: { coreClaimIds: ['DOS-EV-0003'], bridgeClaimIds: [], validationClaimIds: [], boundaryClaimIds: [] },
                assetIds: ['DOS-ASSET-0002'],
                boundedInterpretation: 'The donor-level result supports broad transcript usage but not cell-intrinsic regulation.',
                transition: 'narrows',
                nextQuestion: 'What bounded model integrates these layers?',
                evolutionTransitionIds: [],
            },
            {
                question: 'What bounded model integrates these layers?',
                answer: 'The evidence supports an associative model rather than a single-factor causal mechanism.',
                answerClaimIds: ['DOS-EV-0004'],
                evidence: { coreClaimIds: [], bridgeClaimIds: [], validationClaimIds: [], boundaryClaimIds: ['DOS-EV-0004'] },
                assetIds: [],
                boundedInterpretation: 'A causal interpretation requires independent perturbational validation.',
                transition: 'closes',
                nextQuestion: null,
                evolutionTransitionIds: [],
            },
        ],
        evidenceRoles: [
            { claimId: 'DOS-EV-0001', role: 'core', beatSequences: [1], assetIds: ['DOS-ASSET-0001'], rationale: 'Defines the starting scientific signal.' },
            { claimId: 'DOS-EV-0002', role: 'bridge', beatSequences: [2], assetIds: [], rationale: 'Explains the data-modality transition.' },
            { claimId: 'DOS-EV-0003', role: 'core', beatSequences: [3], assetIds: ['DOS-ASSET-0002'], rationale: 'Supports the broader transcript-usage contribution.' },
            { claimId: 'DOS-EV-0004', role: 'boundary', beatSequences: [4], assetIds: [], rationale: 'Caps the strongest interpretation.' },
        ],
        omissions: [],
        emphasisProfiles: [{
                id: 'balanced',
                label: 'Balanced',
                supportingClaimIds: ['DOS-EV-0002'],
                figurePriority: ['DOS-ASSET-0001', 'DOS-ASSET-0002'],
                sectionWeights: { 'beat-1': 1, 'beat-2': 1, 'beat-3': 1, 'beat-4': 1 },
                discussionEmphasis: ['Retain the same contribution, core claims, and Results order while foregrounding validation limits.'],
            }],
        claimLimits: ['The evidence does not establish a single-factor causal mechanism.'],
        missingValidation: ['Independent perturbational validation is missing.'],
        reviewerRisks: ['Cell composition may confound donor-level effects.'],
    };
    return { dossier: makeDossier(units, assets), proposal };
}
function fakePlanner(proposal) {
    return { plan: () => proposal };
}
test('story planner stops at insufficient-evidence instead of creating a workflow fallback', async () => {
    const dossier = makeDossier([
        makeUnit({
            id: 'DOS-EV-0001',
            statement: 'The quality-controlled analysis matrix is reusable for downstream execution.',
            sourcePath: 'results/readiness.csv',
        }),
    ], []);
    const plan = await buildConcludeStoryPlan(dossier);
    assert.equal(plan.status, 'insufficient-evidence');
    assert.equal(plan.story, null);
    assert.equal(plan.audit.status, 'pass');
    assert.match(plan.diagnostics[0], /do not support/);
});
test('fake semantic planner produces one grounded canonical spine with narrative closure', async () => {
    const { dossier, proposal } = makeSemanticFixture();
    const plan = await buildConcludeStoryPlan(dossier, { semanticPlanner: fakePlanner(proposal) });
    assert.equal(plan.status, 'ready-for-review');
    assert.equal(plan.audit.status, 'pass');
    assert.ok(plan.story);
    assert.equal(plan.story.id, 'canonical-story');
    assert.equal(plan.story.resultsBeats.length, 4);
    assert.equal(plan.story.resultsBeats.at(-1)?.transition, 'closes');
    assert.equal(plan.story.resultsBeats.at(-1)?.nextQuestion, null);
    assert.equal(plan.story.viability.narrativeClosure.status, 'closed');
    assert.deepEqual(plan.story.evidenceRoleAssignments.filter((entry) => entry.role === 'core').map((entry) => entry.claimId), ['DOS-EV-0001', 'DOS-EV-0003']);
    assert.equal(plan.story.omissionLedger.length, 0);
    assert.equal(plan.story.emphasisProfiles.length, 1);
    assert.deepEqual(plan.story.claimGraph.resultOrdering, ['DOS-EV-0001', 'DOS-EV-0002', 'DOS-EV-0003', 'DOS-EV-0004']);
});
test('semantic planner output is rejected when it invents an ungrounded numeric value', async () => {
    const { dossier, proposal } = makeSemanticFixture();
    proposal.beats[2].answer = 'Transcriptome-wide testing identified 999 significant transcripts beyond the candidate panel.';
    const plan = await buildConcludeStoryPlan(dossier, { semanticPlanner: fakePlanner(proposal) });
    assert.equal(plan.status, 'insufficient-evidence');
    assert.equal(plan.story, null);
    assert.equal(plan.audit.status, 'fail');
    assert.ok(plan.audit.violations.some((violation) => violation.code === 'numeric-fidelity'));
});
test('semantic planner output rejects ungrounded claim and asset references without throwing', async () => {
    const { dossier, proposal } = makeSemanticFixture();
    proposal.beats[0].answerClaimIds = ['DOS-EV-9999'];
    proposal.beats[0].evidence.coreClaimIds = ['DOS-EV-9999'];
    proposal.beats[2].assetIds = ['DOS-ASSET-0001'];
    const plan = await buildConcludeStoryPlan(dossier, { semanticPlanner: fakePlanner(proposal) });
    assert.equal(plan.status, 'insufficient-evidence');
    assert.equal(plan.audit.status, 'fail');
    assert.ok(plan.audit.violations.some((violation) => violation.code === 'missing-claim-reference'));
});
test('semantic planner output is rejected when it violates dossier claim-safety verbs', async () => {
    const { dossier, proposal } = makeSemanticFixture();
    proposal.beats[0].answer = 'QKI drives the protective-like astrocyte state.';
    const plan = await buildConcludeStoryPlan(dossier, { semanticPlanner: fakePlanner(proposal) });
    assert.equal(plan.status, 'insufficient-evidence');
    assert.equal(plan.audit.status, 'fail');
    assert.ok(plan.audit.violations.some((violation) => violation.code === 'claim-safety'));
});
test('semantic planner output is rejected for incomplete transitions and missing evidence roles', async () => {
    const { dossier, proposal } = makeSemanticFixture();
    proposal.beats[1].nextQuestion = null;
    proposal.evidenceRoles = proposal.evidenceRoles.filter((entry) => entry.claimId !== 'DOS-EV-0003');
    const plan = await buildConcludeStoryPlan(dossier, { semanticPlanner: fakePlanner(proposal) });
    assert.equal(plan.status, 'insufficient-evidence');
    assert.equal(plan.audit.status, 'fail');
    assert.ok(plan.audit.violations.some((violation) => violation.code === 'invalid-transition'));
    assert.ok(plan.audit.violations.some((violation) => violation.code === 'invalid-evidence-role'));
});
test('semantic planner output is rejected when reader-visible text contains workflow language', async () => {
    const { dossier, proposal } = makeSemanticFixture();
    proposal.centralContribution = 'The QDD workflow generated a transcript-usage story.';
    const plan = await buildConcludeStoryPlan(dossier, { semanticPlanner: fakePlanner(proposal) });
    assert.equal(plan.status, 'insufficient-evidence');
    assert.equal(plan.audit.status, 'fail');
    assert.ok(plan.audit.violations.some((violation) => violation.code === 'execution-language'));
    assert.ok(plan.audit.violations.some((violation) => violation.code === 'unsupported-workflow-story'));
});
//# sourceMappingURL=conclude-story.test.js.map