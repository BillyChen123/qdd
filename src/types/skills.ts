// 本地 skill 条目。
// 主要用于 runtime 扫描、校验 task skills、以及 bootstrap 投影。
export interface LocalSkillEntry {
  // skill 的稳定标识，例如 qdd/qdd-apply 或 plot/xxx。
  id: string;

  // skill 在仓库中的源路径。
  path: string;
}

// problem-level skill 所属的领域。
// 第一版只收敛到少量可控领域，避免 catalog 变成自由文本。
export type SkillDomain = 'singlecell' | 'spatial' | 'public-data' | 'bulk' | 'general';

// problem-level skill 的 stage。
// 第一版保持受控但很小，避免元数据膨胀。
export type SkillStage =
  | 'preprocess'
  | 'integration'
  | 'clustering'
  | 'acquisition'
  | 'downstream';

// problem-level skill 的受控标签。
// 这些标签是轻量判别信号，不是自由关键词池。
export type SkillTag =
  | 'scrna'
  | 'scatac'
  | 'cellxgene'
  | 'qc'
  | 'batch'
  | 'markers'
  | 'de'
  | 'group-stats'
  | 'enrichment'
  | 'module-score'
  | 'trajectory'
  | 'neighborhood'
  | 'niche'
  | 'structure'
  | 'communication';

// problem-level skill 的 metadata。
// 这里是给轻量 resolver / suggest CLI 用的机器面。
export interface ProblemSkillMetadata {
  id: string;
  domain: SkillDomain;
  stage: SkillStage;
  tags: SkillTag[];
}

// 从本地 skill 里解析出的 problem-level skill 条目。
export interface ProblemSkillEntry extends LocalSkillEntry {
  metadata: ProblemSkillMetadata;
}

// `.qdd/skills-catalog.json` 的结构。
export interface SkillsCatalog {
  generated_at: string;
  skills: ProblemSkillMetadata[];
}

// `qdd skills suggest --json` 的输出结构。
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
