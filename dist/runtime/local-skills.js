import path from 'node:path';
import * as fs from 'node:fs/promises';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
const SKILL_FILE_NAME = 'SKILL.md';
const WORKFLOW_SKILL_PREFIX = `${PATHS.workflowSkillCategory}/`;
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
// 解析某个 task 请求的 skills：
// - matched: 项目里确实存在，可以安全使用
// - missing: task 写了，但项目没装，apply 应视为 blocker
// - disallowedWorkflow: 把 qdd/* workflow skill 写进 task 了，这是不允许的
export async function resolveLocalSkills(projectRoot, requestedSkillIds) {
    const normalizedRequested = normalizeTaskSkillIds(requestedSkillIds);
    const disallowedWorkflow = normalizedRequested.filter((entry) => isWorkflowSkillId(entry));
    const requestedDomainSkills = normalizedRequested.filter((entry) => !isWorkflowSkillId(entry));
    const available = await listLocalSkills(projectRoot);
    const availableById = new Map(available.map((entry) => [entry.id, entry]));
    const matched = requestedDomainSkills.map((entry) => availableById.get(entry)).filter((entry) => entry !== undefined);
    const missing = requestedDomainSkills.filter((entry) => !availableById.has(entry));
    return {
        available,
        matched,
        missing,
        disallowedWorkflow,
    };
}
//# sourceMappingURL=local-skills.js.map