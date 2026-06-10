import * as fs from 'node:fs';
import path from 'node:path';
const COMPLETION_MARKER = 'WORKFLOW_COMPLETE';
const MARKER_TAIL_LENGTH = COMPLETION_MARKER.length + 16;
const SYNC_START = '\x1b[?2026h';
const SYNC_END = '\x1b[?2026l';
const INTRO_FRAME_DELAY_MS = 55;
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
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
};
function compact(value, maxLength = 140) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength)
        return normalized;
    return `${normalized.slice(0, maxLength - 3)}...`;
}
function stripCompletionMarker(value) {
    return value.replace(new RegExp(`(?:\\r?\\n)?\\s*${COMPLETION_MARKER}\\s*$`, 'i'), '');
}
function maxTurnsLabel(value) {
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
function timestampForFile(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}
export class AutoConsoleRenderer {
    events;
    stdout;
    locale;
    useColor;
    useIntro;
    useSpinner;
    verbose;
    headerPrinted = false;
    phaseCount = 0;
    textBuffer = '';
    assistantAtLineStart = true;
    assistantWrote = false;
    spinnerTimer = null;
    spinnerFrameIndex = 0;
    spinnerText = '';
    currentCompactAction = '';
    modelPreviewBuffer = '';
    lastModelNote = '';
    phaseFailures = 0;
    phaseWrites = 0;
    logPath = null;
    projectRoot = null;
    constructor(options = {}) {
        this.stdout = options.stdout ?? process.stdout;
        this.locale = resolveLocale(options.locale);
        this.useColor = options.color ?? Boolean(this.stdout.isTTY && !process.env.NO_COLOR);
        this.useSpinner = Boolean(this.stdout.isTTY);
        this.useIntro = options.intro ?? Boolean(this.useSpinner && !process.env.CI && process.env.QDD_AUTO_NO_INTRO !== '1');
        this.verbose = options.verbose ?? false;
        this.events = {
            runStart: (event) => this.runStart(event),
            initialState: (event) => {
                this.logLine(`initial state: ${event.summary}`);
                if (this.verbose)
                    this.line(this.dim(`initial  ${event.summary}`));
            },
            phaseStart: (event) => this.phaseStart(event),
            dryRunPhase: (event) => {
                this.logLine(`dry-run system prompt: ${event.systemPrompt}`);
                this.line(`${this.bullet()} ${this.yellow(this.t('dryRun'))} ${this.dim(this.t('systemPrompt'))} ${event.systemPrompt}`);
            },
            studyScaffold: (event) => {
                this.logLine(`study scaffold: requested=${event.requested} created=${event.created}`);
                this.compactAction(`${this.t('createdStudy')} ${event.created}`);
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
                if (this.verbose)
                    this.line(this.dim(`  state ${event.summary}`));
            },
            phaseIncomplete: (event) => {
                this.stopSpinner();
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
                    const status = failed ? this.red('failed') : this.green('ok');
                    this.stopSpinner(`  ${this.branch()} ${status} ${this.describeToolResult(event.tool, event.result)}`);
                },
                completionMarkerMissing: (event) => {
                    this.stopSpinner();
                    this.logLine(`completion marker missing: ${event.attempt}/${event.maxAttempts}`);
                    this.line(`${this.bullet()} ${this.yellow(`${this.t('waitingCompletion')} ${event.attempt}/${event.maxAttempts}`)}`);
                },
            },
        };
    }
    finish(result) {
        this.stopSpinner();
        this.endAssistantText();
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
    }
    runStart(event) {
        this.projectRoot = event.projectRoot;
        this.openLog(event.projectRoot);
        this.logLine(`qdd auto start project=${event.projectRoot}`);
        this.logLine(`model=${event.model} maxIterations=${event.maxIterations} maxTurns=${maxTurnsLabel(event.maxTurnsPerAgent)} dryRun=${event.dryRun}`);
        if (event.prompt?.trim())
            this.logBlock('prompt', event.prompt);
        this.headerPrinted = true;
        this.playIntroAnimation(event);
        this.line(`${this.title('qdd auto')} ${this.dim(this.t('subtitle'))}`);
        this.field(this.t('project'), event.projectRoot);
        this.field(this.t('model'), event.model);
        this.field(this.t('limits'), `${event.maxIterations} phases, ${maxTurnsLabel(event.maxTurnsPerAgent)} turns/session`);
        this.field(this.t('mode'), event.dryRun ? this.t('dryRun') : this.t('live'));
        this.field(this.t('start'), event.phase ? `${event.phase.phase} ${event.phase.target}` : this.t('terminalState'));
        if (this.logPath)
            this.field(this.t('log'), this.relativeLogPath(event.projectRoot));
        if (event.prompt?.trim())
            this.field(this.t('prompt'), compact(event.prompt, 100));
    }
    phaseStart(event) {
        this.stopSpinner();
        this.endAssistantText();
        this.currentCompactAction = '';
        this.modelPreviewBuffer = '';
        this.lastModelNote = '';
        this.phaseFailures = 0;
        this.phaseWrites = 0;
        this.logLine(`phase ${event.iteration}: ${event.phase.command} target=${event.phase.target} role=${event.role}`);
        if (this.headerPrinted || this.phaseCount > 0)
            this.line('');
        this.phaseCount++;
        this.line(`${this.bullet()} ${this.blue(`[${event.iteration}]`)} ${this.bold(event.label)} ${this.dim(event.phase.target)}`);
        this.line(`  ${this.branch()} ${this.dim(this.t('phase'))} ${event.phase.phase}  ${this.dim(this.t('command'))} ${this.cyan(event.phase.command)}  ${this.dim(this.t('role'))} ${this.magenta(event.role)}`);
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
        this.line(`  ${this.branch()} ${status} ${this.dim(details)}`);
        if (result.failureReason)
            this.line(`  ${this.branch()} ${this.red(`failure ${result.failureReason}`)}`);
        if (this.verbose && result.finalMessage.trim()) {
            this.line(this.dim(`  final ${compact(stripCompletionMarker(result.finalMessage), 300)}`));
        }
    }
    field(label, value) {
        const labelText = label.padEnd(8);
        this.line(`${this.dim(labelText)}${this.truncate(value, Math.max(20, this.termWidth() - labelText.length))}`);
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
            { bar: '[=         ]', label: 'booting autonomous loop', tone: 'cyan' },
            { bar: '[===       ]', label: 'loading qdd protocol', tone: 'blue' },
            { bar: '[=====     ]', label: `syncing target ${target}`, tone: 'magenta' },
            { bar: '[=======   ]', label: 'starting agent runtime', tone: 'cyan' },
            { bar: '[========= ]', label: 'opening run log', tone: 'blue' },
            { bar: '[==========]', label: 'ready', tone: 'green' },
        ];
        for (const frame of frames) {
            const line = `  ${this.title('qdd auto')} ${this.paint(frame.tone, frame.bar)} ${this.truncate(frame.label, Math.max(18, this.termWidth() - 26))}`;
            this.writeRaw(`${SYNC_START}\r\x1b[K${line}${SYNC_END}`);
            this.sleepSync(INTRO_FRAME_DELAY_MS);
        }
        this.writeRaw(`${SYNC_START}\r\x1b[K${SYNC_END}`);
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
        this.writeRaw(`${SYNC_START}\r\x1b[K${value}${this.formatSpinnerFrame()}${SYNC_END}`);
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
        this.line(`${this.bullet()} ${this.blue(this.truncate(action, Math.max(20, this.termWidth() - 2)))}`);
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
    branch() {
        return this.dim('└');
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
        fs.appendFileSync(this.logPath, [
            `${new Date().toISOString()} --- ${title} ---`,
            value,
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
            this.writeRaw(`${SYNC_START}\r\x1b[K${finalLine ? `${finalLine}\n` : ''}${SYNC_END}`);
            return;
        }
        if (finalLine)
            this.line(finalLine);
    }
    renderSpinner() {
        if (this.spinnerTimer === null)
            return;
        this.writeRaw(`${SYNC_START}${this.formatSpinnerFrame()}${SYNC_END}`);
    }
    formatSpinnerFrame() {
        const frames = ['|', '/', '-', '\\'];
        const frame = frames[this.spinnerFrameIndex % frames.length];
        this.spinnerFrameIndex++;
        return `\r${this.bullet()} ${this.dim(frame)} ${this.spinnerText}\x1b[K`;
    }
    termWidth() {
        return this.stdout.columns && this.stdout.columns > 0 ? this.stdout.columns : 100;
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