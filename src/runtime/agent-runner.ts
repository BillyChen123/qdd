import Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageParam, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseYaml } from '../utils/yaml.js';

export interface AgentRunnerOptions {
  model: string;
  systemPrompt: string;
  instructions: string;
  maxTurns: number | null;
  cwd: string;
  signal?: AbortSignal;
  logger?: (message: string) => void;
  verbose?: boolean;
  events?: AgentRunEvents;
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

export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AgentRunEvents {
  turnStart?: (event: { turn: number }) => void;
  textDelta?: (event: { turn: number; delta: string }) => void;
  textEnd?: (event: { turn: number; text: string }) => void;
  toolUse?: (event: { turn: number; tool: AgentToolCall }) => void;
  toolResult?: (event: { turn: number; tool: AgentToolCall; result: string }) => void;
  completionMarkerMissing?: (event: { turn: number; attempt: number; maxAttempts: number }) => void;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRootDir = path.resolve(moduleDir, '..', '..');

const BASH_TOOL: Tool = {
  name: 'bash',
  description: 'Execute a bash command from the QDD project root. Commands already start at QDD_PROJECT_ROOT; do not cd to another checkout. Leaving the project root through cd/pushd/subshells is blocked.',
  input_schema: {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'The bash command to execute from the project root. Use relative paths or "$QDD_PROJECT_ROOT" instead of hard-coded project paths.' },
      timeout: { type: 'number', description: 'Optional numeric timeout in milliseconds. Values are capped by the orchestrator at 3600000.' },
      timeoutPreset: {
        type: 'string',
        enum: ['short', 'normal', 'long'],
        description: 'Optional timeout preset. short=2 minutes, normal=10 minutes, long=1 hour. Prefer long only for expected heavy scientific tools.',
      },
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
const COMPLETION_MARKER = 'WORKFLOW_COMPLETE';
const MAX_COMPLETION_MARKER_RETRIES = 2;
const VERBOSE_RESULT_EXCERPT_LENGTH = 600;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const BASH_OUTPUT_TAIL_CHARS = 16_000;
const BASH_TIMEOUT_GRACE_MS = 3_000;
const BASH_TIMEOUT_FORCE_RESOLVE_MS = 1_000;
const MODEL_TOOL_RESULT_LIMIT = 8_000;
const READ_TEXT_MAX_BYTES = 512 * 1024;
const READ_BINARY_SAMPLE_BYTES = 4096;
const BINARY_READ_EXTENSIONS = new Set([
  '.7z',
  '.arrow',
  '.bai',
  '.bam',
  '.bin',
  '.bz2',
  '.ckpt',
  '.feather',
  '.gz',
  '.h5',
  '.h5ad',
  '.hdf5',
  '.jpeg',
  '.jpg',
  '.loom',
  '.npy',
  '.npz',
  '.onnx',
  '.parquet',
  '.pdf',
  '.png',
  '.pt',
  '.pth',
  '.rda',
  '.rds',
  '.tar',
  '.tgz',
  '.tif',
  '.tiff',
  '.xz',
  '.zip',
]);

export const BASH_TIMEOUT_PRESETS = {
  short: 120_000,
  normal: 600_000,
  long: 3_600_000,
} as const;

type BashTimeoutPreset = keyof typeof BASH_TIMEOUT_PRESETS;
type BashTimeoutInput = number | string | undefined;

interface ResolvedBashTimeout {
  timeoutMs: number;
  preset: BashTimeoutPreset | 'custom';
  requestedMs?: number;
  capped: boolean;
}

interface BoundedText {
  text: string;
  truncated: boolean;
}

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

function toProjectRelativePath(cwd: string, filePath: string): string {
  return path.relative(cwd, filePath).split(path.sep).join('/');
}

function isManagedMarkdownPath(relativePath: string): boolean {
  return /^studies\/STUDY-\d{3}\/study\.md$/.test(relativePath)
    || /^studies\/STUDY-\d{3}\/tasks\/TASK-\d{3}\.md$/.test(relativePath);
}

function isManagedYamlPath(relativePath: string): boolean {
  return relativePath === 'contract.yaml'
    || relativePath === 'evolution.yaml'
    || relativePath === 'artifacts/index.yaml'
    || /^studies\/STUDY-\d{3}\/output\/artifact-candidates\.yaml$/.test(relativePath);
}

function validateManagedWriteContent(cwd: string, filePath: string, content: string): void {
  const relativePath = toProjectRelativePath(cwd, filePath);

  if (isManagedMarkdownPath(relativePath)) {
    const match = content.match(FRONTMATTER_PATTERN);
    if (!match) {
      throw new Error(`Managed Markdown file '${relativePath}' is missing YAML frontmatter.`);
    }
    try {
      parseYaml(match[1]);
    } catch (error) {
      throw new Error(`Managed Markdown file '${relativePath}' has invalid YAML frontmatter: ${(error as Error).message}`);
    }
    return;
  }

  if (isManagedYamlPath(relativePath)) {
    try {
      parseYaml(content);
    } catch (error) {
      throw new Error(`Managed YAML file '${relativePath}' is invalid: ${(error as Error).message}`);
    }
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function resolvePhysicalRoot(cwd: string): Promise<string> {
  try {
    return await fs.realpath(cwd);
  } catch {
    return path.resolve(cwd);
  }
}

function buildProjectRootGuardScript(projectRoot: string): string {
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

function isBashTimeoutPreset(value: unknown): value is BashTimeoutPreset {
  return typeof value === 'string' && value in BASH_TIMEOUT_PRESETS;
}

export function resolveBashTimeoutForTest(timeoutInput?: BashTimeoutInput, timeoutPresetInput?: unknown): ResolvedBashTimeout {
  if (isBashTimeoutPreset(timeoutPresetInput)) {
    return {
      timeoutMs: BASH_TIMEOUT_PRESETS[timeoutPresetInput],
      preset: timeoutPresetInput,
      capped: false,
    };
  }

  if (isBashTimeoutPreset(timeoutInput)) {
    return {
      timeoutMs: BASH_TIMEOUT_PRESETS[timeoutInput],
      preset: timeoutInput,
      capped: false,
    };
  }

  if (typeof timeoutInput === 'number' && Number.isFinite(timeoutInput) && timeoutInput > 0) {
    const requestedMs = Math.floor(timeoutInput);
    return {
      timeoutMs: Math.min(requestedMs, BASH_TIMEOUT_PRESETS.long),
      preset: 'custom',
      requestedMs,
      capped: requestedMs > BASH_TIMEOUT_PRESETS.long,
    };
  }

  return {
    timeoutMs: BASH_TIMEOUT_PRESETS.normal,
    preset: 'normal',
    capped: false,
  };
}

function appendBoundedText(current: BoundedText, chunk: Buffer): BoundedText {
  const combined = `${current.text}${chunk.toString('utf-8')}`;
  if (combined.length <= BASH_OUTPUT_TAIL_CHARS) {
    return { text: combined, truncated: current.truncated };
  }
  return {
    text: combined.slice(-BASH_OUTPUT_TAIL_CHARS),
    truncated: true,
  };
}

function formatBoundedStream(label: 'stdout' | 'stderr', value: BoundedText): string | null {
  const trimmed = value.text.trim();
  if (!trimmed) return null;
  const prefix = value.truncated ? `[${label} truncated to last ${BASH_OUTPUT_TAIL_CHARS} chars]\n` : '';
  if (label === 'stderr') return `[stderr]\n${prefix}${trimmed}`;
  return `${prefix}${trimmed}`;
}

function killProcessBoundary(pid: number | undefined, signal: NodeJS.Signals): boolean {
  if (!pid) return false;
  try {
    if (process.platform === 'win32') {
      process.kill(pid, signal);
    } else {
      process.kill(-pid, signal);
    }
    return true;
  } catch {
    return false;
  }
}

function formatBashRuntimeMetadata(metadata: {
  pid?: number;
  pgid?: number;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  timeout: ResolvedBashTimeout;
  timedOut: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | string | null;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  forceResolved: boolean;
}): string {
  return [
    '[runtime]',
    JSON.stringify({
      pid: metadata.pid ?? null,
      pgid: metadata.pgid ?? null,
      started_at: metadata.startedAt,
      ended_at: metadata.endedAt,
      elapsed_ms: metadata.elapsedMs,
      timeout_ms: metadata.timeout.timeoutMs,
      timeout_preset: metadata.timeout.preset,
      requested_timeout_ms: metadata.timeout.requestedMs ?? null,
      timeout_capped: metadata.timeout.capped,
      timed_out: metadata.timedOut,
      exit_code: metadata.exitCode,
      signal: metadata.signal,
      stdout_truncated: metadata.stdoutTruncated,
      stderr_truncated: metadata.stderrTruncated,
      force_resolved: metadata.forceResolved,
    }, null, 2),
  ].join('\n');
}

async function executeBash(cwd: string, command: string, timeoutInput?: BashTimeoutInput, timeoutPresetInput?: unknown): Promise<string> {
  const projectRoot = await resolvePhysicalRoot(cwd);
  const guardedCommand = `${buildProjectRootGuardScript(projectRoot)}\n${command}`;

  return new Promise((resolve) => {
    const timeout = resolveBashTimeoutForTest(timeoutInput, timeoutPresetInput);
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    let stdout: BoundedText = { text: '', truncated: false };
    let stderr: BoundedText = { text: '', truncated: false };
    let timedOut = false;
    let forceResolved = false;
    let settled = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null;
    let forceResolveTimer: ReturnType<typeof setTimeout> | null = null;

    const proc = spawn('bash', ['-c', guardedCommand], {
      cwd: projectRoot,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', QDD_PROJECT_ROOT: projectRoot, PWD: projectRoot },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    const finish = (code: number | null, signal: NodeJS.Signals | string | null, forceResolve = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (forceResolveTimer) clearTimeout(forceResolveTimer);
      forceResolved = forceResolve;
      const endedAtMs = Date.now();
      const parts: string[] = [];
      const stdoutPart = formatBoundedStream('stdout', stdout);
      const stderrPart = formatBoundedStream('stderr', stderr);
      if (stdoutPart) parts.push(stdoutPart);
      if (stderrPart) parts.push(stderrPart);
      if (timedOut) parts.push('[killed by timeout]');
      if (code !== 0 && !timedOut) parts.push(`[exit code: ${code}]`);
      parts.push(formatBashRuntimeMetadata({
        pid: proc.pid,
        pgid: process.platform === 'win32' ? undefined : proc.pid,
        startedAt,
        endedAt: new Date(endedAtMs).toISOString(),
        elapsedMs: endedAtMs - startedAtMs,
        timeout,
        timedOut,
        exitCode: code,
        signal,
        stdoutTruncated: stdout.truncated,
        stderrTruncated: stderr.truncated,
        forceResolved,
      }));
      resolve(parts.join('\n') || `Command completed with exit code ${code}`);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessBoundary(proc.pid, 'SIGTERM');
      forceKillTimer = setTimeout(() => {
        killProcessBoundary(proc.pid, 'SIGKILL');
        forceResolveTimer = setTimeout(() => finish(null, 'SIGKILL', true), BASH_TIMEOUT_FORCE_RESOLVE_MS);
      }, BASH_TIMEOUT_GRACE_MS);
    }, timeout.timeoutMs);

    proc.stdout.on('data', (data: Buffer) => { stdout = appendBoundedText(stdout, data); });
    proc.stderr.on('data', (data: Buffer) => { stderr = appendBoundedText(stderr, data); });

    proc.on('close', (code: number | null, signal: NodeJS.Signals | null) => finish(code, signal));

    proc.on('error', (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (forceResolveTimer) clearTimeout(forceResolveTimer);
      resolve(`Error executing command: ${err.message}`);
    });
  });
}

export async function executeProjectBashForTest(cwd: string, command: string, timeout?: BashTimeoutInput, timeoutPreset?: unknown): Promise<string> {
  return executeBash(cwd, command, timeout, timeoutPreset);
}

function hasMetadataOnlyExtension(filePath: string): boolean {
  return BINARY_READ_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function looksBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  if (buffer.includes(0)) return true;
  let suspicious = 0;
  for (const byte of buffer) {
    const isAllowedControl = byte === 9 || byte === 10 || byte === 12 || byte === 13;
    if (byte < 32 && !isAllowedControl) suspicious++;
  }
  return suspicious / buffer.length > 0.05;
}

function formatReadMetadataOnly(inputPath: string, filePath: string, stat: fsSync.Stats, reason: 'binary' | 'too_large'): string {
  return [
    `Read skipped: ${reason} file content is not loaded into model context.`,
    JSON.stringify({
      kind: 'metadata_only',
      path: inputPath,
      resolved_path: filePath,
      size_bytes: stat.size,
      mtime: stat.mtime.toISOString(),
      reason,
      hint: 'Use a domain-aware inspection script or a concise shell summary instead of direct read for this artifact.',
    }, null, 2),
  ].join('\n');
}

async function readFileForTool(cwd: string, inputPath: string): Promise<string> {
  const filePath = resolvePathForRead(cwd, inputPath);
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw new Error(`Read path '${inputPath}' is not a file.`);
  }

  if (hasMetadataOnlyExtension(filePath)) {
    return formatReadMetadataOnly(inputPath, filePath, stat, 'binary');
  }

  const handle = await fs.open(filePath, 'r');
  try {
    const sampleSize = Math.min(READ_BINARY_SAMPLE_BYTES, stat.size);
    const sample = Buffer.alloc(sampleSize);
    if (sampleSize > 0) {
      await handle.read(sample, 0, sampleSize, 0);
    }
    if (looksBinary(sample)) {
      return formatReadMetadataOnly(inputPath, filePath, stat, 'binary');
    }
  } finally {
    await handle.close();
  }

  if (stat.size > READ_TEXT_MAX_BYTES) {
    return formatReadMetadataOnly(inputPath, filePath, stat, 'too_large');
  }

  return fs.readFile(filePath, 'utf-8');
}

export function truncateToolResultForModelForTest(result: string): string {
  if (result.length <= MODEL_TOOL_RESULT_LIMIT) return result;
  const marker = `[tool result truncated: omitted ${result.length - MODEL_TOOL_RESULT_LIMIT} chars; full bounded result is in the auto run log]`;
  const available = MODEL_TOOL_RESULT_LIMIT - marker.length - '[... omitted middle ...]'.length - 4;
  const headLength = Math.max(1000, Math.floor(available * 0.6));
  const tailLength = Math.max(1000, available - headLength);
  return [
    marker,
    result.slice(0, headLength),
    '[... omitted middle ...]',
    result.slice(-tailLength),
  ].join('\n');
}

async function executeToolCall(cwd: string, tool: AgentToolCall): Promise<string> {
  try {
    switch (tool.name) {
      case 'bash': {
        const command = String(tool.input.command ?? '');
        if (!command.trim()) return 'Error: empty command';
        const timeout = typeof tool.input.timeout === 'number' || typeof tool.input.timeout === 'string'
          ? tool.input.timeout
          : undefined;
        return executeBash(cwd, command, timeout, tool.input.timeoutPreset);
      }
      case 'read': {
        return readFileForTool(cwd, String(tool.input.path ?? ''));
      }
      case 'write': {
        const filePath = resolvePathForWrite(cwd, String(tool.input.path ?? ''));
        const content = String(tool.input.content ?? '');
        validateManagedWriteContent(cwd, filePath, content);
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

export async function executeAgentToolForTest(cwd: string, tool: AgentToolCall): Promise<string> {
  return executeToolCall(cwd, tool);
}

function hasCompletionMarker(text: string): boolean {
  return text.toUpperCase().includes(COMPLETION_MARKER);
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatExcerpt(value: string, maxLength = VERBOSE_RESULT_EXCERPT_LENGTH): string {
  const compact = compactWhitespace(value);
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function formatToolInput(tool: AgentToolCall): string {
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

function formatToolResult(tool: AgentToolCall, result: string): string {
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

function hasTurnsRemaining(turns: number, maxTurns: number | null): boolean {
  return maxTurns === null || turns < maxTurns;
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

interface ModelResolutionSources {
  env?: NodeJS.ProcessEnv;
  settings?: ClaudeSettings;
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

export function resolveClaudeModel(cliModel?: string, sources: ModelResolutionSources = {}): string {
  const settings = sources.settings ?? getClaudeSettings();
  const env = sources.env ?? process.env;
  return cliModel ?? env.ANTHROPIC_MODEL ?? settings.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
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
  const { model, systemPrompt, instructions, maxTurns, cwd, signal, verbose = false, events } = options;
  const log = options.logger ?? (() => undefined);

  const messages: MessageParam[] = [
    {
      role: 'user',
      content: `You are an agent executing one QDD workflow step.\n\nProject root: ${cwd}\nAll bash commands already execute from this project root. Use relative paths or "$QDD_PROJECT_ROOT"; do not cd to another absolute project path. A bash command that leaves this root will be rejected.\n\nHere are your instructions:\n\n${instructions}\n\nWork through the instructions step by step. Use the available tools to read state, run project-local CLI commands, write project files, and execute analysis. If the workflow step is not complete, continue using tools. When you have completed all the work described in the instructions, respond with a concise summary and end your final response with a standalone line containing exactly "${COMPLETION_MARKER}".`,
    },
  ];

  let turns = 0;
  let toolCalls = 0;
  let finalMessage = '';
  let status: AgentRunStatus = 'max_turns';
  let failureReason: string | undefined;
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
    if (verbose) log(`    [agent] turn ${turns}: requesting model`);
    let response: Message;
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
    events?.textEnd?.({ turn: turns, text });
    if (verbose && text) {
      log(`    [agent] text: ${formatExcerpt(text)}`);
    }
    if (verbose && toolUses.length > 0) {
      log(`    [agent] tool calls: ${toolUses.map((toolUse) => `${toolUse.name}(${formatToolInput({
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
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
        if (verbose) log(`    [agent] missing ${COMPLETION_MARKER}; requesting completion confirmation (${completionMarkerRetries}/${MAX_COMPLETION_MARKER_RETRIES})`);
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

    const toolResults: MessageParam['content'] = [];
    for (const toolUse of toolUses) {
      toolCalls++;
      const toolCall: AgentToolCall = {
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
      };
      events?.toolUse?.({ turn: turns, tool: toolCall });
      const result = await executeToolCall(cwd, {
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      });
      if (verbose) log(`    [tool:${toolUse.name}] ${formatToolResult(toolCall, result)}`);
      events?.toolResult?.({ turn: turns, tool: toolCall, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: truncateToolResultForModelForTest(result),
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
