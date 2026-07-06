import path from 'node:path';
import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from '../runtime/constants.js';
import { discoverStudies } from '../runtime/discovery.js';
import { getStudyArtifactCandidatesPath, getStudyOutputDir, getStudyPublicDataRequestPath, readArtifactCandidateManifest } from '../runtime/evidence.js';
import { listStudyMemoryPaths, readEvolutionState } from '../runtime/evolution.js';
import { isQddProjectRoot } from '../runtime/paths.js';
import { readMarkdownDocument, readYamlFile } from '../runtime/store.js';
const FRONTMATTER_STUDY_ID_PATTERN = /^#\s*(STUDY-\d{3})\s+Memory\b/m;
const RENDER_TOOL_ORDER = ['latexmk', 'xelatex', 'pdflatex', 'pandoc'];
const ASSOCIATIVE_SIGNAL_PATTERN = /\b(associate|associated|association|correlate|correlated|correlation|candidate state|candidate marker|proxy|trend)\b/i;
const CAUSAL_SIGNAL_PATTERN = /\b(driver|drives|cause|causal|mechanism|mechanistic|proof|prove|proves|define|defines|defined|effect)\b/i;
const NEGATIVE_SIGNAL_PATTERN = /\b(block|blocked|negative|failed|failure|dissolv|downgrad|avoid|limit|boundary)\b/i;
const SELECTED_STORY_FIELD_PATTERN = /\bselected(?:[_ -]?story)?[_ -]?id\b\s*[:=]\s*(story-\d+)\b/i;
const STORY_ID_PATTERN = /\b(story-\d+)\b/i;
const TITLE_STYLE_BY_FRAMING = {
    discovery: 'Discovery-first with bounded biological scope',
    method: 'Method-forward with validation framing',
    'case-study': 'Case-study framing with project-grounded lessons',
    benchmark: 'Benchmark framing with explicit comparison criteria',
    'audit-report': 'Audit-report framing centered on evidence quality and limits',
    'bounded-hypothesis': 'Hypothesis-bounded framing with conservative verbs',
};
function buildPathStatus(options) {
    return {
        path: options.path,
        kind: options.kind,
        required: options.required,
        status: options.available ? 'available' : 'blocked',
        details: options.details,
        count: options.count,
    };
}
function extractStudyIdFromMemory(content) {
    const match = content.match(FRONTMATTER_STUDY_ID_PATTERN);
    return match ? match[1] : null;
}
function slugifyConcludeTimestamp(date) {
    return date.toISOString().replace(/[:.]/g, '-');
}
function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
function sentenceCaseTrim(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function normalizeRelativePath(value) {
    return value.split(path.sep).join('/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
}
function resolveProjectLocalPath(projectRoot, targetPath, label) {
    const absoluteTargetPath = path.isAbsolute(targetPath) ? path.resolve(targetPath) : path.resolve(projectRoot, targetPath);
    const relativeToProject = path.relative(projectRoot, absoluteTargetPath);
    if (relativeToProject.startsWith('..') || path.isAbsolute(relativeToProject)) {
        throw new Error(`${label} must stay within the current QDD project directory.`);
    }
    return absoluteTargetPath;
}
function toProjectRelativePath(projectRoot, absolutePath) {
    const relativePath = normalizeRelativePath(path.relative(projectRoot, absolutePath));
    return relativePath.length > 0 ? relativePath : '.';
}
function buildEvidenceId(prefix, index) {
    return `${prefix}-${String(index).padStart(3, '0')}`;
}
function detectClaimStrength(text) {
    if (CAUSAL_SIGNAL_PATTERN.test(text)) {
        return 'causal';
    }
    if (ASSOCIATIVE_SIGNAL_PATTERN.test(text)) {
        return 'associative';
    }
    return 'bounded';
}
function inferEvidenceTags(text) {
    const tags = new Set();
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
function splitBulletLikeLines(content) {
    return content
        .split('\n')
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter((line) => line.length > 0);
}
function summarizeFirstMeaningfulLine(content, fallback) {
    const line = splitBulletLikeLines(content).find((candidate) => !candidate.startsWith('#') && !candidate.startsWith('##'));
    return sentenceCaseTrim(line ?? fallback);
}
function summarizeStudyRecord(study) {
    const parts = [
        study.record.question,
        study.record.hypothesis,
        study.record.status ? `status ${study.record.status}` : '',
        ...(study.record.blockers ?? []),
        ...(study.record.expected_artifacts ?? []),
    ].filter((value) => value && value.trim().length > 0);
    return sentenceCaseTrim(parts.join('. '));
}
function buildClaimSafetyAuditEntry(claim, strength) {
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
function formatEvidenceLine(evidence) {
    const claimSuffix = evidence.claimStrength === 'causal' ? 'causal-risk' : evidence.claimStrength;
    return `- [${evidence.id}] (${evidence.kind}; ${claimSuffix}) ${evidence.summary} Source: \`${evidence.sourcePath}\`.`;
}
function formatEvidenceReferences(evidence) {
    return evidence.map((item) => `- [${item.id}] ${item.summary}`);
}
function uniqueStrings(values) {
    return [...new Set(values.map((value) => sentenceCaseTrim(value)).filter((value) => value.length > 0))];
}
function uniqueEvidenceItems(values) {
    const seen = new Set();
    return values.filter((value) => {
        if (seen.has(value.id)) {
            return false;
        }
        seen.add(value.id);
        return true;
    });
}
function normalizeStoryId(value) {
    return sentenceCaseTrim(value).toLowerCase();
}
function parseSelectedStoryId(content) {
    const labeledMatch = content.match(SELECTED_STORY_FIELD_PATTERN);
    if (labeledMatch) {
        return normalizeStoryId(labeledMatch[1]);
    }
    const storyIdMatch = content.match(STORY_ID_PATTERN);
    return storyIdMatch ? normalizeStoryId(storyIdMatch[1]) : null;
}
function buildReviewerObjections(framing, supporting, negatives) {
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
function scoreStoryCandidate(framing, supporting, negatives, claimSafetyAudit) {
    const supportiveBase = supporting.length * 18;
    const negativeBonus = Math.min(18, negatives.length * 6);
    const causalPenalty = claimSafetyAudit.filter((entry) => entry.action !== 'allow').length * 9;
    const framingBonus = framing === 'bounded-hypothesis' ? 12 :
        framing === 'audit-report' ? 10 :
            framing === 'method' ? 8 :
                framing === 'benchmark' ? 7 :
                    framing === 'case-study' ? 6 :
                        5;
    return clampScore(30 + supportiveBase + negativeBonus + framingBonus - causalPenalty);
}
function readStudyStatus(study) {
    return study.status ?? 'created';
}
function inferEvidenceKindFromStudy(study, content) {
    const status = readStudyStatus(study.record);
    if (status === 'blocked') {
        return 'negative';
    }
    return 'boundary';
}
function inferFramingFromEvidence(supporting, negatives) {
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
async function readArtifactEvidence(projectRoot, study, startIndex) {
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
async function harvestConcludeEvidence(result) {
    const evidence = [];
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
            const summary = sentenceCaseTrim(`${studyEvent.question}. kind ${studyEvent.kind}. ${studyEvent.resolves.length > 0 ? `resolves ${studyEvent.resolves.join(', ')}` : ''} ${studyEvent.opens.length > 0 ? `opens ${studyEvent.opens.join(', ')}` : ''}`);
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
function collectClaimSafetyAudit(evidence) {
    return evidence.map((item) => buildClaimSafetyAuditEntry(item.summary, item.claimStrength));
}
function buildCandidateNarrative(framing, supporting, negatives, contract) {
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
function selectCandidateEvidence(evidence, mode) {
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
function buildStoryCandidates(evidence, contract) {
    const modes = [
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
function selectEvidenceByIds(evidence, ids) {
    const idSet = new Set(ids);
    return evidence.filter((item) => idSet.has(item.id));
}
function buildResultsClaims(candidate, evidence, claimSafetyAudit) {
    const candidateEvidence = uniqueEvidenceItems([
        ...candidate.supportingEvidence,
        ...candidate.negativeOrBoundaryEvidence,
    ]);
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const supportingEvidenceIds = candidate.supportingEvidence.map((item) => item.id);
    const boundaryEvidenceIds = candidate.negativeOrBoundaryEvidence.map((item) => item.id);
    return candidate.supportingEvidence.slice(0, 3).map((item, index) => {
        const relatedEvidence = uniqueEvidenceItems([
            item,
            ...candidate.supportingEvidence.filter((entry) => entry.studyId !== null && entry.studyId === item.studyId),
            ...candidate.negativeOrBoundaryEvidence.filter((entry) => entry.studyId !== null && entry.studyId === item.studyId),
        ]);
        const boundaryEvidence = relatedEvidence.filter((entry) => entry.kind !== 'supporting');
        const safetyEntries = claimSafetyAudit.filter((entry) => entry.claim === item.summary);
        return {
            id: `claim-${index + 1}`,
            heading: `Result ${index + 1}`,
            claim: item.summary,
            claimStrength: item.claimStrength,
            supportingEvidence: uniqueEvidenceItems([
                item,
                ...selectEvidenceByIds(evidence, supportingEvidenceIds),
            ]).slice(0, 4),
            boundaryEvidence: uniqueEvidenceItems([
                ...boundaryEvidence,
                ...selectEvidenceByIds(evidence, boundaryEvidenceIds),
            ]).slice(0, 3),
            validationFocus: item.claimStrength === 'associative'
                ? 'Keep the wording association-only and show why no causal intervention evidence exists.'
                : item.claimStrength === 'causal'
                    ? 'Downgrade mechanistic verbs unless internal evidence shows direct intervention or functional validation.'
                    : 'Keep the claim bounded to the exact result package and avoid scope drift.',
            claimSafetyNotes: uniqueStrings(safetyEntries.length > 0
                ? safetyEntries.map((entry) => `${entry.action.toUpperCase()}: ${entry.rationale}`)
                : ['ALLOW: Current wording is already bounded to the available evidence.']),
            reviewerRisk: candidate.reviewerObjections[index]
                ?? candidate.reviewerObjections[0]
                ?? 'Reviewers may ask for a stronger explanation of why this claim remains bounded.',
        };
    }).map((claim) => ({
        ...claim,
        supportingEvidence: claim.supportingEvidence.map((entry) => evidenceById.get(entry.id) ?? entry),
        boundaryEvidence: claim.boundaryEvidence.map((entry) => evidenceById.get(entry.id) ?? entry),
    }));
}
function renderResultsClaimEvidence(evidence) {
    return evidence.map((item) => `- [${item.id}] ${item.summary} Source: \`${item.sourcePath}\`.`);
}
function renderConfirmedContributionMarkdown(candidate, selectedStoryPath) {
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
        '## Claims Allowed',
        '',
        ...candidate.claimsAllowed.map((value) => `- ${value}`),
        '',
        '## Claims To Soften Or Avoid',
        '',
        ...candidate.claimsToSoftenOrAvoid.map((value) => `- ${value}`),
        '',
    ].join('\n');
}
function renderResultsValidationMarkdown(candidate, claims) {
    const lines = [
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
function renderReviewerAuditMarkdown(candidate, claims) {
    const lines = [
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
function renderCitationSupportBankMarkdown(candidate, claims) {
    const lines = [
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
function renderSectionBlueprintsMarkdown(candidate, claims) {
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
function renderWritingRationaleMatrixMarkdown(candidate, claims) {
    const lines = [
        '# Writing Rationale Matrix',
        '',
        `- Selected story: ${candidate.id}`,
        '',
        '| Section | Narrative job | Evidence anchor | Safety / reviewer rationale |',
        '| --- | --- | --- | --- |',
        `| Contribution | State the confirmed contribution | ${candidate.supportingEvidence[0]?.id ?? 'n/a'} | ${candidate.claimsToSoftenOrAvoid[0] ?? 'Keep wording bounded.'} |`,
    ];
    for (const claim of claims) {
        lines.push(`| ${claim.heading} | Validate one Results claim | ${claim.supportingEvidence.map((item) => item.id).join(', ')} | ${sentenceCaseTrim(`${claim.reviewerRisk} ${claim.claimSafetyNotes[0] ?? ''}`)} |`);
    }
    lines.push(`| Discussion | Bound scope and future work | ${claims.flatMap((claim) => claim.boundaryEvidence.map((item) => item.id)).slice(0, 3).join(', ') || 'n/a'} | Negative evidence stays visible so the story remains auditable. |`);
    lines.push('');
    return lines.join('\n');
}
function buildPlanningArtifactPaths(outputDir, selectedStoryPath) {
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
async function writePlanningArtifacts(candidate, claims, artifactPaths) {
    await FileSystemUtils.createDirectory(artifactPaths.paperRewritingOutputDir);
    await Promise.all([
        FileSystemUtils.writeFile(artifactPaths.confirmedContributionPath, renderConfirmedContributionMarkdown(candidate, artifactPaths.selectedStoryPath)),
        FileSystemUtils.writeFile(artifactPaths.resultsValidationPath, renderResultsValidationMarkdown(candidate, claims)),
        FileSystemUtils.writeFile(artifactPaths.reviewerAuditPath, renderReviewerAuditMarkdown(candidate, claims)),
        FileSystemUtils.writeFile(artifactPaths.citationSupportBankPath, renderCitationSupportBankMarkdown(candidate, claims)),
        FileSystemUtils.writeFile(artifactPaths.sectionBlueprintsPath, renderSectionBlueprintsMarkdown(candidate, claims)),
        FileSystemUtils.writeFile(artifactPaths.writingRationaleMatrixPath, renderWritingRationaleMatrixMarkdown(candidate, claims)),
    ]);
}
async function writeSelectedStoryOutput(outputDir, candidate, inputSource) {
    await FileSystemUtils.writeFile(path.join(outputDir, 'selected_story.md'), renderSelectedStoryMarkdown(candidate, { inputSource }));
}
function renderSelectedStoryMarkdown(candidate, options) {
    return [
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
    ].join('\n');
}
async function resolveSelectedStory(projectRoot, outputDir, options, candidates) {
    const candidateById = new Map(candidates.map((candidate) => [normalizeStoryId(candidate.id), candidate]));
    const directSelectedStoryId = options.selectedStoryId ? normalizeStoryId(options.selectedStoryId) : null;
    const selectedStoryPathInput = options.selectedStoryPath?.trim();
    const auditSelectedStoryPath = path.join(outputDir, 'selected_story.md');
    const defaultSelectedStoryPath = path.join(outputDir, 'selected_story.md');
    const absoluteSelectedStoryPath = selectedStoryPathInput
        ? resolveProjectLocalPath(projectRoot, selectedStoryPathInput, 'Selected story path')
        : defaultSelectedStoryPath;
    const selectedStoryPathExists = await FileSystemUtils.fileExists(absoluteSelectedStoryPath);
    let parsedSelectedStoryId = null;
    if (selectedStoryPathExists) {
        const content = await FileSystemUtils.readFile(absoluteSelectedStoryPath);
        parsedSelectedStoryId = parseSelectedStoryId(content);
    }
    else if (selectedStoryPathInput) {
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
    const selectionInputSource = selectedStoryPathExists
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
function renderStoryCandidatesMarkdown(result) {
    const lines = [
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
function renderEvidenceAuditMarkdown(evidence) {
    return [
        '# Evidence Audit',
        '',
        ...evidence.map(formatEvidenceLine),
        '',
    ].join('\n');
}
function renderClaimSafetyAuditMarkdown(audit) {
    return [
        '# Claim Safety Audit',
        '',
        ...audit.map((entry) => `- ${entry.action.toUpperCase()}: ${entry.claim} (from ${entry.originalStrength} to ${entry.safeStrength}) - ${entry.rationale}`),
        '',
    ].join('\n');
}
function renderReviewerRiskAuditMarkdown(candidates) {
    const lines = ['# Reviewer Risk Audit', ''];
    for (const candidate of candidates) {
        lines.push(`## ${candidate.id}`);
        lines.push('');
        lines.push(...candidate.reviewerObjections.map((objection) => `- ${objection}`));
        lines.push('');
    }
    return lines.join('\n');
}
async function writeConcludeStoryOutputs(result) {
    await FileSystemUtils.createDirectory(result.outputDir);
    await Promise.all([
        FileSystemUtils.writeFile(path.join(result.outputDir, 'story_candidates.md'), renderStoryCandidatesMarkdown(result)),
        FileSystemUtils.writeFile(path.join(result.outputDir, 'evidence_audit.md'), renderEvidenceAuditMarkdown(result.evidence)),
        FileSystemUtils.writeFile(path.join(result.outputDir, 'claim_safety_audit.md'), renderClaimSafetyAuditMarkdown(result.claimSafetyAudit)),
        FileSystemUtils.writeFile(path.join(result.outputDir, 'reviewer_risk_audit.md'), renderReviewerRiskAuditMarkdown(result.candidates)),
    ]);
}
function resolveConcludeOutputDir(projectRoot, outputDir, runId) {
    const requested = outputDir?.trim();
    if (!requested) {
        return path.join(projectRoot, 'conclusions', runId);
    }
    return resolveProjectLocalPath(projectRoot, requested, 'Conclude output directory');
}
export async function generateConcludeStoryCandidates(projectRoot, options = {}) {
    const preflight = await inspectConcludePreflight(projectRoot, options);
    if (preflight.projectStatus === 'blocked') {
        throw new Error(`Conclude preflight is blocked: ${preflight.projectBlockers.join(' ')}`);
    }
    const evidence = await harvestConcludeEvidence(preflight);
    const candidates = buildStoryCandidates(evidence, preflight.snapshot.contract).slice(0, 3);
    const claimSafetyAudit = collectClaimSafetyAudit(evidence);
    const runId = options.runId ?? slugifyConcludeTimestamp(options.now ?? new Date());
    const outputDir = resolveConcludeOutputDir(preflight.projectRoot, options.outputDir, runId);
    const selectedStory = await resolveSelectedStory(preflight.projectRoot, outputDir, options, candidates);
    const resultsClaims = selectedStory.selectedCandidate
        ? buildResultsClaims(selectedStory.selectedCandidate, evidence, claimSafetyAudit)
        : [];
    const planningArtifacts = selectedStory.selectedCandidate && selectedStory.selectedStoryPath
        ? buildPlanningArtifactPaths(outputDir, selectedStory.selectedStoryPath)
        : null;
    const result = {
        runId,
        outputDir,
        storyCandidatesPath: path.join(outputDir, 'story_candidates.md'),
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
        claimSafetyAudit,
        nextStep: selectedStory.selectedCandidate ? 'draft-manuscript' : 'select-story',
    };
    await writeConcludeStoryOutputs(result);
    if (selectedStory.selectedCandidate && selectedStory.selectedStoryInputSource) {
        await writeSelectedStoryOutput(outputDir, selectedStory.selectedCandidate, selectedStory.selectedStoryInputSource);
    }
    if (selectedStory.selectedCandidate && planningArtifacts) {
        await writePlanningArtifacts(selectedStory.selectedCandidate, resultsClaims, planningArtifacts);
    }
    return result;
}
export async function runConclude(projectRoot, options = {}) {
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
async function readStudyMemories(projectRoot, memoryPaths) {
    return Promise.all(memoryPaths.map(async (relativePath) => {
        const content = await FileSystemUtils.readFile(path.join(projectRoot, relativePath));
        return {
            studyId: extractStudyIdFromMemory(content),
            relativePath,
            content,
        };
    }));
}
async function readStudyTasks(projectRoot, studyId) {
    const tasksDir = path.join(projectRoot, PATHS.studiesDir, studyId, 'tasks');
    if (!(await FileSystemUtils.directoryExists(tasksDir))) {
        return [];
    }
    const entries = await fs.readdir(tasksDir, { withFileTypes: true });
    const taskFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    return Promise.all(taskFiles.map(async (fileName) => {
        const taskId = fileName.replace(/\.md$/, '');
        const relativePath = `${PATHS.studiesDir}/${studyId}/tasks/${fileName}`;
        const document = await readMarkdownDocument(projectRoot, relativePath);
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
    }));
}
async function readStudySnapshots(projectRoot) {
    const discoveredStudies = await discoverStudies(projectRoot);
    const sortedStudies = [...discoveredStudies].sort((left, right) => left.study_id.localeCompare(right.study_id));
    return Promise.all(sortedStudies.map(async (study) => {
        const relativePath = `${PATHS.studiesDir}/${study.study_id}/study.md`;
        const document = await readMarkdownDocument(projectRoot, relativePath);
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
    }));
}
function toolMissingStatus(name) {
    return {
        name,
        status: 'blocked',
        available: false,
        resolvedPath: null,
    };
}
async function detectExecutableWithShell(name, environment, shellPath) {
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
async function detectRenderTools(environment, shellPath) {
    const entries = await Promise.all(RENDER_TOOL_ORDER.map(async (toolName) => [toolName, await detectExecutableWithShell(toolName, environment, shellPath)]));
    return Object.fromEntries(entries);
}
function buildRenderTargetStatus(status, reasons, notes) {
    return {
        status,
        reasons,
        notes,
    };
}
function buildRenderStatus(tools) {
    const pdfReasons = [];
    const pdfNotes = [];
    if (!tools.xelatex.available && !tools.pdflatex.available) {
        pdfReasons.push('Neither xelatex nor pdflatex is installed.');
    }
    else if (tools.xelatex.available) {
        pdfNotes.push(`PDF rendering can use xelatex at ${tools.xelatex.resolvedPath}.`);
    }
    else if (tools.pdflatex.available) {
        pdfNotes.push(`PDF rendering can fall back to pdflatex at ${tools.pdflatex.resolvedPath}.`);
    }
    if (tools.latexmk.available) {
        pdfNotes.push(`latexmk is available at ${tools.latexmk.resolvedPath}.`);
    }
    else {
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
function renderPathSummary(status) {
    const countSuffix = typeof status.count === 'number' ? ` (${status.count})` : '';
    return `- ${status.path}: ${status.status.toUpperCase()}${countSuffix} - ${status.details}`;
}
export function renderConcludeRenderStatusMarkdown(result) {
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
export async function inspectConcludePreflight(projectRoot, options = {}) {
    const environment = options.environment ?? process.env;
    const shellPath = options.shellPath ?? 'bash';
    const projectIsQddRoot = await isQddProjectRoot(projectRoot);
    const projectBlockers = [];
    const warnings = [];
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
    let contract = null;
    let evolution = null;
    let resourcesMarkdown = null;
    let artifactIndex = null;
    let studyMemories = [];
    let studies = [];
    try {
        if (hasContract) {
            contract = await readYamlFile(projectRoot, PATHS.contract);
        }
    }
    catch (error) {
        projectBlockers.push(`Failed to read '${PATHS.contract}': ${error.message}`);
    }
    try {
        if (hasEvolution) {
            evolution = await readEvolutionState(projectRoot);
        }
    }
    catch (error) {
        projectBlockers.push(`Failed to read '${PATHS.evolution}': ${error.message}`);
    }
    try {
        if (hasResources) {
            resourcesMarkdown = await FileSystemUtils.readFile(resourcesPath);
        }
    }
    catch (error) {
        projectBlockers.push(`Failed to read '${PATHS.contextResources}': ${error.message}`);
    }
    try {
        if (hasArtifactIndex) {
            artifactIndex = await readYamlFile(projectRoot, PATHS.artifactIndex);
        }
    }
    catch (error) {
        projectBlockers.push(`Failed to read '${PATHS.artifactIndex}': ${error.message}`);
    }
    let memoryPaths = [];
    if (hasMemoryDir) {
        try {
            memoryPaths = await listStudyMemoryPaths(projectRoot);
            studyMemories = await readStudyMemories(projectRoot, memoryPaths);
        }
        catch (error) {
            projectBlockers.push(`Failed to read '${PATHS.contextMemoryDir}': ${error.message}`);
        }
    }
    if (hasMemoryDir && memoryPaths.length === 0) {
        warnings.push(`No study memory files were found under '${PATHS.contextMemoryDir}'.`);
    }
    if (hasStudiesDir) {
        try {
            studies = await readStudySnapshots(projectRoot);
        }
        catch (error) {
            projectBlockers.push(`Failed to read '${PATHS.studiesDir}': ${error.message}`);
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
//# sourceMappingURL=conclude.js.map