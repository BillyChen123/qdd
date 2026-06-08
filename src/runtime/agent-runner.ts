import Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

export interface AgentRunnerOptions {
  model: string;
  systemPrompt: string;
  instructions: string;
  maxTurns: number;
  cwd: string;
  signal?: AbortSignal;
}

export interface AgentRunResult {
  turns: number;
  finalMessage: string;
  terminatedNormally: boolean;
  toolCalls: number;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

const BASH_TOOL: Tool = {
  name: 'bash',
  description: 'Execute a bash command in the project directory. Use for running qdd CLI commands, reading/writing files, git operations, and installing dependencies.',
  input_schema: {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'The bash command to execute' },
      timeout: { type: 'number', description: 'Optional timeout in milliseconds (max 600000)' },
    },
    required: ['command'],
  },
};

const READ_TOOL: Tool = {
  name: 'read',
  description: 'Read the contents of a file at the given path.',
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
  description: 'Write content to a file at the given path. Creates parent directories if needed.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Path to the file to write, relative to project root or absolute' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
};

const TOOLS: Tool[] = [BASH_TOOL, READ_TOOL, WRITE_TOOL];

function resolvePath(cwd: string, inputPath: string): string {
  if (inputPath.startsWith('/')) return inputPath;
  return `${cwd}/${inputPath}`;
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
  switch (tool.name) {
    case 'bash': {
      const command = String(tool.input.command ?? '');
      if (!command.trim()) return 'Error: empty command';
      const timeout = typeof tool.input.timeout === 'number' ? tool.input.timeout : undefined;
      return executeBash(cwd, command, timeout);
    }
    case 'read': {
      const filePath = resolvePath(cwd, String(tool.input.path ?? ''));
      try {
        return await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        return `Error reading file: ${(error as Error).message}`;
      }
    }
    case 'write': {
      const filePath = resolvePath(cwd, String(tool.input.path ?? ''));
      const content = String(tool.input.content ?? '');
      if (!filePath) return 'Error: empty path';
      try {
        await fs.mkdir(filePath.replace(/[^/]+$/, '').replace(/\/$/, ''), { recursive: true }).catch(() => {});
        await fs.writeFile(filePath, content, 'utf-8');
        return `File written: ${filePath}`;
      } catch (error) {
        return `Error writing file: ${(error as Error).message}`;
      }
    }
    default:
      return `Unknown tool: ${tool.name}`;
  }
}

export async function runAgent(options: AgentRunnerOptions): Promise<AgentRunResult> {
  const client = new Anthropic();
  const { model, systemPrompt, instructions, maxTurns, cwd, signal } = options;

  const messages: MessageParam[] = [
    {
      role: 'user',
      content: `You are an agent executing a QDD workflow step. Here are your instructions:\n\n${instructions}\n\nWork through the instructions step by step. Use the available tools to read state, run CLI commands, write files, and execute analysis. When you have completed all the work described in the instructions, respond with a summary of what you accomplished and the text "WORKFLOW_COMPLETE".`,
    },
  ];

  let turns = 0;
  let toolCalls = 0;
  let finalMessage = '';
  let terminatedNormally = false;

  while (turns < maxTurns) {
    if (signal?.aborted) {
      finalMessage = 'Aborted by user.';
      break;
    }

    turns++;
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: systemPrompt,
      messages,
      tools: TOOLS,
    });

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
      terminatedNormally = text.includes('WORKFLOW_COMPLETE');
      break;
    }

    // Add assistant response to history
    messages.push({ role: 'assistant', content: response.content });

    // Execute tools and collect results
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
  }

  return { turns, finalMessage, terminatedNormally, toolCalls };
}
