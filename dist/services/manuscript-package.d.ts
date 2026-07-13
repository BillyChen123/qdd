export interface TexCompiler {
    kind: 'latexmk' | 'tectonic' | 'pdflatex';
    command: string;
    bibtexCommand?: string;
}
export interface ManuscriptPackageReport {
    schema_version: 1;
    package_dir: string;
    citations: string[];
    bibliography_entries: string[];
    labels: string[];
    references: string[];
    figures: string[];
    tables: string[];
    checks: Record<string, 'passed'>;
    tex_compiler: string | null;
    pdf_status: 'compiled' | 'unavailable';
    pdf_path: string | null;
}
export declare function probeTexCompiler(): TexCompiler | null;
export declare function validateManuscriptPackage(packagePath: string, texCompiler?: TexCompiler | null | undefined): Promise<ManuscriptPackageReport>;
export declare function natureTemplateRoot(): string;
//# sourceMappingURL=manuscript-package.d.ts.map