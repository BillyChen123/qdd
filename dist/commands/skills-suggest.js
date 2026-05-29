import { listControlledSkillDomains, listControlledSkillStages, listControlledSkillTags, refreshSkillsCatalog, suggestProblemSkills, } from '../runtime/local-skills.js';
import { requireQddProjectRoot, resolveProjectRoot } from '../runtime/paths.js';
function assertDomain(value) {
    const normalized = value?.trim().toLowerCase() ?? '';
    if (listControlledSkillDomains().includes(normalized)) {
        return normalized;
    }
    throw new Error(`--domain must be one of: ${listControlledSkillDomains().join(', ')}.`);
}
function assertStage(value) {
    const normalized = value?.trim().toLowerCase() ?? '';
    if (listControlledSkillStages().includes(normalized)) {
        return normalized;
    }
    throw new Error(`--stage must be one of: ${listControlledSkillStages().join(', ')}.`);
}
function assertTags(values) {
    const normalized = [...new Set((values ?? []).map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0))];
    const validTags = listControlledSkillTags();
    const invalid = normalized.filter((entry) => !validTags.includes(entry));
    if (invalid.length > 0) {
        throw new Error(`Unknown --tag value(s): ${invalid.join(', ')}. Allowed tags: ${validTags.join(', ')}.`);
    }
    return normalized;
}
export async function skillsSuggestCommand(options = {}) {
    const projectRoot = resolveProjectRoot();
    await requireQddProjectRoot(projectRoot);
    const domain = assertDomain(options.domain);
    const stage = assertStage(options.stage);
    const tags = assertTags(options.tag);
    if (options.refresh) {
        await refreshSkillsCatalog(projectRoot);
    }
    const result = await suggestProblemSkills(projectRoot, { domain, stage, tags });
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    if (result.candidates.length === 0) {
        console.log(`No problem-level skills matched domain='${domain}' stage='${stage}'.`);
        return;
    }
    console.log(`Skill suggestions for domain='${domain}' stage='${stage}'`);
    for (const candidate of result.candidates) {
        const matchedTags = candidate.matched_tags.length > 0 ? ` tags=${candidate.matched_tags.join(',')}` : '';
        console.log(`- ${candidate.id} score=${candidate.score}${matchedTags}`);
    }
    if (result.low_confidence) {
        console.log('Low confidence: domain/stage matched, but requested tags did not strongly narrow the result set.');
    }
}
//# sourceMappingURL=skills-suggest.js.map