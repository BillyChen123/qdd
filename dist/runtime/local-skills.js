import path from 'node:path';
import * as fs from 'node:fs/promises';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
const SKILL_FILE_NAME = 'SKILL.md';
const WORKFLOW_SKILL_PREFIX = `${PATHS.workflowSkillCategory}/`;
export function normalizeSkillId(value) {
    return value.trim().replace(/^\/+|\/+$/g, '').split(/[\\/]+/).join('/');
}
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
export async function listLocalSkills(projectRoot) {
    const skillsRoot = path.join(projectRoot, PATHS.codexSkillsDir);
    if (!(await FileSystemUtils.directoryExists(skillsRoot))) {
        return [];
    }
    const results = [];
    await collectLocalSkills(skillsRoot, '', results);
    return results.sort((left, right) => left.id.localeCompare(right.id));
}
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