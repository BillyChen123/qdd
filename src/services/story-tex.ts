import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { accessSync, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { deflateSync } from 'node:zlib';
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const execFileAsync = promisify(execFile);
const LABEL_PATTERN = /^[A-Za-z][A-Za-z0-9:._-]*$/;
const FIGURE_LABEL_SUFFIX = /^\s*\{#(fig:[A-Za-z][A-Za-z0-9:._-]*)\}\s*$/;
const TABLE_CAPTION = /^Table:\s+(.+?)\s+\{#(tbl:[A-Za-z][A-Za-z0-9:._-]*)\}\s*$/i;
const CITATION_ANCHOR = /^\[@([A-Za-z0-9:._/-]+)(?:\s*;\s*@([A-Za-z0-9:._/-]+))*\]/;
const REFERENCE_ANCHOR = /^@(fig|tbl):([A-Za-z][A-Za-z0-9:._-]*)/;

type MdNode = {
  type: string;
  depth?: number;
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  lang?: string | null;
  ordered?: boolean;
  start?: number | null;
  align?: Array<'left' | 'right' | 'center' | null>;
  children?: MdNode[];
};

export interface TexCompiler {
  kind: 'latexmk' | 'tectonic' | 'pdflatex';
  command: string;
  bibtexCommand?: string;
}

export interface StoryTexBlock {
  index: number;
  type: string;
  sha256: string;
}

export interface StoryTexReport {
  schema_version: 1;
  story_path: string;
  story_sha256: string;
  output_dir: string;
  gate2_accepted: true;
  title: string;
  section_order: string[];
  figures: Array<{ label: string; source: string; output: string; caption: string }>;
  tables: Array<{ label: string; caption: string }>;
  citations: string[];
  references: string[];
  bibliography_entries: string[];
  coverage: {
    story_blocks: number;
    rendered_blocks: number;
    ratio: number;
    blocks: StoryTexBlock[];
  };
  checks: {
    tex_syntax: 'passed';
    assets: 'passed';
    references: 'passed';
    citations: 'passed';
    bibtex: 'passed';
    story_coverage: 'passed';
    section_order: 'passed';
  };
  tex_compiler: string | null;
  pdf_status: 'compiled' | 'unavailable';
  pdf_path: string | null;
}

export interface RenderAcceptedStoryOptions {
  storyPath: string;
  projectRoot?: string;
  outputDir?: string;
  bibliographyPath?: string;
  gate2Accepted: boolean;
  texCompiler?: TexCompiler | null;
}

interface FigureSpec {
  nodeIndex: number;
  label: string;
  sourceAbsolute: string;
  sourceRelative: string;
  outputName: string;
  conversion: 'copy' | 'ppm-to-png';
  caption: string;
}

interface TableSpec {
  captionNodeIndex: number;
  tableNodeIndex: number;
  label: string;
  caption: string;
}

interface StoryAnalysis {
  root: MdNode;
  title: string;
  titleNodeIndex: number;
  abstractHeadingIndex: number;
  sectionOrder: string[];
  figures: FigureSpec[];
  tables: TableSpec[];
  citations: string[];
  references: string[];
  blocks: StoryTexBlock[];
}

interface RenderContext {
  figuresByNode: Map<number, FigureSpec>;
  tablesByNode: Map<number, TableSpec>;
  tableCaptionNodes: Set<number>;
  citations: Set<string>;
  references: Set<string>;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function nodeText(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  if (node.type === 'image') return node.alt ?? '';
  return (node.children ?? []).map(nodeText).join('');
}

function blockDigest(node: MdNode): string {
  const canonicalNode = (value: MdNode): Record<string, unknown> => ({
    type: value.type,
    depth: value.depth ?? null,
    value: value.value ?? null,
    url: value.url ?? null,
    alt: value.alt ?? null,
    title: value.title ?? null,
    lang: value.lang ?? null,
    ordered: value.ordered ?? null,
    start: value.start ?? null,
    align: value.align ?? null,
    children: (value.children ?? []).map(canonicalNode),
  });
  const canonical = JSON.stringify(canonicalNode(node));
  return sha256(canonical);
}

function assertInside(root: string, candidate: string, field: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${field} must stay inside the QDD project: ${candidate}`);
  }
}

function parseMarkdown(story: string): MdNode {
  return unified().use(remarkParse).use(remarkGfm).parse(story) as Root as MdNode;
}

function collectTextAnchors(value: string, citations: Set<string>, references: Set<string>): void {
  let remaining = value;
  while (remaining.length > 0) {
    const citation = remaining.match(CITATION_ANCHOR);
    if (citation) {
      const keys = citation[0].match(/@([A-Za-z0-9:._/-]+)/g) ?? [];
      for (const key of keys) citations.add(key.slice(1));
      remaining = remaining.slice(citation[0].length);
      continue;
    }
    const reference = remaining.match(REFERENCE_ANCHOR);
    if (reference) {
      references.add(`${reference[1]}:${reference[2]}`);
      remaining = remaining.slice(reference[0].length);
      continue;
    }
    remaining = remaining.slice(1);
  }
}

function walkTextNodes(node: MdNode, visit: (value: string) => void): void {
  if (node.type === 'text' && typeof node.value === 'string') visit(node.value);
  if (node.type === 'image' && node.alt) visit(node.alt);
  for (const child of node.children ?? []) walkTextNodes(child, visit);
}

async function analyzeStory(story: string, storyPath: string, projectRoot: string): Promise<StoryAnalysis> {
  const root = parseMarkdown(story);
  const children = root.children ?? [];
  const significant = children.filter((node) => node.type !== 'yaml');
  if (significant.length === 0) throw new Error('story.md is empty.');

  const titleNodeIndex = children.findIndex((node) => node.type === 'heading' && node.depth === 1);
  if (titleNodeIndex < 0) throw new Error('story.md must contain one H1 title.');
  if (titleNodeIndex !== 0) throw new Error('story.md H1 title must be the first Markdown block.');
  if (children.some((node, index) => index !== titleNodeIndex && node.type === 'heading' && node.depth === 1)) {
    throw new Error('story.md must contain exactly one H1 title.');
  }

  const title = normalizeText(nodeText(children[titleNodeIndex]!));
  if (!title) throw new Error('story.md H1 title must not be empty.');
  const abstractHeadingIndex = children.findIndex(
    (node) => node.type === 'heading' && node.depth === 2 && normalizeText(nodeText(node)).toLowerCase() === 'abstract'
  );
  if (abstractHeadingIndex < 0) throw new Error('story.md must contain a `## Abstract` section.');

  const citations = new Set<string>();
  const references = new Set<string>();
  const figures: FigureSpec[] = [];
  const tables: TableSpec[] = [];
  const labels = new Set<string>();
  const tableCaptionNodes = new Set<number>();
  const sectionOrder: string[] = [];

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]!;
    walkTextNodes(node, (value) => collectTextAnchors(value, citations, references));
    if (node.type === 'heading') sectionOrder.push(normalizeText(nodeText(node)));

    if (node.type === 'paragraph' && node.children?.[0]?.type === 'image') {
      const image = node.children[0];
      const suffix = node.children.slice(1).map(nodeText).join('').match(FIGURE_LABEL_SUFFIX);
      if (!suffix) {
        throw new Error(`Figure at story block ${index + 1} must end with a {#fig:key} label.`);
      }
      const label = suffix[1]!;
      if (!LABEL_PATTERN.test(label) || labels.has(label)) throw new Error(`Duplicate or invalid label: ${label}`);
      labels.add(label);
      if (!image.url || /^(?:https?:|data:)/i.test(image.url)) {
        throw new Error(`Figure ${label} must use a project-local asset path.`);
      }
      const sourceAbsolute = path.resolve(path.dirname(storyPath), decodeURIComponent(image.url));
      assertInside(projectRoot, sourceAbsolute, `Figure ${label}`);
      await fs.access(sourceAbsolute).catch(() => {
        throw new Error(`Missing figure asset for ${label}: ${sourceAbsolute}`);
      });
      const extension = path.extname(sourceAbsolute).toLowerCase();
      if (!['.pdf', '.png', '.jpg', '.jpeg', '.ppm'].includes(extension)) {
        throw new Error(`Figure ${label} uses unsupported TeX asset type '${extension || '(none)'}'. Use PDF, PNG, JPEG, or P3 PPM.`);
      }
      const conversion = extension === '.ppm' ? 'ppm-to-png' : 'copy';
      const outputExtension = extension === '.ppm' ? '.png' : extension;
      const outputName = `${label.replace(/[^A-Za-z0-9._-]/g, '-')}${outputExtension}`;
      figures.push({
        nodeIndex: index,
        label,
        sourceAbsolute,
        sourceRelative: path.relative(projectRoot, sourceAbsolute).split(path.sep).join('/'),
        outputName,
        conversion,
        caption: image.alt?.trim() || label,
      });
    }

    if (node.type === 'paragraph') {
      const match = normalizeText(nodeText(node)).match(TABLE_CAPTION);
      if (match) {
        const next = children[index + 1];
        if (!next || next.type !== 'table') throw new Error(`Table caption ${match[2]} must immediately precede a GFM table.`);
        const label = match[2]!;
        if (labels.has(label)) throw new Error(`Duplicate or invalid label: ${label}`);
        labels.add(label);
        tableCaptionNodes.add(index);
        tables.push({ captionNodeIndex: index, tableNodeIndex: index + 1, label, caption: match[1]! });
      }
    }
  }

  for (const reference of references) {
    if (!labels.has(reference)) throw new Error(`Broken story cross-reference: @${reference}`);
  }

  return {
    root,
    title,
    titleNodeIndex,
    abstractHeadingIndex,
    sectionOrder,
    figures,
    tables,
    citations: [...citations],
    references: [...references],
    blocks: children.map((node, index) => ({ index, type: node.type, sha256: blockDigest(node) })),
  };
}

const UNICODE_TEX: Record<string, string> = {
  'α': '\\ensuremath{\\alpha}', 'β': '\\ensuremath{\\beta}', 'γ': '\\ensuremath{\\gamma}',
  'δ': '\\ensuremath{\\delta}', 'Δ': '\\ensuremath{\\Delta}', 'μ': '\\ensuremath{\\mu}',
  'µ': '\\ensuremath{\\mu}', '±': '\\ensuremath{\\pm}', '×': '\\ensuremath{\\times}',
  '≤': '\\ensuremath{\\leq}', '≥': '\\ensuremath{\\geq}', '°': '\\ensuremath{^{\\circ}}',
  '→': '\\ensuremath{\\rightarrow}', '←': '\\ensuremath{\\leftarrow}', '−': '-',
};

function escapeTex(value: string): string {
  return [...value].map((character) => {
    if (UNICODE_TEX[character]) return UNICODE_TEX[character];
    switch (character) {
      case '\\': return '\\textbackslash{}';
      case '{': return '\\{';
      case '}': return '\\}';
      case '#': return '\\#';
      case '$': return '\\$';
      case '%': return '\\%';
      case '&': return '\\&';
      case '_': return '\\_';
      case '^': return '\\textasciicircum{}';
      case '~': return '\\textasciitilde{}';
      default: return character;
    }
  }).join('');
}

function renderText(value: string, context: RenderContext): string {
  let output = '';
  let index = 0;
  while (index < value.length) {
    const remaining = value.slice(index);
    if (remaining.startsWith('$$')) {
      const end = value.indexOf('$$', index + 2);
      if (end < 0) throw new Error('Unclosed display math delimiter in story.md.');
      output += `\\[${value.slice(index + 2, end)}\\]`;
      index = end + 2;
      continue;
    }
    if (remaining.startsWith('$')) {
      const end = value.indexOf('$', index + 1);
      if (end < 0) throw new Error('Unclosed inline math delimiter in story.md.');
      output += `$${value.slice(index + 1, end)}$`;
      index = end + 1;
      continue;
    }
    const citation = remaining.match(CITATION_ANCHOR);
    if (citation) {
      const keys = (citation[0].match(/@([A-Za-z0-9:._/-]+)/g) ?? []).map((key) => key.slice(1));
      keys.forEach((key) => context.citations.add(key));
      output += `\\cite{${keys.join(',')}}`;
      index += citation[0].length;
      continue;
    }
    const reference = remaining.match(REFERENCE_ANCHOR);
    if (reference) {
      const label = `${reference[1]}:${reference[2]}`;
      context.references.add(label);
      output += `${reference[1] === 'fig' ? 'Figure' : 'Table'}~\\ref{${label}}`;
      index += reference[0].length;
      continue;
    }
    output += escapeTex(value[index]!);
    index += 1;
  }
  return output;
}

function renderInline(node: MdNode, context: RenderContext): string {
  switch (node.type) {
    case 'text': return renderText(node.value ?? '', context);
    case 'emphasis': return `\\emph{${renderInlines(node.children, context)}}`;
    case 'strong': return `\\textbf{${renderInlines(node.children, context)}}`;
    case 'delete': return `\\sout{${renderInlines(node.children, context)}}`;
    case 'inlineCode': return `\\texttt{${escapeTex(node.value ?? '')}}`;
    case 'link': return `\\href{${escapeTex(node.url ?? '')}}{${renderInlines(node.children, context)}}`;
    case 'break': return '\\\\\n';
    case 'image': throw new Error('Figures must occupy their own Markdown paragraph.');
    default: throw new Error(`Unsupported inline Markdown node: ${node.type}`);
  }
}

function renderInlines(nodes: MdNode[] | undefined, context: RenderContext): string {
  return (nodes ?? []).map((node) => renderInline(node, context)).join('');
}

function renderTable(node: MdNode, spec: TableSpec, context: RenderContext): string {
  const rows = node.children ?? [];
  if (rows.length === 0) throw new Error(`Table ${spec.label} has no rows.`);
  const columnCount = rows[0]?.children?.length ?? 0;
  if (columnCount === 0 || rows.some((row) => (row.children?.length ?? 0) !== columnCount)) {
    throw new Error(`Table ${spec.label} has inconsistent row widths.`);
  }
  const alignment = (node.align ?? []).map((entry) => entry === 'right' ? 'r' : entry === 'center' ? 'c' : 'l');
  const columns = alignment.length === columnCount ? alignment.join('') : 'l'.repeat(columnCount);
  const renderedRows = rows.map((row, rowIndex) => {
    const cells = (row.children ?? []).map((cell) => renderInlines(cell.children, context));
    return `${cells.join(' & ')} \\\\${rowIndex === 0 ? '\n\\midrule' : ''}`;
  });
  return [
    '\\begin{table}[htbp]',
    '\\centering',
    `\\caption{${renderText(spec.caption, context)}}`,
    `\\label{${spec.label}}`,
    '\\resizebox{\\textwidth}{!}{%',
    `\\begin{tabular}{${columns}}`,
    '\\toprule',
    ...renderedRows,
    '\\bottomrule',
    '\\end{tabular}',
    '}',
    '\\end{table}',
  ].join('\n');
}

function renderList(node: MdNode, context: RenderContext): string {
  const environment = node.ordered ? 'enumerate' : 'itemize';
  const items = (node.children ?? []).map((item) => {
    const body = (item.children ?? []).map((child) => renderBlock(child, -1, context)).join('\n');
    return `\\item ${body}`;
  });
  return [`\\begin{${environment}}`, ...items, `\\end{${environment}}`].join('\n');
}

function renderBlock(node: MdNode, index: number, context: RenderContext): string {
  const figure = context.figuresByNode.get(index);
  if (figure) {
    return [
      '\\begin{figure}[htbp]',
      '\\centering',
      `\\includegraphics[width=\\linewidth]{figures/${escapeTex(figure.outputName)}}`,
      `\\caption{${renderText(figure.caption, context)}}`,
      `\\label{${figure.label}}`,
      '\\end{figure}',
    ].join('\n');
  }
  const table = context.tablesByNode.get(index);
  if (table) return renderTable(node, table, context);

  switch (node.type) {
    case 'paragraph': return renderInlines(node.children, context);
    case 'heading': {
      const command = node.depth === 2 ? 'section' : node.depth === 3 ? 'subsection' : 'subsubsection';
      return `\\${command}{${renderInlines(node.children, context)}}`;
    }
    case 'blockquote': return `\\begin{quote}\n${(node.children ?? []).map((child) => renderBlock(child, -1, context)).join('\n\n')}\n\\end{quote}`;
    case 'list': return renderList(node, context);
    case 'code': return `\\begin{lstlisting}${node.lang ? `[language=${escapeTex(node.lang)}]` : ''}\n${node.value ?? ''}\n\\end{lstlisting}`;
    case 'thematicBreak': return '\\medskip\\hrule\\medskip';
    case 'table': throw new Error(`GFM table at story block ${index + 1} requires a preceding Table: caption {#tbl:key}.`);
    case 'html': throw new Error('Raw HTML is not supported in accepted story.md; express the content in Markdown.');
    default: throw new Error(`Unsupported Markdown block: ${node.type}`);
  }
}

function sourceMarker(block: StoryTexBlock): string {
  return `% qdd-story-block:${block.index} type:${block.type} sha256:${block.sha256}`;
}

function renderMainTex(analysis: StoryAnalysis): { tex: string; renderedBlocks: StoryTexBlock[] } {
  const children = analysis.root.children ?? [];
  const context: RenderContext = {
    figuresByNode: new Map(analysis.figures.map((figure) => [figure.nodeIndex, figure])),
    tablesByNode: new Map(analysis.tables.map((table) => [table.tableNodeIndex, table])),
    tableCaptionNodes: new Set(analysis.tables.map((table) => table.captionNodeIndex)),
    citations: new Set(),
    references: new Set(),
  };
  const body: string[] = [];
  const renderedBlocks: StoryTexBlock[] = [];
  let inAbstract = false;
  const renderedTitle = renderInlines(children[analysis.titleNodeIndex]?.children, context);

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]!;
    const block = analysis.blocks[index]!;
    renderedBlocks.push(block);
    if (index === analysis.titleNodeIndex) {
      body.push(sourceMarker(block));
      continue;
    }
    if (index === analysis.abstractHeadingIndex) {
      body.push(sourceMarker(block), '\\begin{abstract}');
      inAbstract = true;
      continue;
    }
    if (inAbstract && node.type === 'heading') {
      body.push('\\end{abstract}');
      inAbstract = false;
    }
    body.push(sourceMarker(block));
    if (context.tableCaptionNodes.has(index)) continue;
    body.push(renderBlock(node, index, context), '');
  }
  if (inAbstract) body.push('\\end{abstract}');

  if ([...context.citations].sort().join('\0') !== [...analysis.citations].sort().join('\0')) {
    throw new Error('Internal citation coverage mismatch while rendering story.md.');
  }
  if ([...context.references].sort().join('\0') !== [...analysis.references].sort().join('\0')) {
    throw new Error('Internal cross-reference coverage mismatch while rendering story.md.');
  }

  const bibliography = analysis.citations.length > 0
    ? '\n\\bibliographystyle{plain}\n\\bibliography{references}'
    : '';
  const tex = [
    '\\documentclass[11pt]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage{graphicx}',
    '\\usepackage{booktabs}',
    '\\usepackage{hyperref}',
    '\\usepackage[normalem]{ulem}',
    '\\usepackage{listings}',
    '\\usepackage[margin=1in]{geometry}',
    '\\graphicspath{{figures/}}',
    `\\title{${renderedTitle}}`,
    '\\date{}',
    '\\begin{document}',
    '\\maketitle',
    ...body,
    bibliography,
    '\\end{document}',
    '',
  ].join('\n');
  return { tex, renderedBlocks };
}

function parseBibliography(input: string): Array<Record<string, unknown>> {
  if (!input.trim()) return [];
  let cite: Cite;
  try {
    cite = new Cite(input);
  } catch (error) {
    throw new Error(`Malformed BibTeX: ${(error as Error).message}`);
  }
  const keys = cite.data.map((entry) => String(entry['citation-key'] ?? entry.id ?? ''));
  if (keys.some((key) => !key)) throw new Error('Malformed BibTeX entry without a citation key.');
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length > 0) throw new Error(`Duplicate BibTeX keys: ${[...new Set(duplicates)].join(', ')}`);
  return cite.data;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
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
  const tokens = source.split(/\r?\n/)
    .flatMap((line) => line.replace(/#.*/, '').trim().split(/\s+/))
    .filter(Boolean);
  if (tokens[0] !== 'P3') throw new Error('Only ASCII P3 PPM figure assets are supported.');
  const width = Number(tokens[1]);
  const height = Number(tokens[2]);
  const maxValue = Number(tokens[3]);
  const samples = tokens.slice(4).map(Number);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || maxValue <= 0) {
    throw new Error('Invalid PPM dimensions or max value.');
  }
  if (samples.length !== width * height * 3 || samples.some((sample) => !Number.isFinite(sample) || sample < 0 || sample > maxValue)) {
    throw new Error('Invalid PPM sample data.');
  }
  const scanlines = Buffer.alloc(height * (1 + width * 3));
  let target = 0;
  for (let row = 0; row < height; row += 1) {
    scanlines[target++] = 0;
    for (let column = 0; column < width; column += 1) {
      const sourceIndex = (row * width + column) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        scanlines[target++] = Math.round((samples[sourceIndex + channel]! / maxValue) * 255);
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function copyFigure(figure: FigureSpec, destination: string): Promise<void> {
  if (figure.conversion === 'copy') {
    await fs.copyFile(figure.sourceAbsolute, destination);
    return;
  }
  const source = await fs.readFile(figure.sourceAbsolute, 'utf-8');
  await fs.writeFile(destination, ppmToPng(source));
}

function selectBibliography(input: string, citationKeys: string[]): { bibtex: string; keys: string[] } {
  const entries = parseBibliography(input);
  const byKey = new Map(entries.map((entry) => [String(entry['citation-key'] ?? entry.id), entry]));
  const missing = citationKeys.filter((key) => !byKey.has(key));
  if (missing.length > 0) throw new Error(`Missing verified BibTeX entries for story citations: ${missing.join(', ')}`);
  const selected = citationKeys.map((key) => byKey.get(key)!);
  const bibtex = selected.length > 0 ? new Cite(selected).format('bibtex').trim() : '% No citation anchors in accepted story.md.';
  const parsedSelected = parseBibliography(bibtex);
  const selectedKeys = parsedSelected.map((entry) => String(entry['citation-key'] ?? entry.id));
  return { bibtex: `${bibtex}\n`, keys: selectedKeys };
}

function stripTexComments(tex: string): string {
  return tex.split('\n').map((line) => line.replace(/(^|[^\\])%.*/, '$1')).join('\n');
}

function validateBalancedTex(tex: string): void {
  const content = stripTexComments(tex);
  let depth = 0;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]!;
    const escaped = index > 0 && content[index - 1] === '\\' && (index < 2 || content[index - 2] !== '\\');
    if (escaped) continue;
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth < 0) throw new Error('TeX syntax check failed: unmatched closing brace.');
  }
  if (depth !== 0) throw new Error('TeX syntax check failed: unmatched opening brace.');
  const environments: string[] = [];
  for (const match of content.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
    if (match[1] === 'begin') {
      environments.push(match[2]!);
    } else if (environments.pop() !== match[2]) {
      throw new Error(`TeX syntax check failed: unbalanced ${match[2]} environment.`);
    }
  }
  if (environments.length > 0) throw new Error(`TeX syntax check failed: unclosed ${environments.at(-1)} environment.`);
}

async function validatePackage(
  stageDir: string,
  tex: string,
  analysis: StoryAnalysis,
  renderedBlocks: StoryTexBlock[],
  bibliographyKeys: string[]
): Promise<void> {
  validateBalancedTex(tex);
  const labels = [...tex.matchAll(/\\label\{([^}]+)\}/g)].map((match) => match[1]!);
  const expectedLabels = [...analysis.figures.map((figure) => figure.label), ...analysis.tables.map((table) => table.label)].sort();
  if ([...labels].sort().join('\0') !== expectedLabels.join('\0')) throw new Error('TeX label coverage check failed.');
  const refs = [...tex.matchAll(/\\ref\{([^}]+)\}/g)].map((match) => match[1]!);
  const missingRefs = refs.filter((reference) => !labels.includes(reference));
  if (missingRefs.length > 0) throw new Error(`Broken TeX references: ${missingRefs.join(', ')}`);
  const citeKeys = [...tex.matchAll(/\\cite\{([^}]+)\}/g)].flatMap((match) => match[1]!.split(','));
  if ([...new Set(citeKeys)].sort().join('\0') !== [...analysis.citations].sort().join('\0')) {
    throw new Error('Story/TeX citation coverage check failed.');
  }
  if ([...bibliographyKeys].sort().join('\0') !== [...analysis.citations].sort().join('\0')) {
    throw new Error('Story/BibTeX citation coverage check failed.');
  }
  const missingCitations = citeKeys.filter((key) => !bibliographyKeys.includes(key));
  if (missingCitations.length > 0) throw new Error(`Broken TeX citations: ${missingCitations.join(', ')}`);
  const graphics = [...tex.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)].map((match) => match[1]!);
  const expectedGraphics = analysis.figures.map((figure) => `figures/${figure.outputName}`);
  if (graphics.join('\0') !== expectedGraphics.join('\0')) throw new Error('Story/TeX figure coverage or order check failed.');
  for (const graphic of graphics) await fs.access(path.join(stageDir, graphic));
  const expectedMarkers = analysis.blocks.map(sourceMarker);
  const actualMarkers = tex.split('\n').filter((line) => line.startsWith('% qdd-story-block:'));
  if (actualMarkers.join('\0') !== expectedMarkers.join('\0')) throw new Error('Story/TeX coverage or order check failed.');
  if (analysis.blocks.length !== renderedBlocks.length) throw new Error('Story/TeX block count mismatch.');
}

function findExecutable(name: string): string | null {
  const pathValue = process.env.PATH ?? '';
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, name);
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Continue through PATH without spawning repeated probe processes.
    }
  }
  return null;
}

export function probeTexCompiler(hasBibliography = true): TexCompiler | null {
  const latexmk = findExecutable('latexmk');
  const bibtex = findExecutable('bibtex');
  if (latexmk && (!hasBibliography || bibtex)) return { kind: 'latexmk', command: latexmk };
  const tectonic = findExecutable('tectonic');
  if (tectonic) return { kind: 'tectonic', command: tectonic };
  const pdflatex = findExecutable('pdflatex');
  if (pdflatex && (!hasBibliography || bibtex)) return { kind: 'pdflatex', command: pdflatex, bibtexCommand: bibtex ?? undefined };
  return null;
}

async function compilePdf(stageDir: string, compiler: TexCompiler, hasBibliography: boolean): Promise<void> {
  const common = { cwd: stageDir, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 };
  try {
    if (compiler.kind === 'latexmk') {
      await execFileAsync(compiler.command, ['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-jobname=paper', 'main.tex'], common);
    } else if (compiler.kind === 'tectonic') {
      await execFileAsync(compiler.command, ['--only-cached', '--keep-logs', '--outdir', '.', 'main.tex'], common);
      await fs.rename(path.join(stageDir, 'main.pdf'), path.join(stageDir, 'paper.pdf'));
    } else {
      const latexArgs = ['-interaction=nonstopmode', '-halt-on-error', '-jobname=paper', 'main.tex'];
      await execFileAsync(compiler.command, latexArgs, common);
      if (hasBibliography) await execFileAsync(compiler.bibtexCommand!, ['paper'], common);
      await execFileAsync(compiler.command, latexArgs, common);
      await execFileAsync(compiler.command, latexArgs, common);
    }
  } catch (error) {
    const detail = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`TeX compiler '${compiler.command}' failed: ${detail.stderr || detail.stdout || detail.message}`);
  }
  await fs.access(path.join(stageDir, 'paper.pdf'));
}

async function replaceDirectory(stageDir: string, outputDir: string): Promise<void> {
  const backupDir = `${outputDir}.backup-${process.pid}-${Date.now()}`;
  let hadOutput = false;
  try {
    await fs.rename(outputDir, backupDir);
    hadOutput = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    await fs.rename(stageDir, outputDir);
    if (hadOutput) await fs.rm(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (hadOutput) await fs.rename(backupDir, outputDir);
    throw error;
  }
}

export async function renderAcceptedStory(options: RenderAcceptedStoryOptions): Promise<StoryTexReport> {
  if (!options.gate2Accepted) {
    throw new Error('Gate 2 acceptance is required. Re-run only after the user accepts the complete story.md.');
  }
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const storyPath = path.resolve(projectRoot, options.storyPath);
  const outputDir = path.resolve(projectRoot, options.outputDir ?? path.join(path.dirname(storyPath), 'final_paper'));
  assertInside(projectRoot, storyPath, 'storyPath');
  assertInside(projectRoot, outputDir, 'outputDir');
  const story = await fs.readFile(storyPath, 'utf-8');
  const analysis = await analyzeStory(story, storyPath, projectRoot);
  let bibliographyInput = '';
  if (analysis.citations.length > 0) {
    if (!options.bibliographyPath) throw new Error('A verified --bibliography file is required because story.md contains citation anchors.');
    const bibliographyPath = path.resolve(projectRoot, options.bibliographyPath);
    assertInside(projectRoot, bibliographyPath, 'bibliographyPath');
    bibliographyInput = await fs.readFile(bibliographyPath, 'utf-8');
  }
  const bibliography = selectBibliography(bibliographyInput, analysis.citations);
  const rendered = renderMainTex(analysis);
  const stageDir = `${outputDir}.tmp-${process.pid}-${Date.now()}`;
  await fs.rm(stageDir, { recursive: true, force: true });
  await fs.mkdir(path.join(stageDir, 'figures'), { recursive: true });
  try {
    for (const figure of analysis.figures) {
      await copyFigure(figure, path.join(stageDir, 'figures', figure.outputName));
    }
    await fs.writeFile(path.join(stageDir, 'main.tex'), rendered.tex, 'utf-8');
    await fs.writeFile(path.join(stageDir, 'references.bib'), bibliography.bibtex, 'utf-8');
    await validatePackage(stageDir, rendered.tex, analysis, rendered.renderedBlocks, bibliography.keys);
    const compiler = options.texCompiler === undefined ? probeTexCompiler(analysis.citations.length > 0) : options.texCompiler;
    if (compiler) await compilePdf(stageDir, compiler, analysis.citations.length > 0);
    const report: StoryTexReport = {
      schema_version: 1,
      story_path: path.relative(projectRoot, storyPath).split(path.sep).join('/'),
      story_sha256: sha256(story),
      output_dir: path.relative(projectRoot, outputDir).split(path.sep).join('/'),
      gate2_accepted: true,
      title: analysis.title,
      section_order: analysis.sectionOrder,
      figures: analysis.figures.map((figure) => ({
        label: figure.label,
        source: figure.sourceRelative,
        output: `figures/${figure.outputName}`,
        caption: figure.caption,
      })),
      tables: analysis.tables.map(({ label, caption }) => ({ label, caption })),
      citations: analysis.citations,
      references: analysis.references,
      bibliography_entries: bibliography.keys,
      coverage: {
        story_blocks: analysis.blocks.length,
        rendered_blocks: rendered.renderedBlocks.length,
        ratio: analysis.blocks.length === 0 ? 1 : rendered.renderedBlocks.length / analysis.blocks.length,
        blocks: analysis.blocks,
      },
      checks: {
        tex_syntax: 'passed', assets: 'passed', references: 'passed', citations: 'passed',
        bibtex: 'passed', story_coverage: 'passed', section_order: 'passed',
      },
      tex_compiler: compiler?.command ?? null,
      pdf_status: compiler ? 'compiled' : 'unavailable',
      pdf_path: compiler ? `${path.relative(projectRoot, outputDir).split(path.sep).join('/')}/paper.pdf` : null,
    };
    await fs.writeFile(path.join(stageDir, 'render-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
    await replaceDirectory(stageDir, outputDir);
    return report;
  } catch (error) {
    await fs.rm(stageDir, { recursive: true, force: true });
    throw error;
  }
}
