#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc
from scipy import sparse
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize


PEAK_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+:\d+-\d+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone scATAC mixed-feature repair and TF-IDF/LSI preprocessing skill.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--mode", choices=["auto", "repair", "inspect"], default="auto")
    parser.add_argument("--feature-type-column", default="feature_type", help="var column describing feature classes.")
    parser.add_argument("--peak-label", default="Peaks", help="feature_type value that marks peak features.")
    parser.add_argument("--gene-label", default="Gene Expression", help="feature_type value that marks gene-expression features.")
    parser.add_argument("--peak-source", choices=["auto", "feature_type", "regex"], default="auto")
    parser.add_argument("--min-features-per-cell", type=int, default=200)
    parser.add_argument("--min-cells-per-feature", type=int, default=10)
    parser.add_argument("--max-features-per-cell", type=int, default=50000)
    parser.add_argument("--binarize", action="store_true", help="Binarize counts before TF-IDF/LSI.")
    parser.add_argument("--n-components", type=int, default=50)
    parser.add_argument("--random-state", type=int, default=0)
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def peak_like_name(name: str) -> bool:
    return bool(PEAK_PATTERN.match(name))


def matrix_to_csr(matrix) -> sparse.csr_matrix:
    if sparse.issparse(matrix):
        return matrix.tocsr().astype(np.float32)
    return sparse.csr_matrix(np.asarray(matrix, dtype=np.float32))


def classify_features(
    adata: sc.AnnData,
    feature_type_column: str,
    peak_label: str,
    gene_label: str,
    peak_source: str,
) -> pd.DataFrame:
    raw_feature_type = (
        adata.var[feature_type_column].fillna("").astype(str) if feature_type_column in adata.var.columns else pd.Series("", index=adata.var_names)
    )
    records: list[dict[str, str]] = []

    for feature_name, raw_type in zip(map(str, adata.var_names), raw_feature_type):
        raw_type = raw_type.strip()
        peak_by_regex = peak_like_name(feature_name)
        resolved = "other"

        if peak_source in {"auto", "feature_type"} and raw_type == peak_label:
            resolved = "peak"
        elif peak_source in {"auto", "feature_type"} and raw_type == gene_label:
            resolved = "gene"
        elif peak_source in {"auto", "feature_type"} and raw_type == "" and peak_by_regex:
            resolved = "peak"
        elif peak_source in {"auto", "regex"} and peak_by_regex:
            resolved = "peak"
        elif raw_type == gene_label:
            resolved = "gene"

        records.append(
            {
                "feature_id": feature_name,
                "raw_feature_type": raw_type,
                "resolved_feature_class": resolved,
                "peak_like_name": str(peak_by_regex).lower(),
            }
        )

    return pd.DataFrame.from_records(records)


def infer_input_state(feature_summary: pd.DataFrame, obs_columns: list[str]) -> str:
    n_peak = int((feature_summary["resolved_feature_class"] == "peak").sum())
    n_gene = int((feature_summary["resolved_feature_class"] == "gene").sum())
    fragment_hints = {"frip", "FRiP", "tss_enrichment", "TSS.enrichment", "n_fragments", "passed_filters"}
    has_fragment_hints = any(column in fragment_hints for column in obs_columns)

    if n_peak > 0 and n_gene > 0:
        return "mixed_multiome_h5ad"
    if has_fragment_hints:
        return "fragment_aware_hints"
    return "matrix_only_h5ad"


def compute_cell_qc(matrix: sparse.csr_matrix, cell_ids: list[str]) -> pd.DataFrame:
    total_counts = np.asarray(matrix.sum(axis=1)).ravel()
    n_features = np.asarray((matrix > 0).sum(axis=1)).ravel()
    return pd.DataFrame(
        {
            "cell_id": cell_ids,
            "total_counts": total_counts.astype(float),
            "n_features_by_counts": n_features.astype(int),
        }
    )


def filter_peak_matrix(
    matrix: sparse.csr_matrix,
    cell_qc: pd.DataFrame,
    min_features_per_cell: int,
    min_cells_per_feature: int,
    max_features_per_cell: int,
) -> tuple[sparse.csr_matrix, np.ndarray, np.ndarray]:
    cell_mask = (
        (cell_qc["n_features_by_counts"].to_numpy() >= min_features_per_cell)
        & (cell_qc["n_features_by_counts"].to_numpy() <= max_features_per_cell)
    )
    filtered = matrix[cell_mask]
    feature_mask = np.asarray((filtered > 0).sum(axis=0)).ravel() >= min_cells_per_feature
    filtered = filtered[:, feature_mask]
    return filtered, cell_mask, feature_mask


def compute_tfidf_lsi(matrix: sparse.csr_matrix, n_components: int, random_state: int) -> tuple[sparse.csr_matrix, np.ndarray]:
    row_sums = np.asarray(matrix.sum(axis=1)).ravel().astype(np.float32)
    row_sums[row_sums == 0] = 1.0
    tf = sparse.diags(1.0 / row_sums) @ matrix

    doc_freq = np.asarray((matrix > 0).sum(axis=0)).ravel().astype(np.float32)
    idf = np.log1p(matrix.shape[0] / (1.0 + doc_freq)) + 1.0
    tfidf = tf @ sparse.diags(idf)
    tfidf = normalize(tfidf, norm="l2", axis=1)

    max_components = min(matrix.shape[0] - 1, matrix.shape[1] - 1, n_components)
    if max_components < 2:
        raise ValueError("Not enough cells/features remain after filtering to compute a stable LSI embedding.")

    svd = TruncatedSVD(n_components=max_components, random_state=random_state)
    lsi = svd.fit_transform(tfidf)
    return tfidf.tocsr(), lsi


def save_feature_breakdown(feature_summary: pd.DataFrame, figure_path: Path) -> None:
    counts = feature_summary["resolved_feature_class"].value_counts().sort_index()
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.bar(counts.index.astype(str), counts.to_numpy(), color=["#4C78A8", "#72B7B2", "#F58518"])
    ax.set_ylabel("n_features")
    ax.set_title("Resolved feature classes")
    fig.tight_layout()
    fig.savefig(figure_path, dpi=160)
    plt.close(fig)


def save_cell_histograms(cell_qc: pd.DataFrame, figure_path: Path) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    axes[0].hist(cell_qc["total_counts"], bins=50, color="#4C78A8")
    axes[0].set_title("Total accessibility counts")
    axes[0].set_xlabel("total_counts")
    axes[1].hist(cell_qc["n_features_by_counts"], bins=50, color="#F58518")
    axes[1].set_title("Accessible features per cell")
    axes[1].set_xlabel("n_features_by_counts")
    fig.tight_layout()
    fig.savefig(figure_path, dpi=160)
    plt.close(fig)


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    input_state: str,
    feature_summary: pd.DataFrame,
    operations: list[str],
) -> None:
    lines = [
        "# scatac-preprocess-lsi report",
        "",
        "## Input State",
        "",
        f"- inferred_state: `{input_state}`",
        f"- peak_features: `{int((feature_summary['resolved_feature_class'] == 'peak').sum())}`",
        f"- gene_features: `{int((feature_summary['resolved_feature_class'] == 'gene').sum())}`",
        f"- other_features: `{int((feature_summary['resolved_feature_class'] == 'other').sum())}`",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Operations",
        "",
    ]
    lines.extend([f"- {item}" for item in operations] or ["- inspect only"])
    lines.extend(
        [
            "",
            "## Boundary Notes",
            "",
            "- This is a matrix-first scATAC preprocessing path.",
            "- Fragment-native QC claims should not be inferred from this report alone.",
            "",
        ]
    )
    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    tables_dir = output_dir / "tables"
    figures_dir = output_dir / "figures"
    ensure_dir(output_dir)
    ensure_dir(tables_dir)
    ensure_dir(figures_dir)

    adata = sc.read_h5ad(input_path)
    feature_summary = classify_features(adata, args.feature_type_column, args.peak_label, args.gene_label, args.peak_source)
    input_state = infer_input_state(feature_summary, list(map(str, adata.obs.columns)))
    feature_summary.to_csv(tables_dir / "feature_summary.csv", index=False)
    save_feature_breakdown(feature_summary, figures_dir / "feature_class_breakdown.png")

    peak_mask = feature_summary["resolved_feature_class"].eq("peak").to_numpy()
    if int(peak_mask.sum()) == 0:
        raise ValueError("No peak-like features were detected. Refuse to build an ATAC object from this input.")

    peak_only = adata[:, peak_mask].copy()
    peak_matrix = matrix_to_csr(peak_only.X)
    cell_qc = compute_cell_qc(peak_matrix, list(map(str, peak_only.obs_names)))
    cell_qc.to_csv(tables_dir / "cell_qc_metrics.csv", index=False)
    save_cell_histograms(cell_qc, figures_dir / "cell_accessibility_histograms.png")

    operations: list[str] = [f"classify_features -> {input_state}", f"subset_to_peaks: {adata.n_vars} -> {peak_only.n_vars} features"]

    if args.mode == "inspect":
        peak_only.write_h5ad(output_dir / "processed.h5ad")
        selected_features = peak_only.var.copy()
        selected_features.index.name = "feature_id"
        selected_features.to_csv(tables_dir / "selected_features.csv")
        write_report(output_dir / "report.md", args, input_state, feature_summary, operations)
        result = {
            "skill": "singlecell/scatac/scatac-preprocess-lsi",
            "input": str(input_path),
            "output": str(output_dir),
            "input_state": input_state,
            "mode": args.mode,
            "n_obs": int(peak_only.n_obs),
            "n_vars": int(peak_only.n_vars),
            "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
            "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
        }
        (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return

    filtered_matrix, cell_mask, feature_mask = filter_peak_matrix(
        peak_matrix,
        cell_qc,
        args.min_features_per_cell,
        args.min_cells_per_feature,
        args.max_features_per_cell,
    )
    if filtered_matrix.shape[0] == 0 or filtered_matrix.shape[1] == 0:
        raise ValueError("Filtering removed all cells or all features. Relax the thresholds or inspect the input state.")

    filtered = peak_only[cell_mask, feature_mask].copy()
    filtered_matrix = filtered_matrix.tocsr()
    if args.binarize:
        filtered_matrix.data = np.ones_like(filtered_matrix.data, dtype=np.float32)
        operations.append("binarize_counts")

    filtered.layers["counts"] = filtered_matrix.copy()
    filtered.X = filtered_matrix.copy()
    tfidf_matrix, lsi_embedding = compute_tfidf_lsi(filtered_matrix, args.n_components, args.random_state)
    filtered.obsm["X_lsi"] = lsi_embedding
    filtered.uns["qdd_scatac_preprocess"] = {
        "input_state": input_state,
        "mode": args.mode,
        "n_peak_features": int(filtered.n_vars),
        "source_input_n_vars": int(adata.n_vars),
        "tfidf_shape": [int(tfidf_matrix.shape[0]), int(tfidf_matrix.shape[1])],
    }
    filtered.obs["total_counts"] = np.asarray(filtered_matrix.sum(axis=1)).ravel()
    filtered.obs["n_features_by_counts"] = np.asarray((filtered_matrix > 0).sum(axis=1)).ravel()
    filtered.var["selected_peak"] = True

    selected_features = filtered.var.copy()
    selected_features.index.name = "feature_id"
    selected_features.to_csv(tables_dir / "selected_features.csv")
    filtered.write_h5ad(output_dir / "processed.h5ad")

    operations.append(f"filter_cells_features -> {(peak_only.n_obs, peak_only.n_vars)} -> {(filtered.n_obs, filtered.n_vars)}")
    operations.append(f"compute_lsi(n_components={filtered.obsm['X_lsi'].shape[1]})")
    write_report(output_dir / "report.md", args, input_state, feature_summary, operations)

    result = {
        "skill": "singlecell/scatac/scatac-preprocess-lsi",
        "input": str(input_path),
        "output": str(output_dir),
        "input_state": input_state,
        "mode": args.mode,
        "n_obs": int(filtered.n_obs),
        "n_vars": int(filtered.n_vars),
        "obsm_keys": sorted(map(str, filtered.obsm.keys())),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
