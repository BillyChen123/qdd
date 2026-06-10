import * as fs from 'node:fs';
import path from 'node:path';
import type { AgentToolCall } from '../runtime/agent-runner.js';
import type { AutoPhaseStartEvent, AutoResult, AutoRunEvents, AutoRunStartEvent, AutoStopCode } from '../runtime/orchestrator.js';

const COMPLETION_MARKER = 'WORKFLOW_COMPLETE';
const MARKER_TAIL_LENGTH = COMPLETION_MARKER.length + 16;
const SYNC_START = '\x1b[?2026h';
const SYNC_END = '\x1b[?2026l';

interface OutputStream {
  columns?: number;
  isTTY?: boolean;
  write(chunk: string): boolean;
}

export interface AutoConsoleRendererOptions {
  stdout?: OutputStream;
  color?: boolean;
  verbose?: boolean;
}

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function compact(value: string, maxLength = 140): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function stripCompletionMarker(value: string): string {
  return value.replace(new RegExp(`(?:\\r?\\n)?\\s*${COMPLETION_MARKER}\\s*$`, 'i'), '');
}

function maxTurnsLabel(value: number | null): string {
  return value === null ? 'unlimited' : String(value);
}

function terminalTone(code: AutoStopCode): 'green' | 'yellow' | 'red' {
  if (code === 'terminal_state') return 'green';
  if (code === 'max_iterations') return 'yellow';
  return 'red';
}

function isToolFailure(result: string): boolean {
  return result.startsWith('Error') || result.includes('[exit code:') || result.includes('[killed by timeout]');
}

function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export class AutoConsoleRenderer {
  readonly events: AutoRunEvents;

  private readonly stdout: OutputStream;
  private readonly useColor: boolean;
  private readonly useSpinner: boolean;
  private readonly verbose: boolean;
  private headerPrinted = false;
  private phaseCount = 0;
  private textBuffer = '';
  private assistantAtLineStart = true;
  private assistantWrote = false;
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private spinnerFrameIndex = 0;
  private spinnerText = '';
  private currentCompactAction = '';
  private modelPreviewBuffer = '';
  private lastModelNote = '';
  private phaseFailures = 0;
  private phaseWrites = 0;
  private logPath: string | null = null;
  private projectRoot: string | null = null;

  constructor(options: AutoConsoleRendererOptions = {}) {
    this.stdout = options.stdout ?? process.stdout;
    this.useColor = options.color ?? Boolean(this.stdout.isTTY && !process.env.NO_COLOR);
    this.useSpinner = Boolean(this.stdout.isTTY);
    this.verbose = options.verbose ?? false;
    this.events = {
      runStart: (event) => this.runStart(event),
      initialState: (event) => {
        this.logLine(`initial state: ${event.summary}`);
        if (this.verbose) this.line(this.dim(`initial  ${event.summary}`));
      },
      phaseStart: (event) => this.phaseStart(event),
      dryRunPhase: (event) => {
        this.logLine(`dry-run system prompt: ${event.systemPrompt}`);
        this.line(`  ${this.yellow('dry-run')} ${this.dim('system prompt')} ${event.systemPrompt}`);
      },
      studyScaffold: (event) => {
        this.logLine(`study scaffold: requested=${event.requested} created=${event.created}`);
        this.compactAction(`created study scaffold ${event.created}`);
      },
      instructions: (event) => {
        this.logLine(`instructions: role=${event.role} read=${event.readCount} write=${event.writeCount} skills=${event.requiredSkillCount}`);
        if (this.verbose) {
          this.line(this.dim(`  context read=${event.readCount} write=${event.writeCount} skills=${event.requiredSkillCount}`));
        }
      },
      phaseResult: (event) => this.phaseResult(event.result),
      stateAfterPhase: (event) => {
        this.logLine(`state after phase: ${event.summary}`);
        if (this.verbose) this.line(this.dim(`  state ${event.summary}`));
      },
      phaseIncomplete: (event) => {
        this.stopSpinner();
        this.logLine(`phase incomplete: ${event.reason}`);
        for (const detail of event.details) this.logLine(`phase incomplete detail: ${detail}`);
        this.line(`${this.red('  phase incomplete')} ${event.reason}`);
        for (const detail of event.details) this.line(this.dim(`    ${detail}`));
      },
      terminal: (event) => this.logLine(`terminal: ${event.code} ${event.reason}`),
      agent: {
        turnStart: (event) => {
          this.endAssistantText();
          this.modelPreviewBuffer = '';
          this.logLine(`turn ${event.turn}`);
          if (this.verbose) this.line(this.dim(`  turn ${event.turn}`));
          this.startSpinner(`thinking turn ${event.turn}`);
        },
        textDelta: (event) => {
          if (this.verbose) {
            this.stopSpinner();
            this.writeAssistantDelta(event.delta);
          } else {
            this.observeModelDelta(event.delta);
          }
        },
        textEnd: (event) => {
          const cleaned = stripCompletionMarker(event.text);
          this.logBlock(`assistant text turn ${event.turn}`, cleaned);
          if (this.verbose) {
            this.endAssistantText();
          } else {
            this.stopSpinner();
            this.modelPreviewBuffer = '';
            this.modelNote(cleaned);
          }
        },
        toolUse: (event) => {
          this.endAssistantText();
          this.stopSpinner();
          this.logLine(`tool use: ${event.tool.name} ${JSON.stringify(event.tool.input)}`);
          if (this.verbose) {
            this.line(`  ${this.cyan('tool')} ${this.describeTool(event.tool)}`);
          } else {
            this.compactAction(this.describeCompactAction(event.tool));
          }
          this.startSpinner(`running ${event.tool.name}`);
        },
        toolResult: (event) => {
          const failed = isToolFailure(event.result);
          if (event.tool.name === 'write' && !failed) this.phaseWrites++;
          if (failed) this.phaseFailures++;
          this.logBlock(`tool result: ${event.tool.name} ${failed ? 'failed' : 'ok'}`, event.result);
          const status = failed ? this.red('failed') : this.green('ok');
          if (this.verbose || failed) {
            this.stopSpinner(`    ${status} ${this.describeToolResult(event.tool, event.result)}`);
          } else {
            this.stopSpinner();
          }
        },
        completionMarkerMissing: (event) => {
          this.stopSpinner();
          this.logLine(`completion marker missing: ${event.attempt}/${event.maxAttempts}`);
          this.line(this.yellow(`  waiting for completion marker ${event.attempt}/${event.maxAttempts}`));
        },
      },
    };
  }

  finish(result: AutoResult): void {
    this.stopSpinner();
    this.endAssistantText();
    if (!this.headerPrinted) {
      this.line(`${this.title('qdd auto')} ${this.dim('autonomous research loop')}`);
    }
    this.line('');
    const tone = terminalTone(result.terminalCode);
    this.line(`${this.paint(tone, 'result')} ${result.terminalCode}`);
    this.field('reason', result.terminalReason);
    this.field('phases', String(result.iterations));
    this.field('studies', `${result.studiesCompleted} closed`);
    this.field('final', result.finalPhase);
    if (this.logPath) this.field('log', this.relativeLogPath());
    this.field('next', result.terminalCode === 'terminal_state' ? 'qdd status --json' : 'inspect log, then qdd status --json');
  }

  private runStart(event: AutoRunStartEvent): void {
    this.projectRoot = event.projectRoot;
    this.openLog(event.projectRoot);
    this.logLine(`qdd auto start project=${event.projectRoot}`);
    this.logLine(`model=${event.model} maxIterations=${event.maxIterations} maxTurns=${maxTurnsLabel(event.maxTurnsPerAgent)} dryRun=${event.dryRun}`);
    if (event.prompt?.trim()) this.logBlock('prompt', event.prompt);
    this.headerPrinted = true;
    this.line(`${this.title('qdd auto')} ${this.dim('autonomous research loop')}`);
    this.field('project', event.projectRoot);
    this.field('model', event.model);
    this.field('limits', `${event.maxIterations} phases, ${maxTurnsLabel(event.maxTurnsPerAgent)} turns/session`);
    this.field('mode', event.dryRun ? 'dry-run' : 'live');
    this.field('start', event.phase ? `${event.phase.phase} ${event.phase.target}` : 'terminal state');
    if (this.logPath) this.field('log', this.relativeLogPath(event.projectRoot));
    if (event.prompt?.trim()) this.field('prompt', compact(event.prompt, 100));
  }

  private phaseStart(event: AutoPhaseStartEvent): void {
    this.stopSpinner();
    this.endAssistantText();
    this.currentCompactAction = '';
    this.modelPreviewBuffer = '';
    this.lastModelNote = '';
    this.phaseFailures = 0;
    this.phaseWrites = 0;
    this.logLine(`phase ${event.iteration}: ${event.phase.command} target=${event.phase.target} role=${event.role}`);
    if (this.headerPrinted || this.phaseCount > 0) this.line('');
    this.phaseCount++;
    this.line(`${this.blue(`[${event.iteration}]`)} ${this.bold(event.label)} ${this.dim(event.phase.target)}`);
    this.line(`${this.dim('  command')} ${this.cyan(event.phase.command)}  ${this.dim('role')} ${this.magenta(event.role)}`);
  }

  private phaseResult(result: AutoResult['phases'][number]['result']): void {
    this.stopSpinner();
    this.endAssistantText();
    this.logLine(`phase result: status=${result.status} turns=${result.turns} tools=${result.toolCalls} failure=${result.failureReason ?? ''}`);
    if (result.finalMessage.trim()) this.logBlock('phase final message', stripCompletionMarker(result.finalMessage));
    const status = result.terminatedNormally ? this.green(result.status) : this.red(result.status);
    const details = [
      `turns=${result.turns}`,
      `tools=${result.toolCalls}`,
      this.phaseWrites > 0 ? `writes=${this.phaseWrites}` : '',
      this.phaseFailures > 0 ? `failures=${this.phaseFailures}` : '',
    ].filter(Boolean).join(' ');
    this.line(`  ${status} ${this.dim(details)}`);
    if (result.failureReason) this.line(this.red(`  failure ${result.failureReason}`));
    if (this.verbose && result.finalMessage.trim()) {
      this.line(this.dim(`  final ${compact(stripCompletionMarker(result.finalMessage), 300)}`));
    }
  }

  private field(label: string, value: string): void {
    const labelText = label.padEnd(8);
    this.line(`${this.dim(labelText)}${this.truncate(value, Math.max(20, this.termWidth() - labelText.length))}`);
  }

  private line(value: string): void {
    this.writeWithSpinnerCleared(`${value}\n`);
  }

  private write(value: string): void {
    this.writeWithSpinnerCleared(value);
  }

  private writeRaw(value: string): void {
    this.stdout.write(value);
  }

  private writeWithSpinnerCleared(value: string): void {
    const shouldRestoreSpinner = this.spinnerTimer !== null;
    if (!shouldRestoreSpinner) {
      this.writeRaw(value);
      return;
    }
    this.writeRaw(`${SYNC_START}\r\x1b[K${value}${this.formatSpinnerFrame()}${SYNC_END}`);
  }

  private writeAssistantDelta(delta: string): void {
    if (!delta) return;
    this.textBuffer += delta;
    if (this.textBuffer.length <= MARKER_TAIL_LENGTH) return;

    const flushLength = this.textBuffer.length - MARKER_TAIL_LENGTH;
    const flushText = this.textBuffer.slice(0, flushLength);
    this.textBuffer = this.textBuffer.slice(flushLength);
    this.writeAssistantText(flushText);
  }

  private observeModelDelta(delta: string): void {
    if (!delta) return;
    this.modelPreviewBuffer += delta;
    const note = this.extractModelNote(this.modelPreviewBuffer);
    if (note) this.updateSpinner(`thinking ${note}`);
  }

  private modelNote(text: string): void {
    const note = this.extractModelNote(text);
    if (!note || note === this.lastModelNote) return;
    this.lastModelNote = note;
    this.line(`  ${this.magenta('model')} ${this.truncate(note, Math.max(20, this.termWidth() - 10))}`);
  }

  private extractModelNote(text: string): string {
    const cleaned = stripCompletionMarker(text)
      .replace(/\r\n/g, '\n')
      .replace(/```[\s\S]*?```/g, ' ');
    const line = cleaned
      .split('\n')
      .map((entry) => entry.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s+/, '').trim())
      .find((entry) => entry.length > 0 && !/^WORKFLOW_COMPLETE$/i.test(entry));
    return line ? compact(line, 160) : '';
  }

  private endAssistantText(): void {
    if (this.textBuffer) {
      const cleaned = stripCompletionMarker(this.textBuffer);
      this.textBuffer = '';
      this.writeAssistantText(cleaned);
    }
    if (this.assistantWrote && !this.assistantAtLineStart) this.write('\n');
    this.assistantAtLineStart = true;
    this.assistantWrote = false;
  }

  private writeAssistantText(value: string): void {
    const text = value.replace(/\r\n/g, '\n');
    if (!text) return;

    let start = 0;
    for (let index = 0; index < text.length; index++) {
      if (text[index] !== '\n') continue;
      this.writeAssistantSegment(text.slice(start, index));
      this.write('\n');
      this.assistantAtLineStart = true;
      start = index + 1;
    }
    if (start < text.length) this.writeAssistantSegment(text.slice(start));
  }

  private writeAssistantSegment(value: string): void {
    if (!value) return;
    if (this.assistantAtLineStart) {
      this.write(this.dim('  | '));
      this.assistantAtLineStart = false;
    }
    this.assistantWrote = true;
    this.write(value);
  }

  private describeTool(tool: AgentToolCall): string {
    if (tool.name === 'bash') {
      return `$ ${compact(String(tool.input.command ?? ''), 160)}`;
    }
    if (tool.name === 'read') {
      return `read ${String(tool.input.path ?? '')}`;
    }
    if (tool.name === 'write') {
      const content = String(tool.input.content ?? '');
      return `write ${String(tool.input.path ?? '')} (${content.length} chars)`;
    }
    return `${tool.name} ${compact(JSON.stringify(tool.input), 120)}`;
  }

  private describeToolResult(tool: AgentToolCall, result: string): string {
    if (isToolFailure(result)) return `${this.describeTool(tool)} :: ${this.describeFailure(tool, result)}`;
    if (tool.name === 'read') return `read ${String(tool.input.path ?? '')} (${result.length} chars)`;
    if (tool.name === 'write') return compact(result, 180);
    return compact(result, this.verbose ? 500 : 180) || 'no output';
  }

  private describeCompactAction(tool: AgentToolCall): string {
    if (tool.name === 'read') {
      const targetPath = String(tool.input.path ?? '');
      if (targetPath.startsWith('.qdd/examples/')) return 'reading QDD examples';
      if (targetPath.includes('skills-catalog')) return 'reading skills catalog';
      if (targetPath.startsWith('/')) return 'reading external files';
      return 'reading project state';
    }
    if (tool.name === 'write') return 'updating project files';
    if (tool.name === 'bash') {
      const command = String(tool.input.command ?? '');
      if (/^\s*qdd\s+(status|instructions|validate)\b/.test(command)) return 'checking QDD state';
      if (command.includes('/benchmark/') || command.includes('/data/')) return 'inspecting benchmark files';
      if (/\bpython\b/.test(command)) return 'running analysis command';
      return 'running shell command';
    }
    return `using ${tool.name}`;
  }

  private compactAction(action: string): void {
    if (this.verbose || action === this.currentCompactAction) return;
    this.currentCompactAction = action;
    this.line(`  ${this.blue('step')} ${this.truncate(action, Math.max(20, this.termWidth() - 7))}`);
  }

  private describeFailure(tool: AgentToolCall, result: string): string {
    if (tool.name === 'read' && result.includes('outside the allowed project/package roots')) {
      return 'blocked outside project/package roots; full error in log';
    }
    return compact(result, this.verbose ? 500 : 220);
  }

  private bold(value: string): string {
    return this.paint('bold', value);
  }

  private title(value: string): string {
    if (!this.useColor) return value;
    return `\x1b[1;36m${value}${ansi.reset}`;
  }

  private dim(value: string): string {
    return this.paint('dim', value);
  }

  private blue(value: string): string {
    return this.paint('blue', value);
  }

  private cyan(value: string): string {
    return this.paint('cyan', value);
  }

  private magenta(value: string): string {
    return this.paint('magenta', value);
  }

  private green(value: string): string {
    return this.paint('green', value);
  }

  private yellow(value: string): string {
    return this.paint('yellow', value);
  }

  private red(value: string): string {
    return this.paint('red', value);
  }

  private paint(name: keyof typeof ansi, value: string): string {
    if (!this.useColor) return value;
    return `${ansi[name]}${value}${ansi.reset}`;
  }

  private openLog(projectRoot: string): void {
    if (this.logPath) return;
    try {
      const logDir = path.join(projectRoot, '.qdd', 'runs');
      fs.mkdirSync(logDir, { recursive: true });
      this.logPath = path.join(logDir, `auto-${timestampForFile()}.log`);
      fs.writeFileSync(this.logPath, '', 'utf-8');
    } catch {
      this.logPath = null;
    }
  }

  private logLine(value: string): void {
    if (!this.logPath) return;
    fs.appendFileSync(this.logPath, `${new Date().toISOString()} ${value}\n`, 'utf-8');
  }

  private logBlock(title: string, value: string): void {
    if (!this.logPath || !value.trim()) return;
    fs.appendFileSync(
      this.logPath,
      [
        `${new Date().toISOString()} --- ${title} ---`,
        value,
        `${new Date().toISOString()} --- end ${title} ---`,
        '',
      ].join('\n'),
      'utf-8'
    );
  }

  private startSpinner(text: string): void {
    if (!this.useSpinner) return;
    this.spinnerText = this.truncate(text, Math.max(20, this.termWidth() - 6));
    if (this.spinnerTimer !== null) {
      this.renderSpinner();
      return;
    }
    this.spinnerFrameIndex = 0;
    this.spinnerTimer = setInterval(() => this.renderSpinner(), 90);
    this.renderSpinner();
  }

  private updateSpinner(text: string): void {
    if (!this.useSpinner || this.spinnerTimer === null) return;
    this.spinnerText = this.truncate(text, Math.max(20, this.termWidth() - 6));
    this.renderSpinner();
  }

  private stopSpinner(finalLine?: string): void {
    if (this.spinnerTimer !== null) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
      this.writeRaw(`${SYNC_START}\r\x1b[K${finalLine ? `${finalLine}\n` : ''}${SYNC_END}`);
      return;
    }
    if (finalLine) this.line(finalLine);
  }

  private renderSpinner(): void {
    if (this.spinnerTimer === null) return;
    this.writeRaw(`${SYNC_START}${this.formatSpinnerFrame()}${SYNC_END}`);
  }

  private formatSpinnerFrame(): string {
    const frames = ['|', '/', '-', '\\'];
    const frame = frames[this.spinnerFrameIndex % frames.length];
    this.spinnerFrameIndex++;
    return `\r${this.dim(`  ${frame}`)} ${this.spinnerText}\x1b[K`;
  }

  private termWidth(): number {
    return this.stdout.columns && this.stdout.columns > 0 ? this.stdout.columns : 100;
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 3) return value.slice(0, maxLength);
    return `${value.slice(0, maxLength - 3)}...`;
  }

  private relativeLogPath(projectRoot?: string): string {
    if (!this.logPath) return '';
    const root = projectRoot ?? this.projectRoot ?? process.cwd();
    return path.relative(root, this.logPath);
  }
}

export function createAutoConsoleRenderer(options: AutoConsoleRendererOptions = {}): AutoConsoleRenderer {
  return new AutoConsoleRenderer(options);
}
