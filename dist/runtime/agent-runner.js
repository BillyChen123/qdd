import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRootDir = path.resolve(moduleDir, '..', '..');
const BASH_TOOL = {
    name: 'bash',
    description: 'Execute a bash command from the QDD project root. Use for qdd CLI commands, project-local inspection, and bounded analysis commands.',
    input_schema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The bash command to execute from the project root' },
            timeout: { type: 'number', description: 'Optional timeout in milliseconds (max 600000)' },
        },
        required: ['command'],
    },
};
const READ_TOOL = {
    name: 'read',
    description: 'Read a file under the QDD project root or package root.',
    input_schema: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Path to the file to read, relative to project root or absolute' },
        },
        required: ['path'],
    },
};
const WRITE_TOOL = {
    name: 'write',
    description: 'Write a file under the QDD project root. Creates parent directories if needed.',
    input_schema: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Project-local path to write' },
            content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
    },
};
const TOOLS = [BASH_TOOL, READ_TOOL, WRITE_TOOL];
const COMPLETION_MARKER = 'WORKFLOW_COMPLETE';
const MAX_COMPLETION_MARKER_RETRIES = 2;
function normalizeRoot(root) {
    return path.resolve(root);
}
function isPathWithinRoot(targetPath, root) {
    const normalizedTarget = path.resolve(targetPath);
    const normalizedRoot = normalizeRoot(root);
    const relative = path.relative(normalizedRoot, normalizedTarget);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function resolvePathForRead(cwd, inputPath) {
    const resolved = path.isAbsolute(inputPath) ? path.resolve(inputPath) : path.resolve(cwd, inputPath);
    const allowedRoots = [cwd, packageRootDir];
    if (!allowedRoots.some((root) => isPathWithinRoot(resolved, root))) {
        throw new Error(`Read path '${inputPath}' is outside the allowed project/package roots.`);
    }
    return resolved;
}
function resolvePathForWrite(cwd, inputPath) {
    if (path.isAbsolute(inputPath)) {
        throw new Error('Write path must be project-relative.');
    }
    const resolved = path.resolve(cwd, inputPath);
    if (!isPathWithinRoot(resolved, cwd)) {
        throw new Error(`Write path '${inputPath}' is outside the project root.`);
    }
    return resolved;
}
async function executeBash(cwd, command, timeoutMs) {
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
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('close', (code) => {
            clearTimeout(timer);
            const parts = [];
            if (stdout.trim())
                parts.push(stdout.trim());
            if (stderr.trim())
                parts.push(`[stderr]\n${stderr.trim()}`);
            if (killed)
                parts.push('[killed by timeout]');
            if (code !== 0 && !killed)
                parts.push(`[exit code: ${code}]`);
            resolve(parts.join('\n') || `Command completed with exit code ${code}`);
        });
        proc.on('error', (err) => {
            clearTimeout(timer);
            resolve(`Error executing command: ${err.message}`);
        });
    });
}
async function executeToolCall(cwd, tool) {
    try {
        switch (tool.name) {
            case 'bash': {
                const command = String(tool.input.command ?? '');
                if (!command.trim())
                    return 'Error: empty command';
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
    }
    catch (error) {
        return `Error executing tool '${tool.name}': ${error.message}`;
    }
}
function hasCompletionMarker(text) {
    return text.toUpperCase().includes(COMPLETION_MARKER);
}
let _claudeSettingsCache = null;
export function parseClaudeSettings(raw) {
    const parsed = JSON.parse(raw);
    const env = parsed.env ?? {};
    return {
        ANTHROPIC_AUTH_TOKEN: parsed.ANTHROPIC_AUTH_TOKEN ?? env.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_API_KEY: parsed.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY,
        ANTHROPIC_BASE_URL: parsed.ANTHROPIC_BASE_URL ?? env.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: parsed.ANTHROPIC_MODEL ?? env.ANTHROPIC_MODEL,
    };
}
export function getClaudeSettings() {
    if (_claudeSettingsCache)
        return _claudeSettingsCache;
    try {
        const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        const raw = fsSync.readFileSync(settingsPath, 'utf-8');
        _claudeSettingsCache = parseClaudeSettings(raw);
    }
    catch {
        _claudeSettingsCache = {};
    }
    return _claudeSettingsCache;
}
export function resolveClaudeApiKey() {
    const settings = getClaudeSettings();
    return process.env.ANTHROPIC_AUTH_TOKEN
        ?? process.env.ANTHROPIC_API_KEY
        ?? settings.ANTHROPIC_AUTH_TOKEN
        ?? settings.ANTHROPIC_API_KEY;
}
export function hasClaudeCredentials() {
    return Boolean(resolveClaudeApiKey());
}
export function resolveClaudeModel(cliModel, sources = {}) {
    const settings = sources.settings ?? getClaudeSettings();
    const env = sources.env ?? process.env;
    return cliModel ?? env.ANTHROPIC_MODEL ?? settings.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
}
export async function runAgent(options) {
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
    const messages = [
        {
            role: 'user',
            content: `You are an agent executing one QDD workflow step. Here are your instructions:\n\n${instructions}\n\nWork through the instructions step by step. Use the available tools to read state, run project-local CLI commands, write project files, and execute analysis. If the workflow step is not complete, continue using tools. When you have completed all the work described in the instructions, respond with a concise summary and end your final response with a standalone line containing exactly "${COMPLETION_MARKER}".`,
        },
    ];
    let turns = 0;
    let toolCalls = 0;
    let finalMessage = '';
    let status = 'max_turns';
    let failureReason;
    let completionMarkerRetries = 0;
    while (turns < maxTurns) {
        if (signal?.aborted) {
            finalMessage = 'Aborted by user.';
            status = 'aborted';
            failureReason = 'Run was aborted by signal.';
            break;
        }
        turns++;
        let response;
        try {
            response = await client.messages.create({
                model,
                max_tokens: 8000,
                system: systemPrompt,
                messages,
                tools: TOOLS,
            });
        }
        catch (error) {
            finalMessage = `Claude SDK request failed: ${error.message}`;
            status = 'sdk_error';
            failureReason = error.message;
            break;
        }
        const toolUses = [];
        const textParts = [];
        for (const block of response.content) {
            if (block.type === 'tool_use') {
                toolUses.push(block);
            }
            else if (block.type === 'text') {
                textParts.push(block.text);
            }
        }
        const text = textParts.join('\n').trim();
        if (toolUses.length === 0) {
            finalMessage = text;
            if (hasCompletionMarker(text)) {
                status = 'completed';
                failureReason = undefined;
                break;
            }
            if (completionMarkerRetries < MAX_COMPLETION_MARKER_RETRIES && turns < maxTurns) {
                completionMarkerRetries++;
                messages.push({ role: 'assistant', content: response.content });
                messages.push({
                    role: 'user',
                    content: `Your previous response did not include the required completion marker. If the workflow step is complete, reply with a concise summary and end with a standalone line containing exactly "${COMPLETION_MARKER}". If the workflow step is not complete, continue using tools instead of giving a final answer.`,
                });
                continue;
            }
            status = 'sdk_error';
            failureReason = `Agent stopped without ${COMPLETION_MARKER}.`;
            break;
        }
        completionMarkerRetries = 0;
        messages.push({ role: 'assistant', content: response.content });
        const toolResults = [];
        for (const toolUse of toolUses) {
            toolCalls++;
            const result = await executeToolCall(cwd, {
                id: toolUse.id,
                name: toolUse.name,
                input: toolUse.input,
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
//# sourceMappingURL=agent-runner.js.map