// public-data 请求中单条已选数据集。
// 只保留 apply 真正需要消费的最小信息。
export interface PublicDataSelectionEntry {
  dataset_id: string;
  alias: string;
}

// public-data 请求里的研究约束部分。
// 它表达研究问题想要的数据边界，而不是 source-specific API 参数。
export interface PublicDataConstraints {
  organism?: string;
  tissue?: string;
  disease?: string;
  state?: string;
  cell_type?: string | null;
  assay?: string | null;
}

// source-specific 的轻量查询参数。
// 当前只稳定承诺 max_results，其他键留给具体 source skill 自己解释。
export interface PublicDataSourceQuery {
  max_results?: number;
  [key: string]: unknown;
}

// 兼容旧版 `query` handoff。
// 新规划应改写为 `constraints + source_query`。
export interface LegacyPublicDataQuery extends PublicDataConstraints {
  max_results?: number;
}

// `studies/STUDY-XXX/output/public_data_request.yaml` 的结构。
// planning 负责写 constraints/source_query 和 selected；apply 只消费 selected。
export interface PublicDataRequest {
  source: string;
  modality: 'scrna' | 'spatial' | 'scatac' | 'bulk' | 'other';
  goal: string;
  constraints: PublicDataConstraints;
  source_query?: PublicDataSourceQuery;
  selected: PublicDataSelectionEntry[];
  selection_note?: string;
  query?: LegacyPublicDataQuery;
}
