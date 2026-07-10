import type { ArtifactIndex } from './artifacts.js';
import type { ArtifactType } from './core.js';
import type { ResearchContract } from './core.js';
import type { EvolutionState } from './evolution.js';
import type { StudyRecord, TaskRecord } from './studies.js';
export type ConcludeAvailability = 'available' | 'blocked';
export type ConcludeDraftArtifactStatus = 'complete' | 'blocked' | 'gap';
export type ConcludeRenderToolName = 'latexmk' | 'xelatex' | 'pdflatex' | 'pandoc';
export type ConcludeEvidenceKind = 'supporting' | 'negative' | 'boundary';
export type ConcludeClaimStrength = 'associative' | 'bounded' | 'causal';
export type ConcludeEvidenceEligibility = 'results' | 'methods-context' | 'boundary' | 'excluded';
export type ConcludeEvidenceSourceRole = 'supporting' | 'boundary' | 'contradicting';
export type ConcludeEvidenceRegistration = 'artifact-index' | 'artifact-candidate';
export type ConcludeStoryFraming = 'discovery' | 'method' | 'case-study' | 'benchmark' | 'audit-report' | 'bounded-hypothesis';
export type ConcludeEvidenceFocus = 'data-readiness' | 'biological-signal' | 'workflow-validation' | 'claim-boundary' | 'negative-validation' | 'resource-context';
export interface ConcludeRenderToolStatus {
    name: ConcludeRenderToolName;
    status: ConcludeAvailability;
    available: boolean;
    resolvedPath: string | null;
}
export interface ConcludeRenderTargetStatus {
    status: ConcludeAvailability;
    reasons: string[];
    notes: string[];
}
export interface ConcludePathStatus {
    path: string;
    kind: 'file' | 'directory' | 'collection';
    required: boolean;
    status: ConcludeAvailability;
    details: string;
    count?: number;
}
export interface ConcludeTaskSnapshot {
    taskId: string;
    relativePath: string;
    record: TaskRecord;
    body: string;
}
export interface ConcludeStudySnapshot {
    studyId: string;
    relativePath: string;
    record: StudyRecord;
    body: string;
    tasks: ConcludeTaskSnapshot[];
    outputDir: string;
    outputDirExists: boolean;
    artifactCandidatesPath: string | null;
    publicDataRequestPath: string | null;
}
export interface ConcludeStudyMemorySnapshot {
    studyId: string | null;
    relativePath: string;
    content: string;
}
export interface ConcludeEvidenceTableLocator {
    kind: 'table-row';
    path: string;
    row: number;
    selector: Record<string, string>;
    columns: string[];
}
export interface ConcludeEvidenceMarkdownLocator {
    kind: 'markdown-lines';
    path: string;
    startLine: number;
    endLine: number;
    heading: string | null;
}
export interface ConcludeEvidenceFileLocator {
    kind: 'file';
    path: string;
    byteStart: number;
    byteEnd: number;
}
export type ConcludeEvidenceLocator = ConcludeEvidenceTableLocator | ConcludeEvidenceMarkdownLocator | ConcludeEvidenceFileLocator;
export interface ConcludeEvidenceProvenanceRef {
    role: ConcludeEvidenceSourceRole;
    sourceType: 'artifact-content' | 'artifact-metadata' | 'boundary-decision';
    locator: ConcludeEvidenceLocator;
    artifactIds: string[];
    studyIds: string[];
    taskIds: string[];
    registrations: ConcludeEvidenceRegistration[];
}
export interface ConcludeEvidenceStatistic {
    name: string;
    value: string;
}
export interface ConcludeEvidenceNarrative {
    scientificStatement: string | null;
    population: string | null;
    comparison: string | null;
    effect: ConcludeEvidenceStatistic | null;
    statistics: ConcludeEvidenceStatistic[];
    uncertainty: string[];
    claimStrength: ConcludeClaimStrength;
    allowedVerbs: string[];
    forbiddenVerbs: string[];
}
export interface ConcludeEvidenceUnitProvenance {
    sources: ConcludeEvidenceProvenanceRef[];
    extraction: {
        format: 'csv' | 'tsv' | 'markdown' | 'artifact-metadata' | 'unsupported';
        bounded: true;
        bytesRead: number;
        truncated: boolean;
    };
}
export interface ConcludeEvidenceDossierUnit {
    id: string;
    eligibility: ConcludeEvidenceEligibility;
    narrative: ConcludeEvidenceNarrative;
    provenance: ConcludeEvidenceUnitProvenance;
    assetCandidateIds: string[];
    exclusionReason: string | null;
}
export interface ConcludeEvidenceAssetCandidate {
    id: string;
    kind: 'figure' | 'table';
    format: string;
    caption: string | null;
    recommendedUse: string;
    width: number | null;
    height: number | null;
    linkedEvidenceUnitIds: string[];
    provenance: {
        source: ConcludeEvidenceProvenanceRef;
        catalogDescriptions: string[];
    };
}
export interface ConcludeEvidenceDossierGap {
    sourcePath: string;
    artifactType: ArtifactType;
    reason: string;
    artifactIds: string[];
    studyIds: string[];
    taskIds: string[];
}
export interface ConcludeEvidenceDossierAuditViolation {
    code: 'execution-language' | 'provenance-leak' | 'invalid-result-source' | 'missing-quantitative-locator';
    evidenceUnitId: string | null;
    field: string;
    details: string;
}
export interface ConcludeEvidenceDossierAudit {
    status: 'pass' | 'fail';
    violations: ConcludeEvidenceDossierAuditViolation[];
}
export interface ConcludeEvidenceDossier {
    schemaVersion: 1;
    kind: 'qdd-manuscript-evidence-dossier';
    generatedAt: string;
    readLimits: {
        maxBytesPerTextSource: number;
        maxRowsPerTable: number;
        maxEvidenceUnitsPerSource: number;
    };
    summary: {
        uniqueSources: number;
        resultUnits: number;
        boundaryUnits: number;
        excludedUnits: number;
        figureCandidates: number;
        tableCandidates: number;
    };
    evidenceUnits: ConcludeEvidenceDossierUnit[];
    assetCandidates: ConcludeEvidenceAssetCandidate[];
    gaps: ConcludeEvidenceDossierGap[];
    audit: ConcludeEvidenceDossierAudit;
}
export interface ConcludeEvidenceItem {
    id: string;
    kind: ConcludeEvidenceKind;
    sourceType: 'study' | 'task' | 'memory' | 'artifact' | 'evolution' | 'resource';
    sourcePath: string;
    studyId: string | null;
    summary: string;
    rationale: string;
    claimStrength: ConcludeClaimStrength;
    tags: string[];
}
export interface ConcludeEvidencePacket {
    id: string;
    kind: ConcludeEvidenceKind;
    focus: ConcludeEvidenceFocus;
    label: string;
    manuscriptSummary: string;
    rationale: string;
    claimStrength: ConcludeClaimStrength;
    evidenceIds: string[];
    sourcePaths: string[];
    studyIds: string[];
    tags: string[];
}
export interface ConcludePreflightSnapshot {
    contract: ResearchContract | null;
    evolution: EvolutionState | null;
    resourcesMarkdown: string | null;
    artifactIndex: ArtifactIndex | null;
    studyMemories: ConcludeStudyMemorySnapshot[];
    studies: ConcludeStudySnapshot[];
}
export interface ConcludeStoryCandidate {
    id: string;
    framing: ConcludeStoryFraming;
    centralClaim: string;
    story: string;
    narrativeArc: string[];
    claimBundle: ConcludeStoryClaimBundleEntry[];
    supportingPacketRefs: string[];
    boundaryPacketRefs: string[];
    supportingEvidence: ConcludeEvidenceItem[];
    negativeOrBoundaryEvidence: ConcludeEvidenceItem[];
    reviewerObjections: string[];
    claimsAllowed: string[];
    claimSafetyLimits: string[];
    claimsToSoftenOrAvoid: string[];
    suitabilityScore: number;
    recommendedTitleStyle: string;
}
export interface ConcludeStoryClaimBundleEntry {
    id: string;
    statement: string;
    evidencePacketRefs: string[];
    boundaryPacketRefs: string[];
    validationFocus: string;
}
export interface ConcludeClaimSafetyAuditEntry {
    claim: string;
    originalStrength: ConcludeClaimStrength;
    safeStrength: Exclude<ConcludeClaimStrength, 'causal'> | 'causal';
    action: 'allow' | 'soften' | 'avoid';
    rationale: string;
}
export interface ConcludeResultsClaim {
    id: string;
    heading: string;
    claim: string;
    claimStrength: ConcludeClaimStrength;
    supportingPacketRefs: string[];
    boundaryPacketRefs: string[];
    supportingEvidence: ConcludeEvidenceItem[];
    boundaryEvidence: ConcludeEvidenceItem[];
    validationFocus: string;
    claimSafetyNotes: string[];
    reviewerRisk: string;
}
export interface ConcludePlanningArtifactPaths {
    paperRewritingOutputDir: string;
    selectedStoryPath: string;
    confirmedContributionPath: string;
    resultsValidationPath: string;
    reviewerAuditPath: string;
    citationSupportBankPath: string;
    sectionBlueprintsPath: string;
    writingRationaleMatrixPath: string;
}
export interface ConcludeExternalCitationEntry {
    key: string;
    entryType: string;
    rawBibtex: string;
}
export interface ConcludeFigureAssetMapEntry {
    label: string;
    resultClaimId: string;
    evidenceId: string | null;
    sourcePath: string | null;
    targetPath: string | null;
    status: 'available' | 'placeholder';
    recommendedUse: string;
    notes: string[];
}
export interface ConcludeFinalArtifactStatus {
    status: ConcludeDraftArtifactStatus;
    path: string | null;
    details: string;
    notes: string[];
}
export interface ConcludeFinalPaperArtifactPaths {
    finalArtifactAuditPath: string;
    finalPaperDir: string;
    mainTexPath: string;
    referencesBibPath: string;
    figuresDir: string;
    figureAssetMapPath: string;
    paperPdfPath: string;
    paperDocxPath: string;
    pdfRenderLogPath: string;
    wordRenderLogPath: string;
}
export interface ConcludeFinalPaperPackage {
    paths: ConcludeFinalPaperArtifactPaths;
    overallStatus: ConcludeDraftArtifactStatus;
    mainTex: ConcludeFinalArtifactStatus;
    referencesBib: ConcludeFinalArtifactStatus;
    figures: ConcludeFinalArtifactStatus;
    pdf: ConcludeFinalArtifactStatus;
    word: ConcludeFinalArtifactStatus;
    citationIntegrity: ConcludeFinalArtifactStatus;
    citationEntries: ConcludeExternalCitationEntry[];
    citationGaps: string[];
    figureAssets: ConcludeFigureAssetMapEntry[];
}
export interface ConcludeStoryGenerationResult {
    runId: string;
    outputDir: string;
    storyCandidatesPath: string;
    evidencePacketsPath: string;
    evidenceAuditPath: string;
    evidenceDossierJsonPath: string;
    evidenceDossierMarkdownPath: string;
    claimSafetyAuditPath: string;
    reviewerRiskAuditPath: string;
    selectionRequired: boolean;
    selectedStoryId: string | null;
    selectedStoryPath: string | null;
    selectedCandidate: ConcludeStoryCandidate | null;
    planningArtifacts: ConcludePlanningArtifactPaths | null;
    resultsClaims: ConcludeResultsClaim[];
    candidates: ConcludeStoryCandidate[];
    evidence: ConcludeEvidenceItem[];
    evidenceDossier: ConcludeEvidenceDossier;
    evidencePackets: ConcludeEvidencePacket[];
    claimSafetyAudit: ConcludeClaimSafetyAuditEntry[];
    nextStep: 'select-story' | 'draft-manuscript' | 'review-final-draft';
}
export interface RunConcludeOptions extends GenerateConcludeStoryCandidatesOptions {
}
export interface RunConcludeResult extends ConcludeStoryGenerationResult {
    preflight: ConcludePreflightResult;
    renderStatusPath: string;
    finalPaperArtifacts: ConcludeFinalPaperPackage | null;
}
export type ConcludeEvalDimensionId = 'logical_coherence' | 'novelty_significance' | 'evidence_traceability' | 'claim_safety' | 'negative_evidence_use' | 'manuscript_viability' | 'citation_integrity';
export interface ConcludeEvalDimensionScore {
    id: ConcludeEvalDimensionId;
    label: string;
    score: 1 | 2 | 3 | 4 | 5;
    rationale: string;
}
export type ConcludeEvalHardFailId = 'evidence-inventory-prose' | 'fragmented-or-metadata-prose' | 'unsupported-central-claim' | 'missing-result-anchor' | 'invalid-citation' | 'meta-writing' | 'false-positive-evaluation';
export interface ConcludeEvalFinding {
    filePath: string;
    line: number;
    column: number;
    excerpt: string;
    reason: string;
}
export interface ConcludeEvalHardFail {
    id: ConcludeEvalHardFailId;
    triggered: boolean;
    rationale: string;
    findings: ConcludeEvalFinding[];
}
export interface ConcludeEvalOracleFact {
    id: string;
    fact: string;
    sourceRefs: string[];
    support: string[];
}
export interface ConcludeEvalOracleHardFailure {
    id: ConcludeEvalHardFailId;
    description: string;
}
export interface ConcludeEvalOracle {
    schemaVersion: 1;
    caseId: string;
    purpose: string;
    expectedFacts: ConcludeEvalOracleFact[];
    expectedStoryRelationships: string[];
    claimLimits: string[];
    requiredManuscriptSignals: string[];
    forbiddenVisiblePatterns: string[];
    hardFailures: ConcludeEvalOracleHardFailure[];
}
export interface ConcludeEvalOracleReference {
    schemaVersion: number;
    caseId: string;
    oraclePath: string;
}
export interface ConcludeEvalGate {
    status: 'pass' | 'fail';
    passing: boolean;
    reason: string;
}
export interface ConcludeEvalOutputs {
    outputDir: string;
    concludeEvalJsonPath: string;
    concludeEvalMarkdownPath: string;
}
export interface ConcludeEvalSummary {
    scoreTotal: number;
    scoreMaximum: number;
    scorePercent: number;
    hardFailTriggered: boolean;
    triggeredHardFailCount: number;
}
export interface ConcludeEvalReport {
    casePath: string;
    evaluatedAt: string;
    runId: string;
    oracle: ConcludeEvalOracleReference;
    gate: ConcludeEvalGate;
    outputs: ConcludeEvalOutputs;
    concludeRun: {
        outputDir: string;
        storyCandidatesPath: string;
        evidenceAuditPath: string;
        claimSafetyAuditPath: string;
        reviewerRiskAuditPath: string;
        renderStatusPath: string;
        selectedStoryPath: string | null;
        finalPaperDir: string | null;
        mainTexPath: string | null;
        referencesBibPath: string | null;
        finalArtifactAuditPath: string | null;
    };
    dimensions: ConcludeEvalDimensionScore[];
    hardFails: ConcludeEvalHardFail[];
    summary: ConcludeEvalSummary;
    keyImprovements: string[];
}
export interface RunConcludeEvalOptions extends ConcludePreflightOptions {
    casePath: string;
    outputDir?: string;
    selectedStoryId?: string;
    oraclePath?: string;
    now?: Date;
    runId?: string;
}
export interface ConcludeRenderStatus {
    status: ConcludeAvailability;
    reasons: string[];
    notes: string[];
    pdf: ConcludeRenderTargetStatus;
    word: ConcludeRenderTargetStatus;
    tools: Record<ConcludeRenderToolName, ConcludeRenderToolStatus>;
}
export interface ConcludePreflightResult {
    projectRoot: string;
    qddProjectRoot: boolean;
    projectStatus: ConcludeAvailability;
    projectBlockers: string[];
    warnings: string[];
    checkedPaths: {
        contract: ConcludePathStatus;
        evolution: ConcludePathStatus;
        resources: ConcludePathStatus;
        memory: ConcludePathStatus;
        artifactIndex: ConcludePathStatus;
        studies: ConcludePathStatus;
    };
    snapshot: ConcludePreflightSnapshot;
    render: ConcludeRenderStatus;
}
export interface ConcludePreflightOptions {
    environment?: NodeJS.ProcessEnv;
    shellPath?: string;
}
export interface GenerateConcludeStoryCandidatesOptions extends ConcludePreflightOptions {
    selectedStoryId?: string | null;
    selectedStoryPath?: string | null;
    runId?: string;
    now?: Date;
    outputDir?: string;
}
//# sourceMappingURL=conclude.d.ts.map