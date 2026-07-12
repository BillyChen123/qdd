import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { deflateSync } from 'node:zlib';
import { initCommand } from '../commands/init.js';
import { getClaudeSettings, resolveClaudeApiKey, resolveClaudeModel } from '../runtime/agent-runner.js';
import { type ConcludeEvalCase, loadConcludeEvalCase } from './conclude-eval-case.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..', '..');

export type ConcludeEvalMode = 'fake' | 'live';
export type ConcludeEvalStatus = 'passed' | 'failed' | 'blocked';
export type ConcludeEvalStage = 'synthesis' | 'gate1_feedback' | 'story_draft' | 'gate2_revision' | 'semantic_review';
export type SemanticReviewStatus = 'pass' | 'fail' | 'cannot_assess';

interface EvalTextBlock {
  type: 'text';
  text: string;
}

interface EvalToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface EvalToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<EvalTextBlock | EvalImageBlock>;
  is_error?: boolean;
}

interface EvalImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    data: string;
  };
}

type EvalAssistantBlock = EvalTextBlock | EvalToolUseBlock;
type EvalMessage = {
  role: 'user' | 'assistant';
  content: string | Array<EvalTextBlock | EvalToolUseBlock | EvalToolResultBlock>;
};

interface EvalModel {
  complete(messages: EvalMessage[], systemPrompt: string, tools?: Tool[]): Promise<EvalAssistantBlock[]>;
}

export interface ConcludeEvalTranscriptEntry {
  sequence: number;
  timestamp: string;
  stage: ConcludeEvalStage;
  actor: 'human' | 'assistant' | 'tool';
  kind: 'message' | 'tool_use' | 'tool_result';
  content: string;
  tool?: string;
  path?: string;
}

export interface ConcludeEvalAccessEntry {
  sequence: number;
  timestamp: string;
  stage: ConcludeEvalStage;
  action: 'list' | 'read' | 'write' | 'view_image';
  path: string;
}

export interface ConcludeEvalAssertion {
  id: string;
  status: 'pass' | 'fail' | 'not_run';
  detail: string;
}

export interface ConcludeEvalReport {
  schema_version: 2;
  mode: ConcludeEvalMode;
  status: ConcludeEvalStatus;
  started_at: string;
  finished_at: string;
  model: string;
  provider: string;
  repository_commit: string;
  production_skill_sha256: string;
  case: {
    id: string;
    name: string;
    fingerprint_sha256: string;
    provenance: ConcludeEvalCase['provenance'];
  };
  fixture_path: string;
  project_path: string;
  installed_skill_path: string;
  outputs: {
    run_root: string;
    conclusion_dir: string;
    research_synthesis: string;
    story: string;
    story_before_gate2_revision: string;
    transcript: string;
    access_log: string;
    report_json: string;
    report_markdown: string;
    semantic_review_json: string;
    semantic_review_transcript: string;
    semantic_review_access_log: string;
  };
  harness: {
    status: 'PASS' | 'FAIL' | 'NOT_RUN';
    assertions: ConcludeEvalAssertion[];
  };
  semantic_review: ConcludeSemanticReview;
  environment_blockers: string[];
  gates: Array<{
    gate: 'gate_1' | 'gate_2';
    action: 'feedback' | 'accepted';
    message: string;
  }>;
  stage_results: Array<{
    stage: ConcludeEvalStage;
    assistant_message: string;
    research_synthesis_exists: boolean;
    story_exists: boolean;
  }>;
}

export interface RunConcludeEvalOptions {
  mode: ConcludeEvalMode;
  outputRoot: string;
  model?: string;
  provider?: string;
  casePath?: string;
  credentialOverride?: string | null;
}

export interface ConcludeSemanticReview {
  protocol_version: 1;
  verdict: 'accepted' | 'revision_required' | 'blocked';
  summary: string;
  dimensions: Array<{
    id: string;
    status: SemanticReviewStatus;
    analysis: string;
    evidence_paths: string[];
  }>;
  major_claim_checks: Array<{
    claim: string;
    status: SemanticReviewStatus;
    analysis: string;
    source_paths: string[];
  }>;
  figure_checks: Array<{
    figure_path: string;
    status: SemanticReviewStatus;
    analysis: string;
  }>;
  findings: Array<{
    severity: 'critical' | 'major' | 'minor';
    detail: string;
    evidence_paths: string[];
  }>;
}

interface EvalPaths {
  conclusionDir: string;
  synthesis: string;
  story: string;
}

const execFileAsync = promisify(execFile);

const EVAL_TOOLS: Tool[] = [
  {
    name: 'list_files',
    description: 'List files recursively inside one project-relative directory.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative directory, or . for project root.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Read one UTF-8 text file inside the QDD project.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative text file path.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'view_image',
    description: 'Inspect the actual rendered image content of a project figure. PPM fixtures are converted to PNG for multimodal model input.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative image path.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write one UTF-8 file under conclusions/. Parent directories are created automatically.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative output path under conclusions/.' },
        content: { type: 'string', description: 'Complete file content.' },
      },
      required: ['path', 'content'],
    },
  },
];

const SEMANTIC_REVIEW_TOOLS: Tool[] = [
  ...EVAL_TOOLS.slice(0, 3),
  {
    name: 'submit_semantic_review',
    description: 'Submit the evidence-grounded semantic review. This protocol has no numeric or aggregate score.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        verdict: { type: 'string', enum: ['accepted', 'revision_required', 'blocked'] },
        summary: { type: 'string' },
        dimensions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              status: { type: 'string', enum: ['pass', 'fail', 'cannot_assess'] },
              analysis: { type: 'string' },
              evidence_paths: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'status', 'analysis', 'evidence_paths'],
          },
        },
        major_claim_checks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              claim: { type: 'string' },
              status: { type: 'string', enum: ['pass', 'fail', 'cannot_assess'] },
              analysis: { type: 'string' },
              source_paths: { type: 'array', items: { type: 'string' } },
            },
            required: ['claim', 'status', 'analysis', 'source_paths'],
          },
        },
        figure_checks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              figure_path: { type: 'string' },
              status: { type: 'string', enum: ['pass', 'fail', 'cannot_assess'] },
              analysis: { type: 'string' },
            },
            required: ['figure_path', 'status', 'analysis'],
          },
        },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
              detail: { type: 'string' },
              evidence_paths: { type: 'array', items: { type: 'string' } },
            },
            required: ['severity', 'detail', 'evidence_paths'],
          },
        },
      },
      required: ['verdict', 'summary', 'dimensions', 'major_claim_checks', 'figure_checks', 'findings'],
    },
  },
];

function isoNow(): string {
  return new Date().toISOString();
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function redactSensitiveText(value: string, explicitSecrets: string[] = []): string {
  let redacted = value;
  for (const secret of explicitSecrets) {
    if (secret.length >= 8) redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|auth[_-]?token|access[_-]?token|secret)\b\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{12,}["']?/gi, '$1=[REDACTED]');
}

function containsSecretValue(value: string, explicitSecrets: string[] = []): boolean {
  if (explicitSecrets.some((secret) => secret.length >= 8 && value.includes(secret))) return true;
  return /sk-ant-[A-Za-z0-9_-]{8,}/.test(value)
    || /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/i.test(value)
    || /\b(api[_-]?key|auth[_-]?token|access[_-]?token|secret)\b\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{12,}["']?/i.test(value);
}

function resolveProjectPath(projectRoot: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) throw new Error('Evaluation tools require project-relative paths.');
  const resolved = path.resolve(projectRoot, relativePath);
  const relative = path.relative(projectRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path leaves evaluation project: ${relativePath}`);
  }
  return resolved;
}

async function listFiles(root: string, relativeDir: string): Promise<string[]> {
  const absoluteDir = resolveProjectPath(root, relativeDir);
  const output: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        output.push(path.relative(root, absolutePath).split(path.sep).join('/'));
      }
    }
  }

  await walk(absoluteDir);
  return output;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function ppmToPng(source: string): {
  buffer: Buffer;
  originalWidth: number;
  originalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
} {
  const tokens = source
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/#.*/, '').trim().split(/\s+/))
    .filter(Boolean);
  if (tokens[0] !== 'P3') throw new Error('Only ASCII P3 PPM figures are supported by the eval viewer.');
  const width = Number(tokens[1]);
  const height = Number(tokens[2]);
  const maxValue = Number(tokens[3]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || maxValue <= 0) {
    throw new Error('Invalid PPM dimensions or max value.');
  }
  const samples = tokens.slice(4).map(Number);
  if (samples.length !== width * height * 3 || samples.some((sample) => !Number.isFinite(sample))) {
    throw new Error('Invalid PPM sample count.');
  }

  const scale = Math.max(1, Math.ceil(256 / width), Math.ceil(256 / height));
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  const scanlines = Buffer.alloc(renderedHeight * (1 + renderedWidth * 3));
  let targetIndex = 0;
  for (let row = 0; row < renderedHeight; row++) {
    scanlines[targetIndex++] = 0;
    const sourceRow = Math.floor(row / scale);
    for (let column = 0; column < renderedWidth; column++) {
      const sourceColumn = Math.floor(column / scale);
      const sourceIndex = (sourceRow * width + sourceColumn) * 3;
      for (let channel = 0; channel < 3; channel++) {
        scanlines[targetIndex++] = Math.round((samples[sourceIndex + channel] / maxValue) * 255);
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(renderedWidth, 0);
  header.writeUInt32BE(renderedHeight, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  const buffer = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return { buffer, originalWidth: width, originalHeight: height, renderedWidth, renderedHeight };
}

async function imageForModel(filePath: string): Promise<{ block: EvalImageBlock; summary: string }> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.ppm') {
    const source = await fs.readFile(filePath, 'utf-8');
    const image = ppmToPng(source);
    return {
      block: {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: image.buffer.toString('base64') },
      },
      summary: `multimodal image supplied from ${image.originalWidth}x${image.originalHeight} PPM via nearest-neighbor rendering at ${image.renderedWidth}x${image.renderedHeight} (${image.buffer.length} PNG bytes, sha256=${sha256(image.buffer)})`,
    };
  }

  const buffer = await fs.readFile(filePath);
  const mediaType = extension === '.jpg' || extension === '.jpeg'
    ? 'image/jpeg'
    : extension === '.gif'
      ? 'image/gif'
      : extension === '.webp'
        ? 'image/webp'
        : 'image/png';
  return {
    block: {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
    },
    summary: `multimodal image supplied (${buffer.length} bytes, sha256=${sha256(buffer)})`,
  };
}

class AnthropicEvalModel implements EvalModel {
  private readonly client: Anthropic;

  constructor(private readonly model: string, apiKey: string) {
    const settings = getClaudeSettings();
    this.client = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL ?? settings.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  async complete(messages: EvalMessage[], systemPrompt: string, tools: Tool[] = EVAL_TOOLS): Promise<EvalAssistantBlock[]> {
    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8_000,
        system: systemPrompt,
        messages: messages as MessageParam[],
        tools,
      });
    } catch (error) {
      throw new LiveSdkError((error as Error).message);
    }
    return response.content.flatMap((block): EvalAssistantBlock[] => {
      if (block.type === 'text') return [{ type: 'text', text: block.text }];
      if (block.type === 'tool_use') {
        return [{ type: 'tool_use', id: block.id, name: block.name, input: block.input as Record<string, unknown> }];
      }
      return [];
    });
  }
}

class LiveSdkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveSdkError';
  }
}

class ScriptedFakeEvalModel implements EvalModel {
  private call = 0;

  constructor(
    private readonly evalCase: ConcludeEvalCase,
    private readonly paths: EvalPaths
  ) {}

  async complete(): Promise<EvalAssistantBlock[]> {
    this.call++;
    switch (this.call) {
      case 1:
        return this.evalCase.navigation_files.map((filePath) => tool('read_file', { path: filePath }));
      case 2:
        return this.evalCase.evidence_outputs.map((filePath) => tool('read_file', { path: filePath }));
      case 3:
        return this.evalCase.figures.map((filePath) => tool('view_image', { path: filePath }));
      case 4:
        return [tool('write_file', {
          path: this.paths.synthesis,
          content: [
            '# Research Synthesis',
            '',
            `Across its studies, ${this.evalCase.name} changed the project-level explanation rather than merely adding another result.`,
            'The later evidence qualifies the initial finding and supplies the logical condition needed to interpret it.',
            '',
            'This offline fake proves source access and gate mechanics only. Scientific quality is intentionally reserved for live semantic review.',
          ].join('\n'),
        })];
      case 5:
        return [textBlock('research_synthesis.md is complete. I am pausing at Gate 1 for narrative intent feedback.')];
      case 6:
        return [textBlock('I incorporated the requested contribution, emphasis, de-emphasis, and Results logic. I will wait for explicit confirmation and have not created story.md.')];
      case 7:
        return [tool('write_file', {
          path: this.paths.story,
          content: [
            `# ${this.evalCase.name}`,
            '',
            '## Abstract',
            'This draft integrates the project evidence around one conditional contribution.',
            '',
            '## Introduction',
            'The unresolved scientific problem motivates a cross-study test rather than an execution chronology [citation needed: field context].',
            '',
            '## Results',
            'The initial result established the phenomenon, while later evidence changed its interpretation and defined the condition under which it holds.',
            '',
            `![Figure 1. Directly inspected evidence used in the Results logic.](../../${this.evalCase.figures[0]})`,
            '',
            '| Evidence role | Cross-study interpretation |',
            '| --- | --- |',
            '| Initial result | Establishes the phenomenon |',
            '| Later result | Refines its scope and mechanism |',
            '',
            '## Discussion',
            'The combined evidence supports a bounded contribution and does not establish claims beyond the observed design.',
            '',
            '## Methods',
            'Methods follow the finalized study reports and tables inspected for this evaluation.',
          ].join('\n'),
        })];
      case 8:
        return [textBlock('The complete first story.md is ready for Gate 2 review.')];
      case 9:
        return [tool('write_file', {
          path: this.paths.story,
          content: [
            `# ${this.evalCase.name}: revised contribution-first story`,
            '',
            '## Abstract',
            'The revised manuscript centers the cross-study explanation requested during the two human gates.',
            '',
            '## Introduction',
            'The scientific gap concerns why an initially promising result does not hold uniformly [citation needed: field context].',
            '',
            '## Results',
            'The discrepancy appears first, creating the question that the complementary evidence resolves. The initial result then establishes reproducibility, and the later result supplies the condition needed for a unified interpretation.',
            '',
            `![Figure 1. Direct inspection supports the manuscript's logical turn.](../../${this.evalCase.figures[0]})`,
            '',
            '| Evidence role | Revised interpretation |',
            '| --- | --- |',
            '| Discrepant observation | Rules out the simple account |',
            '| Complementary validation | Supports the conditional model |',
            '',
            '## Discussion',
            'The contribution is conditional and evidence-proportionate. Unmeasured causality and broader generalization remain outside the claim.',
            '',
            '## Methods',
            'The reported methods and quantitative definitions come from the directly inspected finalized outputs.',
          ].join('\n'),
        })];
      case 10:
        return [textBlock('I rewrote story.md in response to Gate 2 feedback and am presenting the revised manuscript for acceptance.')];
      default:
        throw new Error(`Unexpected fake model call ${this.call}.`);
    }
  }
}

let fakeToolId = 0;

function tool(name: string, input: Record<string, unknown>): EvalToolUseBlock {
  fakeToolId++;
  return { type: 'tool_use', id: `fake-tool-${fakeToolId}`, name, input };
}

function textBlock(text: string): EvalTextBlock {
  return { type: 'text', text };
}

class EvalConversation {
  readonly transcript: ConcludeEvalTranscriptEntry[] = [];
  readonly accessLog: ConcludeEvalAccessEntry[] = [];
  readonly gates: ConcludeEvalReport['gates'] = [];
  readonly stageResults: ConcludeEvalReport['stage_results'] = [];
  readonly messages: EvalMessage[] = [];
  stage: ConcludeEvalStage = 'synthesis';
  private sequence = 0;

  constructor(
    private readonly projectRoot: string,
    private readonly model: EvalModel,
    private readonly systemPrompt: string,
    private readonly secrets: string[],
    private readonly paths: EvalPaths
  ) {}

  addHumanMessage(content: string): void {
    const safe = redactSensitiveText(content, this.secrets);
    this.messages.push({ role: 'user', content: safe });
    this.transcript.push(this.entry('human', 'message', safe));
  }

  addGate(gate: 'gate_1' | 'gate_2', action: 'feedback' | 'accepted', message: string): void {
    this.gates.push({ gate, action, message });
    this.addHumanMessage(message);
  }

  async recordStageResult(assistantMessage: string): Promise<void> {
    this.stageResults.push({
      stage: this.stage,
      assistant_message: redactSensitiveText(assistantMessage, this.secrets),
      research_synthesis_exists: await exists(resolveProjectPath(this.projectRoot, this.paths.synthesis)),
      story_exists: await exists(resolveProjectPath(this.projectRoot, this.paths.story)),
    });
  }

  async runUntilPause(maxModelCalls = 16): Promise<string> {
    for (let call = 0; call < maxModelCalls; call++) {
      const blocks = await this.model.complete(this.messages, this.systemPrompt);
      const text = blocks.filter((block): block is EvalTextBlock => block.type === 'text').map((block) => block.text).join('\n').trim();
      const toolUses = blocks.filter((block): block is EvalToolUseBlock => block.type === 'tool_use');

      this.messages.push({ role: 'assistant', content: blocks });
      if (text) this.transcript.push(this.entry('assistant', 'message', redactSensitiveText(text, this.secrets)));
      for (const toolUse of toolUses) {
        const pathValue = typeof toolUse.input.path === 'string' ? toolUse.input.path : undefined;
        this.transcript.push(this.entry(
          'assistant',
          'tool_use',
          redactSensitiveText(JSON.stringify(toolUse.input), this.secrets),
          toolUse.name,
          pathValue
        ));
      }

      if (toolUses.length === 0) {
        if (!text) throw new Error(`Model paused without text during ${this.stage}.`);
        return text;
      }

      const results: EvalToolResultBlock[] = [];
      for (const toolUse of toolUses) {
        results.push(await this.executeTool(toolUse));
      }
      this.messages.push({ role: 'user', content: results });
    }
    throw new Error(`Model did not pause within ${maxModelCalls} calls during ${this.stage}.`);
  }

  private entry(
    actor: ConcludeEvalTranscriptEntry['actor'],
    kind: ConcludeEvalTranscriptEntry['kind'],
    content: string,
    toolName?: string,
    toolPath?: string
  ): ConcludeEvalTranscriptEntry {
    this.sequence++;
    return {
      sequence: this.sequence,
      timestamp: isoNow(),
      stage: this.stage,
      actor,
      kind,
      content,
      tool: toolName,
      path: toolPath,
    };
  }

  private addAccess(action: ConcludeEvalAccessEntry['action'], toolPath: string): void {
    this.accessLog.push({
      sequence: this.accessLog.length + 1,
      timestamp: isoNow(),
      stage: this.stage,
      action,
      path: toolPath,
    });
  }

  private async executeTool(toolUse: EvalToolUseBlock): Promise<EvalToolResultBlock> {
    const relativePath = String(toolUse.input.path ?? '');
    let content: EvalToolResultBlock['content'];

    switch (toolUse.name) {
      case 'list_files': {
        this.addAccess('list', relativePath);
        content = (await listFiles(this.projectRoot, relativePath)).join('\n');
        break;
      }
      case 'read_file': {
        this.addAccess('read', relativePath);
        content = await fs.readFile(resolveProjectPath(this.projectRoot, relativePath), 'utf-8');
        break;
      }
      case 'view_image': {
        this.addAccess('view_image', relativePath);
        const image = await imageForModel(resolveProjectPath(this.projectRoot, relativePath));
        content = [image.block, { type: 'text', text: image.summary }];
        break;
      }
      case 'write_file': {
        if (!(relativePath === 'conclusions' || relativePath.startsWith('conclusions/'))) {
          throw new Error(`Eval write is outside conclusions/: ${relativePath}`);
        }
        this.addAccess('write', relativePath);
        const value = redactSensitiveText(String(toolUse.input.content ?? ''), this.secrets);
        const absolutePath = resolveProjectPath(this.projectRoot, relativePath);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, value, 'utf-8');
        content = `File written: ${relativePath} (${value.length} chars, sha256=${sha256(value)})`;
        break;
      }
      default:
        throw new Error(`Unsupported evaluation tool: ${toolUse.name}`);
    }

    const transcriptContent = Array.isArray(content)
      ? content.filter((block): block is EvalTextBlock => block.type === 'text').map((block) => block.text).join('\n')
      : content;
    this.transcript.push(this.entry(
      'tool',
      'tool_result',
      redactSensitiveText(transcriptContent, this.secrets),
      toolUse.name,
      relativePath
    ));
    return { type: 'tool_result', tool_use_id: toolUse.id, content };
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function prepareEvalProject(outputRoot: string, fixtureRoot: string): Promise<{
  projectRoot: string;
  installedSkillPath: string;
  systemPrompt: string;
}> {
  const projectRoot = path.join(outputRoot, 'project');
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.cp(fixtureRoot, projectRoot, { recursive: true });
  await fs.rm(path.join(projectRoot, 'eval-case.yaml'), { force: true });
  await initCommand(projectRoot, { tools: ['claude'], refreshBootstrap: true });
  const installedSkillPath = path.join(projectRoot, '.claude', 'skills', 'qdd-conclude', 'SKILL.md');
  const systemPrompt = await fs.readFile(installedSkillPath, 'utf-8');
  return { projectRoot, installedSkillPath, systemPrompt };
}

async function snapshotStory(projectRoot: string, outputRoot: string, storyPath: string): Promise<string> {
  const story = await fs.readFile(resolveProjectPath(projectRoot, storyPath), 'utf-8');
  const snapshotPath = path.join(outputRoot, 'snapshots', 'story-before-gate2-revision.md');
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, story, 'utf-8');
  return snapshotPath;
}

async function scanGeneratedTextForSecrets(root: string, explicitSecrets: string[]): Promise<string[]> {
  const violations: string[] = [];
  const files = await listFiles(root, '.');
  for (const relativePath of files) {
    if (!/\.(json|md|ya?ml|txt|csv|tsv)$/i.test(relativePath)) continue;
    const content = await fs.readFile(path.join(root, relativePath), 'utf-8');
    if (containsSecretValue(content, explicitSecrets)) violations.push(relativePath);
  }
  return violations;
}

function evaluateAssertions(
  conversation: EvalConversation,
  evalCase: ConcludeEvalCase,
  paths: EvalPaths,
  installedSkill: string,
  synthesisExists: boolean,
  storyExists: boolean,
  storyBeforeRevision: string,
  storyAfterRevision: string,
  secretViolations: string[]
): ConcludeEvalAssertion[] {
  const accesses = conversation.accessLog;
  const firstEvidenceIndex = accesses.findIndex((entry) => evalCase.evidence_outputs.includes(entry.path));
  const evolutionIndex = accesses.findIndex((entry) => entry.action === 'read' && entry.path === 'evolution.yaml');
  const memoryIndex = accesses.findIndex((entry) => entry.action === 'read' && entry.path.startsWith('context/memory/'));
  const storyWrites = accesses.filter((entry) => entry.action === 'write' && entry.path === paths.story);
  const texWrites = accesses.filter((entry) => entry.action === 'write' && entry.path.includes('/final_paper/'));
  const gateOrder = conversation.gates.map((entry) => `${entry.gate}:${entry.action}`).join(' -> ');
  const visibleStory = storyAfterRevision.replace(/\]\([^)]+\)/g, ']');
  const qddMetadataPattern = /\b(?:project research map|boundary tracking|artifact registr(?:y|ies)|study definitions?|internal study outputs?)\b/i;

  return [
    assertion(
      'production_skill_loaded',
      installedSkill.includes('name: qdd-conclude') && installedSkill.includes('Gate 1: Align Narrative Intent') && installedSkill.includes('Gate 2: Review And Revise The Story'),
      'Harness loaded the qdd init-projected .claude/skills/qdd-conclude/SKILL.md.'
    ),
    assertion(
      'two_gate_order',
      gateOrder === 'gate_1:feedback -> gate_1:accepted -> gate_2:feedback -> gate_2:accepted',
      gateOrder || 'No gate events recorded.'
    ),
    assertion(
      'navigation_before_underlying_evidence',
      firstEvidenceIndex >= 0 && evolutionIndex >= 0 && memoryIndex >= 0 && evolutionIndex < firstEvidenceIndex && memoryIndex < firstEvidenceIndex,
      `evolution=${evolutionIndex}, memory=${memoryIndex}, first required evidence=${firstEvidenceIndex}`
    ),
    assertion(
      'unpromoted_finalized_output_read',
      evalCase.unpromoted_finalized_outputs.every((requiredPath) =>
        accesses.some((entry) => entry.action === 'read' && entry.path === requiredPath)
      ),
      evalCase.unpromoted_finalized_outputs.join(', ')
    ),
    assertion(
      'figure_inspected_multimodally',
      evalCase.figures.every((requiredPath) =>
        accesses.some((entry) => entry.action === 'view_image' && entry.path === requiredPath)
      ),
      evalCase.figures.join(', ')
    ),
    assertion(
      'evidence_outputs_read',
      evalCase.evidence_outputs.every((requiredPath) =>
        accesses.some((entry) => entry.action === 'read' && entry.path === requiredPath)
      ),
      `${evalCase.evidence_outputs.length} required evidence outputs or artifacts`
    ),
    assertion(
      'synthesis_before_story',
      synthesisExists && storyWrites.length >= 2 && storyWrites.every((entry) => entry.stage === 'story_draft' || entry.stage === 'gate2_revision'),
      `synthesis=${synthesisExists}, story write stages=${storyWrites.map((entry) => entry.stage).join(',') || '-'}`
    ),
    assertion(
      'gate2_rewrites_story',
      storyExists && storyBeforeRevision.length > 0 && storyAfterRevision.length > 0 && sha256(storyBeforeRevision) !== sha256(storyAfterRevision),
      `before=${storyBeforeRevision ? sha256(storyBeforeRevision) : '-'}, after=${storyAfterRevision ? sha256(storyAfterRevision) : '-'}`
    ),
    assertion(
      'no_tex_before_gate2_acceptance',
      texWrites.length === 0,
      texWrites.length === 0 ? 'No final_paper write occurred during the two-gate evaluation.' : `${texWrites.length} premature TeX writes.`
    ),
    assertion(
      'credential_values_absent',
      secretViolations.length === 0,
      secretViolations.length === 0 ? 'No credential-shaped values found in generated text.' : secretViolations.join(', ')
    ),
    assertion(
      'qdd_ids_absent_from_story',
      !/(?:\b(?:STUDY|TASK|ART)-\d{3}\b|\bB\d{3}\b)/.test(visibleStory),
      'Visible story content must not expose QDD study, task, artifact, or boundary identifiers.'
    ),
    assertion(
      'qdd_metadata_absent_from_story',
      !qddMetadataPattern.test(visibleStory),
      'Visible story content must not expose QDD research-map, boundary, artifact-registry, or study-definition metadata prose.'
    ),
  ];
}

function assertion(id: string, passed: boolean, detail: string): ConcludeEvalAssertion {
  return { id, status: passed ? 'pass' : 'fail', detail };
}

const REQUIRED_REVIEW_DIMENSIONS = [
  'cross_study_synthesis',
  'contribution_and_results_logic',
  'evidence_and_claim_fidelity',
  'figure_table_integration',
  'gate_feedback_fidelity',
  'manuscript_completeness_and_hygiene',
  'citation_discipline',
  'omission_and_balance',
] as const;

function blockedSemanticReview(summary: string): ConcludeSemanticReview {
  return {
    protocol_version: 1,
    verdict: 'blocked',
    summary,
    dimensions: REQUIRED_REVIEW_DIMENSIONS.map((id) => ({
      id,
      status: 'cannot_assess',
      analysis: summary,
      evidence_paths: [],
    })),
    major_claim_checks: [],
    figure_checks: [],
    findings: [],
  };
}

function validateSemanticReview(raw: Record<string, unknown>, evalCase: ConcludeEvalCase): ConcludeSemanticReview {
  const review = { protocol_version: 1, ...raw } as unknown as ConcludeSemanticReview;
  if (!Array.isArray(review.dimensions)) throw new Error('Semantic review dimensions must be an array.');
  const dimensionIds = new Set(review.dimensions.map((entry) => entry.id));
  const missingDimensions = REQUIRED_REVIEW_DIMENSIONS.filter((id) => !dimensionIds.has(id));
  if (missingDimensions.length > 0) {
    throw new Error(`Semantic review omitted dimensions: ${missingDimensions.join(', ')}`);
  }
  if (dimensionIds.size !== REQUIRED_REVIEW_DIMENSIONS.length || review.dimensions.length !== REQUIRED_REVIEW_DIMENSIONS.length) {
    throw new Error('Semantic review must contain each required dimension exactly once.');
  }
  if (!Array.isArray(review.major_claim_checks) || review.major_claim_checks.length < 2) {
    throw new Error('Semantic review must sample at least two major Results claims.');
  }
  const checkedFigures = new Set(review.figure_checks?.map((entry) => entry.figure_path));
  const missingFigures = evalCase.figures.filter((figurePath) => !checkedFigures.has(figurePath));
  if (missingFigures.length > 0) {
    throw new Error(`Semantic review omitted figures: ${missingFigures.join(', ')}`);
  }
  const hasFailedDimension = review.dimensions.some((entry) => entry.status !== 'pass');
  const hasFailedClaimOrFigure = review.major_claim_checks.some((entry) => entry.status !== 'pass')
    || review.figure_checks.some((entry) => entry.status !== 'pass');
  const hasMaterialFinding = review.findings.some((entry) => entry.severity === 'critical' || entry.severity === 'major');
  const unsupportedFigurePass = review.figure_checks.some((entry) =>
    entry.status === 'pass'
    && /unsupported image|could not (?:be )?(?:rendered|inspected)|cannot (?:be |independently )?(?:render|inspect)/i.test(entry.analysis)
  );
  if (review.verdict === 'accepted' && (hasFailedDimension || hasFailedClaimOrFigure || hasMaterialFinding || unsupportedFigurePass)) {
    throw new Error('Semantic review verdict cannot be accepted with a failed check, material finding, or uninspected figure.');
  }
  return review;
}

class SemanticReviewConversation {
  readonly transcript: ConcludeEvalTranscriptEntry[] = [];
  readonly accessLog: ConcludeEvalAccessEntry[] = [];
  private readonly messages: EvalMessage[] = [];
  private sequence = 0;
  private review: ConcludeSemanticReview | null = null;

  constructor(
    private readonly projectRoot: string,
    private readonly model: EvalModel,
    private readonly secrets: string[],
    private readonly evalCase: ConcludeEvalCase
  ) {}

  async run(initialMessage: string): Promise<ConcludeSemanticReview> {
    this.messages.push({ role: 'user', content: initialMessage });
    this.transcript.push(this.entry('human', 'message', initialMessage));
    for (let call = 0; call < 24; call++) {
      const blocks = await this.model.complete(this.messages, SEMANTIC_REVIEW_SYSTEM_PROMPT, SEMANTIC_REVIEW_TOOLS);
      this.messages.push({ role: 'assistant', content: blocks });
      const results: EvalToolResultBlock[] = [];
      for (const block of blocks) {
        if (block.type === 'text') {
          this.transcript.push(this.entry('assistant', 'message', block.text));
          continue;
        }
        const toolPath = typeof block.input.path === 'string' ? block.input.path : undefined;
        this.transcript.push(this.entry('assistant', 'tool_use', JSON.stringify(block.input), block.name, toolPath));
        results.push(await this.executeTool(block));
      }
      if (this.review) return this.review;
      if (results.length === 0) {
        this.messages.push({
          role: 'user',
          content: 'Continue the evidence review and finish by calling submit_semantic_review. Do not return a prose-only verdict.',
        });
      } else {
        this.messages.push({ role: 'user', content: results });
      }
    }
    throw new Error('Semantic reviewer did not submit a review within 24 model calls.');
  }

  private entry(
    actor: ConcludeEvalTranscriptEntry['actor'],
    kind: ConcludeEvalTranscriptEntry['kind'],
    content: string,
    toolName?: string,
    toolPath?: string
  ): ConcludeEvalTranscriptEntry {
    this.sequence++;
    return {
      sequence: this.sequence,
      timestamp: isoNow(),
      stage: 'semantic_review',
      actor,
      kind,
      content: redactSensitiveText(content, this.secrets),
      tool: toolName,
      path: toolPath,
    };
  }

  private addAccess(action: ConcludeEvalAccessEntry['action'], toolPath: string): void {
    this.accessLog.push({
      sequence: this.accessLog.length + 1,
      timestamp: isoNow(),
      stage: 'semantic_review',
      action,
      path: toolPath,
    });
  }

  private async executeTool(toolUse: EvalToolUseBlock): Promise<EvalToolResultBlock> {
    const relativePath = String(toolUse.input.path ?? '');
    let content: EvalToolResultBlock['content'];
    let isError = false;
    if (toolUse.name === 'read_file') {
      this.addAccess('read', relativePath);
      content = await fs.readFile(resolveProjectPath(this.projectRoot, relativePath), 'utf-8');
    } else if (toolUse.name === 'list_files') {
      this.addAccess('list', relativePath);
      content = (await listFiles(this.projectRoot, relativePath)).join('\n');
    } else if (toolUse.name === 'view_image') {
      this.addAccess('view_image', relativePath);
      const image = await imageForModel(resolveProjectPath(this.projectRoot, relativePath));
      content = [image.block, { type: 'text', text: image.summary }];
    } else if (toolUse.name === 'submit_semantic_review') {
      try {
        const requiredReads = [
          ...this.evalCase.evidence_outputs,
          ...this.evalCase.unpromoted_finalized_outputs,
        ];
        const unread = requiredReads.filter((requiredPath) =>
          !this.accessLog.some((entry) => entry.action === 'read' && entry.path === requiredPath)
        );
        const unviewed = this.evalCase.figures.filter((requiredPath) =>
          !this.accessLog.some((entry) => entry.action === 'view_image' && entry.path === requiredPath)
        );
        if (unread.length > 0 || unviewed.length > 0) {
          throw new Error(`Semantic reviewer skipped required evidence: ${[...unread, ...unviewed].join(', ')}`);
        }
        this.review = validateSemanticReview(toolUse.input, this.evalCase);
        content = 'Semantic review accepted by the protocol validator.';
      } catch (error) {
        isError = true;
        content = `Semantic review submission rejected: ${(error as Error).message} Correct the review and call submit_semantic_review again.`;
      }
    } else {
      throw new Error(`Unsupported semantic review tool: ${toolUse.name}`);
    }

    const transcriptContent = Array.isArray(content)
      ? content.filter((block): block is EvalTextBlock => block.type === 'text').map((block) => block.text).join('\n')
      : content;
    this.transcript.push(this.entry('tool', 'tool_result', transcriptContent, toolUse.name, relativePath || undefined));
    return { type: 'tool_result', tool_use_id: toolUse.id, content, ...(isError ? { is_error: true } : {}) };
  }
}

const SEMANTIC_REVIEW_SYSTEM_PROMPT = `You are an independent scientific manuscript reviewer evaluating a QDD conclude run.

This is a semantic protocol, not a scoring rubric. Never produce a numeric score or average. Inspect the actual research_synthesis.md, final story.md, underlying reports and tables, and every relevant rendered figure before judging them. Sample at least two major Results claims and trace each to the source paths you personally read.

Apply a strict source-bound standard. Exact numeric transcription is not enough when the manuscript invents an analysis, experimental detail, method, visual element, or strength of inference around that value. Treat each of the following as a major finding requiring revision:
- statistical significance, equivalence, indistinguishability, reproducibility, or sufficiency language without the corresponding source analysis;
- causal or necessity language such as determines, requires, explains, drives, or mechanistically gates when sources only show observational association, adjacency, or counterexamples;
- design or Methods details, specimen count or identity, measurement independence, matching, controls, assays, or availability statements absent from inspected sources, regardless of which manuscript section contains them;
- a caption or callout for a panel, plot, label, encoding, or visual pattern that is not present in the directly viewed image. A report, filename, or table cannot substitute for comparing the actual image structure to the manuscript;
- a complete citation or bibliography entry that you cannot verify against supplied literature evidence. Familiarity with a plausible publication is not verification. If no literature source or search tool is available, precise citation-needed anchors are acceptable but unsupported full citations are not.
- a literature-dependent statement with neither a verified supporting citation nor an explicit citation-needed location.
- a QDD study, task, artifact identifier, status, checklist, internal path, or provenance statement exposed anywhere in visible manuscript content, including Methods and availability statements.
- an ambiguous baseline for a difference or recovery claim, or prose that merges measurements from separate studies/runs into one continuous experiment without source support.

Apply the source-fidelity, claim-strength, and figure rules to both research_synthesis.md and story.md. An unsupported inference or invented figure interpretation in the synthesis is a review failure even if the final story omits it. QDD identifiers remain appropriate navigation aids in the internal research synthesis; manuscript-hygiene restrictions apply to story.md.

Judge all eight dimensions independently:
1. cross_study_synthesis: whether the synthesis answers what the project established across studies, including support, refinement, redirection, or conflict, rather than dumping evidence or replaying execution order.
2. contribution_and_results_logic: whether one worthwhile contribution drives a continuous question-to-answer Results argument.
3. evidence_and_claim_fidelity: whether values, statistical language, methods, scope, causal strength, and major claims match inspected outputs, including relevant finalized unpromoted outputs; fabricated or materially distorted evidence fails.
4. figure_table_integration: whether figures/tables do argumentative work and their captions, callouts, panel structure, manuscript statements, and directly viewed content agree. If an image is unsupported, unrenderable, or unclear, retry view_image; if it remains unavailable, use cannot_assess and require revision. Case-specific focus, reports, captions, and tables never substitute for direct image inspection.
5. gate_feedback_fidelity: whether Gate 1 and Gate 2 editorial feedback materially changed the contribution, emphasis, and organization without mechanical candidate selection.
6. manuscript_completeness_and_hygiene: whether story.md is readable manuscript content with title, abstract, introduction, Results, discussion, methods, integrated figure/table captions, and no QDD IDs, internal paths, status/checklist, metadata, or project-log prose.
7. citation_discipline: whether literature-dependent statements have honest citation locations and every full citation is verifiable from an inspected literature source. Explicit citation-needed anchors are acceptable in this story-stage evaluation when no literature source was supplied.
8. omission_and_balance: whether selection supports a clear positive story without omitting evidence in a way that makes the contribution materially misleading.

Use cannot_assess when evidence is genuinely unavailable. Any fabrication, unsupported analysis or major claim, invented method, unverified full citation, misleading omission, or figure mismatch is a critical or major finding and cannot receive verdict=accepted. A limitation elsewhere in the manuscript does not neutralize an overclaim in the title, abstract, Results, caption, or Methods. Submit the review only through submit_semantic_review.`;

async function runSemanticReview(options: {
  projectRoot: string;
  model: EvalModel;
  secrets: string[];
  evalCase: ConcludeEvalCase;
  paths: EvalPaths;
  conversation: EvalConversation;
  storyBeforeRevision: string;
}): Promise<{ review: ConcludeSemanticReview; transcript: ConcludeEvalTranscriptEntry[]; accessLog: ConcludeEvalAccessEntry[] }> {
  const reviewer = new SemanticReviewConversation(
    options.projectRoot,
    options.model,
    options.secrets,
    options.evalCase
  );
  const review = await reviewer.run([
    `Case: ${options.evalCase.id} - ${options.evalCase.name}`,
    `Research synthesis path: ${options.paths.synthesis}`,
    `Final story path: ${options.paths.story}`,
    `Required evidence outputs and artifacts: ${options.evalCase.evidence_outputs.join(', ')}`,
    `Finalized unpromoted outputs: ${options.evalCase.unpromoted_finalized_outputs.join(', ')}`,
    `Figures requiring direct inspection: ${options.evalCase.figures.join(', ')}`,
    `Case-specific factual risks: ${options.evalCase.reviewer_focus.join(' | ')}`,
    `Gate history: ${JSON.stringify(options.conversation.gates)}`,
    `Behavior transcript: ${JSON.stringify(options.conversation.transcript)}`,
    `Story before Gate 2 revision:\n${options.storyBeforeRevision}`,
    'Independently read the synthesis, final story, all listed evidence outputs and artifacts, and view every listed figure. Then submit the protocol review.',
  ].join('\n\n'));
  return { review, transcript: reviewer.transcript, accessLog: reviewer.accessLog };
}

function reportPaths(outputRoot: string, projectRoot: string, paths: EvalPaths): ConcludeEvalReport['outputs'] {
  return {
    run_root: outputRoot,
    conclusion_dir: path.join(projectRoot, paths.conclusionDir),
    research_synthesis: path.join(projectRoot, paths.synthesis),
    story: path.join(projectRoot, paths.story),
    story_before_gate2_revision: path.join(outputRoot, 'snapshots', 'story-before-gate2-revision.md'),
    transcript: path.join(outputRoot, 'transcript.json'),
    access_log: path.join(outputRoot, 'access-log.json'),
    report_json: path.join(outputRoot, 'report.json'),
    report_markdown: path.join(outputRoot, 'report.md'),
    semantic_review_json: path.join(outputRoot, 'semantic-review.json'),
    semantic_review_transcript: path.join(outputRoot, 'semantic-review-transcript.json'),
    semantic_review_access_log: path.join(outputRoot, 'semantic-review-access-log.json'),
  };
}

function renderReportMarkdown(report: ConcludeEvalReport): string {
  const assertions = report.harness.assertions.map((entry) => `- ${entry.status.toUpperCase()} \`${entry.id}\`: ${entry.detail}`);
  const stageResults = report.stage_results.map((entry) =>
    `- \`${entry.stage}\`: synthesis=${entry.research_synthesis_exists}, story=${entry.story_exists}; ${entry.assistant_message}`
  );
  const dimensions = report.semantic_review.dimensions.map((entry) =>
    `- ${entry.status.toUpperCase()} \`${entry.id}\`: ${entry.analysis} Evidence: ${entry.evidence_paths.length > 0 ? entry.evidence_paths.map((value) => `\`${value}\``).join(', ') : 'none'}`
  );
  const claimChecks = report.semantic_review.major_claim_checks.map((entry) =>
    `- ${entry.status.toUpperCase()} ${entry.claim}: ${entry.analysis} Sources: ${entry.source_paths.map((value) => `\`${value}\``).join(', ') || 'none'}`
  );
  const figureChecks = report.semantic_review.figure_checks.map((entry) =>
    `- ${entry.status.toUpperCase()} \`${entry.figure_path}\`: ${entry.analysis}`
  );
  const findings = report.semantic_review.findings.map((entry) =>
    `- ${entry.severity.toUpperCase()}: ${entry.detail} Evidence: ${entry.evidence_paths.map((value) => `\`${value}\``).join(', ') || 'none'}`
  );
  const blockers = report.environment_blockers.length > 0
    ? report.environment_blockers.map((entry) => `- ${entry}`)
    : ['- None.'];
  return [
    '# QDD Conclude Behavior Evaluation',
    '',
    `- Mode: \`${report.mode}\``,
    `- Overall status: \`${report.status}\``,
    `- Harness: \`${report.harness.status}\``,
    `- Model: \`${report.model}\``,
    `- Provider: \`${report.provider}\``,
    `- Repository commit: \`${report.repository_commit}\``,
    `- Production skill SHA-256: \`${report.production_skill_sha256}\``,
    `- Case: \`${report.case.id}\` (${report.case.name})`,
    `- Case fingerprint SHA-256: \`${report.case.fingerprint_sha256}\``,
    `- Case provenance: ${report.case.provenance.kind}; ${report.case.provenance.source}; ${report.case.provenance.notes}`,
    `- Installed production skill: \`${report.installed_skill_path}\``,
    '',
    '## Harness Assertions',
    '',
    ...assertions,
    '',
    '## Stage Results',
    '',
    ...(stageResults.length > 0 ? stageResults : ['- Not run.']),
    '',
    '## Semantic Review',
    '',
    `- Verdict: \`${report.semantic_review.verdict}\``,
    `- Summary: ${report.semantic_review.summary}`,
    '',
    '### Dimensions',
    '',
    ...dimensions,
    '',
    '### Major Claim Checks',
    '',
    ...(claimChecks.length > 0 ? claimChecks : ['- Not assessed.']),
    '',
    '### Figure Checks',
    '',
    ...(figureChecks.length > 0 ? figureChecks : ['- Not assessed.']),
    '',
    '### Findings',
    '',
    ...(findings.length > 0 ? findings : ['- None.']),
    '',
    'The semantic verdict is separate from harness assertions and is never reduced to a numeric or aggregate score.',
    '',
    '## Environment Blockers',
    '',
    ...blockers,
    '',
    '## Output Paths',
    '',
    `- Transcript: \`${report.outputs.transcript}\``,
    `- Access log: \`${report.outputs.access_log}\``,
    `- Research synthesis: \`${report.outputs.research_synthesis}\``,
    `- Story before Gate 2 revision: \`${report.outputs.story_before_gate2_revision}\``,
    `- Final story: \`${report.outputs.story}\``,
    `- Semantic review JSON: \`${report.outputs.semantic_review_json}\``,
    `- Semantic review transcript: \`${report.outputs.semantic_review_transcript}\``,
    `- Semantic review access log: \`${report.outputs.semantic_review_access_log}\``,
  ].join('\n');
}

async function writeReportArtifacts(
  report: ConcludeEvalReport,
  conversation: EvalConversation | null,
  semanticTranscript: ConcludeEvalTranscriptEntry[] = [],
  semanticAccessLog: ConcludeEvalAccessEntry[] = []
): Promise<void> {
  await fs.mkdir(path.dirname(report.outputs.report_json), { recursive: true });
  await fs.writeFile(report.outputs.transcript, `${JSON.stringify(conversation?.transcript ?? [], null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.access_log, `${JSON.stringify(conversation?.accessLog ?? [], null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.semantic_review_json, `${JSON.stringify(report.semantic_review, null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.semantic_review_transcript, `${JSON.stringify(semanticTranscript, null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.semantic_review_access_log, `${JSON.stringify(semanticAccessLog, null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.report_json, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.report_markdown, `${renderReportMarkdown(report)}\n`, 'utf-8');
}

export async function runConcludeBehaviorEval(options: RunConcludeEvalOptions): Promise<ConcludeEvalReport> {
  const startedAt = isoNow();
  const outputRoot = path.resolve(options.outputRoot);
  const evalCase = await loadConcludeEvalCase(options.casePath);
  const prepared = await prepareEvalProject(outputRoot, evalCase.root);
  const paths: EvalPaths = {
    conclusionDir: `conclusions/${evalCase.definition.run_id}`,
    synthesis: `conclusions/${evalCase.definition.run_id}/research_synthesis.md`,
    story: `conclusions/${evalCase.definition.run_id}/story.md`,
  };
  const modelName = resolveClaudeModel(options.model);
  const provider = options.provider ?? (options.mode === 'fake' ? 'offline-scripted' : 'anthropic-compatible');
  const apiKey = options.mode === 'live'
    ? options.credentialOverride === undefined
      ? resolveClaudeApiKey()
      : options.credentialOverride ?? undefined
    : undefined;
  const outputs = reportPaths(outputRoot, prepared.projectRoot, paths);
  const installedSkill = await fs.readFile(prepared.installedSkillPath, 'utf-8');
  let repositoryCommit = 'unknown';
  try {
    repositoryCommit = (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: packageRoot })).stdout.trim();
  } catch {
    // A source archive can run the harness without Git metadata.
  }

  const reportBase = {
    schema_version: 2 as const,
    mode: options.mode,
    started_at: startedAt,
    model: options.mode === 'fake' ? 'scripted-offline-fake' : modelName,
    provider,
    repository_commit: repositoryCommit,
    production_skill_sha256: sha256(installedSkill),
    case: {
      id: evalCase.definition.id,
      name: evalCase.definition.name,
      fingerprint_sha256: evalCase.fingerprint,
      provenance: evalCase.definition.provenance,
    },
    fixture_path: evalCase.root,
    project_path: prepared.projectRoot,
    installed_skill_path: prepared.installedSkillPath,
    outputs,
  };

  if (options.mode === 'live' && !apiKey) {
    const report: ConcludeEvalReport = {
      ...reportBase,
      status: 'blocked',
      finished_at: isoNow(),
      harness: {
        status: 'NOT_RUN',
        assertions: [{ id: 'live_sdk_session', status: 'not_run', detail: 'Anthropic credential is unavailable.' }],
      },
      semantic_review: blockedSemanticReview('No live behavior was generated because the Anthropic-compatible credential is unavailable.'),
      environment_blockers: [
        'Anthropic SDK credential is missing. Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY, or configure ~/.claude/settings.json.',
      ],
      gates: [],
      stage_results: [],
    };
    await writeReportArtifacts(report, null);
    return report;
  }

  const secrets = apiKey ? [apiKey] : [];
  const behaviorModel: EvalModel = options.mode === 'live'
    ? new AnthropicEvalModel(modelName, apiKey as string)
    : new ScriptedFakeEvalModel(evalCase.definition, paths);
  const conversation = new EvalConversation(prepared.projectRoot, behaviorModel, prepared.systemPrompt, secrets, paths);
  let storySnapshotPath = outputs.story_before_gate2_revision;
  let environmentBlocker: string | null = null;
  let behaviorFailure: string | null = null;

  try {
    conversation.addHumanMessage([
      '在这个版本化 QDD fixture 中执行已安装的 production $qdd-conclude skill。',
      `本次 case 是 ${evalCase.definition.name}，run-id 固定为 ${evalCase.definition.run_id}，输出写入 ${paths.conclusionDir}/。`,
      '先读取 memory/evolution 导航，再核验 underlying study outputs、promoted artifacts、tables，并用 view_image 实际查看相关 figure。',
      '完成 research_synthesis.md 后停在 Gate 1 等待我；不要提前创建 story.md。',
    ].join(' '));
    await conversation.recordStageResult(await conversation.runUntilPause());
    if (!(await exists(outputs.research_synthesis)) || await exists(outputs.story)) {
      throw new Error('Gate 1 precondition failed: synthesis must exist and story.md must not exist.');
    }

    conversation.stage = 'gate1_feedback';
    conversation.addGate('gate_1', 'feedback', evalCase.definition.gates.gate1_feedback);
    await conversation.recordStageResult(await conversation.runUntilPause());
    if (await exists(outputs.story)) {
      throw new Error('Gate 1 feedback was not yet accepted, but story.md already exists.');
    }

    conversation.stage = 'story_draft';
    conversation.addGate('gate_1', 'accepted', evalCase.definition.gates.gate1_acceptance);
    await conversation.recordStageResult(await conversation.runUntilPause());
    if (!(await exists(outputs.story))) {
      throw new Error('Gate 1 was accepted, but the agent did not create story.md.');
    }
    storySnapshotPath = await snapshotStory(prepared.projectRoot, outputRoot, paths.story);

    conversation.stage = 'gate2_revision';
    conversation.addGate('gate_2', 'feedback', evalCase.definition.gates.gate2_feedback);
    await conversation.recordStageResult(await conversation.runUntilPause());
    const storyBeforeAcceptance = await fs.readFile(storySnapshotPath, 'utf-8');
    const revisedStory = await fs.readFile(outputs.story, 'utf-8');
    if (sha256(storyBeforeAcceptance) === sha256(revisedStory)) {
      throw new Error('Gate 2 feedback did not produce an actual story.md revision.');
    }
    conversation.addGate('gate_2', 'accepted', evalCase.definition.gates.gate2_acceptance);
  } catch (error) {
    if (error instanceof LiveSdkError) environmentBlocker = error.message;
    else behaviorFailure = (error as Error).message;
  }

  const synthesisExists = await exists(outputs.research_synthesis);
  const storyExists = await exists(outputs.story);
  const storyBeforeRevision = await exists(storySnapshotPath) ? await fs.readFile(storySnapshotPath, 'utf-8') : '';
  const storyAfterRevision = storyExists ? await fs.readFile(outputs.story, 'utf-8') : '';
  const secretViolations = await scanGeneratedTextForSecrets(outputRoot, secrets);
  const assertions = environmentBlocker
    ? [{ id: 'live_sdk_session', status: 'not_run' as const, detail: environmentBlocker }]
    : [
      assertion(
        'conversation_completed',
        behaviorFailure === null,
        behaviorFailure ?? 'All scripted human turns completed through Gate 2 acceptance.'
      ),
      ...evaluateAssertions(
        conversation,
        evalCase.definition,
        paths,
        installedSkill,
        synthesisExists,
        storyExists,
        storyBeforeRevision,
        storyAfterRevision,
        secretViolations
      ),
    ];
  const harnessPassed = assertions.length > 0 && assertions.every((entry) => entry.status === 'pass');
  let semanticReview = blockedSemanticReview(
    options.mode === 'fake'
      ? 'Offline fake mode validates harness contracts only; scientific manuscript quality requires a live semantic review.'
      : behaviorFailure ?? environmentBlocker ?? 'Behavior harness did not pass, so semantic review was not run.'
  );
  let semanticTranscript: ConcludeEvalTranscriptEntry[] = [];
  let semanticAccessLog: ConcludeEvalAccessEntry[] = [];

  if (options.mode === 'live' && harnessPassed && !environmentBlocker) {
    try {
      const reviewerModel = new AnthropicEvalModel(modelName, apiKey as string);
      const reviewed = await runSemanticReview({
        projectRoot: prepared.projectRoot,
        model: reviewerModel,
        secrets,
        evalCase: evalCase.definition,
        paths,
        conversation,
        storyBeforeRevision,
      });
      semanticReview = reviewed.review;
      semanticTranscript = reviewed.transcript;
      semanticAccessLog = reviewed.accessLog;
    } catch (error) {
      if (error instanceof LiveSdkError) environmentBlocker = error.message;
      else behaviorFailure = `Semantic review failed: ${(error as Error).message}`;
      semanticReview = blockedSemanticReview(behaviorFailure ?? environmentBlocker ?? 'Semantic review failed.');
    }
  }

  const semanticPassed = options.mode === 'fake' || semanticReview.verdict === 'accepted';
  const status: ConcludeEvalStatus = environmentBlocker
    ? (options.mode === 'live' ? 'blocked' : 'failed')
    : harnessPassed && semanticPassed ? 'passed' : 'failed';
  const report: ConcludeEvalReport = {
    ...reportBase,
    status,
    finished_at: isoNow(),
    harness: {
      status: harnessPassed
        ? 'PASS'
        : assertions.some((entry) => entry.status === 'not_run')
          ? 'NOT_RUN'
          : 'FAIL',
      assertions,
    },
    semantic_review: semanticReview,
    environment_blockers: environmentBlocker ? [redactSensitiveText(environmentBlocker, secrets)] : [],
    gates: conversation.gates,
    stage_results: conversation.stageResults,
  };
  await writeReportArtifacts(report, conversation, semanticTranscript, semanticAccessLog);
  return report;
}
