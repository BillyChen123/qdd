// public-data 请求中单条已选数据集。
// 只保留 apply 真正需要消费的最小信息。
export interface PublicDataSelectionEntry {
  dataset_id: string;
  alias: string;
}

// public-data 请求里的结构化查询部分。
// 这个对象是 planning 写给 executor 的薄 handoff，而不是候选集历史。
export interface PublicDataQuery {
  organism?: string;
  tissue?: string;
  disease?: string;
  state?: string;
  cell_type?: string | null;
  max_results?: number;
}

// `studies/STUDY-XXX/output/public_data_request.yaml` 的结构。
// planning 负责写 query 和 selected；apply 只消费 selected。
export interface PublicDataRequest {
  source: 'cellxgene';
  modality: 'scrna';
  goal: string;
  query: PublicDataQuery;
  selected: PublicDataSelectionEntry[];
  selection_note?: string;
}
