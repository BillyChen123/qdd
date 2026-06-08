import Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export interface AgentRunnerOptions {
  model: string;
  systemPrompt: string;
  instructions: string;
  maxTurns: number;
  cwd: string;
  signal?: AbortSignal;
}

export type AgentRunStatus = 'completed' | 'max_turns' | 'aborted' | 'missing_auth' | 'sdk_error';

export interface AgentRunResult {
  turns: number;
  finalMessage: string;
  terminatedNormally: boolean;
  toolCalls: number;
  status: AgentRunStatus;
  failureReason?: string;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRootDir = path.resolve(moduleDir, '..', '..');

const BASH_TOOL: Tool = {
  name: 'bash',
  description: 'Execute a bash command from the QDD project root. Use for qdd CLI commands, project-local inspection, and bounded analysis commands.',
  input_schema: {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'The bash command to execute from the project root' },
      timeout: { type: 'number', description: 'Optional timeout in milliseconds (max 600000)' },
    },
    required: ['command'],
  },
};

const READ_TOOL: Tool = {
  name: 'read',
  description: 'Read a file under the QDD project root or package root.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Path to the file to read, relative to project root or absolute' },
    },
    required: ['path'],
  },
};

const WRITE_TOOL: Tool = {
  name: 'write',
  description: 'Write a file under the QDD project root. Creates parent directories if needed.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Project-local path to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
};

const TOOLS: Tool[] = [BASH_TOOL, READ_TOOL, WRITE_TOOL];

function normalizeRoot(root: string): string {
  return path.resolve(root);
}

function isPathWithinRoot(targetPath: string, root: string): boolean {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = normalizeRoot(root);
  const relative = path.relative(normalizedRoot, normalizedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolvePathForRead(cwd: string, inputPath: string): string {
  const resolved = path.isAbsolute(inputPath) ? path.resolve(inputPath) : path.resolve(cwd, inputPath);
  const allowedRoots = [cwd, packageRootDir];
  if (!allowedRoots.some((root) => isPathWithinRoot(resolved, root))) {
    throw new Error(`Read path '${inputPath}' is outside the allowed project/package roots.`);
  }
  return resolved;
}

function resolvePathForWrite(cwd: string, inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    throw new Error('Write path must be project-relative.');
  }

  const resolved = path.resolve(cwd, inputPath);
  if (!isPathWithinRoot(resolved, cwd)) {
    throw new Error(`Write path '${inputPath}' is outside the project root.`);
  }
  return resolved;
}

async function executeBash(cwd: string, command: string, timeoutMs?: number): Promise<string> {
  return new Promise((resolve) => {
    const timeout = Math.min(timeoutMs ?? 120_000, 600_000);
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 3000);
    }, timeout);

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code: number | null) => {
      clearTimeout(timer);
      const parts: string[] = [];
      if (stdout.trim()) parts.push(stdout.trim());
      if (stderr.trim()) parts.push(`[stderr]\n${stderr.trim()}`);
      if (killed) parts.push('[killed by timeout]');
      if (code !== 0 && !killed) parts.push(`[exit code: ${code}]`);
      resolve(parts.join('\n') || `Command completed with exit code ${code}`);
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      resolve(`Error executing command: ${err.message}`);
    });
  });
}

async function executeToolCall(cwd: string, tool: ToolCall): Promise<string> {
  try {
    switch (tool.name) {
      case 'bash': {
        const command = String(tool.input.command ?? '');
        if (!command.trim()) return 'Error: empty command';
        const timeout = typeof tool.input.timeout === 'number' ? tool.input.timeout : undefined;
        return executeBash(cwd, command, timeout);
      }
      case 'read': {
        const filePath = resolvePathForRead(cwd, String(tool.input.path ?? ''));
        return await fs.readFile(filePath, 'utf-8');
      }
      case 'write': {
        const filePath = resolvePathForWrite(cwd, String(tool.input.path ?? ''));
        const content = String(tool.input.content ?? '');
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return `File written: ${filePath}`;
      }
      default:
        return `Unknown tool: ${tool.name}`;
    }
  } catch (error) {
    return `Error executing tool '${tool.name}': ${(error as Error).message}`;
  }
}

interface ClaudeSettings {
  ANTHROPIC_AUTH_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
}

interface ClaudeSettingsFile extends ClaudeSettings {
  env?: ClaudeSettings;
}

let _claudeSettingsCache: ClaudeSettings | null = null;

export function parseClaudeSettings(raw: string): ClaudeSettings {
  const parsed = JSON.parse(raw) as ClaudeSettingsFile;
  const env = parsed.env ?? {};
  return {
    ANTHROPIC_AUTH_TOKEN: parsed.ANTHROPIC_AUTH_TOKEN ?? env.ANTHROPIC_AUTH_TOKEN,
    ANTHROPIC_API_KEY: parsed.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL: parsed.ANTHROPIC_BASE_URL ?? env.ANTHROPIC_BASE_URL,
    ANTHROPIC_MODEL: parsed.ANTHROPIC_MODEL ?? env.ANTHROPIC_MODEL,
  };
}

export function getClaudeSettings(): ClaudeSettings {
  if (_claudeSettingsCache) return _claudeSettingsCache;
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    const raw = fsSync.readFileSync(settingsPath, 'utf-8');
    _claudeSettingsCache = parseClaudeSettings(raw);
  } catch {
    _claudeSettingsCache = {};
  }
  return _claudeSettingsCache;
}

export function resolveClaudeApiKey(): string | undefined {
  const settings = getClaudeSettings();
  return process.env.ANTHROPIC_AUTH_TOKEN
    ?? process.env.ANTHROPIC_API_KEY
    ?? settings.ANTHROPIC_AUTH_TOKEN
    ?? settings.ANTHROPIC_API_KEY;
}

export function hasClaudeCredentials(): boolean {
  return Boolean(resolveClaudeApiKey());
}

export function resolveClaudeModel(cliModel?: string): string {
  const settings = getClaudeSettings();
  return cliModel ?? process.env.ANTHROPIC_MODEL ?? settings.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
}

export async function runAgent(options: AgentRunnerOptions): Promise<AgentRunResult> {
  const apiKey = resolveClaudeApiKey();
  if (!apiKey) {
    return {
      turns: 0,
      finalMessage: 'Claude SDK authentication is missing.',
      terminatedNormally: false,
      toolCalls: 0,
      status: 'missing_auth',
      failureReason: 'Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY, or configure ~/.claude/settings.json.',
    };
  }

  const settings = getClaudeSettings();
  const client = new Anthropic({
    apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL ?? settings.ANTHROPIC_BASE_URL ?? undefined,
  });
  const { model, systemPrompt, instructions, maxTurns, cwd, signal } = options;

  const messages: MessageParam[] = [
    {
      role: 'user',
      content: `You are an agent executing one QDD workflow step. Here are your instructions:\n\n${instructions}\n\nWork through the instructions step by step. Use the available tools to read state, run project-local CLI commands, write project files, and execute analysis. When you have completed all the work described in the instructions, respond with a summary of what you accomplished and the text "WORKFLOW_COMPLETE".`,
    },
  ];

  let turns = 0;
  let toolCalls = 0;
  let finalMessage = '';
  let status: AgentRunStatus = 'max_turns';
  let failureReason: string | undefined;

  while (turns < maxTurns) {
    if (signal?.aborted) {
      finalMessage = 'Aborted by user.';
      status = 'aborted';
      failureReason = 'Run was aborted by signal.';
      break;
    }

    turns++;
    let response: Awaited<ReturnType<typeof client.messages.create>>;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 8000,
        system: systemPrompt,
        messages,
        tools: TOOLS,
      });
    } catch (error) {
      finalMessage = `Claude SDK request failed: ${(error as Error).message}`;
      status = 'sdk_error';
      failureReason = (error as Error).message;
      break;
    }

    const toolUses: ToolUseBlock[] = [];
    const textParts: string[] = [];

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        toolUses.push(block);
      } else if (block.type === 'text') {
        textParts.push(block.text);
      }
    }

    const text = textParts.join('\n').trim();

    if (toolUses.length === 0) {
      finalMessage = text;
      status = text.includes('WORKFLOW_COMPLETE') ? 'completed' : 'sdk_error';
      failureReason = status === 'completed' ? undefined : 'Agent stopped without WORKFLOW_COMPLETE.';
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: MessageParam['content'] = [];
    for (const toolUse of toolUses) {
      toolCalls++;
      const result = await executeToolCall(cwd, {
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
      });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.slice(0, 8000),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (turns >= maxTurns && !finalMessage) {
    finalMessage = `Reached maximum turns (${maxTurns}) without explicit completion.`;
    status = 'max_turns';
    failureReason = finalMessage;
  }

  return {
    turns,
    finalMessage,
    terminatedNormally: status === 'completed',
    toolCalls,
    status,
    failureReason,
  };
}
