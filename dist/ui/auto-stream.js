import * as fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getBearArt } from './tui-home-art.js';
const COMPLETION_MARKER = 'WORKFLOW_COMPLETE';
const MARKER_TAIL_LENGTH = COMPLETION_MARKER.length + 16;
const SYNC_START = '\x1b[?2026h';
const SYNC_END = '\x1b[?2026l';
const AUTOWRAP_OFF = '\x1b[?7l';
const AUTOWRAP_ON = '\x1b[?7h';
const INTRO_FRAME_DELAY_MS = 140;
const FOOTER_ROWS = 2;
const RESULT_INLINE_LINE_LIMIT = 2;
const RESULT_INLINE_CHAR_LIMIT = 180;
const LOG_BLOCK_CHAR_LIMIT = 64_000;
const require = createRequire(import.meta.url);
const { version: packageVersion } = require('../../package.json');
const text = {
    en: {
        command: 'command',
        createdStudy: 'Created study scaffold',
        dryRun: 'dry-run',
        final: 'final',
        live: 'live',
        limits: 'limits',
        log: 'log',
        mode: 'mode',
        model: 'model',
        modelEvent: 'Model',
        next: 'next',
        nextInspect: 'inspect log, then qdd status --json',
        phase: 'phase',
        phases: 'phases',
        phaseIncomplete: 'Phase incomplete',
        project: 'project',
        prompt: 'prompt',
        ran: 'Ran',
        read: 'Read',
        reason: 'reason',
        result: 'Result',
        role: 'role',
        start: 'start',
        studies: 'studies',
        studiesClosed: 'closed',
        subtitle: 'autonomous research loop',
        systemPrompt: 'system prompt',
        terminalState: 'terminal state',
        tool: 'Tool',
        waitingCompletion: 'Waiting for completion marker',
        write: 'Write',
    },
    zh: {
        command: '命令',
        createdStudy: '创建研究脚手架',
        dryRun: 'dry-run',
        final: '最终',
        live: 'live',
        limits: '限制',
        log: '日志',
        mode: '模式',
        model: '模型',
        modelEvent: '模型',
        next: '下一步',
        nextInspect: '查看日志，然后运行 qdd status --json',
        phase: '阶段',
        phases: '阶段数',
        phaseIncomplete: '阶段未完成',
        project: '项目',
        prompt: '提示',
        ran: '运行',
        read: '读取',
        reason: '原因',
        result: '结果',
        role: '角色',
        start: '起点',
        studies: '研究',
        studiesClosed: '已关闭',
        subtitle: '自主研究循环',
        systemPrompt: '系统提示',
        terminalState: '终止状态',
        tool: '工具',
        waitingCompletion: '等待完成标记',
        write: '写入',
    },
};
function resolveLocale(value) {
    if (value)
        return value;
    const raw = process.env.QDD_AUTO_LANG ?? process.env.QDD_LANG ?? '';
    return /^zh(?:$|[-_])/i.test(raw) ? 'zh' : 'en';
}
const ansi = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    reverse: '\x1b[7m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    coral: '\x1b[38;5;210m',
    violet: '\x1b[38;5;141m',
    mint: '\x1b[38;5;115m',
};
function phaseAliasForRole(role) {
    if (role === 'study-brain')
        return { alias: 'Study Brain', tone: 'violet' };
    if (role === 'executor')
        return { alias: 'Executor', tone: 'mint' };
    return { alias: 'Thesis Manager', tone: 'cyan' };
}
function phaseIcon(alias) {
    if (alias === 'Study Brain')
        return '🟣';
    if (alias === 'Executor')
        return '🟢';
    return '🔵';
}
function rowPrefix(state) {
    if (state === 'complete')
        return '✔';
    if (state === 'failed')
        return '✖';
    if (state === 'active')
        return '▶';
    return '○';
}
function statusTone(status) {
    if (status === 'EXECUTING' || status === 'COMPLETE')
        return 'mint';
    if (status === 'FAILED')
        return 'coral';
    if (status === 'THINKING')
        return 'violet';
    return 'yellow';
}
function paintValue(name, value, color) {
    if (!color)
        return value;
    return `${ansi[name]}${value}${ansi.reset}`;
}
function visibleLength(value) {
    return value.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').length;
}
function truncateCells(value, maxLength) {
    if (visibleLength(value) <= maxLength)
        return value;
    if (maxLength <= 3)
        return value.slice(0, maxLength);
    const clean = value.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
    return `${clean.slice(0, maxLength - 3)}...`;
}
function padRightCells(value, width) {
    const length = visibleLength(value);
    if (length >= width)
        return value;
    return `${value}${' '.repeat(width - length)}`;
}
function timerLabel(seconds) {
    const bounded = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(bounded / 60);
    const remainder = bounded % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
export function renderAutoConsoleHeader(screen, options = {}) {
    const width = Math.max(60, screen.width);
    const color = options.color ?? false;
    const logo = getBearArt(screen.logoStatus, screen.logoDensity);
    const meta = `v${screen.version}  up ${timerLabel(screen.uptimeSeconds)}  ${screen.globalStatus}`;
    const title = paintValue('bold', 'QDD AUTO', color);
    const subtitle = paintValue('dim', 'modern multi-agent research loop', color);
    const lines = [];
    const contentWidth = width - 2;
    for (let index = 0; index < logo.length; index++) {
        const left = `  ${logo[index] ?? ''}`;
        const right = index === 0
            ? `${title} ${subtitle}`
            : index === 1
                ? paintValue('dim', meta, color)
                : index === 2 && screen.projectRoot
                    ? paintValue('dim', `project ${screen.projectRoot}`, color)
                    : index === 3 && screen.model
                        ? paintValue('dim', `model ${screen.model}  mode ${screen.mode ?? 'live'}`, color)
                        : '';
        lines.push(truncateCells(padRightCells(`${left}  ${right}`, contentWidth), contentWidth));
    }
    lines.push(paintValue('dim', '┄'.repeat(Math.min(width, 120)), color));
    return lines;
}
export function renderAutoConsoleBody(screen, options = {}) {
    const width = Math.max(60, screen.width);
    const color = options.color ?? false;
    const lines = [];
    for (const phase of screen.phases) {
        const title = `${phaseIcon(phase.alias)} [Phase: ${phase.alias}]`;
        lines.push(`  ${paintValue(phase.tone, title, color)} ${paintValue('dim', `${phase.command} ${phase.target}`, color)}`);
        if (phase.rows.length === 0) {
            lines.push(`   └─ ${paintValue('dim', '○ pending', color)}`);
            continue;
        }
        phase.rows.forEach((row, index) => {
            const branch = index === phase.rows.length - 1 ? '└─' : '├─';
            const prefix = rowPrefix(row.state);
            const rowText = row.state === 'complete'
                ? paintValue('dim', `${prefix} ${row.text}`, color)
                : row.state === 'active'
                    ? paintValue('bold', `${prefix} ${row.text}`, color)
                    : row.state === 'failed'
                        ? paintValue('coral', `${prefix} ${row.text}`, color)
                        : `${prefix} ${row.text}`;
            lines.push(truncateCells(`   ${branch} ${rowText}`, width));
            if (row.detail)
                lines.push(truncateCells(`      ⌙ ${paintValue('dim', row.detail, color)}`, width));
        });
        lines.push('');
    }
    return lines;
}
export function renderAutoConsoleFooter(screen, options = {}) {
    const width = Math.max(60, screen.width);
    const writableWidth = Math.max(1, width - 1);
    const color = options.color ?? false;
    const proposeLabel = paintValue('reverse', ' PROPOSE ', color);
    const statusLabel = paintValue('reverse', ` ${screen.actionStatus.padEnd(9)} `, color);
    const status = paintValue(statusTone(screen.actionStatus), screen.actionStatus === 'THINKING' ? '⠹' : '▶', color);
    const propose = truncateCells(`${proposeLabel} ${screen.propose || 'Awaiting current research question...'}`, writableWidth);
    const action = truncateCells(`${statusLabel} ${status} ${screen.action || 'Waiting for next event'} [${timerLabel(screen.timerSeconds)}]`, writableWidth);
    return [
        padRightCells(propose, writableWidth),
        padRightCells(action, writableWidth),
    ];
}
export function renderAutoConsoleFrame(screen, options = {}) {
    return [
        ...renderAutoConsoleHeader(screen, options),
        '',
        ...renderAutoConsoleBody(screen, options),
        paintValue('dim', '┄'.repeat(Math.min(screen.width, 120)), options.color ?? false),
        ...renderAutoConsoleFooter(screen, options),
    ].join('\n');
}
function compact(value, maxLength = 140) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength)
        return normalized;
    return `${normalized.slice(0, maxLength - 3)}...`;
}
function normalizedLines(value) {
    return value
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0);
}
function extractStudyQuestion(value) {
    const frontmatter = value.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatter) {
        const questionLine = frontmatter[1]
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => line.startsWith('question:'));
        if (questionLine) {
            const raw = questionLine.replace(/^question:\s*/, '').trim();
            const quoted = raw.match(/^(['"])([\s\S]*)\1$/);
            return compact(quoted ? quoted[2] : raw, 220);
        }
    }
    const section = value.match(/(?:^|\n)## Question\s*\n+([\s\S]*?)(?=\n## |$)/);
    if (!section)
        return '';
    const question = normalizedLines(section[1]).join(' ');
    return compact(question, 220);
}
function stripCompletionMarker(value) {
    return value.replace(new RegExp(`(?:\\r?\\n)?\\s*${COMPLETION_MARKER}\\s*$`, 'i'), '');
}
function maxTurnsLabel(value) {
    return value === null ? 'unlimited' : String(value);
}
function maxIterationsLabel(value) {
    return value === null ? 'unlimited' : String(value);
}
function terminalTone(code) {
    if (code === 'terminal_state')
        return 'green';
    if (code === 'max_iterations')
        return 'yellow';
    return 'red';
}
function isToolFailure(result) {
    return result.startsWith('Error') || result.includes('[exit code:') || result.includes('[killed by timeout]');
}
function sanitizeLogText(value) {
    return value.replaceAll('\0', '\\0');
}
export function truncateAutoLogBlockForTest(value, limit = LOG_BLOCK_CHAR_LIMIT) {
    const sanitized = sanitizeLogText(value);
    if (sanitized.length <= limit)
        return sanitized;
    const headLength = Math.floor(limit * 0.7);
    const tailLength = limit - headLength;
    const omitted = sanitized.length - headLength - tailLength;
    return [
        `[log block truncated: omitted ${omitted} chars]`,
        sanitized.slice(0, headLength),
        '',
        '[... omitted middle ...]',
        '',
        sanitized.slice(-tailLength),
    ].join('\n');
}
function toolDisplayName(name) {
    if (name === 'bash')
        return 'command';
    return name;
}
function timestampForFile(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}
export class AutoConsoleRenderer {
    events;
    stdout;
    stdin;
    locale;
    useColor;
    useIntro;
    useSpinner;
    useStickyFooter;
    verbose;
    headerPrinted = false;
    phaseCount = 0;
    textBuffer = '';
    assistantAtLineStart = true;
    assistantWrote = false;
    spinnerTimer = null;
    spinnerFrameIndex = 0;
    spinnerRenderedRows = 0;
    spinnerText = '';
    currentCompactAction = '';
    modelPreviewBuffer = '';
    lastModelNote = '';
    phaseFailures = 0;
    phaseWrites = 0;
    logPath = null;
    projectRoot = null;
    runStartedAt = Date.now();
    currentProposal = '';
    currentAction = '';
    actionStatus = 'WAITING';
    globalStatus = 'WAITING';
    runModel = '';
    runMode = 'live';
    activePhaseLabel = '';
    activePhaseCommand = '';
    activePhaseTarget = '';
    activeStudyQuestion = '';
    phaseDisplays = [];
    activePhaseIndex = -1;
    footerActive = false;
    collapsedTranscripts = [];
    transcriptCursor = -1;
    expandedTranscriptIndex = -1;
    transcriptPanelRows = 0;
    keyboardActive = false;
    inputWasRaw = false;
    inputListener = (chunk) => this.handleInput(chunk);
    constructor(options = {}) {
        this.stdout = options.stdout ?? process.stdout;
        this.stdin = options.stdin ?? process.stdin;
        this.locale = resolveLocale(options.locale);
        this.useColor = options.color ?? Boolean(this.stdout.isTTY && !process.env.NO_COLOR);
        this.useSpinner = Boolean(this.stdout.isTTY);
        this.useIntro = options.intro ?? Boolean(this.useSpinner && !process.env.CI && process.env.QDD_AUTO_NO_INTRO !== '1');
        this.useStickyFooter = options.stickyFooter ?? process.env.QDD_AUTO_STICKY_FOOTER === '1';
        this.verbose = options.verbose ?? false;
        this.events = {
            runStart: (event) => this.runStart(event),
            initialState: (event) => {
                this.logLine(`initial state: ${event.summary}`);
                this.currentAction = event.summary;
                this.actionStatus = 'WAITING';
                this.renderStickyFooter();
                if (this.verbose)
                    this.line(this.dim(`initial  ${event.summary}`));
            },
            phaseStart: (event) => this.phaseStart(event),
            dryRunPhase: (event) => {
                this.logLine(`dry-run system prompt: ${event.systemPrompt}`);
                this.addPhaseRow('active', `${this.t('dryRun')} ${this.t('systemPrompt')}`, event.systemPrompt);
                this.line(`${this.bullet()} ${this.yellow(this.t('dryRun'))} ${this.dim(this.t('systemPrompt'))} ${event.systemPrompt}`);
            },
            studyScaffold: (event) => {
                this.logLine(`study scaffold: requested=${event.requested} created=${event.created}`);
                this.currentProposal = event.requested;
                this.compactAction(`${this.t('createdStudy')} ${event.created}`);
            },
            instructions: (event) => {
                this.logLine(`instructions: role=${event.role} read=${event.readCount} write=${event.writeCount} skills=${event.requiredSkillCount}`);
                this.addPhaseRow('complete', `instructions read=${event.readCount} write=${event.writeCount}`, `skills=${event.requiredSkillCount}`);
                if (this.verbose) {
                    this.line(this.dim(`  context read=${event.readCount} write=${event.writeCount} skills=${event.requiredSkillCount}`));
                }
            },
            phaseResult: (event) => this.phaseResult(event.result),
            stateAfterPhase: (event) => {
                this.logLine(`state after phase: ${event.summary}`);
                if (this.verbose)
                    this.line(this.dim(`  state ${event.summary}`));
            },
            phaseIncomplete: (event) => {
                this.stopSpinner();
                this.actionStatus = 'FAILED';
                this.globalStatus = 'FAILED';
                this.addPhaseRow('failed', this.t('phaseIncomplete'), event.reason);
                this.logLine(`phase incomplete: ${event.reason}`);
                for (const detail of event.details)
                    this.logLine(`phase incomplete detail: ${detail}`);
                this.line(`${this.bullet()} ${this.red(this.t('phaseIncomplete'))}`);
                this.line(`  ${this.branch()} ${event.reason}`);
                for (const detail of event.details)
                    this.line(this.dim(`    ${detail}`));
            },
            terminal: (event) => this.logLine(`terminal: ${event.code} ${event.reason}`),
            agent: {
                turnStart: (event) => {
                    this.endAssistantText();
                    this.modelPreviewBuffer = '';
                    this.logLine(`turn ${event.turn}`);
                    if (this.verbose)
                        this.line(this.dim(`  turn ${event.turn}`));
                    this.actionStatus = 'THINKING';
                    this.currentAction = `Brain is modeling the logic chains for turn ${event.turn}`;
                    this.addPhaseRow('active', `[Thinking] turn ${event.turn}`, '正在尝试寻找逻辑链路的最优解...');
                    this.startSpinner(`thinking turn ${event.turn}`);
                },
                textDelta: (event) => {
                    if (this.verbose) {
                        this.stopSpinner();
                        this.writeAssistantDelta(event.delta);
                    }
                    else {
                        this.observeModelDelta(event.delta);
                    }
                },
                textEnd: (event) => {
                    const cleaned = stripCompletionMarker(event.text);
                    this.logBlock(`assistant text turn ${event.turn}`, cleaned);
                    if (this.verbose) {
                        this.endAssistantText();
                    }
                    else {
                        this.stopSpinner();
                        this.modelPreviewBuffer = '';
                        this.modelNote(cleaned);
                    }
                },
                toolUse: (event) => {
                    this.endAssistantText();
                    this.stopSpinner();
                    this.logLine(`tool use: ${event.tool.name} ${JSON.stringify(event.tool.input)}`);
                    this.actionStatus = 'EXECUTING';
                    this.currentAction = this.describeTool(event.tool);
                    if (this.verbose) {
                        this.line(`${this.bullet()} ${this.cyan(this.t('tool'))} ${this.describeTool(event.tool)}`);
                    }
                    else {
                        this.toolStart(event.tool);
                    }
                    this.startSpinner(`running ${event.tool.name}`);
                },
                toolResult: (event) => {
                    const failed = isToolFailure(event.result);
                    if (event.tool.name === 'write' && !failed)
                        this.phaseWrites++;
                    if (failed)
                        this.phaseFailures++;
                    this.logBlock(`tool result: ${event.tool.name} ${failed ? 'failed' : 'ok'}`, event.result);
                    if (!failed)
                        this.captureStudyQuestion(event.tool, event.result);
                    const summary = this.summarizeToolResult(event.tool, event.result, failed);
                    const status = failed ? this.red('failed') : this.green('ok');
                    this.actionStatus = failed ? 'FAILED' : 'WAITING';
                    this.currentAction = summary.headline;
                    this.addPhaseRow(failed ? 'failed' : 'complete', `${failed ? 'failed' : 'completed'} ${toolDisplayName(event.tool.name)}`, summary.detail);
                    this.stopSpinner(`  ${this.branch()} ${status} ${summary.headline}`);
                    if (summary.omittedLines > 0) {
                        this.registerCollapsedTranscript(event.tool, event.result, summary.omittedLines);
                        this.line(this.dim(`    … +${summary.omittedLines} lines (ctrl + t to view transcript)`));
                    }
                    this.compactGap();
                },
                completionMarkerMissing: (event) => {
                    this.stopSpinner();
                    this.actionStatus = 'WAITING';
                    this.currentAction = `${this.t('waitingCompletion')} ${event.attempt}/${event.maxAttempts}`;
                    this.logLine(`completion marker missing: ${event.attempt}/${event.maxAttempts}`);
                    this.line(`${this.bullet()} ${this.yellow(`${this.t('waitingCompletion')} ${event.attempt}/${event.maxAttempts}`)}`);
                },
            },
        };
        this.setupKeyboardShortcuts();
    }
    finish(result) {
        this.stopSpinner();
        this.endAssistantText();
        this.actionStatus = result.terminalCode === 'terminal_state' ? 'COMPLETE' : 'FAILED';
        this.globalStatus = this.actionStatus;
        this.currentAction = result.terminalReason;
        this.renderStickyFooter();
        this.clearStickyFooter();
        if (!this.headerPrinted) {
            this.line(`${this.title('qdd auto')} ${this.dim(this.t('subtitle'))}`);
        }
        this.line('');
        if (this.phaseCount > 0)
            this.separator();
        const tone = terminalTone(result.terminalCode);
        this.line(`${this.bullet()} ${this.paint(tone, this.t('result'))} ${result.terminalCode}`);
        this.field(this.t('reason'), result.terminalReason);
        this.field(this.t('phases'), String(result.iterations));
        this.field(this.t('studies'), `${result.studiesCompleted} ${this.t('studiesClosed')}`);
        this.field(this.t('final'), result.finalPhase);
        if (this.logPath)
            this.field(this.t('log'), this.relativeLogPath());
        this.field(this.t('next'), result.terminalCode === 'terminal_state' ? 'qdd status --json' : this.t('nextInspect'));
        this.restoreKeyboardShortcuts();
    }
    runStart(event) {
        this.projectRoot = event.projectRoot;
        this.runModel = event.model;
        this.runMode = event.dryRun ? this.t('dryRun') : this.t('live');
        this.currentProposal = event.prompt?.trim() || (event.phase ? `${event.phase.phase} ${event.phase.target}` : this.t('terminalState'));
        this.currentAction = event.phase ? `${event.phase.command} ${event.phase.target}` : this.t('terminalState');
        this.actionStatus = 'WAITING';
        this.globalStatus = 'WAITING';
        this.openLog(event.projectRoot);
        this.logLine(`qdd auto start project=${event.projectRoot}`);
        this.logLine(`model=${event.model} maxIterations=${maxIterationsLabel(event.maxIterations)} maxTurns=${maxTurnsLabel(event.maxTurnsPerAgent)} dryRun=${event.dryRun}`);
        if (event.prompt?.trim())
            this.logBlock('prompt', event.prompt);
        this.headerPrinted = true;
        this.playIntroAnimation(event);
        if (this.stdout.isTTY) {
            this.renderModernHeader();
        }
        else {
            this.line(`${this.title('qdd auto')} ${this.dim(this.t('subtitle'))}`);
            this.field(this.t('project'), event.projectRoot);
            this.field(this.t('model'), event.model);
            this.field(this.t('limits'), `${maxIterationsLabel(event.maxIterations)} phases, ${maxTurnsLabel(event.maxTurnsPerAgent)} turns/session`);
            this.field(this.t('mode'), event.dryRun ? this.t('dryRun') : this.t('live'));
            this.field(this.t('start'), event.phase ? `${event.phase.phase} ${event.phase.target}` : this.t('terminalState'));
            if (this.logPath)
                this.field(this.t('log'), this.relativeLogPath(event.projectRoot));
            if (event.prompt?.trim())
                this.field(this.t('prompt'), compact(event.prompt, 100));
        }
        this.renderStickyFooter();
    }
    phaseStart(event) {
        this.stopSpinner();
        this.endAssistantText();
        this.currentCompactAction = '';
        this.modelPreviewBuffer = '';
        this.lastModelNote = '';
        this.phaseFailures = 0;
        this.phaseWrites = 0;
        const alias = phaseAliasForRole(event.role);
        this.activePhaseLabel = event.label;
        this.activePhaseCommand = event.phase.command;
        this.activePhaseTarget = event.phase.target;
        this.activeStudyQuestion = '';
        this.phaseDisplays.push({
            alias: alias.alias,
            tone: alias.tone,
            role: event.role,
            target: event.phase.target,
            command: event.phase.command,
            state: 'active',
            rows: [
                {
                    state: 'active',
                    text: `${event.label}`,
                    detail: `${this.t('phase')} ${event.phase.phase}  ${this.t('command')} ${event.phase.command}  ${this.t('role')} ${event.role}`,
                },
            ],
        });
        this.activePhaseIndex = this.phaseDisplays.length - 1;
        this.currentProposal = `${event.label} -> ${event.phase.target}`;
        this.currentAction = `${event.phase.command} ${event.phase.target}`;
        this.actionStatus = 'THINKING';
        this.globalStatus = 'THINKING';
        this.logLine(`phase ${event.iteration}: ${event.phase.command} target=${event.phase.target} role=${event.role}`);
        if (this.headerPrinted || this.phaseCount > 0)
            this.line('');
        this.phaseCount++;
        this.line(`${this.phaseBullet(alias.alias, alias.tone)} ${this.paint(alias.tone, `[Phase: ${alias.alias}]`)} ${this.dim(event.phase.target)}`);
        this.line(`  ${this.treeBranch(false)} ${this.bold(`▶ ${event.label}`)}`);
        this.line(`     ${this.dim('⌙')} ${this.dim(this.t('phase'))} ${event.phase.phase}  ${this.dim(this.t('command'))} ${this.cyan(event.phase.command)}  ${this.dim(this.t('role'))} ${this.magenta(event.role)}`);
        this.renderStickyFooter();
    }
    phaseResult(result) {
        this.stopSpinner();
        this.endAssistantText();
        this.logLine(`phase result: status=${result.status} turns=${result.turns} tools=${result.toolCalls} failure=${result.failureReason ?? ''}`);
        if (result.finalMessage.trim())
            this.logBlock('phase final message', stripCompletionMarker(result.finalMessage));
        const status = result.terminatedNormally ? this.green(result.status) : this.red(result.status);
        const details = [
            `turns=${result.turns}`,
            `tools=${result.toolCalls}`,
            this.phaseWrites > 0 ? `writes=${this.phaseWrites}` : '',
            this.phaseFailures > 0 ? `failures=${this.phaseFailures}` : '',
        ].filter(Boolean).join(' ');
        if (this.activePhaseIndex >= 0) {
            this.phaseDisplays[this.activePhaseIndex].state = result.terminatedNormally ? 'complete' : 'failed';
            this.addPhaseRow(result.terminatedNormally ? 'complete' : 'failed', `${result.status} ${details}`, result.failureReason ?? undefined);
        }
        this.actionStatus = result.terminatedNormally ? 'WAITING' : 'FAILED';
        this.currentAction = `${result.status} ${details}`;
        this.line(`  ${this.treeBranch(true)} ${result.terminatedNormally ? this.dim(`✔ ${result.status}`) : this.red(`✖ ${result.status}`)} ${this.dim(details)}`);
        if (result.failureReason)
            this.line(`  ${this.treeBranch(true)} ${this.red(`failure ${result.failureReason}`)}`);
        if (this.verbose && result.finalMessage.trim()) {
            this.line(this.dim(`  final ${compact(stripCompletionMarker(result.finalMessage), 300)}`));
        }
        this.renderStickyFooter();
    }
    field(label, value) {
        const labelText = label.padEnd(8);
        this.line(`${this.dim(labelText)}${this.truncate(value, Math.max(20, this.termWidth() - labelText.length))}`);
    }
    currentScreen() {
        return {
            width: this.termWidth(),
            version: packageVersion ?? '0.0.0',
            uptimeSeconds: (Date.now() - this.runStartedAt) / 1000,
            globalStatus: this.globalStatus,
            logoStatus: this.logoStatus(),
            logoDensity: this.logoDensity(),
            projectRoot: this.projectRoot ?? undefined,
            model: this.runModel || undefined,
            mode: this.runMode,
            phases: this.phaseDisplays,
            propose: this.currentProposal,
            actionStatus: this.actionStatus,
            action: this.currentAction,
            timerSeconds: (Date.now() - this.runStartedAt) / 1000,
        };
    }
    logoStatus() {
        if (this.globalStatus === 'COMPLETE')
            return 'happy';
        if (this.globalStatus === 'THINKING' || this.actionStatus === 'THINKING')
            return 'thinking';
        return 'idle';
    }
    logoDensity() {
        return this.termWidth() < 72 || this.termRows() < 18 ? 'compact' : 'full';
    }
    renderModernHeader() {
        if (!this.stdout.isTTY)
            return;
        this.writeRaw(`${renderAutoConsoleHeader(this.currentScreen(), { color: this.useColor }).join('\n')}\n\n`);
    }
    renderStickyFooter() {
        if (!this.canUseStickyFooter())
            return;
        const rows = this.termRows();
        const footer = renderAutoConsoleFooter(this.currentScreen(), { color: this.useColor });
        const firstFooterRow = rows - FOOTER_ROWS + 1;
        this.footerActive = true;
        this.writeRaw([
            SYNC_START,
            AUTOWRAP_OFF,
            '\x1b7',
            `\x1b[${firstFooterRow};1H\x1b[2K${footer[0]}`,
            `\x1b[${firstFooterRow + 1};1H\x1b[2K${footer[1]}`,
            '\x1b8',
            AUTOWRAP_ON,
            SYNC_END,
        ].join(''));
    }
    clearStickyFooter() {
        if (!this.footerActive || !this.canUseStickyFooter()) {
            this.footerActive = false;
            return;
        }
        const rows = this.termRows();
        const firstFooterRow = rows - FOOTER_ROWS + 1;
        this.writeRaw([
            SYNC_START,
            AUTOWRAP_OFF,
            '\x1b7',
            `\x1b[${firstFooterRow};1H\x1b[2K`,
            `\x1b[${firstFooterRow + 1};1H\x1b[2K`,
            '\x1b8',
            AUTOWRAP_ON,
            SYNC_END,
        ].join(''));
        this.footerActive = false;
    }
    canUseStickyFooter() {
        return Boolean(this.useStickyFooter && this.stdout.isTTY && this.termRows() >= 8);
    }
    setupKeyboardShortcuts() {
        if (this.verbose || process.env.CI || !this.stdout.isTTY || !this.stdin?.isTTY)
            return;
        try {
            this.inputWasRaw = Boolean(this.stdin.isRaw);
            this.stdin.setRawMode?.(true);
            this.stdin.resume?.();
            this.stdin.on('data', this.inputListener);
            this.keyboardActive = true;
        }
        catch {
            this.keyboardActive = false;
        }
    }
    restoreKeyboardShortcuts() {
        if (!this.keyboardActive || !this.stdin)
            return;
        this.stdin.off?.('data', this.inputListener);
        this.stdin.removeListener?.('data', this.inputListener);
        try {
            if (!this.inputWasRaw)
                this.stdin.setRawMode?.(false);
        }
        catch {
            // Best effort only; the process may already be exiting.
        }
        this.keyboardActive = false;
    }
    handleInput(chunk) {
        const value = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk;
        if (value.includes('\u0003')) {
            this.restoreKeyboardShortcuts();
            process.kill(process.pid, 'SIGINT');
            return;
        }
        if (!value.includes('\u0014'))
            return;
        this.showCollapsedTranscript();
    }
    registerCollapsedTranscript(tool, content, omittedLines) {
        this.collapsedTranscripts.push({
            title: this.describeTool(tool),
            content,
            omittedLines,
        });
        this.transcriptCursor = this.collapsedTranscripts.length - 1;
    }
    showCollapsedTranscript() {
        const index = this.transcriptCursor < 0 ? this.collapsedTranscripts.length - 1 : this.transcriptCursor;
        if (this.expandedTranscriptIndex === index && this.transcriptPanelRows > 0) {
            this.clearTranscriptPanel();
            this.renderStickyFooter();
            return;
        }
        this.clearTranscriptPanel();
        this.clearStickyFooter();
        if (this.collapsedTranscripts.length === 0) {
            this.line(`${this.bullet()} ${this.dim('No collapsed transcript available')}`);
            this.renderStickyFooter();
            return;
        }
        const transcript = this.collapsedTranscripts[index];
        const panelLines = [
            '',
            this.dim('─'.repeat(Math.min(120, this.termWidth()))),
            `${this.bullet()} ${this.bold(`Transcript ${index + 1}/${this.collapsedTranscripts.length}`)} ${this.dim(transcript.title)}`,
            this.dim(`  expanded ${transcript.omittedLines} folded lines`),
            ...transcript.content
                .replace(/\r\n/g, '\n')
                .split('\n')
                .map((line) => `  ${this.dim('│')} ${this.truncate(line, Math.max(20, this.termWidth() - 6))}`),
            this.dim('─'.repeat(Math.min(120, this.termWidth()))),
        ];
        for (const line of panelLines)
            this.line(line);
        this.expandedTranscriptIndex = index;
        this.transcriptPanelRows = panelLines.length;
        this.renderStickyFooter();
    }
    clearTranscriptPanel() {
        if (this.transcriptPanelRows <= 0)
            return;
        const clearLines = Array.from({ length: this.transcriptPanelRows }, () => '\r\x1b[2K').join('\n');
        this.writeRaw(`${SYNC_START}\x1b[${this.transcriptPanelRows}A${clearLines}\r\x1b[2K${SYNC_END}`);
        this.expandedTranscriptIndex = -1;
        this.transcriptPanelRows = 0;
    }
    addPhaseRow(state, text, detail) {
        if (this.activePhaseIndex < 0)
            return;
        this.phaseDisplays[this.activePhaseIndex].rows.push({ state, text: compact(text, 180), detail: detail ? compact(detail, 220) : undefined });
        this.renderStickyFooter();
    }
    line(value) {
        this.writeWithSpinnerCleared(`${value}\n`);
    }
    write(value) {
        this.writeWithSpinnerCleared(value);
    }
    writeRaw(value) {
        this.stdout.write(value);
    }
    playIntroAnimation(event) {
        if (!this.useIntro)
            return;
        const target = event.phase ? `${event.phase.phase}:${event.phase.target}` : 'terminal';
        const frames = [
            { bar: '[=         ]', label: 'booting autonomous loop', tone: 'cyan', bear: 'idle' },
            { bar: '[===       ]', label: 'loading qdd protocol', tone: 'blue', bear: 'thinking' },
            { bar: '[=====     ]', label: `syncing target ${target}`, tone: 'magenta', bear: 'thinking' },
            { bar: '[=======   ]', label: 'starting agent runtime', tone: 'cyan', bear: 'idle' },
            { bar: '[========= ]', label: 'opening run log', tone: 'blue', bear: 'thinking' },
            { bar: '[==========]', label: 'ready', tone: 'green', bear: 'happy' },
        ];
        let renderedRows = 0;
        for (const frame of frames) {
            const bear = getBearArt(frame.bear, 'compact');
            const status = `${this.title('qdd auto')} ${this.paint(frame.tone, frame.bar)} ${this.truncate(frame.label, Math.max(18, this.termWidth() - 26))}`;
            const block = [
                ...bear.map((line, index) => `  ${this.paint(frame.tone, line.padEnd(13))}${index === 1 ? `  ${status}` : ''}`),
                `  ${this.dim('┄'.repeat(Math.min(54, this.termWidth())))}`,
            ];
            const rewind = renderedRows > 0 ? `\x1b[${renderedRows}A` : '';
            this.writeRaw(`${SYNC_START}${rewind}${block.map((line) => `\r\x1b[K${line}`).join('\n')}\n${SYNC_END}`);
            renderedRows = block.length;
            this.sleepSync(INTRO_FRAME_DELAY_MS);
        }
        const clear = renderedRows > 0
            ? `\x1b[${renderedRows}A${Array.from({ length: renderedRows }, () => '\r\x1b[K').join('\n')}\r\x1b[K`
            : '\r\x1b[K';
        this.writeRaw(`${SYNC_START}${clear}${SYNC_END}`);
    }
    sleepSync(ms) {
        const buffer = new SharedArrayBuffer(4);
        Atomics.wait(new Int32Array(buffer), 0, 0, ms);
    }
    writeWithSpinnerCleared(value) {
        const shouldRestoreSpinner = this.spinnerTimer !== null;
        if (!shouldRestoreSpinner) {
            this.writeRaw(value);
            return;
        }
        const clearBlock = this.clearSpinnerBlock();
        this.spinnerRenderedRows = 0;
        const separator = value.endsWith('\n') || value.endsWith('\r') ? '' : '\n';
        this.writeRaw(`${SYNC_START}${clearBlock}${value}${separator}${this.formatSpinnerBlock(false)}${SYNC_END}`);
    }
    writeAssistantDelta(delta) {
        if (!delta)
            return;
        this.textBuffer += delta;
        if (this.textBuffer.length <= MARKER_TAIL_LENGTH)
            return;
        const flushLength = this.textBuffer.length - MARKER_TAIL_LENGTH;
        const flushText = this.textBuffer.slice(0, flushLength);
        this.textBuffer = this.textBuffer.slice(flushLength);
        this.writeAssistantText(flushText);
    }
    observeModelDelta(delta) {
        if (!delta)
            return;
        this.modelPreviewBuffer += delta;
        const note = this.extractModelNote(this.modelPreviewBuffer);
        if (note)
            this.updateSpinner(`thinking ${note}`);
    }
    modelNote(text) {
        const note = this.extractModelNote(text);
        if (!note || note === this.lastModelNote)
            return;
        this.lastModelNote = note;
        this.line(`${this.bullet()} ${this.magenta(this.t('modelEvent'))}`);
        this.line(`  ${this.branch()} ${this.truncate(note, Math.max(20, this.termWidth() - 6))}`);
        this.compactGap();
    }
    extractModelNote(text) {
        const cleaned = stripCompletionMarker(text)
            .replace(/\r\n/g, '\n')
            .replace(/```[\s\S]*?```/g, ' ');
        const line = cleaned
            .split('\n')
            .map((entry) => entry.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s+/, '').trim())
            .find((entry) => entry.length > 0 && !/^WORKFLOW_COMPLETE$/i.test(entry));
        return line ? compact(line, 160) : '';
    }
    endAssistantText() {
        if (this.textBuffer) {
            const cleaned = stripCompletionMarker(this.textBuffer);
            this.textBuffer = '';
            this.writeAssistantText(cleaned);
        }
        if (this.assistantWrote && !this.assistantAtLineStart)
            this.write('\n');
        this.assistantAtLineStart = true;
        this.assistantWrote = false;
    }
    writeAssistantText(value) {
        const text = value.replace(/\r\n/g, '\n');
        if (!text)
            return;
        let start = 0;
        for (let index = 0; index < text.length; index++) {
            if (text[index] !== '\n')
                continue;
            this.writeAssistantSegment(text.slice(start, index));
            this.write('\n');
            this.assistantAtLineStart = true;
            start = index + 1;
        }
        if (start < text.length)
            this.writeAssistantSegment(text.slice(start));
    }
    writeAssistantSegment(value) {
        if (!value)
            return;
        if (this.assistantAtLineStart) {
            this.write(this.dim('  | '));
            this.assistantAtLineStart = false;
        }
        this.assistantWrote = true;
        this.write(value);
    }
    describeTool(tool) {
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
    describeToolStart(tool) {
        if (tool.name === 'bash') {
            return `${this.cyan(this.t('ran'))} ${compact(String(tool.input.command ?? ''), Math.max(20, this.termWidth() - 8))}`;
        }
        if (tool.name === 'read') {
            return `${this.cyan(this.t('read'))} ${this.truncate(String(tool.input.path ?? ''), Math.max(20, this.termWidth() - 9))}`;
        }
        if (tool.name === 'write') {
            const content = String(tool.input.content ?? '');
            return `${this.cyan(this.t('write'))} ${this.truncate(String(tool.input.path ?? ''), Math.max(20, this.termWidth() - 26))} ${this.dim(`(${content.length} chars)`)}`;
        }
        return `${this.cyan(this.t('tool'))} ${tool.name} ${compact(JSON.stringify(tool.input), 120)}`;
    }
    toolStart(tool) {
        this.line(`${this.bullet()} ${this.describeToolStart(tool)}`);
    }
    describeToolResult(tool, result) {
        if (isToolFailure(result))
            return `${this.describeTool(tool)} :: ${this.describeFailure(tool, result)}`;
        if (tool.name === 'read')
            return `read ${String(tool.input.path ?? '')} (${result.length} chars)`;
        if (tool.name === 'write')
            return compact(result, 180);
        return compact(result, this.verbose ? 500 : 180) || 'no output';
    }
    summarizeToolResult(tool, result, failed) {
        if (this.verbose) {
            return {
                headline: this.describeToolResult(tool, result),
                omittedLines: 0,
            };
        }
        if (tool.name === 'read' && !failed) {
            return {
                headline: `read ${String(tool.input.path ?? '')} (${result.length} chars)`,
                detail: `${result.length} chars`,
                omittedLines: 0,
            };
        }
        if (tool.name === 'write' && !failed) {
            return {
                headline: compact(result, RESULT_INLINE_CHAR_LIMIT),
                detail: compact(result, RESULT_INLINE_CHAR_LIMIT),
                omittedLines: 0,
            };
        }
        const lines = normalizedLines(result);
        const prefix = failed ? `${this.describeTool(tool)} :: ` : '';
        const firstLines = lines.slice(0, RESULT_INLINE_LINE_LIMIT);
        const visibleText = firstLines.length > 0 ? firstLines.join(' ') : 'no output';
        const omittedLines = Math.max(0, lines.length - firstLines.length);
        const headline = `${prefix}${compact(visibleText, RESULT_INLINE_CHAR_LIMIT)}`;
        if (failed && tool.name === 'read' && result.includes('outside the allowed project/package roots')) {
            return {
                headline: `${this.describeTool(tool)} :: blocked outside project/package roots; full error in log`,
                detail: 'blocked outside project/package roots; full error in log',
                omittedLines,
            };
        }
        return {
            headline,
            detail: omittedLines > 0
                ? `${compact(visibleText, RESULT_INLINE_CHAR_LIMIT)} … +${omittedLines} lines`
                : headline,
            omittedLines,
        };
    }
    captureStudyQuestion(tool, result) {
        if (!this.isActiveStudyFile(tool))
            return;
        const source = tool.name === 'write' ? String(tool.input.content ?? '') : result;
        const question = extractStudyQuestion(source);
        if (question)
            this.activeStudyQuestion = question;
    }
    isActiveStudyFile(tool) {
        if (!['read', 'write'].includes(tool.name) || !this.activePhaseTarget)
            return false;
        const rawPath = String(tool.input.path ?? '');
        const normalized = rawPath.replace(/\\/g, '/');
        const studyPath = `studies/${this.activePhaseTarget}/study.md`;
        return normalized === studyPath || normalized.endsWith(`/${studyPath}`);
    }
    describeCompactAction(tool) {
        if (tool.name === 'read') {
            const targetPath = String(tool.input.path ?? '');
            if (targetPath.startsWith('.qdd/examples/'))
                return 'reading QDD examples';
            if (targetPath.includes('skills-catalog'))
                return 'reading skills catalog';
            if (targetPath.startsWith('/'))
                return 'reading external files';
            return 'reading project state';
        }
        if (tool.name === 'write')
            return 'updating project files';
        if (tool.name === 'bash') {
            const command = String(tool.input.command ?? '');
            if (/^\s*qdd\s+(status|instructions|validate)\b/.test(command))
                return 'checking QDD state';
            if (command.includes('/benchmark/') || command.includes('/data/'))
                return 'inspecting benchmark files';
            if (/\bpython\b/.test(command))
                return 'running analysis command';
            return 'running shell command';
        }
        return `using ${tool.name}`;
    }
    compactAction(action) {
        if (this.verbose || action === this.currentCompactAction)
            return;
        this.currentCompactAction = action;
        this.currentAction = action;
        this.actionStatus = 'WAITING';
        this.addPhaseRow('active', action);
        this.line(`${this.bullet()} ${this.blue(this.truncate(action, Math.max(20, this.termWidth() - 2)))}`);
        this.compactGap();
        this.renderStickyFooter();
    }
    compactGap() {
        if (this.verbose)
            return;
        this.line('');
    }
    describeFailure(tool, result) {
        if (tool.name === 'read' && result.includes('outside the allowed project/package roots')) {
            return 'blocked outside project/package roots; full error in log';
        }
        return compact(result, this.verbose ? 500 : 220);
    }
    bold(value) {
        return this.paint('bold', value);
    }
    t(key) {
        return text[this.locale][key];
    }
    bullet() {
        return this.cyan('•');
    }
    phaseBullet(alias, tone) {
        return this.paint(tone, phaseIcon(alias));
    }
    branch() {
        return this.dim('└');
    }
    treeBranch(last) {
        return this.dim(last ? '└─' : '├─');
    }
    separator() {
        this.line(this.dim('─'.repeat(Math.min(120, this.termWidth()))));
    }
    title(value) {
        if (!this.useColor)
            return value;
        return `\x1b[1;36m${value}${ansi.reset}`;
    }
    dim(value) {
        return this.paint('dim', value);
    }
    blue(value) {
        return this.paint('blue', value);
    }
    cyan(value) {
        return this.paint('cyan', value);
    }
    magenta(value) {
        return this.paint('magenta', value);
    }
    green(value) {
        return this.paint('green', value);
    }
    yellow(value) {
        return this.paint('yellow', value);
    }
    red(value) {
        return this.paint('red', value);
    }
    paint(name, value) {
        if (!this.useColor)
            return value;
        return `${ansi[name]}${value}${ansi.reset}`;
    }
    openLog(projectRoot) {
        if (this.logPath)
            return;
        try {
            const logDir = path.join(projectRoot, '.qdd', 'runs');
            fs.mkdirSync(logDir, { recursive: true });
            this.logPath = path.join(logDir, `auto-${timestampForFile()}.log`);
            fs.writeFileSync(this.logPath, '', 'utf-8');
        }
        catch {
            this.logPath = null;
        }
    }
    logLine(value) {
        if (!this.logPath)
            return;
        fs.appendFileSync(this.logPath, `${new Date().toISOString()} ${value}\n`, 'utf-8');
    }
    logBlock(title, value) {
        if (!this.logPath || !value.trim())
            return;
        const safeValue = truncateAutoLogBlockForTest(value);
        fs.appendFileSync(this.logPath, [
            `${new Date().toISOString()} --- ${title} ---`,
            safeValue,
            `${new Date().toISOString()} --- end ${title} ---`,
            '',
        ].join('\n'), 'utf-8');
    }
    startSpinner(text) {
        if (!this.useSpinner)
            return;
        this.spinnerText = this.truncate(text, Math.max(20, this.termWidth() - 6));
        if (this.spinnerTimer !== null) {
            this.renderSpinner();
            return;
        }
        this.spinnerFrameIndex = 0;
        this.spinnerTimer = setInterval(() => this.renderSpinner(), 90);
        this.renderSpinner();
    }
    updateSpinner(text) {
        if (!this.useSpinner || this.spinnerTimer === null)
            return;
        this.spinnerText = this.truncate(text, Math.max(20, this.termWidth() - 6));
        this.renderSpinner();
    }
    stopSpinner(finalLine) {
        if (this.spinnerTimer !== null) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = null;
            const clearBlock = this.clearSpinnerBlock();
            this.spinnerRenderedRows = 0;
            this.writeRaw(`${SYNC_START}${clearBlock}${finalLine ? `${finalLine}\n` : ''}${SYNC_END}`);
            return;
        }
        if (finalLine)
            this.line(finalLine);
    }
    renderSpinner() {
        if (this.spinnerTimer === null)
            return;
        this.writeRaw(`${SYNC_START}${this.formatSpinnerBlock()}${SYNC_END}`);
        this.renderStickyFooter();
    }
    clearSpinnerBlock() {
        const rows = Math.max(1, this.spinnerRenderedRows);
        let output = '\r\x1b[2K';
        for (let index = 1; index < rows; index++) {
            output += '\x1b[1A\r\x1b[2K';
        }
        return output;
    }
    formatSpinnerBlock(clearExisting = true) {
        const context = this.formatLiveContextLine();
        const spinner = this.formatSpinnerLine();
        const clearBlock = clearExisting ? this.clearSpinnerBlock() : '\r';
        this.spinnerRenderedRows = 2;
        return `${clearBlock}${context}\n\r${spinner}`;
    }
    formatLiveContextLine() {
        const phaseContext = this.activePhaseLabel && this.activePhaseTarget
            ? `${this.activePhaseLabel} -> ${this.activePhaseTarget}`
            : this.currentProposal || 'QDD auto';
        const proposeQuestion = this.activeStudyQuestion;
        const context = this.activePhaseCommand === 'qdd-propose' && proposeQuestion
            ? `PROPOSE：${proposeQuestion}`
            : phaseContext;
        return `  ${this.dim('↳')} ${this.truncate(context, Math.max(20, this.termWidth() - 6))}\x1b[K`;
    }
    formatSpinnerLine() {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧'];
        const frame = frames[this.spinnerFrameIndex % frames.length];
        this.spinnerFrameIndex++;
        return `${this.bullet()} ${this.dim(frame)} ${this.spinnerText}\x1b[K`;
    }
    termWidth() {
        return this.stdout.columns && this.stdout.columns > 0 ? this.stdout.columns : 100;
    }
    termRows() {
        return this.stdout.rows && this.stdout.rows > 0 ? this.stdout.rows : 30;
    }
    truncate(value, maxLength) {
        if (value.length <= maxLength)
            return value;
        if (maxLength <= 3)
            return value.slice(0, maxLength);
        return `${value.slice(0, maxLength - 3)}...`;
    }
    relativeLogPath(projectRoot) {
        if (!this.logPath)
            return '';
        const root = projectRoot ?? this.projectRoot ?? process.cwd();
        return path.relative(root, this.logPath);
    }
}
export function createAutoConsoleRenderer(options = {}) {
    return new AutoConsoleRenderer(options);
}
//# sourceMappingURL=auto-stream.js.map