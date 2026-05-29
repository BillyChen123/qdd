import path from 'node:path';
import * as fs from 'node:fs/promises';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { readMarkdownFrontmatter } from './store.js';
const SKILL_FILE_NAME = 'SKILL.md';
const WORKFLOW_SKILL_PREFIX = `${PATHS.workflowSkillCategory}/`;
const PLANNING_ONLY_SKILL_CATEGORY = 'brain';
const CONTROLLED_DOMAINS = ['singlecell', 'spatial', 'bulk', 'general'];
const CONTROLLED_STAGES = ['preprocess', 'integration', 'clustering', 'annotation', 'de', 'visualization', 'other'];
const CONTROLLED_TAGS = [
    'scanpy',
    'anndata',
    'h5ad',
    'raw-counts',
    'qc',
    'normalization',
    'multi-sample',
    'batch-correction',
    'batch-diagnosis',
    'neighbors',
    'leiden',
    'umap',
    'markers',
    'marker-based',
    'cell-type',
    'cell-state',
    'differential-expression',
    'condition-comparison',
];
// skill id 在 runtime 内统一用 category/name 形式。
// 这里顺手清理多余斜杠，避免 task frontmatter 里出现路径风格不一致的问题。
export function normalizeSkillId(value) {
    return value.trim().replace(/^\/+|\/+$/g, '').split(/[\\/]+/).join('/');
}
// task.skills 的去重与规范化入口。
// 这样无论是 CLI 创建还是手工编辑，后续比较都基于同一种规范形式。
export function normalizeTaskSkillIds(skillIds) {
    const seen = new Set();
    const normalized = [];
    for (const rawSkillId of skillIds ?? []) {
        const skillId = normalizeSkillId(rawSkillId);
        if (skillId.length === 0 || seen.has(skillId)) {
            continue;
        }
        seen.add(skillId);
        normalized.push(skillId);
    }
    return normalized;
}
export function isWorkflowSkillId(skillId) {
    return normalizeSkillId(skillId).startsWith(WORKFLOW_SKILL_PREFIX);
}
function isCategorizedSkillId(skillId) {
    return normalizeSkillId(skillId).includes('/');
}
export function getCodexLocalSkillPath(skillId) {
    return `${PATHS.codexSkillsDir}/${normalizeSkillId(skillId)}/${SKILL_FILE_NAME}`;
}
export function getClaudeLocalSkillPath(skillId) {
    return `${PATHS.claudeSkillsDir}/${normalizeSkillId(skillId)}/${SKILL_FILE_NAME}`;
}
function isPlanningOnlySkillId(skillId) {
    return normalizeSkillId(skillId).startsWith(`${PLANNING_ONLY_SKILL_CATEGORY}/`);
}
export function isPlanningOnlySkillCategory(skillId) {
    return isPlanningOnlySkillId(skillId);
}
export function listControlledSkillDomains() {
    return [...CONTROLLED_DOMAINS];
}
export function listControlledSkillStages() {
    return [...CONTROLLED_STAGES];
}
export function listControlledSkillTags() {
    return [...CONTROLLED_TAGS];
}
function normalizeSkillDomain(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (CONTROLLED_DOMAINS.includes(normalized)) {
        return normalized;
    }
    return null;
}
function normalizeSkillStage(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (CONTROLLED_STAGES.includes(normalized)) {
        return normalized;
    }
    return null;
}
function normalizeSkillTags(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = new Set();
    const normalized = [];
    for (const entry of value) {
        if (typeof entry !== 'string') {
            continue;
        }
        const tag = entry.trim().toLowerCase();
        if (tag.length === 0 || !CONTROLLED_TAGS.includes(tag) || seen.has(tag)) {
            continue;
        }
        seen.add(tag);
        normalized.push(tag);
    }
    return normalized;
}
async function collectLocalSkills(directoryPath, relativeDirectory, results) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const hasSkillFile = entries.some((entry) => entry.isFile() && entry.name === SKILL_FILE_NAME);
    if (hasSkillFile && relativeDirectory.length > 0 && isCategorizedSkillId(relativeDirectory)) {
        results.push({
            id: normalizeSkillId(relativeDirectory),
            path: getCodexLocalSkillPath(relativeDirectory),
        });
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const childRelativeDirectory = relativeDirectory.length > 0 ? path.posix.join(relativeDirectory, entry.name) : entry.name;
        await collectLocalSkills(path.join(directoryPath, entry.name), childRelativeDirectory, results);
    }
}
// 枚举项目当前真正可用的本地 domain skills。
// 真相源固定在 .codex/skills/，Claude 只是镜像投影，不作为校验依据。
export async function listLocalSkills(projectRoot) {
    const skillsRoot = path.join(projectRoot, PATHS.codexSkillsDir);
    if (!(await FileSystemUtils.directoryExists(skillsRoot))) {
        return [];
    }
    const results = [];
    await collectLocalSkills(skillsRoot, '', results);
    return results.sort((left, right) => left.id.localeCompare(right.id));
}
async function readProblemSkillMetadata(projectRoot, skillId) {
    if (isWorkflowSkillId(skillId) || isPlanningOnlySkillId(skillId)) {
        return null;
    }
    const skillPath = getCodexLocalSkillPath(skillId);
    const frontmatter = await readMarkdownFrontmatter(projectRoot, skillPath);
    const domain = normalizeSkillDomain(frontmatter.domain);
    const stage = normalizeSkillStage(frontmatter.stage);
    const tags = normalizeSkillTags(frontmatter.tags);
    if (!domain || !stage || tags.length === 0) {
        return null;
    }
    return {
        id: normalizeSkillId(skillId),
        domain,
        stage,
        tags,
    };
}
// 枚举当前项目内可被 suggest/catalog 使用的 problem-level skills。
// 它们必须：
// - 不是 qdd/* workflow skill
// - 不是 brain/* planning-only skill
// - 且在 SKILL.md frontmatter 中声明 domain/stage/tags
export async function listProblemSkills(projectRoot) {
    const localSkills = await listLocalSkills(projectRoot);
    const problemSkills = [];
    for (const skill of localSkills) {
        const metadata = await readProblemSkillMetadata(projectRoot, skill.id);
        if (!metadata) {
            continue;
        }
        problemSkills.push({
            ...skill,
            metadata,
        });
    }
    return problemSkills.sort((left, right) => left.id.localeCompare(right.id));
}
export async function buildSkillsCatalog(projectRoot) {
    const problemSkills = await listProblemSkills(projectRoot);
    return {
        generated_at: new Date().toISOString(),
        skills: problemSkills.map((entry) => entry.metadata),
    };
}
export async function refreshSkillsCatalog(projectRoot) {
    const catalog = await buildSkillsCatalog(projectRoot);
    await FileSystemUtils.writeFile(path.join(projectRoot, PATHS.skillsCatalog), `${JSON.stringify(catalog, null, 2)}\n`);
    return catalog;
}
export async function readSkillsCatalog(projectRoot) {
    const catalogPath = path.join(projectRoot, PATHS.skillsCatalog);
    if (!(await FileSystemUtils.fileExists(catalogPath))) {
        return refreshSkillsCatalog(projectRoot);
    }
    try {
        const content = await FileSystemUtils.readFile(catalogPath);
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed.skills)) {
            return refreshSkillsCatalog(projectRoot);
        }
        return parsed;
    }
    catch {
        return refreshSkillsCatalog(projectRoot);
    }
}
export async function suggestProblemSkills(projectRoot, query) {
    const normalizedTags = normalizeSkillTags(query.tags ?? []);
    const catalog = await readSkillsCatalog(projectRoot);
    const filtered = catalog.skills.filter((entry) => entry.domain === query.domain && entry.stage === query.stage);
    const ranked = filtered
        .map((entry) => {
        const matchedTags = normalizedTags.filter((tag) => entry.tags.includes(tag));
        const score = matchedTags.length;
        const reasons = [`domain=${entry.domain}`, `stage=${entry.stage}`];
        if (matchedTags.length > 0) {
            reasons.push(`matched tags: ${matchedTags.join(', ')}`);
        }
        else if (normalizedTags.length > 0) {
            reasons.push('no requested tags matched; kept by domain/stage fit');
        }
        else {
            reasons.push('matched controlled domain/stage filters');
        }
        return {
            id: entry.id,
            domain: entry.domain,
            stage: entry.stage,
            matched_tags: matchedTags,
            score,
            reasons,
        };
    })
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
    return {
        query: {
            domain: query.domain,
            stage: query.stage,
            tags: normalizedTags,
        },
        candidates: ranked,
        low_confidence: ranked.length === 0 || (ranked[0]?.score ?? 0) === 0,
    };
}
// 解析某个 task 请求的 skills：
// - matched: 项目里确实存在，可以安全使用
// - missing: task 写了，但项目没装，apply 应视为 blocker
// - disallowedWorkflow: 把 qdd/* workflow skill 写进 task 了，这是不允许的
export async function resolveLocalSkills(projectRoot, requestedSkillIds, options = {}) {
    const normalizedRequested = normalizeTaskSkillIds(requestedSkillIds);
    const disallowedWorkflow = normalizedRequested.filter((entry) => isWorkflowSkillId(entry));
    const allowPlanningOnly = options.allowPlanningOnly ?? false;
    const planningOnly = allowPlanningOnly ? [] : normalizedRequested.filter((entry) => isPlanningOnlySkillId(entry));
    const requestedDomainSkills = normalizedRequested.filter((entry) => !isWorkflowSkillId(entry) && (allowPlanningOnly || !isPlanningOnlySkillId(entry)));
    const available = await listLocalSkills(projectRoot);
    const availableById = new Map(available.map((entry) => [entry.id, entry]));
    const matched = requestedDomainSkills.map((entry) => availableById.get(entry)).filter((entry) => entry !== undefined);
    const missing = requestedDomainSkills.filter((entry) => !availableById.has(entry));
    return {
        available,
        matched,
        missing,
        disallowedWorkflow,
        planningOnly,
    };
}
//# sourceMappingURL=local-skills.js.map