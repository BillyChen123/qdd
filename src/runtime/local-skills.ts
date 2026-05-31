import path from 'node:path';
import * as fs from 'node:fs/promises';
import type { LocalSkillEntry, ProblemSkillEntry, ProblemSkillMetadata, SkillDomain, SkillStage, SkillSuggestJson, SkillTag, SkillsCatalog } from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { readBootstrapConfig } from './bootstrap.js';
import { readMarkdownFrontmatter } from './store.js';

const SKILL_FILE_NAME = 'SKILL.md';
const WORKFLOW_SKILL_PREFIX = `${PATHS.workflowSkillCategory}/`;
const PLANNING_ONLY_SKILL_CATEGORY = 'brain';
const DEFAULT_DOMAIN_SKILLS_ROOT = 'domain-skills';
const CONTROLLED_DOMAINS: readonly SkillDomain[] = ['singlecell', 'spatial', 'bulk', 'general'];
const CONTROLLED_STAGES: readonly SkillStage[] = ['preprocess', 'integration', 'clustering', 'annotation', 'de', 'visualization', 'other'];
const CONTROLLED_TAGS: readonly SkillTag[] = [
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
export function normalizeSkillId(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '').split(/[\\/]+/).join('/');
}

// task.skills 的去重与规范化入口。
// 这样无论是 CLI 创建还是手工编辑，后续比较都基于同一种规范形式。
export function normalizeTaskSkillIds(skillIds: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

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

export function isWorkflowSkillId(skillId: string): boolean {
  return normalizeSkillId(skillId).startsWith(WORKFLOW_SKILL_PREFIX);
}

function isCategorizedSkillId(skillId: string): boolean {
  return normalizeSkillId(skillId).includes('/');
}

function isPlanningOnlySkillId(skillId: string): boolean {
  return normalizeSkillId(skillId).startsWith(`${PLANNING_ONLY_SKILL_CATEGORY}/`);
}

export function isPlanningOnlySkillCategory(skillId: string): boolean {
  return isPlanningOnlySkillId(skillId);
}

export function listControlledSkillDomains(): SkillDomain[] {
  return [...CONTROLLED_DOMAINS];
}

export function listControlledSkillStages(): SkillStage[] {
  return [...CONTROLLED_STAGES];
}

export function listControlledSkillTags(): SkillTag[] {
  return [...CONTROLLED_TAGS];
}

function normalizeSkillDomain(value: unknown): SkillDomain | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (CONTROLLED_DOMAINS.includes(normalized as SkillDomain)) {
    return normalized as SkillDomain;
  }

  return null;
}

function normalizeSkillStage(value: unknown): SkillStage | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (CONTROLLED_STAGES.includes(normalized as SkillStage)) {
    return normalized as SkillStage;
  }

  return null;
}

function normalizeSkillTags(value: unknown): SkillTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<SkillTag>();
  const normalized: SkillTag[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const tag = entry.trim().toLowerCase();
    if (tag.length === 0 || !CONTROLLED_TAGS.includes(tag as SkillTag) || seen.has(tag as SkillTag)) {
      continue;
    }

    seen.add(tag as SkillTag);
    normalized.push(tag as SkillTag);
  }

  return normalized;
}

async function collectLocalSkills(
  directoryPath: string,
  relativeDirectory: string,
  results: LocalSkillEntry[]
): Promise<void> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const hasSkillFile = entries.some((entry) => entry.isFile() && entry.name === SKILL_FILE_NAME);

  if (hasSkillFile && relativeDirectory.length > 0 && isCategorizedSkillId(relativeDirectory)) {
    results.push({
      id: normalizeSkillId(relativeDirectory),
      path: path.join(directoryPath, SKILL_FILE_NAME),
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

async function resolveDomainSkillsRoot(projectRoot: string): Promise<{ absolute: string; relative: string }> {
  const bootstrap = await readBootstrapConfig(projectRoot);
  if (bootstrap?.domain_skills_root && bootstrap.domain_skills_root.trim().length > 0) {
    const configuredRoot = bootstrap.domain_skills_root.trim();
    return {
      absolute: path.isAbsolute(configuredRoot) ? configuredRoot : path.join(projectRoot, configuredRoot),
      relative: configuredRoot,
    };
  }

  return {
    absolute: path.join(projectRoot, DEFAULT_DOMAIN_SKILLS_ROOT),
    relative: DEFAULT_DOMAIN_SKILLS_ROOT,
  };
}

// 枚举项目当前真正可用的 domain skills。
// 真相源固定在 QDD 根目录的 domain-skills/，而不是项目本地的 tool 镜像。
export async function listLocalSkills(projectRoot: string): Promise<LocalSkillEntry[]> {
  const skillsRoot = await resolveDomainSkillsRoot(projectRoot);
  if (!(await FileSystemUtils.directoryExists(skillsRoot.absolute))) {
    return [];
  }

  const results: LocalSkillEntry[] = [];
  await collectLocalSkills(skillsRoot.absolute, '', results);
  return results.sort((left, right) => left.id.localeCompare(right.id));
}

async function readProblemSkillMetadata(projectRoot: string, skillId: string): Promise<ProblemSkillMetadata | null> {
  if (isWorkflowSkillId(skillId) || isPlanningOnlySkillId(skillId)) {
    return null;
  }

  const skillPath = path.join((await resolveDomainSkillsRoot(projectRoot)).absolute, normalizeSkillId(skillId), SKILL_FILE_NAME);
  const frontmatter = await readMarkdownFrontmatter<Record<string, unknown>>(projectRoot, skillPath);
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
export async function listProblemSkills(projectRoot: string): Promise<ProblemSkillEntry[]> {
  const localSkills = await listLocalSkills(projectRoot);
  const problemSkills: ProblemSkillEntry[] = [];

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

export async function buildSkillsCatalog(projectRoot: string): Promise<SkillsCatalog> {
  const problemSkills = await listProblemSkills(projectRoot);
  return {
    generated_at: new Date().toISOString(),
    skills: problemSkills.map((entry) => entry.metadata),
  };
}

export async function refreshSkillsCatalog(projectRoot: string): Promise<SkillsCatalog> {
  const catalog = await buildSkillsCatalog(projectRoot);
  await FileSystemUtils.writeFile(path.join(projectRoot, PATHS.skillsCatalog), `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

export async function readSkillsCatalog(projectRoot: string): Promise<SkillsCatalog> {
  const catalogPath = path.join(projectRoot, PATHS.skillsCatalog);
  if (!(await FileSystemUtils.fileExists(catalogPath))) {
    return refreshSkillsCatalog(projectRoot);
  }

  try {
    const content = await FileSystemUtils.readFile(catalogPath);
    const parsed = JSON.parse(content) as SkillsCatalog;
    if (!Array.isArray(parsed.skills)) {
      return refreshSkillsCatalog(projectRoot);
    }

    return parsed;
  } catch {
    return refreshSkillsCatalog(projectRoot);
  }
}

export async function suggestProblemSkills(
  projectRoot: string,
  query: {
    domain: SkillDomain;
    stage: SkillStage;
    tags?: SkillTag[];
  }
): Promise<SkillSuggestJson> {
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
      } else if (normalizedTags.length > 0) {
        reasons.push('no requested tags matched; kept by domain/stage fit');
      } else {
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
export async function resolveLocalSkills(
  projectRoot: string,
  requestedSkillIds: string[] | undefined,
  options: {
    allowPlanningOnly?: boolean;
  } = {}
): Promise<{
  available: LocalSkillEntry[];
  matched: LocalSkillEntry[];
  missing: string[];
  disallowedWorkflow: string[];
  planningOnly: string[];
}> {
  const normalizedRequested = normalizeTaskSkillIds(requestedSkillIds);
  const disallowedWorkflow = normalizedRequested.filter((entry) => isWorkflowSkillId(entry));
  const allowPlanningOnly = options.allowPlanningOnly ?? false;
  const planningOnly = allowPlanningOnly ? [] : normalizedRequested.filter((entry) => isPlanningOnlySkillId(entry));
  const requestedDomainSkills = normalizedRequested.filter(
    (entry) => !isWorkflowSkillId(entry) && (allowPlanningOnly || !isPlanningOnlySkillId(entry))
  );
  const available = await listLocalSkills(projectRoot);
  const availableById = new Map(available.map((entry) => [entry.id, entry]));

  const matched = requestedDomainSkills.map((entry) => availableById.get(entry)).filter((entry): entry is LocalSkillEntry => entry !== undefined);
  const missing = requestedDomainSkills.filter((entry) => !availableById.has(entry));

  return {
    available,
    matched,
    missing,
    disallowedWorkflow,
    planningOnly,
  };
}
