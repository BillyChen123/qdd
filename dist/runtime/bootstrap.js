import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { readYamlFile, writeYamlFile } from './store.js';
const BOOTSTRAP_VERSION = 2;
const DEFAULT_BOOTSTRAP_TOOLS = ['claude', 'codex'];
const SUPPORTED_BOOTSTRAP_TOOLS = ['claude', 'codex'];
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const bootstrapPromptDir = path.join(moduleDir, 'bootstrap-prompts');
const packageRootDir = path.resolve(moduleDir, '..', '..');
const defaultDomainSkillsSourceDir = path.join(packageRootDir, 'domain-skills');
const WORKFLOW_METADATA = {
    'qdd-start': {
        description: 'Onboard project context, dataset links, and local skill boundaries before the first study',
        tags: ['qdd', 'research', 'workflow', 'start'],
    },
    'qdd-propose': {
        description: 'Frame one bounded study from a human-supplied research question or hypothesis',
        tags: ['qdd', 'research', 'workflow', 'propose'],
    },
    'qdd-explore': {
        description: 'Stress-test one study and refine its plan through discussion before execution',
        tags: ['qdd', 'research', 'workflow', 'explore'],
    },
    'qdd-apply': {
        description: 'Execute the current approved study/task set until the study reaches a decision point',
        tags: ['qdd', 'research', 'workflow', 'apply'],
    },
    'qdd-close': {
        description: 'Validate, synthesize evidence, close a study, and carry forward stable project context',
        tags: ['qdd', 'research', 'workflow', 'close'],
    },
};
const AUTO_ENTRY_SKILL_ID = 'qdd-auto';
const AUTO_ENTRY_SKILL_DESCRIPTION = 'Start autonomous QDD research loop — forks a Thesis Manager that chains through Study Brain, Executor, and back until termination';
function uniqueValues(values) {
    return [...new Set(values)];
}
// QDD 的 codex prompt 会落到 CODEX_HOME/prompts，
// 而本地 skill 镜像仍然落在项目目录里。
// 这里统一解析"当前机器应该把 codex prompt 安装到哪里"。
function getCodexHome() {
    const envHome = process.env.CODEX_HOME?.trim();
    return path.resolve(envHome ? envHome : path.join(os.homedir(), '.codex'));
}
function normalizeProjectPath(projectRoot, targetPath) {
    const relativePath = path.relative(projectRoot, targetPath);
    if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
        return relativePath.split(path.sep).join('/');
    }
    return targetPath;
}
function escapeYamlValue(value) {
    const needsQuoting = /[:\n\r#{}\[\],&*!|>'"%@`]|^\s|\s$/.test(value);
    if (!needsQuoting) {
        return value;
    }
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `"${escaped}"`;
}
function formatTagsArray(tags) {
    return `[${tags.map((tag) => escapeYamlValue(tag)).join(', ')}]`;
}
function formatSkillContent(content) {
    return `---\nname: ${content.id}\ndescription: ${content.description}\nlicense: MIT\ncompatibility: Requires qdd CLI.\nmetadata:\n  author: qdd\n  version: "1.0"\n  generatedBy: "${BOOTSTRAP_VERSION}"\n---\n\n${content.body}\n`;
}
// workflow prompt 的真相源在 src/runtime/bootstrap-prompts/。
// 安装 bootstrap 时，会把这些源内容投影成：
// - Claude command
// - Codex prompt
// - 项目内的 workflow skills
async function getWorkflowContents() {
    const workflows = Object.entries(WORKFLOW_METADATA);
    return Promise.all(workflows.map(async ([id, metadata]) => ({
        id,
        description: metadata.description,
        tags: metadata.tags,
        body: await FileSystemUtils.readFile(path.join(bootstrapPromptDir, `${id}.md`)),
    })));
}
function formatCodexPrompt(content) {
    return `---\ndescription: ${content.description}\nargument-hint: optional study id or research direction\n---\n\n${content.body}\n`;
}
function formatClaudeCommand(content) {
    return `---\nname: ${escapeYamlValue(content.id)}\ndescription: ${escapeYamlValue(content.description)}\ncategory: ${escapeYamlValue('QDD')}\ntags: ${formatTagsArray(content.tags)}\n---\n\n${content.body}\n`;
}
function resolveToolAssetPath(projectRoot, tool, workflowId) {
    switch (tool) {
        case 'claude':
            return path.join(projectRoot, '.claude', 'commands', `${workflowId}.md`);
        case 'codex':
            return path.join(getCodexHome(), 'prompts', `${workflowId}.md`);
    }
}
function resolveToolSkillPath(projectRoot, tool, workflowId) {
    switch (tool) {
        case 'claude':
            return path.join(projectRoot, PATHS.claudeSkillsDir, PATHS.workflowSkillCategory, workflowId, 'SKILL.md');
        case 'codex':
            return path.join(projectRoot, PATHS.codexSkillsDir, PATHS.workflowSkillCategory, workflowId, 'SKILL.md');
    }
}
function formatToolAsset(tool, content) {
    switch (tool) {
        case 'claude':
            return formatClaudeCommand(content);
        case 'codex':
            return formatCodexPrompt(content);
    }
}
// 解析 init 时用户请求安装哪些 tool surface。
// 未指定时默认同时安装 claude + codex。
export function resolveBootstrapTools(requestedTools) {
    if (!requestedTools || requestedTools.length === 0) {
        return [...DEFAULT_BOOTSTRAP_TOOLS];
    }
    const normalized = uniqueValues(requestedTools.map((tool) => tool.trim().toLowerCase()).filter((tool) => tool.length > 0));
    if (normalized.length === 0) {
        return [...DEFAULT_BOOTSTRAP_TOOLS];
    }
    for (const tool of normalized) {
        if (!SUPPORTED_BOOTSTRAP_TOOLS.includes(tool)) {
            throw new Error(`Unsupported bootstrap tool '${tool}'. Supported tools: ${SUPPORTED_BOOTSTRAP_TOOLS.join(', ')}.`);
        }
    }
    return normalized;
}
export async function readBootstrapConfig(projectRoot) {
    const bootstrapPath = path.join(projectRoot, PATHS.bootstrapConfig);
    if (!(await FileSystemUtils.fileExists(bootstrapPath))) {
        return null;
    }
    return readYamlFile(projectRoot, PATHS.bootstrapConfig);
}
// init 时如果用户没显式传 --tool，就优先复用项目已有 bootstrap 配置，
// 保证 refresh 不会无意间改变安装矩阵。
export async function resolveBootstrapToolsForInit(projectRoot, requestedTools) {
    if (requestedTools && requestedTools.length > 0) {
        return resolveBootstrapTools(requestedTools);
    }
    const existingConfig = await readBootstrapConfig(projectRoot);
    if (existingConfig && existingConfig.tools.length > 0) {
        return existingConfig.tools.map((entry) => entry.tool);
    }
    return [...DEFAULT_BOOTSTRAP_TOOLS];
}
// 安装 QDD bootstrap：
// 1. 写 workflow prompts/commands/skills + qdd-auto entry skill
// 2. 不再把 domain skills 投影到项目目录；领域 skill 真相源固定在 QDD 根 domain-skills/
// 3. 记录 bootstrap.yaml，方便后续 refresh 和审计
export async function installBootstrap(projectRoot, options) {
    const toolRecords = [];
    const workflowContents = await getWorkflowContents();
    const domainSkillsSourceDir = options.domainSkillsSourceDir ?? defaultDomainSkillsSourceDir;
    if (!(await FileSystemUtils.directoryExists(domainSkillsSourceDir))) {
        throw new Error(`Domain skill source directory '${domainSkillsSourceDir}' does not exist.`);
    }
    for (const tool of options.tools) {
        const assets = [];
        for (const workflow of workflowContents) {
            const targetPath = resolveToolAssetPath(projectRoot, tool, workflow.id);
            if (options.refresh || !(await FileSystemUtils.fileExists(targetPath))) {
                await FileSystemUtils.writeFile(targetPath, formatToolAsset(tool, workflow));
            }
            const skillPath = resolveToolSkillPath(projectRoot, tool, workflow.id);
            if (options.refresh || !(await FileSystemUtils.fileExists(skillPath))) {
                await FileSystemUtils.writeFile(skillPath, formatSkillContent(workflow));
            }
            assets.push({
                workflow: workflow.id,
                path: normalizeProjectPath(projectRoot, targetPath),
            });
            assets.push({
                workflow: workflow.id,
                path: normalizeProjectPath(projectRoot, skillPath),
            });
        }
        // Install qdd-auto entry skill (not a workflow command, skill-only)
        const autoSkillPath = resolveToolSkillPath(projectRoot, tool, AUTO_ENTRY_SKILL_ID);
        if (options.refresh || !(await FileSystemUtils.fileExists(autoSkillPath))) {
            const autoBody = await FileSystemUtils.readFile(path.join(bootstrapPromptDir, `${AUTO_ENTRY_SKILL_ID}.md`));
            await FileSystemUtils.writeFile(autoSkillPath, formatSkillContent({
                id: AUTO_ENTRY_SKILL_ID,
                description: AUTO_ENTRY_SKILL_DESCRIPTION,
                tags: ['qdd', 'research', 'auto'],
                body: autoBody,
            }));
        }
        assets.push({
            workflow: AUTO_ENTRY_SKILL_ID,
            path: normalizeProjectPath(projectRoot, autoSkillPath),
        });
        toolRecords.push({
            tool,
            assets,
        });
    }
    const bootstrapConfig = {
        version: BOOTSTRAP_VERSION,
        installed_at: new Date().toISOString(),
        instructions_path: PATHS.instructions,
        domain_skills_root: normalizeProjectPath(projectRoot, domainSkillsSourceDir),
        tools: toolRecords,
    };
    await writeYamlFile(projectRoot, PATHS.bootstrapConfig, bootstrapConfig);
    return bootstrapConfig;
}
//# sourceMappingURL=bootstrap.js.map