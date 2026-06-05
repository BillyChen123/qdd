export interface PublicDataSelectionEntry {
    dataset_id: string;
    alias: string;
}
export interface PublicDataQuery {
    organism?: string;
    tissue?: string;
    disease?: string;
    state?: string;
    cell_type?: string | null;
    max_results?: number;
}
export interface PublicDataRequest {
    source: 'cellxgene';
    modality: 'scrna';
    goal: string;
    query: PublicDataQuery;
    selected: PublicDataSelectionEntry[];
    selection_note?: string;
}
//# sourceMappingURL=public-data.d.ts.map