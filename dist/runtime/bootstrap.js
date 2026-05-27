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
const WORKFLOW_METADATA = {
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
function uniqueValues(values) {
    return [...new Set(values)];
}
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
            return path.join(projectRoot, '.claude', 'skills', workflowId, 'SKILL.md');
        case 'codex':
            return path.join(projectRoot, '.codex', 'skills', workflowId, 'SKILL.md');
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
export async function installBootstrap(projectRoot, options) {
    const toolRecords = [];
    const workflowContents = await getWorkflowContents();
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
        toolRecords.push({
            tool,
            assets,
        });
    }
    const bootstrapConfig = {
        version: BOOTSTRAP_VERSION,
        installed_at: new Date().toISOString(),
        instructions_path: PATHS.instructions,
        tools: toolRecords,
    };
    await writeYamlFile(projectRoot, PATHS.bootstrapConfig, bootstrapConfig);
    return bootstrapConfig;
}
//# sourceMappingURL=bootstrap.js.map