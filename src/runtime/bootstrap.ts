import os from 'node:os';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { BootstrapConfig, BootstrapTool, BootstrapToolRecord, BootstrapWorkflow } from '../types.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { PATHS } from './constants.js';
import { readYamlFile, writeYamlFile } from './store.js';

const BOOTSTRAP_VERSION = 2;
const DEFAULT_BOOTSTRAP_TOOLS: BootstrapTool[] = ['claude', 'codex'];
const SUPPORTED_BOOTSTRAP_TOOLS: readonly BootstrapTool[] = ['claude', 'codex'];

interface WorkflowContent {
  id: BootstrapWorkflow;
  description: string;
  tags: string[];
  body: string;
}

interface InstallBootstrapOptions {
  tools: BootstrapTool[];
  refresh: boolean;
  domainSkillsSourceDir?: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const bootstrapPromptDir = path.join(moduleDir, 'bootstrap-prompts');
const packageRootDir = path.resolve(moduleDir, '..', '..');
const defaultDomainSkillsSourceDir = path.join(packageRootDir, 'domain-skills');

interface DomainSkillSource {
  id: string;
  sourceDir: string;
}

const WORKFLOW_METADATA: Record<BootstrapWorkflow, { description: string; tags: string[] }> = {
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

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function getCodexHome(): string {
  const envHome = process.env.CODEX_HOME?.trim();
  return path.resolve(envHome ? envHome : path.join(os.homedir(), '.codex'));
}

function normalizeProjectPath(projectRoot: string, targetPath: string): string {
  const relativePath = path.relative(projectRoot, targetPath);
  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath.split(path.sep).join('/');
  }

  return targetPath;
}

function escapeYamlValue(value: string): string {
  const needsQuoting = /[:\n\r#{}\[\],&*!|>'"%@`]|^\s|\s$/.test(value);
  if (!needsQuoting) {
    return value;
  }

  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

function formatTagsArray(tags: string[]): string {
  return `[${tags.map((tag) => escapeYamlValue(tag)).join(', ')}]`;
}

function formatSkillContent(content: WorkflowContent): string {
  return `---\nname: ${content.id}\ndescription: ${content.description}\nlicense: MIT\ncompatibility: Requires qdd CLI.\nmetadata:\n  author: qdd\n  version: "1.0"\n  generatedBy: "${BOOTSTRAP_VERSION}"\n---\n\n${content.body}\n`;
}

async function getWorkflowContents(): Promise<WorkflowContent[]> {
  const workflows = Object.entries(WORKFLOW_METADATA) as Array<[BootstrapWorkflow, { description: string; tags: string[] }]>;
  return Promise.all(
    workflows.map(async ([id, metadata]) => ({
      id,
      description: metadata.description,
      tags: metadata.tags,
      body: await FileSystemUtils.readFile(path.join(bootstrapPromptDir, `${id}.md`)),
    }))
  );
}

function formatCodexPrompt(content: WorkflowContent): string {
  return `---\ndescription: ${content.description}\nargument-hint: optional study id or research direction\n---\n\n${content.body}\n`;
}

function formatClaudeCommand(content: WorkflowContent): string {
  return `---\nname: ${escapeYamlValue(content.id)}\ndescription: ${escapeYamlValue(content.description)}\ncategory: ${escapeYamlValue('QDD')}\ntags: ${formatTagsArray(content.tags)}\n---\n\n${content.body}\n`;
}

function resolveToolAssetPath(projectRoot: string, tool: BootstrapTool, workflowId: BootstrapWorkflow): string {
  switch (tool) {
    case 'claude':
      return path.join(projectRoot, '.claude', 'commands', `${workflowId}.md`);
    case 'codex':
      return path.join(getCodexHome(), 'prompts', `${workflowId}.md`);
  }
}

function resolveToolSkillPath(projectRoot: string, tool: BootstrapTool, workflowId: BootstrapWorkflow): string {
  switch (tool) {
    case 'claude':
      return path.join(projectRoot, PATHS.claudeSkillsDir, PATHS.workflowSkillCategory, workflowId, 'SKILL.md');
    case 'codex':
      return path.join(projectRoot, PATHS.codexSkillsDir, PATHS.workflowSkillCategory, workflowId, 'SKILL.md');
  }
}

function resolveToolSkillDir(projectRoot: string, tool: BootstrapTool, skillId: string): string {
  switch (tool) {
    case 'claude':
      return path.join(projectRoot, PATHS.claudeSkillsDir, skillId);
    case 'codex':
      return path.join(projectRoot, PATHS.codexSkillsDir, skillId);
  }
}

async function discoverDomainSkills(sourceRoot: string): Promise<DomainSkillSource[]> {
  if (!(await FileSystemUtils.directoryExists(sourceRoot))) {
    return [];
  }

  const categories = await fs.readdir(sourceRoot, { withFileTypes: true });
  const results: DomainSkillSource[] = [];

  for (const categoryEntry of categories) {
    if (!categoryEntry.isDirectory()) {
      continue;
    }

    const categoryDir = path.join(sourceRoot, categoryEntry.name);
    const skills = await fs.readdir(categoryDir, { withFileTypes: true });

    for (const skillEntry of skills) {
      if (!skillEntry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(categoryDir, skillEntry.name);
      if (!(await FileSystemUtils.fileExists(path.join(skillDir, 'SKILL.md')))) {
        continue;
      }

      results.push({
        id: `${categoryEntry.name}/${skillEntry.name}`,
        sourceDir: skillDir,
      });
    }
  }

  return results.sort((left, right) => left.id.localeCompare(right.id));
}

async function projectDomainSkill(sourceDir: string, targetDir: string, refresh: boolean): Promise<void> {
  const targetSkillFile = path.join(targetDir, 'SKILL.md');
  if (!refresh && (await FileSystemUtils.fileExists(targetSkillFile))) {
    return;
  }

  if (refresh) {
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  await FileSystemUtils.createDirectory(path.dirname(targetDir));
  await fs.cp(sourceDir, targetDir, { recursive: true });
}

function formatToolAsset(tool: BootstrapTool, content: WorkflowContent): string {
  switch (tool) {
    case 'claude':
      return formatClaudeCommand(content);
    case 'codex':
      return formatCodexPrompt(content);
  }
}

export function resolveBootstrapTools(requestedTools?: string[]): BootstrapTool[] {
  if (!requestedTools || requestedTools.length === 0) {
    return [...DEFAULT_BOOTSTRAP_TOOLS];
  }

  const normalized = uniqueValues(requestedTools.map((tool) => tool.trim().toLowerCase()).filter((tool) => tool.length > 0));
  if (normalized.length === 0) {
    return [...DEFAULT_BOOTSTRAP_TOOLS];
  }

  for (const tool of normalized) {
    if (!SUPPORTED_BOOTSTRAP_TOOLS.includes(tool as BootstrapTool)) {
      throw new Error(`Unsupported bootstrap tool '${tool}'. Supported tools: ${SUPPORTED_BOOTSTRAP_TOOLS.join(', ')}.`);
    }
  }

  return normalized as BootstrapTool[];
}

export async function readBootstrapConfig(projectRoot: string): Promise<BootstrapConfig | null> {
  const bootstrapPath = path.join(projectRoot, PATHS.bootstrapConfig);
  if (!(await FileSystemUtils.fileExists(bootstrapPath))) {
    return null;
  }

  return readYamlFile<BootstrapConfig>(projectRoot, PATHS.bootstrapConfig);
}

export async function resolveBootstrapToolsForInit(projectRoot: string, requestedTools?: string[]): Promise<BootstrapTool[]> {
  if (requestedTools && requestedTools.length > 0) {
    return resolveBootstrapTools(requestedTools);
  }

  const existingConfig = await readBootstrapConfig(projectRoot);
  if (existingConfig && existingConfig.tools.length > 0) {
    return existingConfig.tools.map((entry) => entry.tool);
  }

  return [...DEFAULT_BOOTSTRAP_TOOLS];
}

export async function installBootstrap(projectRoot: string, options: InstallBootstrapOptions): Promise<BootstrapConfig> {
  const toolRecords: BootstrapToolRecord[] = [];
  const workflowContents = await getWorkflowContents();
  const domainSkills = await discoverDomainSkills(options.domainSkillsSourceDir ?? defaultDomainSkillsSourceDir);

  for (const tool of options.tools) {
    const assets = [] as BootstrapToolRecord['assets'];
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

    for (const domainSkill of domainSkills) {
      const targetDir = resolveToolSkillDir(projectRoot, tool, domainSkill.id);
      await projectDomainSkill(domainSkill.sourceDir, targetDir, options.refresh);
    }

    toolRecords.push({
      tool,
      assets,
    });
  }

  const bootstrapConfig: BootstrapConfig = {
    version: BOOTSTRAP_VERSION,
    installed_at: new Date().toISOString(),
    instructions_path: PATHS.instructions,
    tools: toolRecords,
  };

  await writeYamlFile(projectRoot, PATHS.bootstrapConfig, bootstrapConfig);
  return bootstrapConfig;
}
