const DATASET_PUBLIC_DATA_SKILL_IDS = new Set<string>(['public-data/cellxgene-discover']);

function normalizeSkillId(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '').split(/[\\/]+/).join('/');
}

export function isDatasetPublicDataSkillId(skillId: string): boolean {
  return DATASET_PUBLIC_DATA_SKILL_IDS.has(normalizeSkillId(skillId));
}

export function isReferencePublicDataSkillId(skillId: string): boolean {
  const normalized = normalizeSkillId(skillId);
  return normalized.startsWith('public-data/') && !DATASET_PUBLIC_DATA_SKILL_IDS.has(normalized);
}
