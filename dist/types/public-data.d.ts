export interface PublicDataSelectionEntry {
    dataset_id: string;
    alias: string;
}
export interface PublicDataConstraints {
    organism?: string;
    tissue?: string;
    disease?: string;
    state?: string;
    cell_type?: string | null;
    assay?: string | null;
}
export interface PublicDataSourceQuery {
    max_results?: number;
    [key: string]: unknown;
}
export interface LegacyPublicDataQuery extends PublicDataConstraints {
    max_results?: number;
}
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
//# sourceMappingURL=public-data.d.ts.map