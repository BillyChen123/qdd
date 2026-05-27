export interface MarkdownDocument<T> {
    frontmatter: T;
    body: string;
}
export declare function readYamlFile<T>(projectRoot: string, relativePath: string): Promise<T>;
export declare function writeYamlFile(projectRoot: string, relativePath: string, data: unknown): Promise<void>;
export declare function serializeMarkdownDocument(frontmatter: unknown, body: string): string;
export declare function readMarkdownDocument<T>(projectRoot: string, relativePath: string): Promise<MarkdownDocument<T>>;
export declare function writeMarkdownDocument(projectRoot: string, relativePath: string, frontmatter: unknown, body: string): Promise<void>;
export declare function readMarkdownFrontmatter<T>(projectRoot: string, relativePath: string): Promise<T>;
//# sourceMappingURL=store.d.ts.map