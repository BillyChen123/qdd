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
    description: 'Execute a bash command from the QDD project root. Commands already start at QDD_PROJECT_ROOT; do not cd to another checkout. Leaving the project root through cd/pushd/subshells is blocked.',
    input_schema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The bash command to execute from the project root. Use relative paths or "$QDD_PROJECT_ROOT" instead of hard-coded project paths.' },
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
const VERBOSE_RESULT_EXCERPT_LENGTH = 600;
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
function shellQuote(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
async function resolvePhysicalRoot(cwd) {
    try {
        return await fs.realpath(cwd);
    }
    catch {
        return path.resolve(cwd);
    }
}
function buildProjectRootGuardScript(projectRoot) {
    const quotedRoot = shellQuote(projectRoot);
    return [
        `__qdd_project_root=${quotedRoot}`,
        'export QDD_PROJECT_ROOT="$__qdd_project_root"',
        'set -T',
        '__qdd_guard_pwd() {',
        '  local __qdd_pwd',
        '  __qdd_pwd="$(pwd -P)" || exit 125',
        '  case "$__qdd_pwd" in',
        '    "$__qdd_project_root"|"$__qdd_project_root"/*) ;;',
        '    *) echo "Error: bash command left QDD project root: $__qdd_pwd" >&2; exit 125 ;;',
        '  esac',
        '}',
        'cd "$__qdd_project_root" || exit 125',
        "trap '__qdd_guard_pwd' DEBUG",
        '__qdd_guard_pwd',
    ].join('\n');
}
async function executeBash(cwd, command, timeoutMs) {
    const projectRoot = await resolvePhysicalRoot(cwd);
    const guardedCommand = `${buildProjectRootGuardScript(projectRoot)}\n${command}`;
    return new Promise((resolve) => {
        const timeout = Math.min(timeoutMs ?? 120_000, 600_000);
        let stdout = '';
        let stderr = '';
        let killed = false;
        const proc = spawn('bash', ['-c', guardedCommand], {
            cwd: projectRoot,
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', QDD_PROJECT_ROOT: projectRoot, PWD: projectRoot },
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
export async function executeProjectBashForTest(cwd, command, timeoutMs) {
    return executeBash(cwd, command, timeoutMs);
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
function compactWhitespace(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function formatExcerpt(value, maxLength = VERBOSE_RESULT_EXCERPT_LENGTH) {
    const compact = compactWhitespace(value);
    if (compact.length <= maxLength)
        return compact;
    return `${compact.slice(0, maxLength)}...`;
}
function formatToolInput(tool) {
    switch (tool.name) {
        case 'bash':
            return `command=${JSON.stringify(String(tool.input.command ?? ''))}`;
        case 'read':
        case 'write':
            return `path=${JSON.stringify(String(tool.input.path ?? ''))}`;
        default:
            return JSON.stringify(tool.input);
    }
}
function formatToolResult(tool, result) {
    switch (tool.name) {
        case 'read':
            return `read ${String(tool.input.path ?? '')} (${result.length} chars)`;
        case 'write':
            return result;
        case 'bash':
            return formatExcerpt(result);
        default:
            return formatExcerpt(result);
    }
}
function hasTurnsRemaining(turns, maxTurns) {
    return maxTurns === null || turns < maxTurns;
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
    const { model, systemPrompt, instructions, maxTurns, cwd, signal, verbose = false, events } = options;
    const log = options.logger ?? (() => undefined);
    const messages = [
        {
            role: 'user',
            content: `You are an agent executing one QDD workflow step.\n\nProject root: ${cwd}\nAll bash commands already execute from this project root. Use relative paths or "$QDD_PROJECT_ROOT"; do not cd to another absolute project path. A bash command that leaves this root will be rejected.\n\nHere are your instructions:\n\n${instructions}\n\nWork through the instructions step by step. Use the available tools to read state, run project-local CLI commands, write project files, and execute analysis. If the workflow step is not complete, continue using tools. When you have completed all the work described in the instructions, respond with a concise summary and end your final response with a standalone line containing exactly "${COMPLETION_MARKER}".`,
        },
    ];
    let turns = 0;
    let toolCalls = 0;
    let finalMessage = '';
    let status = 'max_turns';
    let failureReason;
    let completionMarkerRetries = 0;
    while (hasTurnsRemaining(turns, maxTurns)) {
        if (signal?.aborted) {
            finalMessage = 'Aborted by user.';
            status = 'aborted';
            failureReason = 'Run was aborted by signal.';
            break;
        }
        turns++;
        events?.turnStart?.({ turn: turns });
        if (verbose)
            log(`    [agent] turn ${turns}: requesting model`);
        let response;
        try {
            const stream = client.messages.stream({
                model,
                max_tokens: 8000,
                system: systemPrompt,
                messages,
                tools: TOOLS,
            }, { signal });
            stream.on('text', (textDelta) => {
                events?.textDelta?.({ turn: turns, delta: textDelta });
            });
            response = await stream.finalMessage();
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
        events?.textEnd?.({ turn: turns, text });
        if (verbose && text) {
            log(`    [agent] text: ${formatExcerpt(text)}`);
        }
        if (verbose && toolUses.length > 0) {
            log(`    [agent] tool calls: ${toolUses.map((toolUse) => `${toolUse.name}(${formatToolInput({
                id: toolUse.id,
                name: toolUse.name,
                input: toolUse.input,
            })})`).join(', ')}`);
        }
        if (toolUses.length === 0) {
            finalMessage = text;
            if (hasCompletionMarker(text)) {
                status = 'completed';
                failureReason = undefined;
                break;
            }
            if (completionMarkerRetries < MAX_COMPLETION_MARKER_RETRIES && hasTurnsRemaining(turns, maxTurns)) {
                completionMarkerRetries++;
                if (verbose)
                    log(`    [agent] missing ${COMPLETION_MARKER}; requesting completion confirmation (${completionMarkerRetries}/${MAX_COMPLETION_MARKER_RETRIES})`);
                events?.completionMarkerMissing?.({
                    turn: turns,
                    attempt: completionMarkerRetries,
                    maxAttempts: MAX_COMPLETION_MARKER_RETRIES,
                });
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
            const toolCall = {
                id: toolUse.id,
                name: toolUse.name,
                input: toolUse.input,
            };
            events?.toolUse?.({ turn: turns, tool: toolCall });
            const result = await executeToolCall(cwd, {
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
            });
            if (verbose)
                log(`    [tool:${toolUse.name}] ${formatToolResult(toolCall, result)}`);
            events?.toolResult?.({ turn: turns, tool: toolCall, result });
            toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: result.slice(0, 8000),
            });
        }
        messages.push({ role: 'user', content: toolResults });
    }
    if (maxTurns !== null && turns >= maxTurns && !finalMessage) {
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