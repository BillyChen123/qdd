import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { initCommand } from '../commands/init.js';
import { getClaudeSettings, resolveClaudeApiKey, resolveClaudeModel } from '../runtime/agent-runner.js';

export type ConcludeEvalMode = 'fake' | 'live';
export type ConcludeEvalStatus = 'passed' | 'failed' | 'blocked';
export type ConcludeEvalStage = 'synthesis' | 'gate1_feedback' | 'story_draft' | 'gate2_revision';

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
  complete(messages: EvalMessage[], systemPrompt: string): Promise<EvalAssistantBlock[]>;
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
  schema_version: 1;
  mode: ConcludeEvalMode;
  status: ConcludeEvalStatus;
  started_at: string;
  finished_at: string;
  model: string;
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
  };
  harness: {
    status: 'PASS' | 'FAIL' | 'NOT_RUN';
    assertions: ConcludeEvalAssertion[];
  };
  semantic_observations: Array<{
    id: string;
    status: 'simulated' | 'review_required' | 'not_run';
    detail: string;
    evidence_paths: string[];
  }>;
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
  credentialOverride?: string | null;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..', '..');
export const CONCLUDE_EVAL_FIXTURE_PATH = path.join(
  packageRoot,
  'src',
  'test',
  'fixtures',
  'conclude',
  'sdk-two-gate'
);

const CONCLUSION_RELATIVE_DIR = 'conclusions/sdk-eval';
const SYNTHESIS_RELATIVE_PATH = `${CONCLUSION_RELATIVE_DIR}/research_synthesis.md`;
const STORY_RELATIVE_PATH = `${CONCLUSION_RELATIVE_DIR}/story.md`;
const UNPROMOTED_REPORT_PATH = 'studies/STUDY-002/output/reports/spatial-validation.md';
const REQUIRED_FIGURE_PATH = 'studies/STUDY-002/output/figures/regional-response.ppm';

const GATE_1_FEEDBACK = [
  'Gate 1 反馈：当前中心叙事不要停留在“发现了一个响应标志物”。',
  '请把贡献改为解释跨区域响应为何受免疫生态位结构限制，并把未提升的空间验证作为关键转折；标志物目录降为背景。',
  '这是编辑意图，不是标准答案正文。请先吸收并说明新的 Results 逻辑，尚未确认前不要创建 story.md。',
].join(' ');

const GATE_1_ACCEPTANCE = [
  'Gate 1 确认通过。',
  '按“发现候选信号 -> 空间验证显示其受生态位限制 -> 跨 study 形成条件性机制解释”的逻辑写完整 story.md。',
].join(' ');

const GATE_2_FEEDBACK = [
  'Gate 2：不接受首版，请实际重写 story.md。',
  '把空间反例提前到 Results 前半段，减少按 study 执行顺序复述；让图像承担机制转折，并在讨论中突出条件性而不是普遍性。',
  '这是修改意图，不提供可直接粘贴的正文。',
].join(' ');

const GATE_2_ACCEPTANCE = 'Gate 2 确认接受修订后的完整 story.md。评测在接受点结束，不在本 issue 中执行 TeX renderer。';

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

function ppmToPng(source: string): Buffer {
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

  const scanlines = Buffer.alloc(height * (1 + width * 3));
  let sourceIndex = 0;
  let targetIndex = 0;
  for (let row = 0; row < height; row++) {
    scanlines[targetIndex++] = 0;
    for (let column = 0; column < width * 3; column++) {
      scanlines[targetIndex++] = Math.round((samples[sourceIndex++] / maxValue) * 255);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function imageForModel(filePath: string): Promise<{ block: EvalImageBlock; summary: string }> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.ppm') {
    const source = await fs.readFile(filePath, 'utf-8');
    const png = ppmToPng(source);
    return {
      block: {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') },
      },
      summary: `multimodal image supplied (${png.length} PNG bytes, sha256=${sha256(png)})`,
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

  async complete(messages: EvalMessage[], systemPrompt: string): Promise<EvalAssistantBlock[]> {
    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8_000,
        system: systemPrompt,
        messages: messages as MessageParam[],
        tools: EVAL_TOOLS,
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

  async complete(): Promise<EvalAssistantBlock[]> {
    this.call++;
    switch (this.call) {
      case 1:
        return [
          tool('read_file', { path: 'evolution.yaml' }),
          tool('read_file', { path: 'context/memory/STUDY-001.md' }),
          tool('read_file', { path: 'context/memory/STUDY-002.md' }),
          tool('read_file', { path: 'contract.yaml' }),
        ];
      case 2:
        return [
          tool('read_file', { path: 'artifacts/index.yaml' }),
          tool('read_file', { path: 'studies/STUDY-001/study.md' }),
          tool('read_file', { path: 'studies/STUDY-001/output/reports/discovery-report.md' }),
          tool('read_file', { path: 'studies/STUDY-001/output/tables/discovery-summary.csv' }),
          tool('read_file', { path: 'studies/STUDY-002/study.md' }),
          tool('read_file', { path: UNPROMOTED_REPORT_PATH }),
          tool('read_file', { path: 'studies/STUDY-002/output/tables/niche-response.tsv' }),
        ];
      case 3:
        return [tool('view_image', { path: REQUIRED_FIGURE_PATH })];
      case 4:
        return [tool('write_file', {
          path: SYNTHESIS_RELATIVE_PATH,
          content: [
            '# Research Synthesis',
            '',
            'The project established that the candidate response program is reproducible but not sufficient on its own.',
            'Discovery linked the program to response, while spatial validation showed that benefit concentrates where immune-rich niches organize the same signal.',
            'The decisive project-level understanding is therefore conditional: tissue ecology constrains whether the program becomes a productive response.',
            '',
            'The promoted discovery report and table support the initial association. The finalized but unpromoted spatial report, niche table, and inspected regional-response figure provide the cross-study refinement.',
          ].join('\n'),
        })];
      case 5:
        return [textBlock('research_synthesis.md 已完成。当前 Gate 1 建议以候选响应程序为主线，并把空间生态位作为限定因素；请给出叙事意图反馈。')];
      case 6:
        return [textBlock('已吸收 Gate 1 反馈：中心贡献改为生态位结构解释跨区域条件性响应，未提升的空间验证提前成为关键转折，标志物目录仅保留为发现入口。等待明确确认，不创建 story.md。')];
      case 7:
        return [tool('write_file', {
          path: STORY_RELATIVE_PATH,
          content: [
            '# Spatial niches condition a reproducible response program',
            '',
            '## Abstract',
            'A discovery cohort identified a reproducible response program, and spatial validation showed that the program predicts benefit only inside immune-rich tissue niches.',
            '',
            '## Results',
            'Discovery first established the candidate program. A second finalized study then showed regional heterogeneity, refining the association into a conditional ecological model.',
            '',
            '![Regional response](../../studies/STUDY-002/output/figures/regional-response.ppm)',
            '',
            '## Discussion',
            'The combined studies argue that niche organization, rather than marker abundance alone, determines productive response.',
          ].join('\n'),
        })];
      case 8:
        return [textBlock('首版完整 story.md 已写入并提交 Gate 2 审阅。')];
      case 9:
        return [tool('write_file', {
          path: STORY_RELATIVE_PATH,
          content: [
            '# Tissue ecology gates an otherwise reproducible response program',
            '',
            '## Abstract',
            'Spatially discordant regions reveal that a reproducible response program becomes beneficial only when immune-rich niches organize it into a productive tissue response.',
            '',
            '## Results',
            'Regional counterexamples immediately challenged a marker-only explanation: signal-high immune-poor regions remained non-responsive. The inspected regional-response image localized benefit to organized immune-rich neighborhoods. Discovery evidence then established that the underlying program was reproducible across the initial cohort, linking a robust signal to the ecological condition that makes it effective.',
            '',
            '![Regional response](../../studies/STUDY-002/output/figures/regional-response.ppm)',
            '',
            '## Discussion',
            'Together, the studies support a conditional mechanism. The response program is not universally protective; tissue niche architecture determines when it can organize productive immunity.',
          ].join('\n'),
        })];
      case 10:
        return [textBlock('已按 Gate 2 反馈重写：空间反例前置，图像承担机制转折，讨论改为条件性解释。请审阅修订版。')];
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
    private readonly secrets: string[]
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
      research_synthesis_exists: await exists(resolveProjectPath(this.projectRoot, SYNTHESIS_RELATIVE_PATH)),
      story_exists: await exists(resolveProjectPath(this.projectRoot, STORY_RELATIVE_PATH)),
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

async function prepareEvalProject(outputRoot: string): Promise<{
  projectRoot: string;
  installedSkillPath: string;
  systemPrompt: string;
}> {
  const projectRoot = path.join(outputRoot, 'project');
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.cp(CONCLUDE_EVAL_FIXTURE_PATH, projectRoot, { recursive: true });
  await initCommand(projectRoot, { tools: ['claude'], refreshBootstrap: true });
  const installedSkillPath = path.join(projectRoot, '.claude', 'skills', 'qdd-conclude', 'SKILL.md');
  const systemPrompt = await fs.readFile(installedSkillPath, 'utf-8');
  return { projectRoot, installedSkillPath, systemPrompt };
}

async function snapshotStory(projectRoot: string, outputRoot: string): Promise<string> {
  const story = await fs.readFile(resolveProjectPath(projectRoot, STORY_RELATIVE_PATH), 'utf-8');
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
  installedSkill: string,
  synthesisExists: boolean,
  storyExists: boolean,
  storyBeforeRevision: string,
  storyAfterRevision: string,
  secretViolations: string[]
): ConcludeEvalAssertion[] {
  const accesses = conversation.accessLog;
  const firstEvidenceIndex = accesses.findIndex((entry) => /^studies\/STUDY-\d{3}\/output\//.test(entry.path));
  const evolutionIndex = accesses.findIndex((entry) => entry.action === 'read' && entry.path === 'evolution.yaml');
  const memoryIndex = accesses.findIndex((entry) => entry.action === 'read' && entry.path.startsWith('context/memory/'));
  const storyWrites = accesses.filter((entry) => entry.action === 'write' && entry.path === STORY_RELATIVE_PATH);
  const texWrites = accesses.filter((entry) => entry.action === 'write' && entry.path.includes('/final_paper/'));
  const gateOrder = conversation.gates.map((entry) => `${entry.gate}:${entry.action}`).join(' -> ');

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
      `evolution=${evolutionIndex}, memory=${memoryIndex}, first underlying output=${firstEvidenceIndex}`
    ),
    assertion(
      'unpromoted_finalized_output_read',
      accesses.some((entry) => entry.action === 'read' && entry.path === UNPROMOTED_REPORT_PATH),
      UNPROMOTED_REPORT_PATH
    ),
    assertion(
      'figure_inspected_multimodally',
      accesses.some((entry) => entry.action === 'view_image' && entry.path === REQUIRED_FIGURE_PATH),
      REQUIRED_FIGURE_PATH
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
  ];
}

function assertion(id: string, passed: boolean, detail: string): ConcludeEvalAssertion {
  return { id, status: passed ? 'pass' : 'fail', detail };
}

function reportPaths(outputRoot: string, projectRoot: string): ConcludeEvalReport['outputs'] {
  return {
    run_root: outputRoot,
    conclusion_dir: path.join(projectRoot, CONCLUSION_RELATIVE_DIR),
    research_synthesis: path.join(projectRoot, SYNTHESIS_RELATIVE_PATH),
    story: path.join(projectRoot, STORY_RELATIVE_PATH),
    story_before_gate2_revision: path.join(outputRoot, 'snapshots', 'story-before-gate2-revision.md'),
    transcript: path.join(outputRoot, 'transcript.json'),
    access_log: path.join(outputRoot, 'access-log.json'),
    report_json: path.join(outputRoot, 'report.json'),
    report_markdown: path.join(outputRoot, 'report.md'),
  };
}

function renderReportMarkdown(report: ConcludeEvalReport): string {
  const assertions = report.harness.assertions.map((entry) => `- ${entry.status.toUpperCase()} \`${entry.id}\`: ${entry.detail}`);
  const stageResults = report.stage_results.map((entry) =>
    `- \`${entry.stage}\`: synthesis=${entry.research_synthesis_exists}, story=${entry.story_exists}; ${entry.assistant_message}`
  );
  const observations = report.semantic_observations.map((entry) => `- ${entry.status.toUpperCase()} \`${entry.id}\`: ${entry.detail}`);
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
    '## Semantic Observations',
    '',
    ...observations,
    '',
    'Semantic observations are intentionally separate from harness PASS. File existence, hashes, and keyword counts are not manuscript-quality oracles.',
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
  ].join('\n');
}

async function writeReportArtifacts(
  report: ConcludeEvalReport,
  conversation: EvalConversation | null
): Promise<void> {
  await fs.mkdir(path.dirname(report.outputs.report_json), { recursive: true });
  await fs.writeFile(report.outputs.transcript, `${JSON.stringify(conversation?.transcript ?? [], null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.access_log, `${JSON.stringify(conversation?.accessLog ?? [], null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.report_json, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  await fs.writeFile(report.outputs.report_markdown, `${renderReportMarkdown(report)}\n`, 'utf-8');
}

export async function runConcludeBehaviorEval(options: RunConcludeEvalOptions): Promise<ConcludeEvalReport> {
  const startedAt = isoNow();
  const outputRoot = path.resolve(options.outputRoot);
  const prepared = await prepareEvalProject(outputRoot);
  const modelName = resolveClaudeModel(options.model);
  const apiKey = options.mode === 'live'
    ? options.credentialOverride === undefined
      ? resolveClaudeApiKey()
      : options.credentialOverride ?? undefined
    : undefined;
  const outputs = reportPaths(outputRoot, prepared.projectRoot);

  if (options.mode === 'live' && !apiKey) {
    const report: ConcludeEvalReport = {
      schema_version: 1,
      mode: options.mode,
      status: 'blocked',
      started_at: startedAt,
      finished_at: isoNow(),
      model: modelName,
      fixture_path: CONCLUDE_EVAL_FIXTURE_PATH,
      project_path: prepared.projectRoot,
      installed_skill_path: prepared.installedSkillPath,
      outputs,
      harness: {
        status: 'NOT_RUN',
        assertions: [{ id: 'live_sdk_session', status: 'not_run', detail: 'Anthropic credential is unavailable.' }],
      },
      semantic_observations: [{
        id: 'gate_feedback_effects',
        status: 'not_run',
        detail: 'No live behavior was generated, so semantic review is unavailable.',
        evidence_paths: [],
      }],
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
  const model: EvalModel = options.mode === 'live'
    ? new AnthropicEvalModel(modelName, apiKey as string)
    : new ScriptedFakeEvalModel();
  const conversation = new EvalConversation(prepared.projectRoot, model, prepared.systemPrompt, secrets);
  let storySnapshotPath = outputs.story_before_gate2_revision;
  let environmentBlocker: string | null = null;
  let behaviorFailure: string | null = null;

  try {
    conversation.addHumanMessage([
      '在这个版本化 QDD fixture 中执行已安装的 production $qdd-conclude skill。',
      `本次 run-id 固定为 sdk-eval，输出写入 ${CONCLUSION_RELATIVE_DIR}/。`,
      '先读取 memory/evolution 导航，再核验 underlying study outputs、promoted artifacts、tables，并用 view_image 实际查看相关 figure。',
      '完成 research_synthesis.md 后停在 Gate 1 等待我；不要提前创建 story.md。',
    ].join(' '));
    await conversation.recordStageResult(await conversation.runUntilPause());
    if (!(await exists(outputs.research_synthesis)) || await exists(outputs.story)) {
      throw new Error('Gate 1 precondition failed: synthesis must exist and story.md must not exist.');
    }

    conversation.stage = 'gate1_feedback';
    conversation.addGate('gate_1', 'feedback', GATE_1_FEEDBACK);
    await conversation.recordStageResult(await conversation.runUntilPause());
    if (await exists(outputs.story)) {
      throw new Error('Gate 1 feedback was not yet accepted, but story.md already exists.');
    }

    conversation.stage = 'story_draft';
    conversation.addGate('gate_1', 'accepted', GATE_1_ACCEPTANCE);
    await conversation.recordStageResult(await conversation.runUntilPause());
    if (!(await exists(outputs.story))) {
      throw new Error('Gate 1 was accepted, but the agent did not create story.md.');
    }
    storySnapshotPath = await snapshotStory(prepared.projectRoot, outputRoot);

    conversation.stage = 'gate2_revision';
    conversation.addGate('gate_2', 'feedback', GATE_2_FEEDBACK);
    await conversation.recordStageResult(await conversation.runUntilPause());
    const storyBeforeAcceptance = await fs.readFile(storySnapshotPath, 'utf-8');
    const revisedStory = await fs.readFile(outputs.story, 'utf-8');
    if (sha256(storyBeforeAcceptance) === sha256(revisedStory)) {
      throw new Error('Gate 2 feedback did not produce an actual story.md revision.');
    }
    conversation.addGate('gate_2', 'accepted', GATE_2_ACCEPTANCE);
  } catch (error) {
    if (error instanceof LiveSdkError) environmentBlocker = error.message;
    else behaviorFailure = (error as Error).message;
  }

  const synthesisExists = await exists(outputs.research_synthesis);
  const storyExists = await exists(outputs.story);
  const storyBeforeRevision = await exists(storySnapshotPath) ? await fs.readFile(storySnapshotPath, 'utf-8') : '';
  const storyAfterRevision = storyExists ? await fs.readFile(outputs.story, 'utf-8') : '';
  const secretViolations = await scanGeneratedTextForSecrets(outputRoot, secrets);
  const installedSkill = await fs.readFile(prepared.installedSkillPath, 'utf-8');
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
        installedSkill,
        synthesisExists,
        storyExists,
        storyBeforeRevision,
        storyAfterRevision,
        secretViolations
      ),
    ];
  const harnessPassed = assertions.length > 0 && assertions.every((entry) => entry.status === 'pass');
  const status: ConcludeEvalStatus = environmentBlocker
    ? (options.mode === 'live' ? 'blocked' : 'failed')
    : harnessPassed ? 'passed' : 'failed';
  const report: ConcludeEvalReport = {
    schema_version: 1,
    mode: options.mode,
    status,
    started_at: startedAt,
    finished_at: isoNow(),
    model: options.mode === 'fake' ? 'scripted-offline-fake' : modelName,
    fixture_path: CONCLUDE_EVAL_FIXTURE_PATH,
    project_path: prepared.projectRoot,
    installed_skill_path: prepared.installedSkillPath,
    outputs,
    harness: {
      status: environmentBlocker ? 'NOT_RUN' : harnessPassed ? 'PASS' : 'FAIL',
      assertions,
    },
    semantic_observations: environmentBlocker ? [{
      id: 'gate_feedback_effects',
      status: 'not_run',
      detail: 'The SDK conversation did not complete, so semantic behavior remains unreviewed.',
      evidence_paths: [],
    }] : [
      {
        id: 'gate1_feedback_effect',
        status: options.mode === 'fake' ? 'simulated' : 'review_required',
        detail: 'Review the Gate 1 feedback and assistant alignment response in the transcript against the final story central narrative and Results logic.',
        evidence_paths: [outputs.transcript, outputs.story],
      },
      {
        id: 'gate2_feedback_effect',
        status: options.mode === 'fake' ? 'simulated' : 'review_required',
        detail: 'Review the before/after story snapshots for actual prose, emphasis, and organization changes; the harness only proves that content changed.',
        evidence_paths: [outputs.story_before_gate2_revision, outputs.story],
      },
    ],
    environment_blockers: environmentBlocker ? [redactSensitiveText(environmentBlocker, secrets)] : [],
    gates: conversation.gates,
    stage_results: conversation.stageResults,
  };
  await writeReportArtifacts(report, conversation);
  return report;
}
