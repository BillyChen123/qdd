import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { parseYaml, stringifyYaml } from '../utils/yaml.js';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function resolveFilePath(projectRoot: string, targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.join(projectRoot, targetPath);
}

export interface MarkdownDocument<T> {
  frontmatter: T;
  body: string;
}

export async function readYamlFile<T>(projectRoot: string, relativePath: string): Promise<T> {
  const filePath = resolveFilePath(projectRoot, relativePath);
  const content = await FileSystemUtils.readFile(filePath);
  return parseYaml<T>(content);
}

export async function writeYamlFile(projectRoot: string, relativePath: string, data: unknown): Promise<void> {
  const filePath = resolveFilePath(projectRoot, relativePath);
  await FileSystemUtils.writeFile(filePath, stringifyYaml(data));
}

export function serializeMarkdownDocument(frontmatter: unknown, body: string): string {
  return `---\n${stringifyYaml(frontmatter)}---\n\n${body.trim()}\n`;
}

export async function readMarkdownDocument<T>(projectRoot: string, relativePath: string): Promise<MarkdownDocument<T>> {
  const filePath = resolveFilePath(projectRoot, relativePath);
  const content = await FileSystemUtils.readFile(filePath);
  const match = content.match(FRONTMATTER_PATTERN);

  if (!match) {
    throw new Error(`${relativePath} is missing YAML frontmatter.`);
  }

  const fullFrontmatter = match[0];
  return {
    frontmatter: parseYaml<T>(match[1]),
    body: content.slice(fullFrontmatter.length).trim(),
  };
}

export async function writeMarkdownDocument(
  projectRoot: string,
  relativePath: string,
  frontmatter: unknown,
  body: string
): Promise<void> {
  const filePath = resolveFilePath(projectRoot, relativePath);
  await FileSystemUtils.writeFile(filePath, serializeMarkdownDocument(frontmatter, body));
}

export async function readMarkdownFrontmatter<T>(projectRoot: string, relativePath: string): Promise<T> {
  const document = await readMarkdownDocument<T>(projectRoot, relativePath);
  return document.frontmatter;
}
