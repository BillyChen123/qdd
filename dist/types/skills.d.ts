export interface LocalSkillEntry {
    id: string;
    path: string;
}
export type SkillDomain = 'singlecell' | 'spatial' | 'bulk' | 'general';
export type SkillStage = 'preprocess' | 'integration' | 'clustering' | 'annotation' | 'acquisition' | 'de' | 'visualization' | 'other';
export type SkillTag = 'scanpy' | 'anndata' | 'h5ad' | 'public-data' | 'dataset-search' | 'dataset-download' | 'cellxgene' | 'citation' | 'title-match' | 'raw-counts' | 'qc' | 'normalization' | 'peaks' | 'peak-matrix' | 'multiome' | 'tfidf' | 'lsi' | 'multi-sample' | 'batch-correction' | 'batch-diagnosis' | 'neighbors' | 'leiden' | 'umap' | 'markers' | 'marker-based' | 'gene-activity' | 'cell-type' | 'cell-state' | 'differential-expression' | 'differential-accessibility' | 'condition-comparison';
export interface ProblemSkillMetadata {
    id: string;
    domain: SkillDomain;
    stage: SkillStage;
    tags: SkillTag[];
}
export interface ProblemSkillEntry extends LocalSkillEntry {
    metadata: ProblemSkillMetadata;
}
export interface SkillsCatalog {
    generated_at: string;
    skills: ProblemSkillMetadata[];
}
export interface SkillSuggestJson {
    query: {
        domain: SkillDomain;
        stage: SkillStage;
        tags: SkillTag[];
    };
    candidates: Array<{
        id: string;
        domain: SkillDomain;
        stage: SkillStage;
        matched_tags: SkillTag[];
        score: number;
        reasons: string[];
    }>;
    low_confidence: boolean;
}
//# sourceMappingURL=skills.d.ts.map