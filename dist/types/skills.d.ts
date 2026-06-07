export interface LocalSkillEntry {
    id: string;
    path: string;
}
export type SkillDomain = 'singlecell' | 'spatial' | 'public-data' | 'bulk' | 'general';
export type SkillStage = 'preprocess' | 'integration' | 'clustering' | 'acquisition' | 'downstream';
export type SkillTag = 'scrna' | 'scatac' | 'cellxgene' | 'qc' | 'batch' | 'markers' | 'de' | 'group-stats' | 'enrichment' | 'module-score' | 'trajectory' | 'neighborhood' | 'niche' | 'structure' | 'communication';
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