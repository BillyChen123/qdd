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
export declare function renderBulletList(values: string[], emptyLine: string): string;
export declare function renderMarkdownDocument(frontmatter: unknown, body: string): string;
export declare function renderYamlDocument(value: unknown): string;
export declare function extractBulletSection(body: string, heading: string): string[] | null;
export declare function replaceMarkdownSection(body: string, heading: string, content: string): string;
export declare function renderSchemaReferenceMarkdown(contracts: ManagedFileContract[]): string;
//# sourceMappingURL=shared.d.ts.map