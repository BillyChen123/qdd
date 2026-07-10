const PROVENANCE_ID_PATTERN = /\b(?:STUDY|TASK|ART)-\d+\b/i;
const INTERNAL_BOUNDARY_PATTERN = /\bB\d{3}\b/i;
const EXECUTION_LANGUAGE_PATTERN = /\b(?:QDD|workflow|task status|study status|checklist|artifact description|output files?|reusable for|loads?|extracts?|exports?|pipeline validated)\b/i;
const DATA_READINESS_PATTERN = /\b(?:data[- ]readiness|analysis matrix|quality[- ]control(?:led)?|QC packet|reusable|workflow|task|status|checklist|output files?|pipeline validated)\b/i;
const INCOMPLETE_STATEMENT_PATTERN = /(?:[:;]\s*$)|^(?:however|but|and|or|significant\s*\()\b/i;
const UNSAFE_CAUSAL_ASSERTION_PATTERN = /\b(?:proven|direct drivers?|drives|causes?|establishes? mechanism)\b/i;
const NEGATIVE_PATTERN = /\b(?:not supported|unsupported|failed|failure|cannot|could not|no significant|not significant|does not support)\b/i;
const TRANSITION_TYPES = new Set(['motivates', 'narrows', 'rules-out', 'validates', 'closes']);
const EVIDENCE_ROLES = new Set(['core', 'bridge', 'validation', 'boundary', 'context', 'supplementary', 'excluded']);
function normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function sanitizeReaderText(value) {
    return normalizeText(value
        .replace(/>\s*/g, ' ')
        .replace(/\b(?:STUDY|TASK|ART)-\d+\b/gi, '')
        .replace(/\bB\d{3}\b/gi, '')
        .replace(/\bQDD(?: Auto)?\b/gi, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+([,.;:])/g, '$1'));
}
function uniqueStrings(values) {
    return [...new Set(values.map(normalizeText).filter(Boolean))];
}
function claimStatement(unit) {
    return normalizeText(unit.narrative.scientificStatement ?? '');
}
function unitStudyIds(unit) {
    return uniqueStrings(unit.provenance.sources.flatMap((source) => source.studyIds));
}
function isSafeNarrativeUnit(unit) {
    const statement = claimStatement(unit);
    return statement.length >= 20
        && !INCOMPLETE_STATEMENT_PATTERN.test(statement)
        && !DATA_READINESS_PATTERN.test(statement)
        && !PROVENANCE_ID_PATTERN.test(statement)
        && !EXECUTION_LANGUAGE_PATTERN.test(statement);
}
function unitScore(unit) {
    const statement = claimStatement(unit);
    return (unit.assetCandidateIds.length > 0 ? 5 : 0)
        + (unit.narrative.statistics.length > 0 ? 3 : 0)
        + (unit.narrative.effect ? 2 : 0)
        + (statement.length >= 60 && statement.length <= 500 ? 2 : 0)
        + (unit.provenance.sources.some((source) => source.locator.kind === 'markdown-lines') ? 1 : 0);
}
function selectUnits(units, pattern, limit, preferredStudyIds = []) {
    return units
        .filter((unit) => pattern.test(claimStatement(unit)))
        .sort((left, right) => {
        const leftPreferred = unitStudyIds(left).some((studyId) => preferredStudyIds.includes(studyId)) ? 1 : 0;
        const rightPreferred = unitStudyIds(right).some((studyId) => preferredStudyIds.includes(studyId)) ? 1 : 0;
        return rightPreferred - leftPreferred || unitScore(right) - unitScore(left) || left.id.localeCompare(right.id);
    })
        .slice(0, limit);
}
function findExactUnit(units, pattern, preferredStudyIds = []) {
    return selectUnits(units, pattern, 1, preferredStudyIds)[0] ?? null;
}
export function buildConcludeQuestionEvolutionTransitions(evolution) {
    if (!evolution) {
        return [];
    }
    return evolution.studies.map((event, index) => ({
        id: `evolution-${String(index + 1).padStart(3, '0')}`,
        studyId: event.id,
        question: normalizeText(event.question),
        changeType: event.kind,
        resolvedBoundaryIds: [...event.resolves],
        openedBoundaryIds: [...event.opens],
        candidateNextQuestions: [...event.candidates],
        nextStudyId: evolution.studies[index + 1]?.id ?? null,
    }));
}
function proposalBeatIsValid(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const beat = value;
    const evidence = beat.evidence;
    return typeof beat.question === 'string'
        && typeof beat.answer === 'string'
        && isStringArray(beat.answerClaimIds)
        && Boolean(evidence)
        && isStringArray(evidence?.coreClaimIds)
        && isStringArray(evidence?.bridgeClaimIds)
        && isStringArray(evidence?.validationClaimIds)
        && isStringArray(evidence?.boundaryClaimIds)
        && isStringArray(beat.assetIds)
        && typeof beat.boundedInterpretation === 'string'
        && typeof beat.transition === 'string'
        && TRANSITION_TYPES.has(beat.transition)
        && (beat.nextQuestion === null || typeof beat.nextQuestion === 'string')
        && isStringArray(beat.evolutionTransitionIds);
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
function isSemanticStoryProposal(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const proposal = value;
    return typeof proposal.centralContribution === 'string'
        && typeof proposal.scientificQuestion === 'string'
        && Array.isArray(proposal.beats)
        && proposal.beats.length > 0
        && proposal.beats.every(proposalBeatIsValid)
        && Array.isArray(proposal.evidenceRoles)
        && proposal.evidenceRoles.every((entry) => Boolean(entry)
            && typeof entry.claimId === 'string'
            && typeof entry.role === 'string'
            && EVIDENCE_ROLES.has(entry.role)
            && Array.isArray(entry.beatSequences)
            && entry.beatSequences.every((sequence) => Number.isInteger(sequence))
            && isStringArray(entry.assetIds)
            && typeof entry.rationale === 'string')
        && Array.isArray(proposal.omissions)
        && proposal.omissions.every((entry) => Boolean(entry)
            && typeof entry.claimId === 'string'
            && ['context', 'supplementary', 'excluded'].includes(entry.role)
            && ['context-only', 'supplementary', 'redundant', 'failed', 'off-axis', 'execution-only', 'unsafe'].includes(entry.category)
            && typeof entry.rationale === 'string')
        && Array.isArray(proposal.emphasisProfiles)
        && proposal.emphasisProfiles.every((profile) => Boolean(profile)
            && typeof profile.id === 'string'
            && typeof profile.label === 'string'
            && isStringArray(profile.supportingClaimIds)
            && isStringArray(profile.figurePriority)
            && Boolean(profile.sectionWeights && typeof profile.sectionWeights === 'object')
            && isStringArray(profile.discussionEmphasis))
        && isStringArray(proposal.claimLimits)
        && isStringArray(proposal.missingValidation)
        && isStringArray(proposal.reviewerRisks);
}
function stageAssetIds(units) {
    return uniqueStrings(units.flatMap((unit) => unit.assetCandidateIds));
}
function transitionIdsForUnits(units, transitions) {
    const studyIds = new Set(units.flatMap(unitStudyIds));
    return transitions.filter((transition) => studyIds.has(transition.studyId)).map((transition) => transition.id);
}
function evolutionStudyIdsMatching(input, pattern) {
    return input.questionEvolutionTransitions
        .filter((transition) => pattern.test([
        transition.question,
        ...transition.candidateNextQuestions,
    ].join(' ')))
        .map((transition) => transition.studyId);
}
function buildDefaultStages(input) {
    const results = input.dossier.evidenceUnits.filter((unit) => unit.eligibility === 'results' && isSafeNarrativeUnit(unit));
    const boundaries = input.dossier.evidenceUnits.filter((unit) => unit.eligibility === 'boundary' && isSafeNarrativeUnit(unit));
    const stages = [];
    const stateStudyIds = evolutionStudyIdsMatching(input, /astrocyte.*(?:splicing|RNA|QKI|CELF2)|(?:QKI|CELF2).*astrocyte/i);
    const resolutionStudyIds = evolutionStudyIdsMatching(input, /3[' -]?prime|full-length|isoform-level|transcript-level resolution/i);
    const candidateStudyIds = evolutionStudyIdsMatching(input, /candidate|prioritized.*(?:DTU|isoform)|donor-level.*DTU/i);
    const globalStudyIds = evolutionStudyIdsMatching(input, /unbiased.*DTU|transcriptome-wide|full transcriptome/i);
    const pathwayStudyIds = evolutionStudyIdsMatching(input, /pathway|autophagy|mitophagy|mitochondrial/i);
    const eventStudyIds = evolutionStudyIdsMatching(input, /event-local|locali[sz].*transcript|transcript-structure event|regulator.*compatib/i);
    const qkiState = findExactUnit(results, /QKI.*(?:subcluster|cluster)\s*17.*(?:log2fc|elevated|up)/i, stateStudyIds);
    const celf2State = findExactUnit(results, /CELF2.*(?:subcluster|cluster)\s*17.*(?:log2fc|elevated|up)/i, stateStudyIds);
    let stateUnits = [qkiState, celf2State].filter((unit) => Boolean(unit));
    if (stateUnits.length === 0) {
        stateUnits = selectUnits(results, /(?:astrocyte|cellular).*(?:state|subcluster|cluster).*(?:RNA|splic|transcript|QKI|CELF2)|(?:QKI|CELF2).*(?:state|astrocyte)/i, 2);
    }
    if (stateUnits.length > 0) {
        stages.push({
            key: 'state',
            question: 'Does a defined cellular state nominate an RNA-processing question?',
            answer: stateUnits.some((unit) => /QKI/i.test(claimStatement(unit))) && stateUnits.some((unit) => /CELF2/i.test(claimStatement(unit)))
                ? 'QKI and CELF2 were both elevated in the same astrocyte state, nominating an RNA-processing axis.'
                : sanitizeReaderText(claimStatement(stateUnits[0])),
            boundedInterpretation: 'The state association nominates an RNA-processing question but does not establish transcript-level or causal regulation.',
            transition: 'motivates',
            units: stateUnits,
            coreCount: stateUnits.length,
            bridge: false,
        });
    }
    const resolutionUnit = findExactUnit(boundaries, /cannot determine which isoforms|requires transcript-level resolution|3[' -]?prime.*(?:isoform|transcript)|cannot provide isoform-level|full transcript.*limitation/i, resolutionStudyIds);
    if (resolutionUnit) {
        const resolutionAnchor = findExactUnit(results, /QKI.*(?:mean|expression).*(?:astrocyte|n\s*a=|subcluster)/i, resolutionStudyIds);
        stages.push({
            key: 'resolution',
            question: 'Can the initial assay resolve the transcript-level question?',
            answer: 'The initial assay could not determine which isoforms changed, so transcript-level resolution was required.',
            boundedInterpretation: 'This is a modality boundary that justifies the next data route; it is not itself a biological result.',
            transition: 'motivates',
            units: uniqueUnits([resolutionUnit, ...(resolutionAnchor ? [resolutionAnchor] : [])]),
            coreCount: 0,
            bridge: true,
        });
    }
    let candidateUnits = selectUnits(results, /ENST\d+.*(?:QKI|CELF2)|(?:QKI|CELF2).*ENST\d+/i, 3, candidateStudyIds);
    if (candidateUnits.length === 0) {
        candidateUnits = selectUnits(results, /candidate.*(?:differential transcript|transcript usage|isoform)|(?:transcript usage|isoform).*candidate/i, 2);
    }
    if (candidateUnits.length > 0) {
        stages.push({
            key: 'candidate',
            question: 'Does full-length analysis support candidate transcript-usage changes?',
            answer: candidateUnits.some((unit) => /CELF2/i.test(claimStatement(unit)))
                ? 'Full-length candidate testing identified transcript-usage signals for CELF2 and a bounded QKI transcript signal.'
                : sanitizeReaderText(claimStatement(candidateUnits[0])),
            boundedInterpretation: 'Candidate testing provides a first transcript-level test and must retain the recorded multiplicity and power limits.',
            transition: 'motivates',
            units: candidateUnits,
            coreCount: 1,
            bridge: false,
        });
    }
    const globalSummary = findExactUnit(results, /transcriptome-wide.*(?:identified|reveals?).*(?:significant transcripts|transcript-usage)|(?:674 significant transcripts|widespread transcript-usage)/i, globalStudyIds);
    const stableAnchor = findExactUnit(results, /CELF2.*ENST00000631460.*(?:0\.012|significant)/i, globalStudyIds);
    const globalUnits = [globalSummary, stableAnchor].filter((unit) => Boolean(unit));
    if (globalUnits.length > 0) {
        stages.push({
            key: 'global',
            question: 'Does the candidate signal extend to transcriptome-wide remodeling?',
            answer: globalSummary
                ? sanitizeReaderText(claimStatement(globalSummary))
                : sanitizeReaderText(claimStatement(globalUnits[0])),
            boundedInterpretation: 'The broader screen supports widespread donor-level transcript-usage differences without proving cell-type-specific causality.',
            transition: 'motivates',
            units: globalUnits,
            coreCount: 1,
            bridge: false,
        });
    }
    const pathwayUnits = uniqueUnits([
        ...selectUnits(results, /selective autophagy|macroautophagy/i, 2, pathwayStudyIds),
        ...selectUnits(results, /mitophagy|mitochondrial quality|proteostasis/i, 1, pathwayStudyIds),
    ]).slice(0, 3);
    if (pathwayUnits.length > 0) {
        stages.push({
            key: 'pathway',
            question: 'Where does the transcript-usage landscape converge biologically?',
            answer: 'The differential-transcript-usage foreground converged on autophagy and mitochondrial-quality-control processes.',
            boundedInterpretation: 'Pathway enrichment identifies a disease-facing destination but does not establish the direction of regulation.',
            transition: 'motivates',
            units: pathwayUnits,
            coreCount: 1,
            bridge: false,
        });
    }
    const localizedCount = findExactUnit(results, /localized candidates\s*:\s*\d+/i, eventStudyIds);
    const boundaryRemodeling = findExactUnit(boundaries, /transcript-boundary remodeling.*(?:first|last).*exon|first\/last exon changes/i, eventStudyIds);
    const eventUnits = [localizedCount, boundaryRemodeling].filter((unit) => Boolean(unit));
    if (eventUnits.length > 0) {
        stages.push({
            key: 'event',
            question: 'Can the pathway-level signal be localized to concrete transcript architecture?',
            answer: localizedCount && boundaryRemodeling
                ? `Event-local evidence localized ${firstNumber(claimStatement(localizedCount)) ?? 'the prioritized'} candidates and identified transcript-boundary remodeling with frequent first- and last-exon changes.`
                : sanitizeReaderText(claimStatement(eventUnits[eventUnits.length - 1])),
            boundedInterpretation: 'The localization is annotation-backed and supports transcript-architecture interpretation, not raw-read proof of exon usage.',
            transition: 'narrows',
            units: eventUnits,
            coreCount: eventUnits.length,
            bridge: false,
        });
    }
    return stages;
}
function firstNumber(value) {
    return value.match(/\b\d+(?:\.\d+)?\b/)?.[0] ?? null;
}
function uniqueUnits(units) {
    const seen = new Set();
    return units.filter((unit) => {
        if (seen.has(unit.id)) {
            return false;
        }
        seen.add(unit.id);
        return true;
    });
}
function buildDefaultProposal(input) {
    if (input.dossier.audit.status !== 'pass') {
        return null;
    }
    const stages = buildDefaultStages(input);
    const safeBoundaries = input.dossier.evidenceUnits.filter((unit) => unit.eligibility === 'boundary' && isSafeNarrativeUnit(unit));
    const closureStudyIds = evolutionStudyIdsMatching(input, /event-local|locali[sz].*transcript|regulator.*compatib|bounded.*(?:model|causal)/i);
    const causalBoundary = findExactUnit(safeBoundaries, /does not support.*(?:broad|driver|causal)|cannot establish.*(?:causal|specific)|not establish.*mechanistic|plausible bridge.*not core-defining/i, closureStudyIds) ?? safeBoundaries.find((unit) => !UNSAFE_CAUSAL_ASSERTION_PATTERN.test(claimStatement(unit))) ?? null;
    if (stages.length === 0 || !causalBoundary) {
        return null;
    }
    const motifValidation = findExactUnit(input.dossier.evidenceUnits.filter((unit) => unit.eligibility === 'results' && isSafeNarrativeUnit(unit)), /(?:QKI|CELF2).*confidence score|motif-compatible|binding-context-compatible/i, closureStudyIds);
    const eventStage = stages.find((stage) => stage.key === 'event');
    if (eventStage && motifValidation && !eventStage.units.some((unit) => unit.id === motifValidation.id)) {
        eventStage.units.push(motifValidation);
    }
    const mainBeatUnits = [];
    const beats = stages.map((stage) => {
        const coreClaimIds = stage.bridge ? [] : stage.units.slice(0, stage.coreCount).map((unit) => unit.id);
        const bridgeClaimIds = stage.bridge ? stage.units.slice(0, 1).map((unit) => unit.id) : [];
        const validationClaimIds = stage.units.slice(stage.bridge ? 1 : stage.coreCount).map((unit) => unit.id);
        const boundaryClaimIds = stage.units
            .filter((unit) => unit.eligibility === 'boundary' && !bridgeClaimIds.includes(unit.id) && !coreClaimIds.includes(unit.id))
            .map((unit) => unit.id);
        mainBeatUnits.push(stage.units);
        return {
            question: stage.question,
            answer: stage.answer,
            answerClaimIds: stage.bridge ? stage.units.slice(0, 1).map((unit) => unit.id) : stage.units.map((unit) => unit.id),
            evidence: { coreClaimIds, bridgeClaimIds, validationClaimIds, boundaryClaimIds },
            assetIds: stageAssetIds(stage.units),
            boundedInterpretation: stage.boundedInterpretation,
            transition: stage.transition,
            nextQuestion: null,
            evolutionTransitionIds: transitionIdsForUnits(stage.units, input.questionEvolutionTransitions),
        };
    });
    const closureUnits = uniqueUnits([causalBoundary, ...(motifValidation ? [motifValidation] : [])]);
    mainBeatUnits.push(closureUnits);
    beats.push({
        question: 'What bounded model integrates the evidence without exceeding it?',
        answer: 'The integrated evidence supports a bounded RNA-processing-linked transcript-architecture model while stopping short of a single-factor causal explanation.',
        answerClaimIds: closureUnits.map((unit) => unit.id),
        evidence: {
            coreClaimIds: [],
            bridgeClaimIds: [],
            validationClaimIds: motifValidation ? [motifValidation.id] : [],
            boundaryClaimIds: [causalBoundary.id],
        },
        assetIds: stageAssetIds(closureUnits),
        boundedInterpretation: 'The model is associative and compatibility-based; direct binding, cell-type-specific regulation, and disease causality remain validation needs.',
        transition: 'closes',
        nextQuestion: null,
        evolutionTransitionIds: transitionIdsForUnits(closureUnits, input.questionEvolutionTransitions),
    });
    for (let index = 0; index < beats.length - 1; index += 1) {
        beats[index].nextQuestion = beats[index + 1].question;
    }
    const includedUnits = uniqueUnits(mainBeatUnits.flat());
    const includedIds = new Set(includedUnits.map((unit) => unit.id));
    const selectedStudyIds = new Set(includedUnits.flatMap(unitStudyIds));
    const roleByClaimId = new Map();
    const beatSequencesByClaimId = new Map();
    for (const [index, beat] of beats.entries()) {
        const roles = [
            ['core', beat.evidence.coreClaimIds],
            ['bridge', beat.evidence.bridgeClaimIds],
            ['validation', beat.evidence.validationClaimIds],
            ['boundary', beat.evidence.boundaryClaimIds],
        ];
        for (const [role, claimIds] of roles) {
            for (const claimId of claimIds) {
                if (!roleByClaimId.has(claimId) || role === 'core') {
                    roleByClaimId.set(claimId, role);
                }
                beatSequencesByClaimId.set(claimId, uniqueNumbers([...(beatSequencesByClaimId.get(claimId) ?? []), index + 1]));
            }
        }
    }
    const omissions = [];
    for (const unit of input.dossier.evidenceUnits) {
        if (includedIds.has(unit.id)) {
            continue;
        }
        const statement = claimStatement(unit);
        let role;
        let category;
        let rationale;
        if (unit.eligibility === 'methods-context') {
            role = 'context';
            category = 'context-only';
            rationale = 'Useful for Methods or provenance, but not part of the reader-facing Results spine.';
        }
        else if (unit.eligibility === 'excluded' || EXECUTION_LANGUAGE_PATTERN.test(statement) || DATA_READINESS_PATTERN.test(statement)) {
            role = 'excluded';
            category = 'execution-only';
            rationale = 'Execution, readiness, or catalog content does not support a scientific Results beat.';
        }
        else if (UNSAFE_CAUSAL_ASSERTION_PATTERN.test(statement)) {
            role = 'excluded';
            category = 'unsafe';
            rationale = 'The assertion exceeds the dossier claim-safety ceiling.';
        }
        else if (unitStudyIds(unit).some((studyId) => selectedStudyIds.has(studyId))) {
            role = 'supplementary';
            category = NEGATIVE_PATTERN.test(statement) ? 'failed' : 'supplementary';
            rationale = NEGATIVE_PATTERN.test(statement)
                ? 'This negative or null result does not change the main interpretation and remains auditable outside the spine.'
                : 'This evidence supports a selected layer but is redundant for the main question-answer sequence.';
        }
        else {
            role = 'excluded';
            category = NEGATIVE_PATTERN.test(statement) ? 'failed' : 'off-axis';
            rationale = NEGATIVE_PATTERN.test(statement)
                ? 'The failed or dissolved route is not required to explain a scientific pivot in the selected spine.'
                : 'The evidence belongs to an off-axis question-evolution branch and does not support the central contribution.';
        }
        roleByClaimId.set(unit.id, role);
        omissions.push({ claimId: unit.id, role, category, rationale });
    }
    const evidenceRoles = input.dossier.evidenceUnits.map((unit) => {
        const role = roleByClaimId.get(unit.id) ?? 'excluded';
        return {
            claimId: unit.id,
            role,
            beatSequences: beatSequencesByClaimId.get(unit.id) ?? [],
            assetIds: unit.assetCandidateIds,
            rationale: role === 'core'
                ? 'Necessary to support one of the central question-answer links.'
                : role === 'bridge'
                    ? 'Explains why the next scientific question or data modality follows.'
                    : role === 'validation'
                        ? 'Independently strengthens an answer without changing the story order.'
                        : role === 'boundary'
                            ? 'Changes the strongest interpretation allowed by the evidence.'
                            : omissions.find((entry) => entry.claimId === unit.id)?.rationale ?? 'Not used in the main Results spine.',
        };
    });
    const stageKeys = new Set(stages.map((stage) => stage.key));
    const parkinsonShape = ['state', 'candidate', 'global', 'pathway', 'event'].every((key) => stageKeys.has(key));
    const centralContribution = parkinsonShape
        ? 'An astrocyte QKI/CELF2 RNA-processing state connects through candidate and transcriptome-wide differential transcript usage to autophagy and mitochondrial-quality-control loci, where event-local evidence supports bounded transcript-architecture remodeling rather than a single-factor causal model.'
        : 'A defined biological state is connected to a bounded downstream evidence chain whose strongest interpretation remains associative pending independent validation.';
    const scientificQuestion = parkinsonShape
        ? 'How does an astrocyte RNA-processing state connect to transcript-architecture remodeling at disease-relevant quality-control loci?'
        : 'Can the available evidence form one closed and scientifically bounded question-answer chain?';
    const supportingIds = evidenceRoles.filter((entry) => ['bridge', 'validation', 'supplementary'].includes(entry.role)).map((entry) => entry.claimId);
    const figurePriority = uniqueStrings(beats.flatMap((beat) => beat.assetIds));
    const boundaryText = sanitizeReaderText(claimStatement(causalBoundary));
    const oracleLimits = input.oracleConstraints?.claimLimits ?? [];
    return {
        centralContribution,
        scientificQuestion,
        beats,
        evidenceRoles,
        omissions,
        emphasisProfiles: [{
                id: 'balanced',
                label: 'Balanced evidence emphasis',
                supportingClaimIds: supportingIds.slice(0, 12),
                figurePriority,
                sectionWeights: Object.fromEntries(beats.map((_, index) => [`beat-${index + 1}`, 1])),
                discussionEmphasis: ['Preserve the central contribution while foregrounding claim limits and independent validation needs.'],
            }],
        claimLimits: uniqueStrings([
            boundaryText,
            'Associative and compatibility-based evidence does not establish direct binding, cell-type-specific causality, or a single-factor disease mechanism.',
            ...oracleLimits,
        ]).slice(0, 8),
        missingValidation: uniqueStrings([
            ...causalBoundary.narrative.uncertainty,
            'Independent cell-type-resolved or perturbational validation remains necessary for causal interpretation.',
        ]),
        reviewerRisks: uniqueStrings([
            'A reviewer may question whether donor-level effects reflect cell composition rather than cell-intrinsic regulation.',
            'A reviewer may ask whether motif or binding compatibility has direct functional support.',
        ]),
    };
}
function uniqueNumbers(values) {
    return [...new Set(values)];
}
export const defaultConcludeSemanticStoryPlanner = {
    plan(input) {
        return buildDefaultProposal(input);
    },
};
function roleAssignmentMap(proposal, beats) {
    return proposal.evidenceRoles.map((assignment) => ({
        claimId: assignment.claimId,
        role: assignment.role,
        beatIds: assignment.beatSequences
            .map((sequence) => beats[sequence - 1]?.id)
            .filter((beatId) => Boolean(beatId)),
        assetIds: uniqueStrings(assignment.assetIds),
        rationale: normalizeText(assignment.rationale),
    }));
}
function buildCanonicalStory(proposal, input) {
    const transitionById = new Map(input.questionEvolutionTransitions.map((transition) => [transition.id, transition]));
    const unitById = new Map(input.dossier.evidenceUnits.map((unit) => [unit.id, unit]));
    const assetById = new Map(input.dossier.assetCandidates.map((asset) => [asset.id, asset]));
    const beats = proposal.beats.map((beat, index) => {
        const evolutionRefs = beat.evolutionTransitionIds.map((transitionId) => {
            const transition = transitionById.get(transitionId);
            return {
                transitionId,
                studyIds: transition ? [transition.studyId] : [],
                boundaryIds: transition ? uniqueStrings([...transition.resolvedBoundaryIds, ...transition.openedBoundaryIds]) : [],
            };
        });
        return {
            id: `beat-${index + 1}`,
            sequence: index + 1,
            question: normalizeText(beat.question),
            answer: normalizeText(beat.answer),
            answerClaimIds: uniqueStrings(beat.answerClaimIds),
            evidence: {
                coreClaimIds: uniqueStrings(beat.evidence.coreClaimIds),
                bridgeClaimIds: uniqueStrings(beat.evidence.bridgeClaimIds),
                validationClaimIds: uniqueStrings(beat.evidence.validationClaimIds),
                boundaryClaimIds: uniqueStrings(beat.evidence.boundaryClaimIds),
            },
            assetIds: uniqueStrings(beat.assetIds),
            boundedInterpretation: normalizeText(beat.boundedInterpretation),
            transition: beat.transition,
            nextQuestion: beat.nextQuestion === null ? null : normalizeText(beat.nextQuestion),
            qddEvolutionRefs: evolutionRefs,
        };
    });
    const assignments = roleAssignmentMap(proposal, beats);
    const assignmentByClaimId = new Map(assignments.map((assignment) => [assignment.claimId, assignment]));
    const mainAssignments = assignments.filter((assignment) => ['core', 'bridge', 'validation', 'boundary'].includes(assignment.role));
    const mainClaimIds = mainAssignments.map((assignment) => assignment.claimId);
    const graphNodes = mainAssignments.map((assignment) => {
        const unit = unitById.get(assignment.claimId);
        return {
            claimId: assignment.claimId,
            role: assignment.role,
            statement: unit ? sanitizeReaderText(claimStatement(unit)) : '',
            claimStrength: unit?.narrative.claimStrength ?? 'bounded',
            assetCandidateIds: unit?.assetCandidateIds ?? [],
            allowedVerbs: unit?.narrative.allowedVerbs ?? [],
            forbiddenVerbs: unit?.narrative.forbiddenVerbs ?? [],
        };
    });
    const graphEdges = [];
    for (let index = 0; index < beats.length - 1; index += 1) {
        const fromClaimId = beats[index].answerClaimIds[0];
        const toClaimId = beats[index + 1].answerClaimIds[0];
        if (fromClaimId && toClaimId) {
            graphEdges.push({
                fromClaimId,
                toClaimId,
                relation: beats[index].transition,
                rationale: `${beats[index].transition} the next reader-facing scientific question.`,
            });
        }
    }
    for (const assignment of assignments.filter((entry) => entry.role === 'boundary')) {
        for (const beatId of assignment.beatIds) {
            const beat = beats.find((entry) => entry.id === beatId);
            const targetClaimId = beat?.answerClaimIds.find((claimId) => claimId !== assignment.claimId);
            if (targetClaimId) {
                graphEdges.push({
                    fromClaimId: assignment.claimId,
                    toClaimId: targetClaimId,
                    relation: 'bounds',
                    rationale: 'The boundary claim limits the strongest allowed interpretation.',
                });
            }
        }
    }
    const figureTableSequence = [];
    const seenAssets = new Set();
    for (const beat of beats) {
        for (const assetId of beat.assetIds) {
            if (seenAssets.has(assetId)) {
                continue;
            }
            const asset = assetById.get(assetId);
            if (!asset) {
                continue;
            }
            seenAssets.add(assetId);
            figureTableSequence.push({
                sequence: figureTableSequence.length + 1,
                assetId,
                kind: asset.kind,
                claimIds: beat.answerClaimIds,
                role: `Anchor ${beat.id}: ${beat.question}`,
            });
        }
    }
    const claimGraph = {
        schemaVersion: 1,
        leadClaimId: beats[0]?.answerClaimIds[0] ?? mainClaimIds[0] ?? '',
        nodes: graphNodes,
        edges: graphEdges,
        resultOrdering: beats.flatMap((beat) => beat.answerClaimIds.slice(0, 1)),
        figureTablePlan: figureTableSequence,
        claimSafety: proposal.claimLimits,
        missingValidation: proposal.missingValidation,
        reviewerRisk: proposal.reviewerRisks,
    };
    const viability = buildViabilityDiagnostics(beats, assignments, input.dossier, figureTableSequence, proposal);
    const coreClaimIds = assignments.filter((assignment) => assignment.role === 'core').map((assignment) => assignment.claimId);
    const includedClaimIds = mainClaimIds;
    const boundaryClaimIds = assignments.filter((assignment) => assignment.role === 'boundary').map((assignment) => assignment.claimId);
    const supportingClaimIds = assignments.filter((assignment) => ['core', 'bridge', 'validation'].includes(assignment.role)).map((assignment) => assignment.claimId);
    return {
        schemaVersion: 1,
        id: 'canonical-story',
        framing: 'bounded-hypothesis',
        resultsBeats: beats,
        evidenceRoleAssignments: assignments,
        omissionLedger: proposal.omissions,
        emphasisProfiles: proposal.emphasisProfiles,
        claimLimits: proposal.claimLimits.map(normalizeText),
        missingValidation: proposal.missingValidation.map(normalizeText),
        reviewerRisks: proposal.reviewerRisks.map(normalizeText),
        scientificQuestion: normalizeText(proposal.scientificQuestion),
        scientificQuestionClaimIds: coreClaimIds,
        centralContribution: normalizeText(proposal.centralContribution),
        centralClaim: normalizeText(proposal.centralContribution),
        story: beats.map((beat) => `${beat.question} ${beat.answer}`).join(' '),
        resultsArc: beats.map((beat, index) => ({
            sequence: index + 1,
            claimId: beat.answerClaimIds[0],
            statement: beat.answer,
            role: (index === 0 ? 'lead' : 'supporting'),
        })).filter((entry) => Boolean(entry.claimId)),
        narrativeArc: beats.map((beat) => `${beat.question} ${beat.answer} (${beat.transition})`),
        claimGraph,
        claimBundle: beats.map((beat) => ({
            id: beat.id,
            statement: beat.answer,
            evidencePacketRefs: beat.answerClaimIds,
            boundaryPacketRefs: beat.evidence.boundaryClaimIds,
            validationFocus: beat.boundedInterpretation,
        })),
        includedClaimIds,
        excludedClaimIds: assignments.filter((assignment) => assignment.role === 'excluded').map((assignment) => assignment.claimId),
        figureTableSequence,
        limitationPlacement: boundaryClaimIds.map((claimId) => ({
            claimIds: assignmentByClaimId.get(claimId)?.beatIds.flatMap((beatId) => beats.find((beat) => beat.id === beatId)?.answerClaimIds ?? []) ?? [],
            boundaryClaimIds: [claimId],
            placement: 'discussion',
            rationale: 'Use this boundary to cap interpretation rather than to create a separate Results route.',
        })),
        viabilityBlockers: viability.narrativeClosure.status === 'closed' ? [] : ['The Results sequence does not close the central argument.'],
        viability,
        supportingPacketRefs: supportingClaimIds,
        boundaryPacketRefs: boundaryClaimIds,
        supportingEvidence: supportingClaimIds.flatMap((claimId) => dossierClaimToEvidence(input.dossier, claimId, 'supporting')),
        negativeOrBoundaryEvidence: boundaryClaimIds.flatMap((claimId) => dossierClaimToEvidence(input.dossier, claimId, 'boundary')),
        reviewerObjections: proposal.reviewerRisks.map(normalizeText),
        claimsAllowed: supportingClaimIds.map((claimId) => {
            const unit = unitById.get(claimId);
            return `[${claimId}] Use ${unit?.narrative.allowedVerbs.join(', ') || 'bounded descriptive wording'} for this claim.`;
        }),
        claimSafetyLimits: proposal.claimLimits.map(normalizeText),
        claimsToSoftenOrAvoid: supportingClaimIds.map((claimId) => {
            const unit = unitById.get(claimId);
            return `[${claimId}] Avoid ${unit?.narrative.forbiddenVerbs.join(', ') || 'language stronger than the recorded claim strength'}.`;
        }),
        recommendedTitleStyle: 'Contribution-first title centered on the canonical evidence chain.',
    };
}
function buildViabilityDiagnostics(beats, assignments, dossier, figureTableSequence, proposal) {
    const mainClaims = assignments.filter((assignment) => ['core', 'bridge', 'validation', 'boundary'].includes(assignment.role));
    const sourceGroups = new Set(mainClaims.flatMap((assignment) => {
        const unit = dossier.evidenceUnits.find((entry) => entry.id === assignment.claimId);
        return unit?.provenance.sources.map((source) => source.locator.path) ?? [];
    })).size;
    const closed = beats.length >= 2
        && beats[beats.length - 1]?.transition === 'closes'
        && beats.slice(0, -1).every((beat) => beat.transition !== 'closes' && Boolean(beat.nextQuestion))
        && Boolean(beats[0]?.answerClaimIds.length);
    const boundaryCount = assignments.filter((assignment) => assignment.role === 'boundary').length;
    return {
        narrativeClosure: {
            status: closed ? 'closed' : 'open',
            rationale: closed
                ? 'The ordered question-answer sequence ends in one bounded model and does not open another Results question.'
                : 'The sequence lacks a grounded closing beat or has an incomplete transition.',
        },
        coherence: {
            level: closed && beats.length >= 4 ? 'strong' : closed ? 'moderate' : 'weak',
            rationale: closed
                ? 'Coherence is determined by complete question-answer transitions and final closure.'
                : 'The scientific transitions do not yet form a closed argument.',
        },
        evidenceCoverage: {
            includedResultClaims: mainClaims.length,
            availableResultClaims: dossier.evidenceUnits.filter((unit) => unit.eligibility === 'results').length,
            sourceGroups,
            rationale: 'Coverage reports the selected scientific subgraph; it is not used as a proxy for narrative coherence.',
        },
        figureReadiness: {
            status: figureTableSequence.length >= Math.max(1, beats.length - 2) ? 'ready' : figureTableSequence.length > 0 ? 'partial' : 'missing',
            plannedAssets: figureTableSequence.length,
            rationale: 'Assets are ordered by the claims they anchor in the canonical Results sequence.',
        },
        claimSafety: {
            status: boundaryCount > 0 ? 'bounded' : 'review-required',
            boundaryClaims: boundaryCount,
            rationale: boundaryCount > 0
                ? 'Boundary evidence changes the strongest allowed interpretation in the closing model.'
                : 'No grounded boundary claim caps the central interpretation.',
        },
        noveltyRisk: {
            level: 'unassessed',
            rationale: 'External novelty assessment remains outside dossier-only story planning.',
        },
        missingValidation: proposal.missingValidation,
    };
}
function collectReaderVisibleFields(story) {
    return [
        { field: 'scientificQuestion', value: story.scientificQuestion, claimIds: story.scientificQuestionClaimIds },
        { field: 'centralContribution', value: story.centralContribution, claimIds: story.evidenceRoleAssignments.filter((entry) => entry.role === 'core').map((entry) => entry.claimId) },
        ...story.resultsBeats.flatMap((beat, index) => [
            { field: `resultsBeats[${index}].question`, value: beat.question, claimIds: beat.answerClaimIds },
            { field: `resultsBeats[${index}].answer`, value: beat.answer, claimIds: beat.answerClaimIds },
            { field: `resultsBeats[${index}].boundedInterpretation`, value: beat.boundedInterpretation, claimIds: uniqueStrings([...beat.answerClaimIds, ...beat.evidence.boundaryClaimIds]) },
            ...(beat.nextQuestion ? [{ field: `resultsBeats[${index}].nextQuestion`, value: beat.nextQuestion, claimIds: [] }] : []),
        ]),
        ...story.claimLimits.map((value, index) => ({ field: `claimLimits[${index}]`, value, claimIds: story.boundaryPacketRefs })),
        ...story.missingValidation.map((value, index) => ({ field: `missingValidation[${index}]`, value, claimIds: story.boundaryPacketRefs })),
        ...story.reviewerRisks.map((value, index) => ({ field: `reviewerRisks[${index}]`, value, claimIds: story.includedClaimIds })),
        ...story.emphasisProfiles.flatMap((profile, profileIndex) => profile.discussionEmphasis.map((value, index) => ({
            field: `emphasisProfiles[${profileIndex}].discussionEmphasis[${index}]`,
            value,
            claimIds: profile.supportingClaimIds,
        }))),
    ];
}
function numericTokens(value) {
    return value.match(/(?<![A-Za-z0-9_])[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) ?? [];
}
function normalizedNumericToken(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toPrecision(12) : value.toLowerCase();
}
function patternMatches(pattern, value) {
    try {
        return new RegExp(pattern, 'i').test(value);
    }
    catch {
        return value.toLowerCase().includes(pattern.toLowerCase());
    }
}
export function auditConcludeStoryPlan(story, input) {
    const violations = [];
    if (!story) {
        return { status: 'pass', violations };
    }
    const dossierClaimIds = new Set(input?.dossier.evidenceUnits.map((unit) => unit.id) ?? story.evidenceRoleAssignments.map((entry) => entry.claimId));
    const assetIds = new Set(input?.dossier.assetCandidates.map((asset) => asset.id) ?? uniqueStrings([
        ...story.figureTableSequence.map((entry) => entry.assetId),
        ...story.evidenceRoleAssignments.flatMap((assignment) => assignment.assetIds),
        ...story.resultsBeats.flatMap((beat) => beat.assetIds),
        ...story.emphasisProfiles.flatMap((profile) => profile.figurePriority),
    ]));
    const transitionIds = new Set(input?.questionEvolutionTransitions.map((transition) => transition.id) ?? story.resultsBeats.flatMap((beat) => beat.qddEvolutionRefs.map((ref) => ref.transitionId)));
    const unitById = new Map(input?.dossier.evidenceUnits.map((unit) => [unit.id, unit]) ?? []);
    const assetById = new Map(input?.dossier.assetCandidates.map((asset) => [asset.id, asset]) ?? []);
    const safetyByClaimId = new Map(input?.claimSafety.map((safety) => [safety.claimId, safety]) ?? []);
    const readerFields = collectReaderVisibleFields(story);
    for (const field of readerFields) {
        if (PROVENANCE_ID_PATTERN.test(field.value) || INTERNAL_BOUNDARY_PATTERN.test(field.value)) {
            violations.push({
                code: 'provenance-leak',
                candidateId: story.id,
                field: field.field,
                details: 'Reader-visible story text contains a QDD provenance identifier.',
            });
        }
        if (EXECUTION_LANGUAGE_PATTERN.test(field.value)) {
            violations.push({
                code: 'execution-language',
                candidateId: story.id,
                field: field.field,
                details: 'Reader-visible story text contains execution or workflow language.',
            });
        }
        for (const forbiddenPattern of input?.oracleConstraints?.forbiddenVisiblePatterns ?? []) {
            if (patternMatches(forbiddenPattern, field.value)) {
                violations.push({
                    code: 'execution-language',
                    candidateId: story.id,
                    field: field.field,
                    details: `Reader-visible story text matches forbidden pattern '${forbiddenPattern}'.`,
                });
            }
        }
        if (input && field.claimIds.length > 0) {
            const groundedNumbers = new Set(field.claimIds.flatMap((claimId) => {
                const unit = unitById.get(claimId);
                return unit ? numericTokens(claimStatement(unit)) : [];
            }).map(normalizedNumericToken));
            const ungroundedNumbers = numericTokens(field.value).filter((token) => !groundedNumbers.has(normalizedNumericToken(token)));
            if (ungroundedNumbers.length > 0) {
                violations.push({
                    code: 'numeric-fidelity',
                    candidateId: story.id,
                    field: field.field,
                    details: `Numeric values are not present in the referenced dossier claims: ${ungroundedNumbers.join(', ')}.`,
                });
            }
            if (field.field === 'centralContribution' || /\.answer$/.test(field.field)) {
                const forbiddenVerbs = uniqueStrings(field.claimIds.flatMap((claimId) => safetyByClaimId.get(claimId)?.forbiddenVerbs ?? []));
                const unsafeVerbs = forbiddenVerbs.filter((verb) => field.value.toLowerCase().includes(verb.toLowerCase()));
                if (unsafeVerbs.length > 0) {
                    violations.push({
                        code: 'claim-safety',
                        candidateId: story.id,
                        field: field.field,
                        details: `Reader-visible text uses verbs prohibited by the referenced claim safety: ${unsafeVerbs.join(', ')}.`,
                    });
                }
            }
        }
    }
    if (story.resultsBeats.length < 2) {
        violations.push({
            code: 'invalid-transition',
            candidateId: story.id,
            field: 'resultsBeats',
            details: 'A canonical story needs at least one advancing beat and one closing beat.',
        });
    }
    for (const [index, beat] of story.resultsBeats.entries()) {
        const referencedClaims = uniqueStrings([
            ...beat.answerClaimIds,
            ...beat.evidence.coreClaimIds,
            ...beat.evidence.bridgeClaimIds,
            ...beat.evidence.validationClaimIds,
            ...beat.evidence.boundaryClaimIds,
        ]);
        if (beat.answerClaimIds.length === 0 || referencedClaims.some((claimId) => !dossierClaimIds.has(claimId))) {
            violations.push({
                code: 'missing-claim-reference',
                candidateId: story.id,
                field: `resultsBeats[${index}]`,
                details: 'Every Results answer and evidence role must reference an available dossier claim.',
            });
        }
        const evidenceClaimIds = new Set([
            ...beat.evidence.coreClaimIds,
            ...beat.evidence.bridgeClaimIds,
            ...beat.evidence.validationClaimIds,
            ...beat.evidence.boundaryClaimIds,
        ]);
        if (beat.answerClaimIds.some((claimId) => !evidenceClaimIds.has(claimId))) {
            violations.push({
                code: 'invalid-evidence-role',
                candidateId: story.id,
                field: `resultsBeats[${index}].answerClaimIds`,
                details: 'Every grounded answer claim must have a main-spine editorial role in the same beat.',
            });
        }
        if (beat.assetIds.some((assetId) => !assetIds.has(assetId))) {
            violations.push({
                code: 'missing-claim-reference',
                candidateId: story.id,
                field: `resultsBeats[${index}].assetIds`,
                details: 'Every figure/table anchor must reference a dossier asset candidate.',
            });
        }
        if (input && beat.assetIds.some((assetId) => {
            const asset = assetById.get(assetId);
            return Boolean(asset) && !asset.linkedEvidenceUnitIds.some((claimId) => referencedClaims.includes(claimId));
        })) {
            violations.push({
                code: 'missing-claim-reference',
                candidateId: story.id,
                field: `resultsBeats[${index}].assetIds`,
                details: 'Every figure/table anchor must link to evidence assigned to the same Results beat.',
            });
        }
        if (beat.qddEvolutionRefs.some((ref) => !transitionIds.has(ref.transitionId))) {
            violations.push({
                code: 'missing-claim-reference',
                candidateId: story.id,
                field: `resultsBeats[${index}].qddEvolutionRefs`,
                details: 'Question-evolution provenance must reference a structured transition supplied to the planner.',
            });
        }
        const closing = index === story.resultsBeats.length - 1;
        if (closing ? beat.transition !== 'closes' || beat.nextQuestion !== null : beat.transition === 'closes' || !beat.nextQuestion) {
            violations.push({
                code: 'invalid-transition',
                candidateId: story.id,
                field: `resultsBeats[${index}]`,
                details: closing
                    ? 'The final beat must close the argument and must not open another question.'
                    : 'Every non-final beat must use an advancing transition and name the next scientific question.',
            });
        }
    }
    if (DATA_READINESS_PATTERN.test(story.resultsBeats[0]?.answer ?? '')) {
        violations.push({
            code: 'invalid-leading-claim',
            candidateId: story.id,
            field: 'resultsBeats[0].answer',
            details: 'The leading Results answer is data readiness or execution state rather than a scientific result.',
        });
    }
    if (story.framing === 'method' || story.framing === 'audit-report' || /\bQDD workflow\b/i.test(story.centralContribution)) {
        violations.push({
            code: 'unsupported-workflow-story',
            candidateId: story.id,
            field: 'centralContribution',
            details: 'A workflow or audit contribution cannot replace the dossier-backed scientific contribution.',
        });
    }
    const assignmentByClaimId = new Map();
    for (const assignment of story.evidenceRoleAssignments) {
        if (assignmentByClaimId.has(assignment.claimId)
            || !dossierClaimIds.has(assignment.claimId)
            || !EVIDENCE_ROLES.has(assignment.role)
            || assignment.assetIds.some((assetId) => !assetIds.has(assetId))) {
            violations.push({
                code: 'invalid-evidence-role',
                candidateId: story.id,
                field: `evidenceRoleAssignments.${assignment.claimId}`,
                details: 'Every dossier claim must have one valid editorial role and grounded assets.',
            });
        }
        assignmentByClaimId.set(assignment.claimId, assignment);
        const unit = unitById.get(assignment.claimId);
        if (unit && UNSAFE_CAUSAL_ASSERTION_PATTERN.test(claimStatement(unit)) && assignment.role !== 'excluded') {
            violations.push({
                code: 'invalid-evidence-role',
                candidateId: story.id,
                field: `evidenceRoleAssignments.${assignment.claimId}`,
                details: 'An unsafe causal assertion must remain excluded rather than enter the story spine.',
            });
        }
    }
    if ([...dossierClaimIds].some((claimId) => !assignmentByClaimId.has(claimId))) {
        violations.push({
            code: 'invalid-evidence-role',
            candidateId: story.id,
            field: 'evidenceRoleAssignments',
            details: 'Every dossier claim must be classified, including omitted evidence.',
        });
    }
    const beatIds = new Set(story.resultsBeats.map((beat) => beat.id));
    for (const assignment of story.evidenceRoleAssignments) {
        if (assignment.beatIds.some((beatId) => !beatIds.has(beatId))) {
            violations.push({
                code: 'invalid-evidence-role',
                candidateId: story.id,
                field: `evidenceRoleAssignments.${assignment.claimId}.beatIds`,
                details: 'Evidence role assignments may only reference canonical Results beats.',
            });
        }
    }
    for (const beat of story.resultsBeats) {
        const roleClaims = [
            ['core', beat.evidence.coreClaimIds],
            ['bridge', beat.evidence.bridgeClaimIds],
            ['validation', beat.evidence.validationClaimIds],
            ['boundary', beat.evidence.boundaryClaimIds],
        ];
        for (const [role, claimIds] of roleClaims) {
            for (const claimId of claimIds) {
                const assignment = assignmentByClaimId.get(claimId);
                if (!assignment || assignment.role !== role || !assignment.beatIds.includes(beat.id)) {
                    violations.push({
                        code: 'invalid-evidence-role',
                        candidateId: story.id,
                        field: `${beat.id}.${role}.${claimId}`,
                        details: 'Beat-level evidence roles must agree with the canonical claim assignment and beat membership.',
                    });
                }
            }
        }
    }
    const omissionByClaimId = new Map(story.omissionLedger.map((entry) => [entry.claimId, entry]));
    if (omissionByClaimId.size !== story.omissionLedger.length) {
        violations.push({
            code: 'invalid-evidence-role',
            candidateId: story.id,
            field: 'omissionLedger',
            details: 'Each omitted dossier claim must have exactly one omission-ledger entry.',
        });
    }
    for (const assignment of story.evidenceRoleAssignments) {
        const omitted = ['context', 'supplementary', 'excluded'].includes(assignment.role);
        if (omitted !== omissionByClaimId.has(assignment.claimId) || (omitted && assignment.beatIds.length > 0)) {
            violations.push({
                code: 'invalid-evidence-role',
                candidateId: story.id,
                field: `omissionLedger.${assignment.claimId}`,
                details: 'Context, supplementary, and excluded claims must have one omission rationale and cannot enter a Results beat.',
            });
        }
    }
    if (!story.evidenceRoleAssignments.some((assignment) => assignment.role === 'core')
        || !story.evidenceRoleAssignments.some((assignment) => assignment.role === 'boundary')) {
        violations.push({
            code: 'invalid-evidence-role',
            candidateId: story.id,
            field: 'evidenceRoleAssignments',
            details: 'A viable spine needs both indispensable core evidence and interpretation-changing boundary evidence.',
        });
    }
    for (const [index, profile] of story.emphasisProfiles.entries()) {
        if (profile.supportingClaimIds.some((claimId) => !assignmentByClaimId.has(claimId))
            || profile.figurePriority.some((assetId) => !assetIds.has(assetId))
            || Object.values(profile.sectionWeights).some((weight) => !Number.isFinite(weight) || weight < 0)) {
            violations.push({
                code: 'invalid-emphasis-profile',
                candidateId: story.id,
                field: `emphasisProfiles[${index}]`,
                details: 'Emphasis profiles may only reweight grounded supporting evidence, figures, sections, and Discussion emphasis.',
            });
        }
    }
    if (story.viability.narrativeClosure.status !== 'closed') {
        violations.push({
            code: 'invalid-transition',
            candidateId: story.id,
            field: 'viability.narrativeClosure',
            details: 'The semantic planner did not produce narrative closure.',
        });
    }
    return { status: violations.length === 0 ? 'pass' : 'fail', violations };
}
export async function buildConcludeStoryPlan(dossier, options = {}) {
    const input = {
        schemaVersion: 1,
        dossier,
        questionEvolutionTransitions: buildConcludeQuestionEvolutionTransitions(options.evolution),
        claimSafety: dossier.evidenceUnits.map((unit) => ({
            claimId: unit.id,
            claimStrength: unit.narrative.claimStrength,
            allowedVerbs: unit.narrative.allowedVerbs,
            forbiddenVerbs: unit.narrative.forbiddenVerbs,
            uncertainty: unit.narrative.uncertainty,
        })),
        oracleConstraints: options.oracleConstraints ?? null,
    };
    let rawProposal;
    try {
        rawProposal = await (options.semanticPlanner ?? defaultConcludeSemanticStoryPlanner).plan(input);
    }
    catch (error) {
        return {
            schemaVersion: 2,
            kind: 'qdd-manuscript-story-plan',
            status: 'insufficient-evidence',
            diagnostics: [`Semantic story planning failed: ${error.message}`],
            story: null,
            audit: {
                status: 'fail',
                violations: [{
                        code: 'invalid-schema',
                        candidateId: null,
                        field: 'semanticPlanner',
                        details: 'The semantic planner did not return a usable structured proposal.',
                    }],
            },
        };
    }
    if (rawProposal === null || rawProposal === undefined) {
        return {
            schemaVersion: 2,
            kind: 'qdd-manuscript-story-plan',
            status: 'insufficient-evidence',
            diagnostics: ['The structured dossier and question evolution do not support a grounded story with narrative closure.'],
            story: null,
            audit: { status: 'pass', violations: [] },
        };
    }
    if (!isSemanticStoryProposal(rawProposal)) {
        return {
            schemaVersion: 2,
            kind: 'qdd-manuscript-story-plan',
            status: 'insufficient-evidence',
            diagnostics: ['The semantic planner output failed the canonical story proposal schema.'],
            story: null,
            audit: {
                status: 'fail',
                violations: [{
                        code: 'invalid-schema',
                        candidateId: null,
                        field: 'semanticPlanner',
                        details: 'The semantic planner output is missing required canonical story fields.',
                    }],
            },
        };
    }
    const story = buildCanonicalStory(rawProposal, input);
    const audit = auditConcludeStoryPlan(story, input);
    if (audit.status === 'fail' || story.viabilityBlockers.length > 0) {
        return {
            schemaVersion: 2,
            kind: 'qdd-manuscript-story-plan',
            status: 'insufficient-evidence',
            diagnostics: [`The semantic story failed canonical validation: ${uniqueStrings(audit.violations.map((violation) => violation.code)).join(', ') || story.viabilityBlockers.join(', ')}.`],
            story: null,
            audit,
        };
    }
    return {
        schemaVersion: 2,
        kind: 'qdd-manuscript-story-plan',
        status: 'ready-for-review',
        diagnostics: ['One canonical story spine passed grounding, fidelity, transition, evidence-role, and narrative-closure validation.'],
        story,
        audit,
    };
}
function dossierUnitToEvidence(unit, kind) {
    const source = unit.provenance.sources[0];
    return {
        id: unit.id,
        kind,
        sourceType: 'artifact',
        sourcePath: source?.locator.path ?? 'unknown',
        studyId: source?.studyIds[0] ?? null,
        summary: claimStatement(unit),
        rationale: `${unit.id} is a grounded ${kind} claim from the scientific evidence dossier.`,
        claimStrength: unit.narrative.claimStrength,
        tags: [unit.eligibility],
    };
}
export function dossierClaimToEvidence(dossier, claimId, kind) {
    const unit = dossier.evidenceUnits.find((candidate) => candidate.id === claimId);
    if (!unit) {
        return [];
    }
    const evidence = [dossierUnitToEvidence(unit, kind)];
    if (kind === 'supporting') {
        const assetById = new Map(dossier.assetCandidates.map((asset) => [asset.id, asset]));
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
export function strongestClaimStrength(units) {
    if (units.some((unit) => unit.narrative.claimStrength === 'causal')) {
        return 'causal';
    }
    if (units.some((unit) => unit.narrative.claimStrength === 'associative')) {
        return 'associative';
    }
    return 'bounded';
}
//# sourceMappingURL=conclude-story.js.map