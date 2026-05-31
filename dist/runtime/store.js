import path from 'node:path';
import { FileSystemUtils } from '../utils/file-system.js';
import { parseYaml, stringifyYaml } from '../utils/yaml.js';
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
function resolveFilePath(projectRoot, targetPath) {
    return path.isAbsolute(targetPath) ? targetPath : path.join(projectRoot, targetPath);
}
export async function readYamlFile(projectRoot, relativePath) {
    const filePath = resolveFilePath(projectRoot, relativePath);
    const content = await FileSystemUtils.readFile(filePath);
    return parseYaml(content);
}
export async function writeYamlFile(projectRoot, relativePath, data) {
    const filePath = resolveFilePath(projectRoot, relativePath);
    await FileSystemUtils.writeFile(filePath, stringifyYaml(data));
}
export function serializeMarkdownDocument(frontmatter, body) {
    return `---\n${stringifyYaml(frontmatter)}---\n\n${body.trim()}\n`;
}
export async function readMarkdownDocument(projectRoot, relativePath) {
    const filePath = resolveFilePath(projectRoot, relativePath);
    const content = await FileSystemUtils.readFile(filePath);
    const match = content.match(FRONTMATTER_PATTERN);
    if (!match) {
        throw new Error(`${relativePath} is missing YAML frontmatter.`);
    }
    const fullFrontmatter = match[0];
    return {
        frontmatter: parseYaml(match[1]),
        body: content.slice(fullFrontmatter.length).trim(),
    };
}
export async function writeMarkdownDocument(projectRoot, relativePath, frontmatter, body) {
    const filePath = resolveFilePath(projectRoot, relativePath);
    await FileSystemUtils.writeFile(filePath, serializeMarkdownDocument(frontmatter, body));
}
export async function readMarkdownFrontmatter(projectRoot, relativePath) {
    const document = await readMarkdownDocument(projectRoot, relativePath);
    return document.frontmatter;
}
//# sourceMappingURL=store.js.map