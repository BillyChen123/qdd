import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { runConclude } from './conclude.js';
const ASSOCIATIVE_SIGNAL_PATTERN = /\b(associate|associated|association|correlate|correlated|correlation|candidate state|candidate marker|proxy|trend)\b/i;
const CAUSAL_SIGNAL_PATTERN = /\b(driver|drives|cause|causal|mechanism|mechanistic|proof|prove|proves|define|defines|defined|effect)\b/i;
const NEGATIVE_SIGNAL_PATTERN = /\b(block|blocked|negative|failed|failure|dissolv|downgrad|avoid|limit|boundary)\b/i;
const BIBTEX_ENTRY_PATTERN = /@\s*([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,[\s\S]*?\n\}/g;
const CITE_COMMAND_PATTERN = /\\cite\{([^}]+)\}/g;
function normalizeLine(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function clampFivePointScore(value) {
    return Math.max(1, Math.min(5, Math.round(value)));
}
function slugifyTimestamp(date) {
    return date.toISOString().replace(/[:.]/g, '-');
}
function countBibtexEntries(content) {
    return [...content.matchAll(BIBTEX_ENTRY_PATTERN)].length;
}
function extractBibtexKeys(content) {
    return [...content.matchAll(BIBTEX_ENTRY_PATTERN)].map((match) => match[2]);
}
function extractCiteKeys(content) {
    return [...content.matchAll(CITE_COMMAND_PATTERN)]
        .flatMap((match) => match[1].split(','))
        .map((key) => normalizeLine(key))
        .filter((key) => key.length > 0);
}
function collectMissingEvidenceAnchors(claims) {
    return claims
        .filter((claim) => claim.supportingEvidence.length === 0)
        .map((claim) => `${claim.id}: ${normalizeLine(claim.claim)}`);
}
function collectAssociativeToCausalOverclaims(claims, audit) {
    const softenedClaims = new Set(audit
        .filter((entry) => entry.action === 'soften')
        .map((entry) => normalizeLine(entry.claim).toLowerCase()));
    return claims
        .filter((claim) => {
        const normalizedClaim = normalizeLine(claim.claim).toLowerCase();
        return softenedClaims.has(normalizedClaim)
            || (ASSOCIATIVE_SIGNAL_PATTERN.test(claim.claim) && CAUSAL_SIGNAL_PATTERN.test(claim.claim));
    })
        .map((claim) => `${claim.id}: ${normalizeLine(claim.claim)}`);
}
function collectSuspiciousCitationSignals(run, mainTexContent, referencesBibContent) {
    const findings = [];
    const referencesCount = countBibtexEntries(referencesBibContent);
    const bibliographyUses = (referencesBibContent.match(/@/g) ?? []).length;
    const bibtexKeys = new Set(extractBibtexKeys(referencesBibContent));
    const citeKeys = extractCiteKeys(mainTexContent);
    const missingCiteKeys = citeKeys.filter((key) => !bibtexKeys.has(key));
    if (run.finalPaperArtifacts?.citationIntegrity.status === 'gap' && referencesCount > 0 && bibliographyUses === 0) {
        findings.push('references.bib contains malformed entries that did not parse as valid BibTeX.');
    }
    if (run.finalPaperArtifacts?.citationIntegrity.status === 'complete' && referencesCount === 0) {
        findings.push('Citation integrity was marked complete without any parseable BibTeX entry.');
    }
    if (missingCiteKeys.length > 0) {
        findings.push(`main.tex cites missing BibTeX key(s): ${[...new Set(missingCiteKeys)].join(', ')}.`);
    }
    return findings;
}
function buildDimensionScore(id, score, rationale) {
    const labels = {
        logical_coherence: 'logical_coherence',
        novelty_significance: 'novelty_significance',
        evidence_traceability: 'evidence_traceability',
        claim_safety: 'claim_safety',
        negative_evidence_use: 'negative_evidence_use',
        manuscript_viability: 'manuscript_viability',
        citation_integrity: 'citation_integrity',
    };
    return {
        id,
        label: labels[id],
        score: clampFivePointScore(score),
        rationale: normalizeLine(rationale),
    };
}
function scoreLogicalCoherence(mainTex, claims) {
    const sectionCount = Number(/\\section\{Introduction\}/.test(mainTex))
        + Number(/\\section\{Results\}/.test(mainTex))
        + Number(/\\section\{Discussion\}/.test(mainTex))
        + Number(/\\begin\{abstract\}/.test(mainTex));
    const subsectionCount = (mainTex.match(/\\subsection\{/g) ?? []).length;
    const score = 2 + Math.min(2, sectionCount - 2) + (subsectionCount >= Math.max(1, claims.length - 1) ? 1 : 0);
    return buildDimensionScore('logical_coherence', score, sectionCount >= 4
        ? 'The draft preserves a recognizable manuscript arc from abstract through discussion.'
        : 'The manuscript skeleton exists but still needs a more complete scientific narrative arc.');
}
function scoreNoveltySignificance(run) {
    const candidate = run.selectedCandidate;
    const objectionPenalty = Math.min(2, candidate?.reviewerObjections.length ?? 0);
    const framingBonus = candidate?.framing === 'discovery' ? 2 :
        candidate?.framing === 'bounded-hypothesis' ? 1 :
            0;
    const score = 2 + framingBonus + Math.max(0, 1 - objectionPenalty);
    return buildDimensionScore('novelty_significance', score, candidate
        ? `The selected ${candidate.framing} framing shows some manuscript value, but reviewer objections still bound the significance claim.`
        : 'No selected story was available to judge novelty and significance.');
}
function scoreEvidenceTraceability(run, mainTex) {
    const anchoredClaims = run.resultsClaims.filter((claim) => claim.supportingEvidence.length > 0).length;
    const anchorMentions = (mainTex.match(/Internal Evidence Anchors/g) ?? []).length;
    const score = 1 + Math.min(3, anchoredClaims) + (anchorMentions >= Math.max(1, anchoredClaims) ? 1 : 0);
    return buildDimensionScore('evidence_traceability', score, anchoredClaims === run.resultsClaims.length && run.resultsClaims.length > 0
        ? 'Each Results claim retains an internal evidence anchor in the draft package.'
        : 'Some Results claims remain under-anchored and need clearer traceability back to QDD evidence.');
}
function scoreClaimSafety(run) {
    const softenedCount = run.claimSafetyAudit.filter((entry) => entry.action === 'soften').length;
    const causalClaimCount = run.resultsClaims.filter((claim) => CAUSAL_SIGNAL_PATTERN.test(claim.claim)).length;
    const score = 5 - Math.min(3, softenedCount + causalClaimCount);
    return buildDimensionScore('claim_safety', score, softenedCount > 0
        ? `The audits still had to soften ${softenedCount} claim(s), so the draft needs tighter wording discipline.`
        : 'The draft mostly stays within bounded or associative language.');
}
function scoreNegativeEvidenceUse(run, mainTex) {
    const negativeEvidenceCount = run.resultsClaims.reduce((total, claim) => total + claim.boundaryEvidence.length, 0);
    const explicitBoundaryMentions = (mainTex.match(/Boundary Evidence/g) ?? []).length + (mainTex.match(NEGATIVE_SIGNAL_PATTERN) ?? []).length;
    const score = 1 + Math.min(2, negativeEvidenceCount) + (explicitBoundaryMentions > 0 ? 2 : 0);
    return buildDimensionScore('negative_evidence_use', score, negativeEvidenceCount > 0
        ? 'Negative or boundary evidence is visible in the draft, which helps keep the story bounded.'
        : 'The draft does not yet make strong use of negative or boundary evidence.');
}
function scoreManuscriptViability(run, mainTex) {
    const hasFinalPackage = Boolean(run.finalPaperArtifacts?.mainTex.path);
    const resultsClaims = run.resultsClaims.length;
    const figurePlaceholders = run.finalPaperArtifacts?.figureAssets.filter((asset) => asset.status === 'placeholder').length ?? 0;
    const score = (hasFinalPackage ? 2 : 1) + Math.min(2, resultsClaims) + (figurePlaceholders === 0 ? 1 : 0);
    return buildDimensionScore('manuscript_viability', score, /\\bibliography\{references\}/.test(mainTex)
        ? 'The manuscript package is structurally reviewable, though remaining citation or figure gaps may still limit submission readiness.'
        : 'The draft exists, but its manuscript packaging is still incomplete.');
}
function scoreCitationIntegrity(run, referencesBibContent) {
    const bibtexEntries = countBibtexEntries(referencesBibContent);
    const citationIntegrityStatus = run.finalPaperArtifacts?.citationIntegrity.status ?? 'gap';
    const score = citationIntegrityStatus === 'complete' && bibtexEntries > 0 ? 5 :
        citationIntegrityStatus === 'gap' && bibtexEntries > 0 ? 3 :
            citationIntegrityStatus === 'gap' ? 2 :
                1;
    return buildDimensionScore('citation_integrity', score, bibtexEntries > 0
        ? `The draft includes ${bibtexEntries} parseable BibTeX entr${bibtexEntries === 1 ? 'y' : 'ies'}, but integrity still depends on conservative citation use.`
        : 'No verified BibTeX support was available, so external citation integrity remains incomplete.');
}
function buildHardFail(id, triggered, rationale, evidence) {
    return {
        id,
        triggered,
        rationale: normalizeLine(rationale),
        evidence: evidence.map((entry) => normalizeLine(entry)),
    };
}
function buildKeyImprovements(report) {
    const improvements = [];
    const weakestDimensions = [...report.dimensions].sort((left, right) => left.score - right.score).slice(0, 3);
    for (const dimension of weakestDimensions) {
        if (dimension.id === 'citation_integrity') {
            improvements.push('补齐真实且可解析的 BibTeX 条目，避免 external statement 无引用支撑。');
            continue;
        }
        if (dimension.id === 'claim_safety') {
            improvements.push('继续收紧 Results 段落措辞，把任何关联性证据从机制/因果表述降级为 bounded wording。');
            continue;
        }
        if (dimension.id === 'negative_evidence_use') {
            improvements.push('把负结果、blocked study 和 boundary evidence 更明确地写进 Results/Discussion，而不是只留在审计文件里。');
            continue;
        }
        if (dimension.id === 'evidence_traceability') {
            improvements.push('为每个 major claim 补足更直观的 internal evidence anchor，确保正文和 QDD 产物可双向追踪。');
            continue;
        }
        if (dimension.id === 'logical_coherence') {
            improvements.push('加强段落之间的过渡和结果链条，让 manuscript 从问题、证据到结论的逻辑更顺滑。');
            continue;
        }
        if (dimension.id === 'novelty_significance') {
            improvements.push('更清楚地区分“workflow completion”和“scientific contribution”，把 significance 收束在真正有证据支撑的范围内。');
            continue;
        }
        improvements.push('补强 manuscript 可读性与结构完整性，减少 placeholder 痕迹。');
    }
    if (report.hardFails.some((item) => item.triggered)) {
        improvements.push('先消除所有 hard-fail，再比较分数变化；hard-fail 存在时总分提升不代表 draft 已可接受。');
    }
    for (const hint of report.finalPaperAuditHints.slice(0, 2)) {
        improvements.push(hint);
    }
    return [...new Set(improvements)].slice(0, 5);
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
        '## Summary',
        '',
        `- Total score: ${report.summary.scoreTotal}/${report.summary.scoreMaximum} (${report.summary.scorePercent}%)`,
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
    lines.push('');
    lines.push('## Hard Fails');
    lines.push('');
    for (const hardFail of report.hardFails) {
        lines.push(`### ${hardFail.id}`);
        lines.push('');
        lines.push(`- Triggered: ${hardFail.triggered ? 'YES' : 'NO'}`);
        lines.push(`- Rationale: ${hardFail.rationale}`);
        if (hardFail.evidence.length > 0) {
            lines.push('- Evidence:');
            for (const evidence of hardFail.evidence) {
                lines.push(`  - ${evidence}`);
            }
        }
        lines.push('');
    }
    lines.push('## Key Improvements');
    lines.push('');
    for (const improvement of report.keyImprovements) {
        lines.push(`- ${improvement}`);
    }
    lines.push('');
    lines.push('## Output Paths');
    lines.push('');
    lines.push(`- story_candidates.md: \`${report.concludeRun.storyCandidatesPath}\``);
    lines.push(`- evidence_audit.md: \`${report.concludeRun.evidenceAuditPath}\``);
    lines.push(`- claim_safety_audit.md: \`${report.concludeRun.claimSafetyAuditPath}\``);
    lines.push(`- reviewer_risk_audit.md: \`${report.concludeRun.reviewerRiskAuditPath}\``);
    lines.push(`- render_status.md: \`${report.concludeRun.renderStatusPath}\``);
    if (report.concludeRun.finalPaperDir) {
        lines.push(`- final_paper/: \`${report.concludeRun.finalPaperDir}\``);
    }
    lines.push(`- conclude_eval.json: \`${report.outputs.concludeEvalJsonPath}\``);
    lines.push(`- conclude_eval.md: \`${report.outputs.concludeEvalMarkdownPath}\``);
    lines.push('');
    return lines.join('\n');
}
export async function runConcludeEval(options) {
    const now = options.now ?? new Date();
    const runId = options.runId ?? `eval-${slugifyTimestamp(now)}`;
    const outputDir = options.outputDir
        ? path.resolve(options.casePath, options.outputDir)
        : path.resolve(options.casePath, 'conclusions', runId);
    const concludeRun = await runConclude(options.casePath, {
        environment: options.environment,
        shellPath: options.shellPath,
        outputDir,
        selectedStoryId: options.selectedStoryId ?? 'story-1',
        now,
        runId,
    });
    const mainTexPath = concludeRun.finalPaperArtifacts?.paths.mainTexPath;
    const referencesBibPath = concludeRun.finalPaperArtifacts?.paths.referencesBibPath;
    const finalArtifactAuditPath = concludeRun.finalPaperArtifacts?.paths.finalArtifactAuditPath;
    const mainTexContent = mainTexPath && await FileSystemUtils.fileExists(mainTexPath)
        ? await FileSystemUtils.readFile(mainTexPath)
        : '';
    const referencesBibContent = referencesBibPath && await FileSystemUtils.fileExists(referencesBibPath)
        ? await FileSystemUtils.readFile(referencesBibPath)
        : '';
    const finalArtifactAuditContent = finalArtifactAuditPath && await FileSystemUtils.fileExists(finalArtifactAuditPath)
        ? await FileSystemUtils.readFile(finalArtifactAuditPath)
        : '';
    const missingEvidenceAnchors = collectMissingEvidenceAnchors(concludeRun.resultsClaims);
    const associativeToCausalOverclaims = collectAssociativeToCausalOverclaims(concludeRun.resultsClaims, concludeRun.claimSafetyAudit);
    const suspiciousCitationSignals = collectSuspiciousCitationSignals(concludeRun, mainTexContent, referencesBibContent);
    const dimensions = [
        scoreLogicalCoherence(mainTexContent, concludeRun.resultsClaims),
        scoreNoveltySignificance(concludeRun),
        scoreEvidenceTraceability(concludeRun, mainTexContent),
        scoreClaimSafety(concludeRun),
        scoreNegativeEvidenceUse(concludeRun, mainTexContent),
        scoreManuscriptViability(concludeRun, mainTexContent),
        scoreCitationIntegrity(concludeRun, referencesBibContent),
    ];
    const hardFails = [
        buildHardFail('missing_internal_evidence_anchor', missingEvidenceAnchors.length > 0, 'Every major Results claim must retain at least one internal QDD evidence anchor.', missingEvidenceAnchors),
        buildHardFail('fabricated_citation_or_bibtex', suspiciousCitationSignals.length > 0, 'The draft must not invent citations or report complete citation integrity without real BibTeX support.', suspiciousCitationSignals),
        buildHardFail('associative_to_causal_overclaim', associativeToCausalOverclaims.length > 0, 'Associative evidence must not be written as a proven causal mechanism.', associativeToCausalOverclaims),
    ];
    const scoreTotal = dimensions.reduce((total, item) => total + item.score, 0);
    const scoreMaximum = dimensions.length * 5;
    const triggeredHardFailCount = hardFails.filter((item) => item.triggered).length;
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
        if (/references\.bib: GAP/i.test(line)) {
            return '补齐 references.bib 的真实条目后再提升 citation_integrity 分数。';
        }
        if (/citation integrity: GAP/i.test(line)) {
            return '对所有 external statement 建立可解析、可核验的 BibTeX 支撑。';
        }
        if (/Overall status: BLOCKED/i.test(line)) {
            return '清理 final paper package 中的 blocked 项，避免结构上可读但交付上仍不可用。';
        }
        if (/PDF render: BLOCKED/i.test(line)) {
            return '若目标包含可提交稿件，需补齐本地 TeX 依赖并重新验证 PDF 渲染。';
        }
        if (/Word render: BLOCKED/i.test(line)) {
            return '若目标包含 Word 交付，需补齐 pandoc 并重新验证 docx 渲染。';
        }
        if (/figures asset map: GAP/i.test(line)) {
            return '减少 figure placeholder，给关键 Results claim 配上可复用的内部图表资产。';
        }
        return `处理审计缺口：${line}`;
    })
        .slice(0, 3);
    const concludeEvalJsonPath = path.join(outputDir, 'conclude_eval.json');
    const concludeEvalMarkdownPath = path.join(outputDir, 'conclude_eval.md');
    const report = {
        casePath: options.casePath,
        evaluatedAt: now.toISOString(),
        runId,
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
            mainTexPath: mainTexPath ?? null,
            referencesBibPath: referencesBibPath ?? null,
            finalArtifactAuditPath: finalArtifactAuditPath ?? null,
        },
        dimensions,
        hardFails,
        summary,
        keyImprovements: buildKeyImprovements({
            dimensions,
            hardFails,
            finalPaperAuditHints,
        }),
    };
    await Promise.all([
        FileSystemUtils.writeFile(concludeEvalJsonPath, `${JSON.stringify(report, null, 2)}\n`),
        FileSystemUtils.writeFile(concludeEvalMarkdownPath, renderConcludeEvalMarkdown(report)),
    ]);
    return report;
}
//# sourceMappingURL=conclude-eval.js.map