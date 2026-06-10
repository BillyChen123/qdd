const DATASET_PUBLIC_DATA_SKILL_IDS = new Set(['public-data/cellxgene-discover']);
function normalizeSkillId(value) {
    return value.trim().replace(/^\/+|\/+$/g, '').split(/[\\/]+/).join('/');
}
export function isDatasetPublicDataSkillId(skillId) {
    return DATASET_PUBLIC_DATA_SKILL_IDS.has(normalizeSkillId(skillId));
}
export function isLightweightPublicDataSkillId(skillId) {
    const normalized = normalizeSkillId(skillId);
    return normalized.startsWith('public-data/') && !DATASET_PUBLIC_DATA_SKILL_IDS.has(normalized);
}
export function isReferencePublicDataSkillId(skillId) {
    return isLightweightPublicDataSkillId(skillId);
}
//# sourceMappingURL=public-data.js.map