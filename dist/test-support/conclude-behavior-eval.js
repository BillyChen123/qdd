import Anthropic from '@anthropic-ai/sdk';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { deflateSync } from 'node:zlib';
import { initCommand } from '../commands/init.js';
import { getClaudeSettings, resolveClaudeApiKey, resolveClaudeModel } from '../runtime/agent-runner.js';
import { natureTemplateRoot, validateManuscriptPackage } from '../services/manuscript-package.js';
import { loadConcludeEvalCase } from './conclude-eval-case.js';
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..', '..');
export const MAX_EVAL_TOOL_TEXT_CHARS = 120_000;
const execFileAsync = promisify(execFile);
const EVAL_TOOLS = [
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
    {
        name: 'copy_project_file',
        description: 'Copy one existing project-local source asset into the current conclusion final_paper package.',
        input_schema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'Existing project-relative source file path.' },
                destination: { type: 'string', description: 'Destination path under the current conclusions/<run-id>/final_paper/ directory.' },
            },
            required: ['source', 'destination'],
        },
    },
    {
        name: 'copy_nature_template',
        description: 'Copy a tracked QDD Nature template file into the current final_paper package. Allowed source paths are sn-jnl.cls, latexmkrc, and bst/sn-nature.bst.',
        input_schema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'Tracked template-relative source path.' },
                destination: { type: 'string', description: 'Destination path under the current conclusions/<run-id>/final_paper/ directory.' },
            },
            required: ['source', 'destination'],
        },
    },
    {
        name: 'search_literature',
        description: 'Search PubMed and return bibliographic metadata for proposition-level citation verification. Use exact PMIDs when available; otherwise use a focused scientific query. Verify the returned title and journal support before citing it.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'A PubMed ID or focused literature query.' },
            },
            required: ['query'],
        },
    },
];
const SEMANTIC_REVIEW_TOOLS = [
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
function isoNow() {
    return new Date().toISOString();
}
function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}
function redactSensitiveText(value, explicitSecrets = []) {
    let redacted = value;
    for (const secret of explicitSecrets) {
        if (secret.length >= 8)
            redacted = redacted.split(secret).join('[REDACTED]');
    }
    return redacted
        .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
        .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/gi, 'Bearer [REDACTED]')
        .replace(/\b(api[_-]?key|auth[_-]?token|access[_-]?token|secret)\b\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{12,}["']?/gi, '$1=[REDACTED]');
}
function containsSecretValue(value, explicitSecrets = []) {
    if (explicitSecrets.some((secret) => secret.length >= 8 && value.includes(secret)))
        return true;
    return /sk-ant-[A-Za-z0-9_-]{8,}/.test(value)
        || /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/i.test(value)
        || /\b(api[_-]?key|auth[_-]?token|access[_-]?token|secret)\b\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{12,}["']?/i.test(value);
}
export function truncateEvalToolText(value) {
    if (value.length <= MAX_EVAL_TOOL_TEXT_CHARS)
        return value;
    const headLength = Math.floor(MAX_EVAL_TOOL_TEXT_CHARS * 0.75);
    const tailLength = MAX_EVAL_TOOL_TEXT_CHARS - headLength;
    const omitted = value.length - headLength - tailLength;
    return [
        value.slice(0, headLength),
        '',
        `[Tool output truncated for model transport: ${value.length} characters total; ${omitted} omitted. Read a smaller report, table subset, or specific supporting source instead of inferring omitted content.]`,
        '',
        value.slice(-tailLength),
    ].join('\n');
}
function resolveProjectPath(projectRoot, relativePath) {
    if (path.isAbsolute(relativePath))
        throw new Error('Evaluation tools require project-relative paths.');
    const resolved = path.resolve(projectRoot, relativePath);
    const relative = path.relative(projectRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Path leaves evaluation project: ${relativePath}`);
    }
    return resolved;
}
async function listFiles(root, relativeDir) {
    const absoluteDir = resolveProjectPath(root, relativeDir);
    const output = [];
    async function walk(current) {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
            const absolutePath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                await walk(absolutePath);
            }
            else if (entry.isFile()) {
                output.push(path.relative(root, absolutePath).split(path.sep).join('/'));
            }
        }
    }
    await walk(absoluteDir);
    return output;
}
function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
}
function ppmToPng(source) {
    const tokens = source
        .split(/\r?\n/)
        .flatMap((line) => line.replace(/#.*/, '').trim().split(/\s+/))
        .filter(Boolean);
    if (tokens[0] !== 'P3')
        throw new Error('Only ASCII P3 PPM figures are supported by the eval viewer.');
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
async function imageForModel(filePath) {
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
async function searchPubmed(query) {
    const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    searchUrl.searchParams.set('db', 'pubmed');
    searchUrl.searchParams.set('retmode', 'json');
    searchUrl.searchParams.set('retmax', '5');
    searchUrl.searchParams.set('term', query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
        const searchResponse = await fetch(searchUrl, { signal: controller.signal });
        if (!searchResponse.ok)
            throw new Error(`PubMed search HTTP ${searchResponse.status}`);
        const search = await searchResponse.json();
        const ids = search.esearchresult?.idlist ?? [];
        if (ids.length === 0)
            return `PubMed returned no records for: ${query}`;
        const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
        summaryUrl.searchParams.set('db', 'pubmed');
        summaryUrl.searchParams.set('retmode', 'json');
        summaryUrl.searchParams.set('id', ids.join(','));
        const summaryResponse = await fetch(summaryUrl, { signal: controller.signal });
        if (!summaryResponse.ok)
            throw new Error(`PubMed summary HTTP ${summaryResponse.status}`);
        const summary = await summaryResponse.json();
        return (summary.result?.uids ?? []).map((id) => {
            const record = summary.result?.[id];
            const authors = Array.isArray(record?.authors)
                ? record.authors.map((author) => author.name).filter(Boolean).join(', ')
                : '';
            return [
                `PMID: ${id}`,
                `Title: ${String(record?.title ?? '')}`,
                `Journal: ${String(record?.fulljournalname ?? record?.source ?? '')}`,
                `Date: ${String(record?.pubdate ?? '')}`,
                `Authors: ${authors}`,
                `DOI: ${String(record?.elocationid ?? '')}`,
            ].join('\n');
        }).join('\n\n');
    }
    finally {
        clearTimeout(timeout);
    }
}
class AnthropicEvalModel {
    model;
    client;
    constructor(model, apiKey) {
        this.model = model;
        const settings = getClaudeSettings();
        this.client = new Anthropic({
            apiKey,
            baseURL: process.env.ANTHROPIC_BASE_URL ?? settings.ANTHROPIC_BASE_URL ?? undefined,
        });
    }
    async complete(messages, systemPrompt, tools = EVAL_TOOLS) {
        let response;
        try {
            response = await this.client.messages.create({
                model: this.model,
                max_tokens: 8_000,
                system: systemPrompt,
                messages: messages,
                tools,
            });
        }
        catch (error) {
            throw new LiveSdkError(error.message);
        }
        return response.content.flatMap((block) => {
            if (block.type === 'text')
                return [{ type: 'text', text: block.text }];
            if (block.type === 'tool_use') {
                return [{ type: 'tool_use', id: block.id, name: block.name, input: block.input }];
            }
            return [];
        });
    }
}
class LiveSdkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LiveSdkError';
    }
}
class ScriptedFakeEvalModel {
    evalCase;
    paths;
    call = 0;
    constructor(evalCase, paths) {
        this.evalCase = evalCase;
        this.paths = paths;
    }
    async complete() {
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
function tool(name, input) {
    fakeToolId++;
    return { type: 'tool_use', id: `fake-tool-${fakeToolId}`, name, input };
}
function textBlock(text) {
    return { type: 'text', text };
}
class EvalConversation {
    projectRoot;
    model;
    systemPrompt;
    secrets;
    paths;
    visionAvailable;
    transcript = [];
    accessLog = [];
    gates = [];
    stageResults = [];
    messages = [];
    stage = 'synthesis';
    sequence = 0;
    constructor(projectRoot, model, systemPrompt, secrets, paths, visionAvailable) {
        this.projectRoot = projectRoot;
        this.model = model;
        this.systemPrompt = systemPrompt;
        this.secrets = secrets;
        this.paths = paths;
        this.visionAvailable = visionAvailable;
    }
    addHumanMessage(content) {
        const safe = redactSensitiveText(content, this.secrets);
        this.messages.push({ role: 'user', content: safe });
        this.transcript.push(this.entry('human', 'message', safe));
    }
    addGate(gate, action, message) {
        this.gates.push({ gate, action, message });
        this.addHumanMessage(message);
    }
    async recordStageResult(assistantMessage) {
        this.stageResults.push({
            stage: this.stage,
            assistant_message: redactSensitiveText(assistantMessage, this.secrets),
            research_synthesis_exists: await exists(resolveProjectPath(this.projectRoot, this.paths.synthesis)),
            story_exists: await exists(resolveProjectPath(this.projectRoot, this.paths.story)),
        });
    }
    async runUntilPause(maxModelCalls = 16) {
        for (let call = 0; call < maxModelCalls; call++) {
            const blocks = await this.model.complete(this.messages, this.systemPrompt);
            const text = blocks.filter((block) => block.type === 'text').map((block) => block.text).join('\n').trim();
            const toolUses = blocks.filter((block) => block.type === 'tool_use');
            this.messages.push({ role: 'assistant', content: blocks });
            if (text)
                this.transcript.push(this.entry('assistant', 'message', redactSensitiveText(text, this.secrets)));
            for (const toolUse of toolUses) {
                const pathValue = typeof toolUse.input.path === 'string' ? toolUse.input.path : undefined;
                this.transcript.push(this.entry('assistant', 'tool_use', redactSensitiveText(JSON.stringify(toolUse.input), this.secrets), toolUse.name, pathValue));
            }
            if (toolUses.length === 0) {
                if (!text)
                    throw new Error(`Model paused without text during ${this.stage}.`);
                return text;
            }
            const results = [];
            for (const toolUse of toolUses) {
                results.push(await this.executeTool(toolUse));
            }
            this.messages.push({ role: 'user', content: results });
        }
        throw new Error(`Model did not pause within ${maxModelCalls} calls during ${this.stage}.`);
    }
    entry(actor, kind, content, toolName, toolPath) {
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
    addAccess(action, toolPath) {
        this.accessLog.push({
            sequence: this.accessLog.length + 1,
            timestamp: isoNow(),
            stage: this.stage,
            action,
            path: toolPath,
        });
    }
    async executeTool(toolUse) {
        const relativePath = String(toolUse.input.path ?? '');
        let content;
        let isError = false;
        try {
            switch (toolUse.name) {
                case 'list_files': {
                    this.addAccess('list', relativePath);
                    content = truncateEvalToolText((await listFiles(this.projectRoot, relativePath)).join('\n'));
                    break;
                }
                case 'read_file': {
                    this.addAccess('read', relativePath);
                    content = truncateEvalToolText(await fs.readFile(resolveProjectPath(this.projectRoot, relativePath), 'utf-8'));
                    break;
                }
                case 'view_image': {
                    if (!this.visionAvailable) {
                        this.addAccess('view_image_deferred', relativePath);
                        content = 'Pixel-level visual verification is unavailable for this configured model. Use source-backed captions, reports, tables, and provenance to select the figure; do not claim uninspected visual details, and record pixel-level verification as deferred for human review.';
                    }
                    else {
                        this.addAccess('view_image', relativePath);
                        const image = await imageForModel(resolveProjectPath(this.projectRoot, relativePath));
                        content = [image.block, { type: 'text', text: image.summary }];
                    }
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
                case 'copy_project_file': {
                    const source = String(toolUse.input.source ?? '');
                    const destination = String(toolUse.input.destination ?? '');
                    this.assertFinalPaperDestination(destination);
                    this.addAccess('copy', `${source} -> ${destination}`);
                    const sourcePath = resolveProjectPath(this.projectRoot, source);
                    const destinationPath = resolveProjectPath(this.projectRoot, destination);
                    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
                    await fs.copyFile(sourcePath, destinationPath);
                    content = `File copied: ${source} -> ${destination}`;
                    break;
                }
                case 'copy_nature_template': {
                    const source = String(toolUse.input.source ?? '');
                    const destination = String(toolUse.input.destination ?? '');
                    const allowed = new Set(['sn-jnl.cls', 'latexmkrc', 'bst/sn-nature.bst']);
                    if (!allowed.has(source))
                        throw new Error(`Unsupported Nature template asset: ${source}`);
                    this.assertFinalPaperDestination(destination);
                    this.addAccess('copy', `template:${source} -> ${destination}`);
                    const destinationPath = resolveProjectPath(this.projectRoot, destination);
                    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
                    await fs.copyFile(path.join(natureTemplateRoot(), source), destinationPath);
                    content = `Nature template copied: ${source} -> ${destination}`;
                    break;
                }
                case 'search_literature': {
                    const query = String(toolUse.input.query ?? '').trim();
                    if (!query)
                        throw new Error('PubMed query is required.');
                    this.addAccess('literature_search', query);
                    content = await searchPubmed(query);
                    break;
                }
                default:
                    throw new Error(`Unsupported evaluation tool: ${toolUse.name}`);
            }
        }
        catch (error) {
            isError = true;
            content = `Tool error for ${relativePath || toolUse.name}: ${error.message}. Continue with another available project source; do not infer content from this unavailable path.`;
        }
        const transcriptContent = Array.isArray(content)
            ? content.filter((block) => block.type === 'text').map((block) => block.text).join('\n')
            : content;
        this.transcript.push(this.entry('tool', 'tool_result', redactSensitiveText(transcriptContent, this.secrets), toolUse.name, relativePath));
        return { type: 'tool_result', tool_use_id: toolUse.id, content, ...(isError ? { is_error: true } : {}) };
    }
    assertFinalPaperDestination(destination) {
        const finalPaperPrefix = `${this.paths.conclusionDir}/final_paper/`;
        if (!destination.startsWith(finalPaperPrefix)) {
            throw new Error(`Eval copy destination must be under ${finalPaperPrefix}: ${destination}`);
        }
    }
}
async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function isPathWithinRoot(target, root) {
    const relative = path.relative(root, target);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
async function assertReadableQddProject(projectRoot) {
    const required = ['contract.yaml', 'evolution.yaml', 'artifacts/index.yaml', 'context/memory'];
    for (const relativePath of required) {
        await fs.access(path.join(projectRoot, relativePath));
    }
}
async function prepareEvalProject(outputRoot, fixtureRoot, projectPath) {
    const liveProjectRoot = projectPath ? path.resolve(projectPath) : undefined;
    if (liveProjectRoot && (isPathWithinRoot(outputRoot, liveProjectRoot) || isPathWithinRoot(liveProjectRoot, outputRoot))) {
        throw new Error('Live project and evaluation output directories must not overlap.');
    }
    await fs.rm(outputRoot, { recursive: true, force: true });
    await fs.mkdir(outputRoot, { recursive: true });
    const projectRoot = liveProjectRoot ?? path.join(outputRoot, 'project');
    if (liveProjectRoot) {
        await assertReadableQddProject(projectRoot);
    }
    else {
        await fs.cp(fixtureRoot, projectRoot, { recursive: true });
        await fs.rm(path.join(projectRoot, 'eval-case.yaml'), { force: true });
    }
    await initCommand(projectRoot, { tools: ['claude'], refreshBootstrap: true });
    const installedSkillPath = path.join(projectRoot, '.claude', 'skills', 'qdd-conclude', 'SKILL.md');
    const systemPrompt = await fs.readFile(installedSkillPath, 'utf-8');
    return { projectRoot, installedSkillPath, systemPrompt, usesLiveProject: Boolean(liveProjectRoot) };
}
async function snapshotStory(projectRoot, outputRoot, storyPath) {
    const story = await fs.readFile(resolveProjectPath(projectRoot, storyPath), 'utf-8');
    const snapshotPath = path.join(outputRoot, 'snapshots', 'story-before-gate2-revision.md');
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, story, 'utf-8');
    return snapshotPath;
}
async function scanGeneratedTextForSecrets(root, explicitSecrets, relativeRoot = '.') {
    if (!(await exists(resolveProjectPath(root, relativeRoot))))
        return [];
    const violations = [];
    const files = await listFiles(root, relativeRoot);
    for (const relativePath of files) {
        if (!/\.(json|md|ya?ml|txt|csv|tsv)$/i.test(relativePath))
            continue;
        const content = await fs.readFile(path.join(root, relativePath), 'utf-8');
        if (containsSecretValue(content, explicitSecrets))
            violations.push(relativePath);
    }
    return violations;
}
function evaluateAssertions(accesses, gates, usesLiveProject, evalCase, paths, installedSkill, synthesisExists, storyExists, storyBeforeRevision, storyAfterRevision, secretViolations) {
    const firstEvidenceIndex = accesses.findIndex((entry) => usesLiveProject
        ? entry.action === 'read' && /^(?:artifacts\/(?:reports|tables|figures|data)|studies\/STUDY-\d+\/output\/)/.test(entry.path)
        : evalCase.evidence_outputs.includes(entry.path));
    const evolutionIndex = accesses.findIndex((entry) => entry.action === 'read' && entry.path === 'evolution.yaml');
    const memoryIndex = accesses.findIndex((entry) => entry.action === 'read' && entry.path.startsWith('context/memory/'));
    const storyWrites = accesses.filter((entry) => entry.action === 'write' && entry.path === paths.story);
    const texWrites = accesses.filter((entry) => entry.action === 'write' && entry.path.includes('/final_paper/'));
    const gateOrder = gates.map((entry) => `${entry.gate}:${entry.action}`).join(' -> ');
    const visibleStory = storyAfterRevision.replace(/\]\([^)]+\)/g, ']');
    const qddMetadataPattern = /\b(?:project research map|boundary tracking|artifact registr(?:y|ies)|study definitions?|internal study outputs?)\b/i;
    return [
        assertion('production_skill_loaded', installedSkill.includes('name: qdd-conclude') && installedSkill.includes('Gate 1: Align Narrative Intent') && installedSkill.includes('Gate 2: Review And Revise The Story'), 'Harness loaded the qdd init-projected .claude/skills/qdd-conclude/SKILL.md.'),
        assertion('two_gate_order', gateOrder === 'gate_1:feedback -> gate_1:accepted -> gate_2:feedback -> gate_2:accepted', gateOrder || 'No gate events recorded.'),
        assertion('navigation_before_underlying_evidence', firstEvidenceIndex >= 0 && evolutionIndex >= 0 && memoryIndex >= 0 && evolutionIndex < firstEvidenceIndex && memoryIndex < firstEvidenceIndex, `evolution=${evolutionIndex}, memory=${memoryIndex}, first underlying evidence=${firstEvidenceIndex}`),
        assertion('unpromoted_finalized_output_read', evalCase.unpromoted_finalized_outputs.every((requiredPath) => accesses.some((entry) => entry.action === 'read' && entry.path === requiredPath)), evalCase.unpromoted_finalized_outputs.join(', ')),
        assertion('figure_inspected_multimodally', evalCase.figures.every((requiredPath) => accesses.some((entry) => entry.action === 'view_image' && entry.path === requiredPath)), evalCase.figures.join(', ')),
        assertion('evidence_outputs_read', evalCase.evidence_outputs.every((requiredPath) => accesses.some((entry) => entry.action === 'read' && entry.path === requiredPath)), `${evalCase.evidence_outputs.length} required evidence outputs or artifacts`),
        assertion('synthesis_before_story', synthesisExists && storyWrites.length >= 2 && storyWrites.every((entry) => entry.stage === 'story_draft' || entry.stage === 'gate2_revision'), `synthesis=${synthesisExists}, story write stages=${storyWrites.map((entry) => entry.stage).join(',') || '-'}`),
        assertion('gate2_rewrites_story', storyExists && storyBeforeRevision.length > 0 && storyAfterRevision.length > 0 && sha256(storyBeforeRevision) !== sha256(storyAfterRevision), `before=${storyBeforeRevision ? sha256(storyBeforeRevision) : '-'}, after=${storyAfterRevision ? sha256(storyAfterRevision) : '-'}`),
        assertion('no_tex_before_gate2_acceptance', texWrites.length === 0, texWrites.length === 0 ? 'No final_paper write occurred during the two-gate evaluation.' : `${texWrites.length} premature TeX writes.`),
        assertion('credential_values_absent', secretViolations.length === 0, secretViolations.length === 0 ? 'No credential-shaped values found in generated text.' : secretViolations.join(', ')),
        ...(usesLiveProject
            ? [assertion('source_trail_present_in_story', /\bART-\d{3}\b|artifacts\//.test(visibleStory), 'Direct live stories may retain source identifiers so the human-reviewed blueprint remains traceable.')]
            : [assertion('qdd_ids_absent_from_story', !/(?:\b(?:STUDY|TASK|ART)-\d{3}\b|\bB\d{3}\b)/.test(visibleStory), 'Visible story content must not expose QDD study, task, artifact, or boundary identifiers.')]),
        assertion('qdd_metadata_absent_from_story', !qddMetadataPattern.test(visibleStory), 'Visible story content must not expose QDD research-map, boundary, artifact-registry, or study-definition metadata prose.'),
    ];
}
export async function recheckConcludeBehaviorEval(outputRoot) {
    const reportPath = path.join(path.resolve(outputRoot), 'report.json');
    const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
    const usesLiveProject = report.case.provenance.kind === 'live-qdd-project';
    const evalCase = usesLiveProject
        ? (await loadLiveProjectCase(report.project_path, path.basename(report.outputs.conclusion_dir))).definition
        : (await loadConcludeEvalCase(report.fixture_path)).definition;
    const accesses = JSON.parse(await fs.readFile(report.outputs.access_log, 'utf-8'));
    const paths = {
        conclusionDir: path.relative(report.project_path, report.outputs.conclusion_dir).split(path.sep).join('/'),
        synthesis: path.relative(report.project_path, report.outputs.research_synthesis).split(path.sep).join('/'),
        story: path.relative(report.project_path, report.outputs.story).split(path.sep).join('/'),
    };
    const installedSkill = await fs.readFile(report.installed_skill_path, 'utf-8');
    const synthesisExists = await exists(report.outputs.research_synthesis);
    const storyExists = await exists(report.outputs.story);
    const storyBeforeRevision = await exists(report.outputs.story_before_gate2_revision)
        ? await fs.readFile(report.outputs.story_before_gate2_revision, 'utf-8')
        : '';
    const storyAfterRevision = storyExists ? await fs.readFile(report.outputs.story, 'utf-8') : '';
    const secretViolations = [
        ...await scanGeneratedTextForSecrets(report.outputs.run_root, []),
        ...await scanGeneratedTextForSecrets(report.project_path, [], paths.conclusionDir),
    ];
    const assertions = [
        assertion('conversation_completed', report.gates.length === 4 && report.stage_results.length >= 4, 'Persisted transcript records all scripted turns through Gate 2 acceptance.'),
        ...evaluateAssertions(accesses, report.gates, usesLiveProject, evalCase, paths, installedSkill, synthesisExists, storyExists, storyBeforeRevision, storyAfterRevision, secretViolations),
    ];
    const harnessPassed = assertions.every((entry) => entry.status === 'pass');
    const rechecked = {
        ...report,
        status: harnessPassed ? 'passed' : 'failed',
        harness: { status: harnessPassed ? 'PASS' : 'FAIL', assertions },
        semantic_review: harnessPassed && usesLiveProject
            ? blockedSemanticReview('Semantic reviewer was not run for the direct live-project writer evaluation; it is advisory and must not consume an additional model run.')
            : report.semantic_review,
    };
    await fs.writeFile(rechecked.outputs.semantic_review_json, `${JSON.stringify(rechecked.semantic_review, null, 2)}\n`, 'utf-8');
    await fs.writeFile(rechecked.outputs.report_json, `${JSON.stringify(rechecked, null, 2)}\n`, 'utf-8');
    await fs.writeFile(rechecked.outputs.report_markdown, `${renderReportMarkdown(rechecked)}\n`, 'utf-8');
    return rechecked;
}
function assertion(id, passed, detail) {
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
];
function blockedSemanticReview(summary) {
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
function validateSemanticReview(raw, evalCase) {
    const review = { protocol_version: 1, ...raw };
    if (!Array.isArray(review.dimensions))
        throw new Error('Semantic review dimensions must be an array.');
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
    const unsupportedFigurePass = review.figure_checks.some((entry) => entry.status === 'pass'
        && /unsupported image|could not (?:be )?(?:rendered|inspected)|cannot (?:be |independently )?(?:render|inspect)/i.test(entry.analysis));
    if (review.verdict === 'accepted' && (hasFailedDimension || hasFailedClaimOrFigure || hasMaterialFinding || unsupportedFigurePass)) {
        throw new Error('Semantic review verdict cannot be accepted with a failed check, material finding, or uninspected figure.');
    }
    return review;
}
class SemanticReviewConversation {
    projectRoot;
    model;
    secrets;
    evalCase;
    transcript = [];
    accessLog = [];
    messages = [];
    sequence = 0;
    review = null;
    constructor(projectRoot, model, secrets, evalCase) {
        this.projectRoot = projectRoot;
        this.model = model;
        this.secrets = secrets;
        this.evalCase = evalCase;
    }
    async run(initialMessage) {
        this.messages.push({ role: 'user', content: initialMessage });
        this.transcript.push(this.entry('human', 'message', initialMessage));
        for (let call = 0; call < 24; call++) {
            const blocks = await this.model.complete(this.messages, SEMANTIC_REVIEW_SYSTEM_PROMPT, SEMANTIC_REVIEW_TOOLS);
            this.messages.push({ role: 'assistant', content: blocks });
            const results = [];
            for (const block of blocks) {
                if (block.type === 'text') {
                    this.transcript.push(this.entry('assistant', 'message', block.text));
                    continue;
                }
                const toolPath = typeof block.input.path === 'string' ? block.input.path : undefined;
                this.transcript.push(this.entry('assistant', 'tool_use', JSON.stringify(block.input), block.name, toolPath));
                results.push(await this.executeTool(block));
            }
            if (this.review)
                return this.review;
            if (results.length === 0) {
                this.messages.push({
                    role: 'user',
                    content: 'Continue the evidence review and finish by calling submit_semantic_review. Do not return a prose-only verdict.',
                });
            }
            else {
                this.messages.push({ role: 'user', content: results });
            }
        }
        throw new Error('Semantic reviewer did not submit a review within 24 model calls.');
    }
    entry(actor, kind, content, toolName, toolPath) {
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
    addAccess(action, toolPath) {
        this.accessLog.push({
            sequence: this.accessLog.length + 1,
            timestamp: isoNow(),
            stage: 'semantic_review',
            action,
            path: toolPath,
        });
    }
    async executeTool(toolUse) {
        const relativePath = String(toolUse.input.path ?? '');
        let content;
        let isError = false;
        if (toolUse.name === 'read_file') {
            this.addAccess('read', relativePath);
            content = await fs.readFile(resolveProjectPath(this.projectRoot, relativePath), 'utf-8');
        }
        else if (toolUse.name === 'list_files') {
            this.addAccess('list', relativePath);
            content = (await listFiles(this.projectRoot, relativePath)).join('\n');
        }
        else if (toolUse.name === 'view_image') {
            this.addAccess('view_image', relativePath);
            const image = await imageForModel(resolveProjectPath(this.projectRoot, relativePath));
            content = [image.block, { type: 'text', text: image.summary }];
        }
        else if (toolUse.name === 'submit_semantic_review') {
            try {
                const requiredReads = [
                    ...this.evalCase.evidence_outputs,
                    ...this.evalCase.unpromoted_finalized_outputs,
                ];
                const unread = requiredReads.filter((requiredPath) => !this.accessLog.some((entry) => entry.action === 'read' && entry.path === requiredPath));
                const unviewed = this.evalCase.figures.filter((requiredPath) => !this.accessLog.some((entry) => entry.action === 'view_image' && entry.path === requiredPath));
                if (unread.length > 0 || unviewed.length > 0) {
                    throw new Error(`Semantic reviewer skipped required evidence: ${[...unread, ...unviewed].join(', ')}`);
                }
                this.review = validateSemanticReview(toolUse.input, this.evalCase);
                content = 'Semantic review accepted by the protocol validator.';
            }
            catch (error) {
                isError = true;
                content = `Semantic review submission rejected: ${error.message} Correct the review and call submit_semantic_review again.`;
            }
        }
        else {
            throw new Error(`Unsupported semantic review tool: ${toolUse.name}`);
        }
        const transcriptContent = Array.isArray(content)
            ? content.filter((block) => block.type === 'text').map((block) => block.text).join('\n')
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
async function runSemanticReview(options) {
    const reviewer = new SemanticReviewConversation(options.projectRoot, options.model, options.secrets, options.evalCase);
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
function reportPaths(outputRoot, projectRoot, paths) {
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
function renderReportMarkdown(report) {
    const assertions = report.harness.assertions.map((entry) => `- ${entry.status.toUpperCase()} \`${entry.id}\`: ${entry.detail}`);
    const stageResults = report.stage_results.map((entry) => `- \`${entry.stage}\`: synthesis=${entry.research_synthesis_exists}, story=${entry.story_exists}; ${entry.assistant_message}`);
    const dimensions = report.semantic_review.dimensions.map((entry) => `- ${entry.status.toUpperCase()} \`${entry.id}\`: ${entry.analysis} Evidence: ${entry.evidence_paths.length > 0 ? entry.evidence_paths.map((value) => `\`${value}\``).join(', ') : 'none'}`);
    const claimChecks = report.semantic_review.major_claim_checks.map((entry) => `- ${entry.status.toUpperCase()} ${entry.claim}: ${entry.analysis} Sources: ${entry.source_paths.map((value) => `\`${value}\``).join(', ') || 'none'}`);
    const figureChecks = report.semantic_review.figure_checks.map((entry) => `- ${entry.status.toUpperCase()} \`${entry.figure_path}\`: ${entry.analysis}`);
    const findings = report.semantic_review.findings.map((entry) => `- ${entry.severity.toUpperCase()}: ${entry.detail} Evidence: ${entry.evidence_paths.map((value) => `\`${value}\``).join(', ') || 'none'}`);
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
        `- Pixel-level visual verification: \`${report.capabilities.pixel_level_visual_verification}\``,
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
function liveRunId() {
    return `bil31-live-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
}
async function loadLiveProjectCase(projectRoot, runId) {
    await assertReadableQddProject(projectRoot);
    const hash = createHash('sha256');
    const sourceFiles = ['contract.yaml', 'evolution.yaml', 'artifacts/index.yaml'];
    const memoryRoot = path.join(projectRoot, 'context', 'memory');
    const memoryFiles = (await fs.readdir(memoryRoot, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => path.join('context', 'memory', entry.name))
        .sort();
    for (const relativePath of [...sourceFiles, ...memoryFiles]) {
        hash.update(relativePath);
        hash.update('\0');
        hash.update(await fs.readFile(path.join(projectRoot, relativePath)));
        hash.update('\0');
    }
    return {
        root: projectRoot,
        manifestPath: '(live project)',
        definition: {
            schema_version: 1,
            id: 'live-qdd-project',
            name: path.basename(projectRoot),
            run_id: runId,
            provenance: {
                kind: 'live-qdd-project',
                source: projectRoot,
                notes: 'Direct evaluation against the supplied QDD project; no scientific fixture was copied or used as a quality oracle.',
            },
            navigation_files: [],
            evidence_outputs: [],
            unpromoted_finalized_outputs: [],
            figures: [],
            gates: {
                gate1_feedback: [
                    'Gate 1 feedback: center the paper on the strongest source-grounded donor-level Parkinson substantia nigra transcript-usage contribution.',
                    'Use the early astrocyte RNA-processing observations only as a clearly separate contextual scale, not as proof of cell-intrinsic disease regulation.',
                    'De-emphasize preliminary spatial or exploratory branches unless they are necessary to explain the final contribution. Revise the narrative intent and wait for explicit acceptance without creating story.md.',
                ].join(' '),
                gate1_acceptance: 'Gate 1 accepted. Write the complete English story.md now, with a contribution-first Results progression, evidence and figure plan, bounded Discussion, Methods scope, and precise citation-needed anchors where external support is required.',
                gate2_feedback: [
                    'Gate 2 feedback: revise story.md directly. Make the Results progression explicit from cohort-level transcript-usage landscape, through the PD-biased biological convergence, to the constrained RNA-processing compatibility layer.',
                    'Keep different datasets and evidence tiers distinct; retain decisive values and figure roles; state that pixel-level figure verification is deferred when visual inspection was unavailable.',
                    'Remove empty sections, generic TODOs, and unsupported causal or cell-type-specific wording. Do not draft TeX.',
                ].join(' '),
                gate2_acceptance: 'Gate 2 accepted after revision. End this evaluation at story acceptance; TeX belongs to the downstream issue.',
            },
            reviewer_focus: [],
        },
        fingerprint: hash.digest('hex'),
    };
}
async function writeReportArtifacts(report, conversation, semanticTranscript = [], semanticAccessLog = []) {
    await fs.mkdir(path.dirname(report.outputs.report_json), { recursive: true });
    await fs.writeFile(report.outputs.transcript, `${JSON.stringify(conversation?.transcript ?? [], null, 2)}\n`, 'utf-8');
    await fs.writeFile(report.outputs.access_log, `${JSON.stringify(conversation?.accessLog ?? [], null, 2)}\n`, 'utf-8');
    await fs.writeFile(report.outputs.semantic_review_json, `${JSON.stringify(report.semantic_review, null, 2)}\n`, 'utf-8');
    await fs.writeFile(report.outputs.semantic_review_transcript, `${JSON.stringify(semanticTranscript, null, 2)}\n`, 'utf-8');
    await fs.writeFile(report.outputs.semantic_review_access_log, `${JSON.stringify(semanticAccessLog, null, 2)}\n`, 'utf-8');
    await fs.writeFile(report.outputs.report_json, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
    await fs.writeFile(report.outputs.report_markdown, `${renderReportMarkdown(report)}\n`, 'utf-8');
}
export async function runConcludeBehaviorEval(options) {
    const startedAt = isoNow();
    const outputRoot = path.resolve(options.outputRoot);
    const liveProjectPath = options.projectPath ? path.resolve(options.projectPath) : undefined;
    const evalCase = liveProjectPath
        ? await loadLiveProjectCase(liveProjectPath, options.runId ?? liveRunId())
        : await loadConcludeEvalCase(options.casePath);
    const prepared = await prepareEvalProject(outputRoot, evalCase.root, liveProjectPath);
    const paths = {
        conclusionDir: `conclusions/${evalCase.definition.run_id}`,
        synthesis: `conclusions/${evalCase.definition.run_id}/research_synthesis.md`,
        story: `conclusions/${evalCase.definition.run_id}/story.md`,
    };
    const modelName = resolveClaudeModel(options.model);
    const provider = options.provider ?? (options.mode === 'fake' ? 'offline-scripted' : 'anthropic-compatible');
    const visionAvailable = options.visionAvailable
        ?? (options.mode === 'fake' || !modelName.toLowerCase().includes('deepseek'));
    const pixelLevelVisualVerification = visionAvailable ? 'available' : 'deferred';
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
    }
    catch {
        // A source archive can run the harness without Git metadata.
    }
    const reportBase = {
        schema_version: 2,
        mode: options.mode,
        started_at: startedAt,
        model: options.mode === 'fake' ? 'scripted-offline-fake' : modelName,
        provider,
        capabilities: {
            pixel_level_visual_verification: pixelLevelVisualVerification,
        },
        repository_commit: repositoryCommit,
        production_skill_sha256: sha256(installedSkill),
        case: {
            id: evalCase.definition.id,
            name: evalCase.definition.name,
            fingerprint_sha256: evalCase.fingerprint,
            provenance: evalCase.definition.provenance,
        },
        fixture_path: prepared.usesLiveProject ? '(none; direct live project)' : evalCase.root,
        project_path: prepared.projectRoot,
        installed_skill_path: prepared.installedSkillPath,
        outputs,
    };
    if (options.mode === 'live' && !apiKey) {
        const report = {
            ...reportBase,
            status: 'blocked',
            finished_at: isoNow(),
            harness: {
                status: 'NOT_RUN',
                assertions: [{ id: 'live_sdk_session', status: 'not_run', detail: 'Anthropic credential is unavailable.' }],
            },
            semantic_review: blockedSemanticReview('No live behavior was generated because the Anthropic-compatible credential is unavailable.'),
            capabilities: {
                pixel_level_visual_verification: pixelLevelVisualVerification,
            },
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
    const behaviorModel = options.mode === 'live'
        ? new AnthropicEvalModel(modelName, apiKey)
        : new ScriptedFakeEvalModel(evalCase.definition, paths);
    const conversation = new EvalConversation(prepared.projectRoot, behaviorModel, prepared.systemPrompt, secrets, paths, visionAvailable);
    let storySnapshotPath = outputs.story_before_gate2_revision;
    let environmentBlocker = null;
    let behaviorFailure = null;
    try {
        conversation.addHumanMessage(prepared.usesLiveProject
            ? [
                '在这个真实 QDD 项目中直接执行已安装的 production $qdd-conclude skill。不要复制 fixture，也不要把模拟科学证据当作质量验收。',
                `使用新的 run-id ${evalCase.definition.run_id}，只写入 ${paths.conclusionDir}/。`,
                '先读取 project instructions、memory、evolution、artifacts，再核验支持主张的 study reports、tables、captions 和 provenance。',
                'research_synthesis.md 与 story.md 默认英文。synthesis 必须是完整科学底稿和 source trail，包含跨 study 综合、样本/方法/统计/数据集事实、decisive values、候选图表及其用途、已知文献标识和精确的文献需求。',
                '当前模型的像素核验不可用时，以报告、caption、study output 和 provenance 选择图表；不得声称未检查的视觉细节，并在文稿中记录 pixel-level verification deferred。完成 research_synthesis.md 后停在 Gate 1；不得提前创建 story.md，也不得生成 TeX。',
            ].join(' ')
            : [
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
    }
    catch (error) {
        if (error instanceof LiveSdkError)
            environmentBlocker = error.message;
        else
            behaviorFailure = error.message;
    }
    const synthesisExists = await exists(outputs.research_synthesis);
    const storyExists = await exists(outputs.story);
    const storyBeforeRevision = await exists(storySnapshotPath) ? await fs.readFile(storySnapshotPath, 'utf-8') : '';
    const storyAfterRevision = storyExists ? await fs.readFile(outputs.story, 'utf-8') : '';
    const secretViolations = [
        ...await scanGeneratedTextForSecrets(outputRoot, secrets),
        ...await scanGeneratedTextForSecrets(prepared.projectRoot, secrets, paths.conclusionDir),
    ];
    const assertions = environmentBlocker
        ? [{ id: 'live_sdk_session', status: 'not_run', detail: environmentBlocker }]
        : [
            assertion('conversation_completed', behaviorFailure === null, behaviorFailure ?? 'All scripted human turns completed through Gate 2 acceptance.'),
            ...evaluateAssertions(conversation.accessLog, conversation.gates, prepared.usesLiveProject, evalCase.definition, paths, installedSkill, synthesisExists, storyExists, storyBeforeRevision, storyAfterRevision, secretViolations),
        ];
    const harnessPassed = assertions.length > 0 && assertions.every((entry) => entry.status === 'pass');
    let semanticReview = blockedSemanticReview(options.mode === 'fake'
        ? 'Offline fake mode validates harness contracts only; scientific manuscript quality requires a live semantic review.'
        : behaviorFailure ?? environmentBlocker ?? 'Behavior harness did not pass, so semantic review was not run.');
    let semanticTranscript = [];
    let semanticAccessLog = [];
    let reviewerDiagnostic = prepared.usesLiveProject
        ? 'Semantic reviewer was not run for the direct live-project writer evaluation; it is advisory and must not consume an additional model run.'
        : null;
    if (options.mode === 'live' && harnessPassed && !environmentBlocker && !prepared.usesLiveProject) {
        try {
            const reviewerModel = new AnthropicEvalModel(modelName, apiKey);
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
        }
        catch (error) {
            reviewerDiagnostic = error instanceof LiveSdkError
                ? `Semantic reviewer unavailable: ${error.message}`
                : `Semantic reviewer failed: ${error.message}`;
            semanticReview = blockedSemanticReview(reviewerDiagnostic);
        }
    }
    const status = environmentBlocker
        ? (options.mode === 'live' ? 'blocked' : 'failed')
        : harnessPassed ? 'passed' : 'failed';
    const report = {
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
        environment_blockers: [
            ...(environmentBlocker ? [redactSensitiveText(environmentBlocker, secrets)] : []),
            ...(reviewerDiagnostic ? [redactSensitiveText(reviewerDiagnostic, secrets)] : []),
        ],
        gates: conversation.gates,
        stage_results: conversation.stageResults,
    };
    await writeReportArtifacts(report, conversation, semanticTranscript, semanticAccessLog);
    return report;
}
function relativePathInsideProject(projectRoot, candidatePath, field) {
    const resolved = path.resolve(candidatePath);
    const relative = path.relative(projectRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative))
        throw new Error(`${field} must be inside the supplied QDD project.`);
    return relative.split(path.sep).join('/');
}
async function currentRepositoryCommit() {
    try {
        return (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: packageRoot })).stdout.trim();
    }
    catch {
        return 'unknown';
    }
}
export async function runConcludeManuscriptEval(options) {
    const startedAt = isoNow();
    const projectRoot = path.resolve(options.projectPath);
    await assertReadableQddProject(projectRoot);
    const resumeConclusion = path.resolve(options.resumeConclusion);
    const conclusionDir = relativePathInsideProject(projectRoot, resumeConclusion, 'resumeConclusion');
    const synthesis = `${conclusionDir}/research_synthesis.md`;
    const story = `${conclusionDir}/story.md`;
    await fs.access(resolveProjectPath(projectRoot, synthesis));
    await fs.access(resolveProjectPath(projectRoot, story));
    const finalPaper = `${conclusionDir}/final_paper`;
    const outputRoot = path.resolve(options.outputRoot);
    if (isPathWithinRoot(outputRoot, projectRoot) || isPathWithinRoot(projectRoot, outputRoot)) {
        throw new Error('Manuscript evaluation output directory must not overlap the QDD project.');
    }
    await fs.rm(outputRoot, { recursive: true, force: true });
    await fs.mkdir(outputRoot, { recursive: true });
    await initCommand(projectRoot, { tools: ['claude'], refreshBootstrap: true });
    const installedSkillPath = path.join(projectRoot, '.claude', 'skills', 'qdd-conclude', 'SKILL.md');
    const installedSkill = await fs.readFile(installedSkillPath, 'utf-8');
    const modelName = resolveClaudeModel(options.model);
    const provider = options.provider ?? 'anthropic-compatible';
    const visionAvailable = options.visionAvailable ?? !modelName.toLowerCase().includes('deepseek');
    const pixelLevelVisualVerification = visionAvailable ? 'available' : 'deferred';
    const apiKey = options.credentialOverride === undefined ? resolveClaudeApiKey() : options.credentialOverride ?? undefined;
    const transcriptPath = path.join(outputRoot, 'transcript.json');
    const accessLogPath = path.join(outputRoot, 'access-log.json');
    const reportJsonPath = path.join(outputRoot, 'report.json');
    const reportMarkdownPath = path.join(outputRoot, 'report.md');
    const base = {
        schema_version: 1,
        started_at: startedAt,
        model: modelName,
        provider,
        repository_commit: await currentRepositoryCommit(),
        production_skill_sha256: sha256(installedSkill),
        project_path: projectRoot,
        resume_conclusion: resumeConclusion,
        final_paper: path.join(projectRoot, finalPaper),
        transcript: transcriptPath,
        access_log: accessLogPath,
        report_json: reportJsonPath,
        report_markdown: reportMarkdownPath,
        capabilities: { pixel_level_visual_verification: pixelLevelVisualVerification },
    };
    const writeReport = async (report, conversation) => {
        await fs.writeFile(transcriptPath, `${JSON.stringify(conversation?.transcript ?? [], null, 2)}\n`, 'utf-8');
        await fs.writeFile(accessLogPath, `${JSON.stringify(conversation?.accessLog ?? [], null, 2)}\n`, 'utf-8');
        await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
        const checks = report.manuscript_validation
            ? Object.entries(report.manuscript_validation.checks).map(([name, status]) => `- ${status.toUpperCase()} \`${name}\``)
            : ['- Not run.'];
        await fs.writeFile(reportMarkdownPath, [
            '# QDD Conclude Manuscript Evaluation', '',
            `- Status: \`${report.status}\``, `- Model: \`${report.model}\``, `- Provider: \`${report.provider}\``,
            `- Resume conclusion: \`${report.resume_conclusion}\``, `- Final paper: \`${report.final_paper}\``,
            `- Pixel-level visual verification: \`${report.capabilities.pixel_level_visual_verification}\``,
            `- PDF status: \`${report.pdf_status}\``, '', '## Mechanical Validation', '', ...checks,
            '', '## Environment Blockers', '', ...(report.environment_blockers.length > 0 ? report.environment_blockers.map((entry) => `- ${entry}`) : ['- None.']),
            '', '## Outputs', '', `- Transcript: \`${transcriptPath}\``, `- Access log: \`${accessLogPath}\``,
        ].join('\n').concat('\n'), 'utf-8');
    };
    if (!apiKey) {
        const report = {
            ...base,
            status: 'blocked',
            finished_at: isoNow(),
            pdf_status: 'not_run',
            manuscript_validation: null,
            environment_blockers: ['Anthropic SDK credential is missing. Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY, or configure ~/.claude/settings.json.'],
        };
        await writeReport(report, null);
        return report;
    }
    const paths = { conclusionDir, synthesis, story };
    const synthesisBefore = await fs.readFile(resolveProjectPath(projectRoot, synthesis), 'utf-8');
    const storyBefore = await fs.readFile(resolveProjectPath(projectRoot, story), 'utf-8');
    const conversation = new EvalConversation(projectRoot, new AnthropicEvalModel(modelName, apiKey), installedSkill, [apiKey], paths, visionAvailable);
    conversation.stage = 'manuscript';
    conversation.addHumanMessage([
        'Gate 2 已经接受下列已存在的 story.md。现在只执行 $qdd-conclude 的 manuscript drafting 阶段：绝不能重跑 synthesis、Gate 1、story writing、Gate 2 或 semantic review，也不得改写 research_synthesis.md 或 story.md。',
        `先读取 ${synthesis}、${story} 及支持所选证据的原始 study outputs；从已接受 story 的精确 citation-needed anchors 进行真实文献检索并核验。`,
        `在 ${finalPaper}/ 生成独立 English Nature package：main.tex、references.bib、sn-jnl.cls、latexmkrc、bst/sn-nature.bst、figures/。使用 copy_nature_template 复制三个模板资产，使用 copy_project_file 复制所选 figure assets。`,
        'main.tex 必须使用 \\documentclass[pdflatex,sn-nature]{sn-jnl}，保留 title、keywords、bibliography，省略 author/affiliation，仅含 Abstract、Introduction、Results、Discussion、Methods；bibliography 在 Methods 后，所有 figure/table environments 在 bibliography 后。',
        '这是完整英文初稿写作，而非 story 的逐段转换：可根据 synthesis 和原始 sources 扩写，但不得改变接受的中心贡献、Results logic、图表/证据选择、claim strength 或结论。不要保留 TODO、TBD、citation needed、待补或空 section。无 pixel vision 时仅依据 captions、reports、study outputs 和 provenance；不要声称未检验像素细节。写完全部文件后用一条完成消息停止。',
    ].join(' '));
    let manuscriptValidation = null;
    let environmentBlockers = [];
    let status = 'passed';
    try {
        await conversation.runUntilPause(32);
        if (sha256(await fs.readFile(resolveProjectPath(projectRoot, synthesis), 'utf-8')) !== sha256(synthesisBefore)
            || sha256(await fs.readFile(resolveProjectPath(projectRoot, story), 'utf-8')) !== sha256(storyBefore)) {
            throw new Error('Manuscript stage modified the accepted synthesis or story.');
        }
        const evidenceRead = conversation.accessLog.some((entry) => entry.action === 'read'
            && entry.path !== synthesis && entry.path !== story && /^(?:artifacts\/|studies\/)/.test(entry.path));
        if (!evidenceRead)
            throw new Error('Manuscript stage did not read an underlying project evidence source.');
        manuscriptValidation = await validateManuscriptPackage(path.join(projectRoot, finalPaper));
    }
    catch (error) {
        status = error instanceof LiveSdkError ? 'blocked' : 'failed';
        environmentBlockers = [redactSensitiveText(error.message, [apiKey])];
    }
    const report = {
        ...base,
        status,
        finished_at: isoNow(),
        pdf_status: manuscriptValidation?.pdf_status ?? 'not_run',
        manuscript_validation: manuscriptValidation,
        environment_blockers: environmentBlockers,
    };
    await writeReport(report, conversation);
    return report;
}
//# sourceMappingURL=conclude-behavior-eval.js.map