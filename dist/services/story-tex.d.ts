import '@citation-js/plugin-bibtex';
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
    figures: Array<{
        label: string;
        source: string;
        output: string;
        caption: string;
    }>;
    tables: Array<{
        label: string;
        caption: string;
    }>;
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
export declare function probeTexCompiler(hasBibliography?: boolean): TexCompiler | null;
export declare function renderAcceptedStory(options: RenderAcceptedStoryOptions): Promise<StoryTexReport>;
//# sourceMappingURL=story-tex.d.ts.map