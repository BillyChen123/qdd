import { stringifyYaml } from '../utils/yaml.js';

export interface ManagedFieldDoc {
  path: string;
  type: string;
  required: boolean;
  description: string;
  allowedValues?: readonly string[];
}

export interface ManagedSectionDoc {
  name: string;
  required: boolean;
  description: string;
  rules?: string[];
}

export interface ManagedFileContract {
  id: string;
  title: string;
  projectPath: string;
  exampleFileName: string;
  format: 'yaml' | 'markdown';
  purpose: string;
  notes: string[];
  fields?: ManagedFieldDoc[];
  sections?: ManagedSectionDoc[];
  renderExample(): string;
}

export function renderBulletList(values: string[], emptyLine: string): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : emptyLine;
}

export function renderMarkdownDocument(frontmatter: unknown, body: string): string {
  return `---\n${stringifyYaml(frontmatter)}---\n\n${body.trim()}\n`;
}

export function renderYamlDocument(value: unknown): string {
  return stringifyYaml(value);
}

export function extractBulletSection(body: string, heading: string): string[] | null {
  const pattern = new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = body.match(pattern);
  if (!match) {
    return null;
  }

  const lines = match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));

  return lines.map((line) => line.slice(2).trim()).filter((line) => line.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 用于就地替换 Markdown 的某个二级标题段落。
// QDD 的做法是 frontmatter 管结构化真相，正文保留给人读，
// 所以这里会在不重建整份文档的前提下同步某个 section。
export function replaceMarkdownSection(body: string, heading: string, content: string): string {
  const normalizedContent = content.trim();
  const sectionPattern = new RegExp(`(## ${escapeRegExp(heading)}\\n\\n)([\\s\\S]*?)(?=\\n## |$)`);

  if (sectionPattern.test(body)) {
    return body.replace(sectionPattern, `$1${normalizedContent}\n`);
  }

  const suffix = body.trim().length > 0 ? '\n\n' : '';
  return `${body.trim()}${suffix}## ${heading}\n\n${normalizedContent}`.trim();
}

function renderFieldLine(field: ManagedFieldDoc): string {
  const required = field.required ? 'required' : 'optional';
  const allowed = field.allowedValues && field.allowedValues.length > 0 ? ` Allowed: ${field.allowedValues.join(', ')}.` : '';
  return `- \`${field.path}\` (${field.type}, ${required}): ${field.description}${allowed}`;
}

function renderSectionLine(section: ManagedSectionDoc): string {
  const required = section.required ? 'required' : 'optional';
  const rules = section.rules && section.rules.length > 0 ? ` Rules: ${section.rules.join(' ')}` : '';
  return `- \`${section.name}\` (${required}): ${section.description}${rules}`;
}

export function renderSchemaReferenceMarkdown(contracts: ManagedFileContract[]): string {
  const lines: string[] = [
    '# Managed File Schema Reference',
    '',
    '> Generated from `src/file-contracts/*` by `qdd init`.',
    '> Treat this file and `.qdd/examples/*` as refreshable references, not as protocol truth sources.',
    '',
  ];

  for (const contract of contracts) {
    lines.push(`## ${contract.title}`);
    lines.push('');
    lines.push(`- Project path: \`${contract.projectPath}\``);
    lines.push(`- Example file: \`.qdd/examples/${contract.exampleFileName}\``);
    lines.push(`- Format: ${contract.format}`);
    lines.push(`- Purpose: ${contract.purpose}`);
    lines.push('');

    if (contract.fields && contract.fields.length > 0) {
      lines.push('### Fields');
      lines.push('');
      lines.push(...contract.fields.map(renderFieldLine));
      lines.push('');
    }

    if (contract.sections && contract.sections.length > 0) {
      lines.push('### Markdown Sections');
      lines.push('');
      lines.push(...contract.sections.map(renderSectionLine));
      lines.push('');
    }

    if (contract.notes.length > 0) {
      lines.push('### Notes');
      lines.push('');
      lines.push(...contract.notes.map((note) => `- ${note}`));
      lines.push('');
    }
  }

  return `${lines.join('\n').trim()}\n`;
}
