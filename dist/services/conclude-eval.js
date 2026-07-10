import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { loadConcludeEvalOracle } from './conclude-eval-oracle.js';
import { runConclude } from './conclude.js';
const CAUSAL_SIGNAL_PATTERN = /\b(driver|drives|cause|causes|caused|causal|mechanism|mechanistic|proof|prove|proves|proven|define|defines|defined)\b/i;
const CAUSAL_GUARD_PATTERN = /\b(no|not|without|rather than|instead of|cannot|can't|does not|do not|did not|associative|association|bounded|compatible|hypothesis|requires? validation)\b/i;
const NEGATIVE_SIGNAL_PATTERN = /\b(block|blocked|negative|failed|failure|dissolv|downgrad|avoid|limit|boundary)\b/i;
const BIBTEX_ENTRY_PATTERN = /@\s*([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,[\s\S]*?\n?\}/g;
const CITE_COMMAND_PATTERN = /\\(?:cite|citep|citet|parencite|textcite|autocite)\w*\{([^}]+)\}/g;
const QUANTITATIVE_ANCHOR_PATTERN = /(?:\d+(?:\.\d+)?\\?%|\b(?:FDR|q(?:-value)?|p(?:-value)?|log2FC|CI)\s*[=<>]|\b\d[\d,]*(?:\.\d+)?\s+(?:donors?|samples?|nuclei|spots|transcripts?|genes?|loci|events?)\b)/i;
const FIGURE_TABLE_ANCHOR_PATTERN = /(?:\\(?:ref|autoref|cref)\{[^}]+\}|\b(?:figure|fig\.|table)\s*(?:\\?\d+|reference)\b)/i;
const INVENTORY_DESCRIPTOR_PATTERN = /\b(?:analysis matrix|abundance summary|autocorrelation statistics|correlation|artifact descriptions?|dataset descriptions?|evidence chain|per-pseudo-bulk QC metrics|nuclei count and fraction)\b/gi;
const META_WRITING_PATTERNS = [
    /\bthe (?:abstract|introduction|results|discussion|section) (?:should|frames?|remains|is organized)\b/gi,
    /\b(?:citations?|bibtex entries?) (?:are|is) (?:currently )?(?:unavailable|not yet available|missing)\b/gi,
    /\b(?:should|must|will|need to) be added (?:later|manually|before submission)\b/gi,
    /\b(?:selection gate|reviewer-facing|submission-oriented|manuscript-native|writing commentary|drafting instructions?)\b/gi,
];
const METADATA_PROSE_PATTERNS = [
    /[.!?]\s*[,.;:!?]+/g,
    /…\s*[;,.]/g,
    /;\s*(?:requires?|contains?|loads?|extracts?|exports?)\b/gi,
    /\b(?:status|expected_artifacts|source path|study id|task id|artifact id)\s*[:=]/gi,
];
function normalizeLine(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function truncateExcerpt(value) {
    const normalized = normalizeLine(value);
    return normalized.length > 320 ? `${normalized.slice(0, 317)}...` : normalized;
}
function excerptAroundMatch(value, matchedText) {
    const normalized = normalizeLine(value);
    if (!matchedText || normalized.length <= 320) {
        return truncateExcerpt(normalized);
    }
    const matchIndex = normalized.toLowerCase().indexOf(normalizeLine(matchedText).toLowerCase());
    if (matchIndex < 0) {
        return truncateExcerpt(normalized);
    }
    const start = Math.max(0, matchIndex - 120);
    const end = Math.min(normalized.length, Math.max(matchIndex + matchedText.length + 120, start + 317));
    return `${start > 0 ? '...' : ''}${normalized.slice(start, end)}${end < normalized.length ? '...' : ''}`;
}
function findLatexCommentStart(line) {
    for (let index = 0; index < line.length; index += 1) {
        if (line[index] !== '%') {
            continue;
        }
        let precedingBackslashes = 0;
        for (let cursor = index - 1; cursor >= 0 && line[cursor] === '\\'; cursor -= 1) {
            precedingBackslashes += 1;
        }
        if (precedingBackslashes % 2 === 0) {
            return index;
        }
    }
    return -1;
}
function stripLatexComments(text) {
    return text
        .split('\n')
        .map((line) => {
        const commentIndex = findLatexCommentStart(line);
        return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    })
        .join('\n');
}
function latexLineToVisibleText(line) {
    return normalizeLine(line
        .replace(/\\(?:cite|citep|citet|parencite|textcite|autocite)\w*\{[^}]*\}/g, ' ')
        .replace(/\\(?:label|bibliography|bibliographystyle|includegraphics|input|include)\*?(?:\[[^\]]*\])?\{[^}]*\}/g, ' ')
        .replace(/\\(?:ref|autoref|cref)\*?\{[^}]*\}/g, ' figure reference ')
        .replace(/\\(?:begin|end)\{[^}]*\}/g, ' ')
        .replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?\{([^{}]*)\}/g, ' $1 ')
        .replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?/g, ' ')
        .replace(/\\([%&#_$])/g, '$1')
        .replace(/[{}]/g, ' ')
        .replace(/~/g, ' '));
}
function extractVisibleManuscriptLines(mainTex, filePath) {
    return mainTex.split('\n').flatMap((rawLine, index) => {
        const commentIndex = findLatexCommentStart(rawLine);
        const uncommented = commentIndex >= 0 ? rawLine.slice(0, commentIndex) : rawLine;
        const text = latexLineToVisibleText(uncommented);
        if (!text) {
            return [];
        }
        return [{ filePath, line: index + 1, raw: uncommented, text }];
    });
}
function extractVisibleManuscriptText(mainTex) {
    return normalizeLine(extractVisibleManuscriptLines(mainTex, 'main.tex').map((line) => line.text).join(' '));
}
function makeFinding(line, reason, matchedText) {
    const rawMatchIndex = matchedText
        ? line.raw.toLowerCase().indexOf(matchedText.toLowerCase())
        : -1;
    return {
        filePath: line.filePath,
        line: line.line,
        column: rawMatchIndex >= 0 ? rawMatchIndex + 1 : 1,
        excerpt: excerptAroundMatch(line.text, matchedText),
        reason: normalizeLine(reason),
    };
}
function makeFileFinding(filePath, excerpt, reason, line = 1, column = 1) {
    return {
        filePath,
        line,
        column,
        excerpt: truncateExcerpt(excerpt),
        reason: normalizeLine(reason),
    };
}
function uniqueFindings(findings) {
    const seen = new Set();
    return findings.filter((finding) => {
        const key = `${finding.filePath}:${finding.line}:${finding.reason}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function collectRegexFindings(lines, patterns, reason) {
    const findings = [];
    for (const line of lines) {
        for (const pattern of patterns) {
            const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
            const matches = line.text.matchAll(new RegExp(pattern.source, flags));
            for (const match of matches) {
                findings.push(makeFinding(line, reason, match[0]));
            }
        }
    }
    return uniqueFindings(findings);
}
function collectEvidenceInventoryFindings(lines) {
    const findings = [];
    for (const line of lines) {
        const descriptorCount = [...line.text.matchAll(new RegExp(INVENTORY_DESCRIPTOR_PATTERN.source, 'gi'))].length;
        const selectedEvidenceChain = /\bacross the selected evidence chain\b/i.test(line.text);
        const semicolonInventory = /\bspecifically\b/i.test(line.text) && (line.text.match(/;/g) ?? []).length >= 2;
        const concatenatedDescriptors = descriptorCount >= 2 && /(?:;|\bwhile\b|\bfollowed by\b)/i.test(line.text);
        if (selectedEvidenceChain || semicolonInventory || concatenatedDescriptors) {
            const matchedText = selectedEvidenceChain
                ? 'Across the selected evidence chain'
                : semicolonInventory
                    ? 'Specifically'
                    : undefined;
            findings.push(makeFinding(line, 'Visible prose enumerates evidence or artifact descriptions instead of stating a synthesized scientific result.', matchedText));
        }
    }
    return uniqueFindings(findings);
}
function oraclePatternIsQddIdentifier(pattern) {
    return /(?:EV-)?(?:ART|STUDY|TASK)-/i.test(pattern);
}
function collectOraclePatternFindings(lines, patterns, selectPattern, reason) {
    return collectRegexFindings(lines, patterns.filter(selectPattern).map((pattern) => new RegExp(pattern, 'gi')), reason);
}
function collectFragmentedOrMetadataFindings(lines, oracle) {
    return uniqueFindings([
        ...collectRegexFindings(lines, METADATA_PROSE_PATTERNS, 'Visible prose contains broken punctuation, a sentence fragment, or metadata-shaped field text.'),
        ...collectOraclePatternFindings(lines, oracle.forbiddenVisiblePatterns, oraclePatternIsQddIdentifier, 'A QDD study, task, or artifact identifier is exposed in reader-visible manuscript prose.'),
    ]);
}
function collectMetaWritingFindings(lines, oracle) {
    return uniqueFindings([
        ...collectRegexFindings(lines, META_WRITING_PATTERNS, 'Reader-visible prose exposes drafting instructions, audit language, or a future-work placeholder.'),
        ...collectOraclePatternFindings(lines, oracle.forbiddenVisiblePatterns, (pattern) => !oraclePatternIsQddIdentifier(pattern), 'Reader-visible prose matches an Oracle-forbidden meta-writing or workflow phrase.'),
    ]);
}
function collectUnsupportedCentralClaimFindings(lines) {
    const findings = [];
    for (const line of lines) {
        const sentences = line.text.match(/[^.!?]+[.!?]?/g) ?? [];
        for (const sentence of sentences) {
            const normalized = normalizeLine(sentence);
            if (CAUSAL_SIGNAL_PATTERN.test(normalized) && !CAUSAL_GUARD_PATTERN.test(normalized)) {
                findings.push(makeFinding({ ...line, text: normalized }, 'A visible central statement uses causal or mechanistic language without an explicit evidence-bounded guard.'));
            }
        }
    }
    return uniqueFindings(findings);
}
function lineForClaim(lines, claim) {
    const normalizedClaim = normalizeLine(claim.claim).toLowerCase();
    const searchText = normalizedClaim.slice(0, Math.min(80, normalizedClaim.length));
    return lines.find((line) => line.text.toLowerCase().includes(searchText))
        ?? lines.find((line) => line.text.toLowerCase().includes(normalizeLine(claim.heading).toLowerCase()));
}
function hasResultAnchor(text) {
    return QUANTITATIVE_ANCHOR_PATTERN.test(text) || FIGURE_TABLE_ANCHOR_PATTERN.test(text);
}
function collectMissingResultAnchorFindings(lines, mainTexPath, resultsClaims, figureAssets, inventoryFindings) {
    if (lines.length === 0) {
        return [makeFileFinding(mainTexPath, '<empty or missing manuscript>', 'No reader-visible manuscript prose exists from which a major Results claim can be grounded.')];
    }
    const findings = [];
    if (resultsClaims.length > 0) {
        for (const claim of resultsClaims) {
            const claimLine = lineForClaim(lines, claim);
            if (!claimLine) {
                continue;
            }
            const availableFigure = figureAssets.some((asset) => asset.resultClaimId === claim.id && asset.status === 'available');
            if (!availableFigure && !hasResultAnchor(`${claim.claim} ${claimLine.raw}`)) {
                findings.push(makeFinding(claimLine, `Major Results claim ${claim.id} has no usable figure, table, or verifiable quantitative value in visible prose.`));
            }
        }
    }
    else {
        for (const inventoryFinding of inventoryFindings) {
            const line = lines.find((candidate) => candidate.line === inventoryFinding.line);
            if (line && !hasResultAnchor(line.raw)) {
                findings.push(makeFinding(line, 'The evidence-inventory statement has no usable figure, table, or verifiable quantitative value grounding it as a Results claim.'));
            }
        }
    }
    return uniqueFindings(findings);
}
function extractBibtexKeys(content) {
    return [...content.matchAll(new RegExp(BIBTEX_ENTRY_PATTERN.source, 'g'))].map((match) => match[2]);
}
function extractCiteKeys(content) {
    return [...content.matchAll(new RegExp(CITE_COMMAND_PATTERN.source, 'g'))]
        .flatMap((match) => match[1].split(','))
        .map((key) => normalizeLine(key))
        .filter((key) => key.length > 0);
}
function collectInvalidCitationFindings(lines, mainTexContent, referencesBibContent, referencesBibPath) {
    const findings = [];
    const bibtexKeys = new Set(extractBibtexKeys(referencesBibContent));
    const citeKeys = extractCiteKeys(mainTexContent);
    const missingCiteKeys = [...new Set(citeKeys.filter((key) => !bibtexKeys.has(key)))];
    if (bibtexKeys.size === 0) {
        findings.push(makeFileFinding(referencesBibPath, referencesBibContent.trim() || '<empty bibliography>', 'No parseable, verified BibTeX entry is available; an empty bibliography cannot be reported as citation-viable.'));
    }
    if ((referencesBibContent.match(/@/g) ?? []).length > bibtexKeys.size) {
        const malformedLineIndex = referencesBibContent.split('\n').findIndex((line) => line.includes('@'));
        const malformedLine = referencesBibContent.split('\n')[Math.max(0, malformedLineIndex)] ?? '<malformed BibTeX>';
        findings.push(makeFileFinding(referencesBibPath, malformedLine, 'references.bib contains an entry that cannot be parsed as BibTeX.', Math.max(0, malformedLineIndex) + 1));
    }
    for (const missingKey of missingCiteKeys) {
        const line = lines.find((candidate) => candidate.raw.includes(missingKey));
        findings.push(line
            ? makeFinding(line, `TeX citation key ${missingKey} is unresolved in references.bib.`, missingKey)
            : makeFileFinding(referencesBibPath, missingKey, `TeX citation key ${missingKey} is unresolved in references.bib.`));
    }
    return uniqueFindings(findings);
}
function buildHardFail(oracle, id, findings) {
    const oracleFailure = oracle.hardFailures.find((failure) => failure.id === id);
    if (!oracleFailure) {
        throw new Error(`Conclude eval oracle does not define hard failure ${id}.`);
    }
    return {
        id,
        triggered: findings.length > 0,
        rationale: oracleFailure.description,
        findings: uniqueFindings(findings),
    };
}
function buildGate(hardFails) {
    const triggeredIds = hardFails.filter((failure) => failure.triggered).map((failure) => failure.id);
    if (triggeredIds.length > 0) {
        return {
            status: 'fail',
            passing: false,
            reason: `Hard-fail override: ${triggeredIds.join(', ')}. Aggregate scores remain diagnostic only.`,
        };
    }
    return {
        status: 'pass',
        passing: true,
        reason: 'No Oracle hard failure was detected; aggregate scores remain diagnostic only.',
    };
}
function evaluateManuscriptQuality(input) {
    const visibleLines = extractVisibleManuscriptLines(input.mainTexContent, input.mainTexPath);
    const inventoryFindings = collectEvidenceInventoryFindings(visibleLines);
    const fragmentedFindings = collectFragmentedOrMetadataFindings(visibleLines, input.oracle);
    const unsupportedClaimFindings = collectUnsupportedCentralClaimFindings(visibleLines);
    const missingResultAnchorFindings = collectMissingResultAnchorFindings(visibleLines, input.mainTexPath, input.resultsClaims, input.figureAssets, inventoryFindings);
    const invalidCitationFindings = collectInvalidCitationFindings(visibleLines, input.mainTexContent, input.referencesBibContent, input.referencesBibPath);
    const metaWritingFindings = collectMetaWritingFindings(visibleLines, input.oracle);
    const detectedHardFails = [
        buildHardFail(input.oracle, 'evidence-inventory-prose', inventoryFindings),
        buildHardFail(input.oracle, 'fragmented-or-metadata-prose', fragmentedFindings),
        buildHardFail(input.oracle, 'unsupported-central-claim', unsupportedClaimFindings),
        buildHardFail(input.oracle, 'missing-result-anchor', missingResultAnchorFindings),
        buildHardFail(input.oracle, 'invalid-citation', invalidCitationFindings),
        buildHardFail(input.oracle, 'meta-writing', metaWritingFindings),
    ];
    const gate = buildGate(detectedHardFails);
    const falsePositiveFindings = gate.passing && detectedHardFails.some((failure) => failure.triggered)
        ? [makeFileFinding(input.mainTexPath, '<gate invariant violation>', 'The evaluator marked a hard-failing manuscript as passing.')]
        : [];
    const hardFails = [
        ...detectedHardFails,
        buildHardFail(input.oracle, 'false-positive-evaluation', falsePositiveFindings),
    ];
    return {
        visibleText: normalizeLine(visibleLines.map((line) => line.text).join(' ')),
        hardFails,
        gate: buildGate(hardFails),
    };
}
function clampFivePointScore(value) {
    return Math.max(1, Math.min(5, Math.round(value)));
}
function slugifyTimestamp(date) {
    return date.toISOString().replace(/[:.]/g, '-');
}
function countBibtexEntries(content) {
    return extractBibtexKeys(content).length;
}
function buildDimensionScore(id, score, rationale) {
    return {
        id,
        label: id,
        score: clampFivePointScore(score),
        rationale: normalizeLine(rationale),
    };
}
function triggeredFindingCount(hardFails, id) {
    return hardFails.find((failure) => failure.id === id)?.findings.length ?? 0;
}
function scoreLogicalCoherence(mainTex, hardFails) {
    const requiredStructureCount = [
        /\\begin\{abstract\}/.test(mainTex),
        /\\section\{Introduction\}/.test(mainTex),
        /\\section\{Results\}/.test(mainTex),
        /\\section\{Discussion\}/.test(mainTex),
    ].filter(Boolean).length;
    const inventoryPenalty = triggeredFindingCount(hardFails, 'evidence-inventory-prose') > 0 ? 2 : 0;
    const fragmentedPenalty = triggeredFindingCount(hardFails, 'fragmented-or-metadata-prose') > 0 ? 2 : 0;
    const metaPenalty = triggeredFindingCount(hardFails, 'meta-writing') > 0 ? 1 : 0;
    const groundingPenalty = triggeredFindingCount(hardFails, 'missing-result-anchor') > 0 ? 1 : 0;
    const structurePenalty = requiredStructureCount < 4 ? 1 : 0;
    const score = 5 - inventoryPenalty - fragmentedPenalty - metaPenalty - groundingPenalty - structurePenalty;
    const semanticFailureCount = inventoryPenalty + fragmentedPenalty + metaPenalty + groundingPenalty;
    return buildDimensionScore('logical_coherence', score, semanticFailureCount > 0
        ? 'The diagnostic score is reduced by evidence-inventory, prose-integrity, meta-writing, or result-grounding failures; section presence does not restore coherence.'
        : requiredStructureCount === 4
            ? 'Required sections exist and no deterministic semantic coherence failure was detected.'
            : 'The draft lacks required manuscript structure and cannot receive a high coherence diagnostic.');
}
function scoreNoveltySignificance(run) {
    const candidate = run.selectedCandidate;
    const objectionPenalty = Math.min(2, candidate?.reviewerObjections.length ?? 0);
    const framingBonus = candidate?.framing === 'discovery' ? 2 : candidate?.framing === 'bounded-hypothesis' ? 1 : 0;
    return buildDimensionScore('novelty_significance', 2 + framingBonus + Math.max(0, 1 - objectionPenalty), candidate
        ? `The selected ${candidate.framing} framing is diagnostic context only; reviewer objections continue to bound significance.`
        : 'No selected story was available to diagnose novelty and significance.');
}
function scoreEvidenceTraceability(run, hardFails) {
    const missingAnchorCount = triggeredFindingCount(hardFails, 'missing-result-anchor');
    const claimCount = run.resultsClaims.length;
    const score = claimCount === 0 ? 1 : 5 - Math.min(4, missingAnchorCount * 2);
    return buildDimensionScore('evidence_traceability', score, missingAnchorCount > 0
        ? `${missingAnchorCount} major Results claim(s) lack reader-visible figure, table, or value grounding; provenance comments alone are insufficient.`
        : claimCount > 0
            ? 'Major Results claims retain internal provenance and reader-visible grounding.'
            : 'No Results claims were available to trace.');
}
function scoreClaimSafety(run, hardFails) {
    const unsupportedCount = triggeredFindingCount(hardFails, 'unsupported-central-claim');
    const softenedCount = run.claimSafetyAudit.filter((entry) => entry.action === 'soften').length;
    return buildDimensionScore('claim_safety', 5 - Math.min(4, unsupportedCount * 2 + Math.min(2, softenedCount)), unsupportedCount > 0
        ? `${unsupportedCount} reader-visible causal or mechanistic statement(s) exceed the bounded claim contract.`
        : softenedCount > 0
            ? `The audit still identifies ${softenedCount} claim(s) requiring softer wording.`
            : 'No deterministic claim-limit violation was detected.');
}
function scoreNegativeEvidenceUse(run, visibleText) {
    const negativeEvidenceCount = run.resultsClaims.reduce((total, claim) => total + claim.boundaryEvidence.length, 0);
    const explicitBoundaryMentions = (visibleText.match(NEGATIVE_SIGNAL_PATTERN) ?? []).length;
    const score = 1 + Math.min(2, negativeEvidenceCount) + (explicitBoundaryMentions > 0 ? 2 : 0);
    return buildDimensionScore('negative_evidence_use', score, negativeEvidenceCount > 0
        ? 'The diagnostic detects boundary evidence in the draft; prose-quality hard failures still override this score.'
        : 'The draft does not yet make clear use of negative or boundary evidence.');
}
function scoreManuscriptViability(run, hardFails) {
    const triggeredCount = hardFails.filter((failure) => failure.triggered).length;
    const hasFinalPackage = Boolean(run.finalPaperArtifacts?.mainTex.path);
    const figurePlaceholders = run.finalPaperArtifacts?.figureAssets.filter((asset) => asset.status === 'placeholder').length ?? 0;
    const score = triggeredCount > 0 ? (triggeredCount === 1 ? 2 : 1) : hasFinalPackage && figurePlaceholders === 0 ? 5 : 3;
    return buildDimensionScore('manuscript_viability', score, triggeredCount > 0
        ? `${triggeredCount} Oracle hard failure(s) make the manuscript non-passing; section and file existence cannot imply viability.`
        : hasFinalPackage && figurePlaceholders === 0
            ? 'No deterministic hard failure or figure placeholder prevents manuscript viability.'
            : 'The package remains diagnostically incomplete even though no hard failure was detected.');
}
function scoreCitationIntegrity(referencesBibContent, hardFails) {
    const bibtexEntries = countBibtexEntries(referencesBibContent);
    const invalidCitationCount = triggeredFindingCount(hardFails, 'invalid-citation');
    return buildDimensionScore('citation_integrity', invalidCitationCount > 0 ? 1 : bibtexEntries > 0 ? 5 : 2, invalidCitationCount > 0
        ? `${invalidCitationCount} citation-integrity failure(s) keep the gate non-passing.`
        : `The draft includes ${bibtexEntries} parseable BibTeX entr${bibtexEntries === 1 ? 'y' : 'ies'} with no unresolved TeX key.`);
}
function collectAssociativeToCausalOverclaims(claims, audit) {
    const unsafeClaims = new Set(audit.filter((entry) => entry.action === 'avoid').map((entry) => normalizeLine(entry.claim).toLowerCase()));
    return claims
        .filter((claim) => claim.claimStrength === 'causal' || unsafeClaims.has(normalizeLine(claim.claim).toLowerCase()))
        .map((claim) => `${claim.id}: ${normalizeLine(claim.claim)}`);
}
function buildKeyImprovements(report) {
    const improvements = [];
    const triggeredIds = new Set(report.hardFails.filter((failure) => failure.triggered).map((failure) => failure.id));
    if (triggeredIds.has('evidence-inventory-prose')) {
        improvements.push('把 artifact/study 清单重写为带比较、数值、图表锚点和边界解释的科学结果链。');
    }
    if (triggeredIds.has('fragmented-or-metadata-prose')) {
        improvements.push('清理句子碎片、重复标点、metadata 字段和所有 reader-visible QDD 标识符。');
    }
    if (triggeredIds.has('meta-writing')) {
        improvements.push('从可见正文移除写作指令、审计语言和未来补齐 placeholder。');
    }
    if (triggeredIds.has('missing-result-anchor')) {
        improvements.push('为每个 major Results claim 补足可用 figure/table 或可核验的定量值。');
    }
    if (triggeredIds.has('invalid-citation')) {
        improvements.push('补齐可解析、可核验且与 TeX citation key 一致的真实 BibTeX 条目。');
    }
    if (triggeredIds.has('unsupported-central-claim')) {
        improvements.push('把超出证据边界的因果/机制表述降级为关联性或 bounded hypothesis。');
    }
    if (triggeredIds.size > 0) {
        improvements.push('先消除所有 hard-fail；aggregate score 只用于诊断，不能覆盖 gate。');
    }
    for (const hint of report.finalPaperAuditHints) {
        improvements.push(hint);
    }
    if (improvements.length < 3) {
        const weakest = [...report.dimensions].sort((left, right) => left.score - right.score);
        for (const dimension of weakest) {
            improvements.push(`继续改进 ${dimension.label}：${dimension.rationale}`);
            if (improvements.length >= 3) {
                break;
            }
        }
    }
    return [...new Set(improvements)].slice(0, 6);
}
function renderConcludeEvalMarkdown(report) {
    const lines = [
        '# Conclude Eval',
        '',
        `- Case path: \`${report.casePath}\``,
        `- Evaluated at: ${report.evaluatedAt}`,
        `- Run ID: ${report.runId}`,
        `- Conclude output: \`${report.concludeRun.outputDir}\``,
        '',
        '## Oracle',
        '',
        `- Schema version: ${report.oracle.schemaVersion}`,
        `- Case ID: \`${report.oracle.caseId}\``,
        `- Oracle path: \`${report.oracle.oraclePath}\``,
        '',
        '## Quality Gate',
        '',
        `- Gate status: **${report.gate.status.toUpperCase()}**`,
        `- Passing: ${report.gate.passing ? 'YES' : 'NO'}`,
        `- Reason: ${report.gate.reason}`,
        '',
        '## Diagnostic Summary',
        '',
        `- Aggregate score: ${report.summary.scoreTotal}/${report.summary.scoreMaximum} (${report.summary.scorePercent}%)`,
        `- Hard fail triggered: ${report.summary.hardFailTriggered ? 'YES' : 'NO'}`,
        `- Triggered hard fails: ${report.summary.triggeredHardFailCount}`,
        '',
        '## Dimension Scores',
        '',
        '| Dimension | Score | Rationale |',
        '| --- | --- | --- |',
    ];
    for (const dimension of report.dimensions) {
        lines.push(`| ${dimension.label} | ${dimension.score}/5 | ${dimension.rationale} |`);
    }
    lines.push('', '## Hard Fails', '');
    for (const hardFail of report.hardFails) {
        lines.push(`### ${hardFail.id}`, '');
        lines.push(`- Triggered: ${hardFail.triggered ? 'YES' : 'NO'}`);
        lines.push(`- Rationale: ${hardFail.rationale}`);
        for (const finding of hardFail.findings) {
            lines.push(`- Location: \`${finding.filePath}:${finding.line}:${finding.column}\``);
            lines.push(`- Visible excerpt: ${finding.excerpt}`);
            lines.push(`- Reason: ${finding.reason}`);
        }
        lines.push('');
    }
    lines.push('## Key Improvements', '');
    for (const improvement of report.keyImprovements) {
        lines.push(`- ${improvement}`);
    }
    lines.push('', '## Output Paths', '');
    lines.push(`- story_candidates.md: \`${report.concludeRun.storyCandidatesPath}\``);
    lines.push(`- evidence_audit.md: \`${report.concludeRun.evidenceAuditPath}\``);
    lines.push(`- claim_safety_audit.md: \`${report.concludeRun.claimSafetyAuditPath}\``);
    lines.push(`- reviewer_risk_audit.md: \`${report.concludeRun.reviewerRiskAuditPath}\``);
    lines.push(`- render_status.md: \`${report.concludeRun.renderStatusPath}\``);
    if (report.concludeRun.finalPaperDir) {
        lines.push(`- final_paper/: \`${report.concludeRun.finalPaperDir}\``);
    }
    lines.push(`- conclude_eval.json: \`${report.outputs.concludeEvalJsonPath}\``);
    lines.push(`- conclude_eval.md: \`${report.outputs.concludeEvalMarkdownPath}\``, '');
    return lines.join('\n');
}
export async function runConcludeEval(options) {
    const now = options.now ?? new Date();
    const runId = options.runId ?? `eval-${slugifyTimestamp(now)}`;
    const outputDir = options.outputDir
        ? path.resolve(options.casePath, options.outputDir)
        : path.resolve(options.casePath, 'conclusions', runId);
    const { oracle, oraclePath } = await loadConcludeEvalOracle(options.oraclePath);
    const concludeRun = await runConclude(options.casePath, {
        environment: options.environment,
        shellPath: options.shellPath,
        outputDir,
        selectedStoryId: options.selectedStoryId ?? 'story-1',
        now,
        runId,
    });
    const mainTexPath = concludeRun.finalPaperArtifacts?.paths.mainTexPath
        ?? path.join(outputDir, 'paper_rewriting_output', 'final_paper', 'main.tex');
    const referencesBibPath = concludeRun.finalPaperArtifacts?.paths.referencesBibPath
        ?? path.join(outputDir, 'paper_rewriting_output', 'final_paper', 'references.bib');
    const finalArtifactAuditPath = concludeRun.finalPaperArtifacts?.paths.finalArtifactAuditPath;
    const mainTexContent = await FileSystemUtils.fileExists(mainTexPath) ? await FileSystemUtils.readFile(mainTexPath) : '';
    const referencesBibContent = await FileSystemUtils.fileExists(referencesBibPath)
        ? await FileSystemUtils.readFile(referencesBibPath)
        : '';
    const finalArtifactAuditContent = finalArtifactAuditPath && await FileSystemUtils.fileExists(finalArtifactAuditPath)
        ? await FileSystemUtils.readFile(finalArtifactAuditPath)
        : '';
    const quality = evaluateManuscriptQuality({
        oracle,
        mainTexContent,
        referencesBibContent,
        mainTexPath,
        referencesBibPath,
        resultsClaims: concludeRun.resultsClaims,
        figureAssets: concludeRun.finalPaperArtifacts?.figureAssets ?? [],
    });
    const dimensions = [
        scoreLogicalCoherence(mainTexContent, quality.hardFails),
        scoreNoveltySignificance(concludeRun),
        scoreEvidenceTraceability(concludeRun, quality.hardFails),
        scoreClaimSafety(concludeRun, quality.hardFails),
        scoreNegativeEvidenceUse(concludeRun, quality.visibleText),
        scoreManuscriptViability(concludeRun, quality.hardFails),
        scoreCitationIntegrity(referencesBibContent, quality.hardFails),
    ];
    const scoreTotal = dimensions.reduce((total, item) => total + item.score, 0);
    const scoreMaximum = dimensions.length * 5;
    const triggeredHardFailCount = quality.hardFails.filter((item) => item.triggered).length;
    const summary = {
        scoreTotal,
        scoreMaximum,
        scorePercent: Math.round((scoreTotal / scoreMaximum) * 100),
        hardFailTriggered: triggeredHardFailCount > 0,
        triggeredHardFailCount,
    };
    const finalPaperAuditHints = finalArtifactAuditContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^- /.test(line) && /(GAP|BLOCKED)/.test(line))
        .map((line) => line.replace(/^- /, ''))
        .map((line) => {
        if (/figures asset map: GAP/i.test(line)) {
            return '减少 figure placeholder，给关键 Results claim 配上可复用的内部图表资产。';
        }
        if (/PDF render: BLOCKED/i.test(line)) {
            return '若目标包含 PDF，需补齐本地 TeX 依赖并重新验证渲染。';
        }
        if (/Word render: BLOCKED/i.test(line)) {
            return '若目标包含 Word，需补齐 pandoc 并重新验证 docx 渲染。';
        }
        return `处理 final paper 审计缺口：${line}`;
    })
        .slice(0, 2);
    const concludeEvalJsonPath = path.join(outputDir, 'conclude_eval.json');
    const concludeEvalMarkdownPath = path.join(outputDir, 'conclude_eval.md');
    const report = {
        casePath: options.casePath,
        evaluatedAt: now.toISOString(),
        runId,
        oracle: {
            schemaVersion: oracle.schemaVersion,
            caseId: oracle.caseId,
            oraclePath,
        },
        gate: quality.gate,
        outputs: {
            outputDir,
            concludeEvalJsonPath,
            concludeEvalMarkdownPath,
        },
        concludeRun: {
            outputDir: concludeRun.outputDir,
            storyCandidatesPath: concludeRun.storyCandidatesPath,
            evidenceAuditPath: concludeRun.evidenceAuditPath,
            claimSafetyAuditPath: concludeRun.claimSafetyAuditPath,
            reviewerRiskAuditPath: concludeRun.reviewerRiskAuditPath,
            renderStatusPath: concludeRun.renderStatusPath,
            selectedStoryPath: concludeRun.selectedStoryPath,
            finalPaperDir: concludeRun.finalPaperArtifacts?.paths.finalPaperDir ?? null,
            mainTexPath: concludeRun.finalPaperArtifacts?.paths.mainTexPath ?? null,
            referencesBibPath: concludeRun.finalPaperArtifacts?.paths.referencesBibPath ?? null,
            finalArtifactAuditPath: finalArtifactAuditPath ?? null,
        },
        dimensions,
        hardFails: quality.hardFails,
        summary,
        keyImprovements: buildKeyImprovements({
            dimensions,
            hardFails: quality.hardFails,
            finalPaperAuditHints,
        }),
    };
    await Promise.all([
        FileSystemUtils.writeFile(concludeEvalJsonPath, `${JSON.stringify(report, null, 2)}\n`),
        FileSystemUtils.writeFile(concludeEvalMarkdownPath, renderConcludeEvalMarkdown(report)),
    ]);
    return report;
}
function collectRawTaskStudyLeakage(visibleText) {
    const matches = visibleText.match(/\b(?:ART|STUDY|TASK)-\d{3}\b/gi) ?? [];
    return [...new Set(matches.map((match) => normalizeLine(match)))];
}
function collectReportToneSignals(visibleText) {
    const line = { filePath: 'main.tex', line: 1, raw: visibleText, text: visibleText };
    return collectRegexFindings([line], META_WRITING_PATTERNS, 'meta-writing').map((finding) => finding.excerpt);
}
export const __testOnly = {
    stripLatexComments,
    extractVisibleManuscriptText,
    collectRawTaskStudyLeakage,
    collectReportToneSignals,
    evaluateManuscriptQuality,
    scoreLogicalCoherence,
    collectAssociativeToCausalOverclaims,
};
//# sourceMappingURL=conclude-eval.js.map