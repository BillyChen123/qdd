#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc
from scipy import sparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Spatial marker annotation and population inference for AnnData.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--mode", choices=["inspect", "auto", "assisted"], default="auto")
    parser.add_argument("--assignment-unit", choices=["auto", "existing", "obs", "cluster"], default="auto")
    parser.add_argument("--marker-file", default=None, help="TSV or CSV marker table.")
    parser.add_argument("--existing-label-key", default=None, help="obs column to copy or summarize.")
    parser.add_argument("--cluster-key", default=None, help="obs cluster column for cluster-level annotation.")
    parser.add_argument("--annotation-key", default="spatial_annotation")
    parser.add_argument("--unknown-label", default="unknown")
    parser.add_argument("--min-score", type=float, default=0.0)
    parser.add_argument("--min-margin", type=float, default=0.0)
    parser.add_argument("--n-genes", type=int, default=25)
    parser.add_argument("--rank-method", choices=["wilcoxon", "t-test", "logreg"], default="wilcoxon")
    parser.add_argument("--use-raw", action="store_true", help="Use adata.raw for expression scoring when available.")
    parser.add_argument("--layer", default=None, help="Layer to use for observation-level marker scoring.")
    parser.add_argument("--case-insensitive", action="store_true", help="Match markers to var names case-insensitively.")
    parser.add_argument("--embedding-key", default="X_umap")
    parser.add_argument("--spatial-obsm-key", default="auto")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def dataframe_to_markdown(frame: pd.DataFrame, max_rows: int = 20) -> str:
    if frame.empty:
        return "_No rows_"
    frame = frame.head(max_rows)
    columns = [str(column) for column in frame.columns]
    lines = [
        "| " + " | ".join(columns) + " |",
        "| " + " | ".join(["---"] * len(columns)) + " |",
    ]
    for row in frame.itertuples(index=False, name=None):
        values = ["" if value is None else str(value) for value in row]
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines)


def read_marker_file(path: Path) -> dict[str, list[str]]:
    sep = "\t" if path.suffix.lower() in {".tsv", ".txt"} else ","
    frame = pd.read_csv(path, sep=sep)
    label_col = next((col for col in ["label", "cell_type", "population"] if col in frame.columns), None)
    genes_col = next((col for col in ["genes", "markers"] if col in frame.columns), None)
    if label_col is None or genes_col is None:
        raise ValueError("marker file must contain one label column (label/cell_type/population) and one gene column (genes/markers)")
    marker_map: dict[str, list[str]] = {}
    for _, row in frame.iterrows():
        label = str(row[label_col]).strip()
        genes = [gene.strip() for gene in re.split(r"[,;|\s]+", str(row[genes_col])) if gene.strip()]
        if label and genes:
            marker_map[label] = genes
    if not marker_map:
        raise ValueError("marker file did not yield usable marker sets")
    return marker_map


def feature_lookup(var_names: pd.Index, case_insensitive: bool) -> dict[str, str]:
    if case_insensitive:
        return {str(name).upper(): str(name) for name in var_names}
    return {str(name): str(name) for name in var_names}


def marker_panel_coverage(marker_map: dict[str, list[str]], var_names: pd.Index, case_insensitive: bool) -> tuple[pd.DataFrame, dict[str, list[str]]]:
    lookup = feature_lookup(var_names, case_insensitive)
    rows: list[dict[str, Any]] = []
    present_map: dict[str, list[str]] = {}
    for label, markers in marker_map.items():
        present: list[str] = []
        missing: list[str] = []
        for marker in markers:
            key = marker.upper() if case_insensitive else marker
            if key in lookup:
                present.append(lookup[key])
            else:
                missing.append(marker)
        present_map[label] = present
        rows.append(
            {
                "label": label,
                "n_markers": len(markers),
                "n_present": len(present),
                "coverage_fraction": len(present) / max(1, len(markers)),
                "present_markers": ",".join(present),
                "missing_markers": ",".join(missing),
            }
        )
    return pd.DataFrame(rows), present_map


def resolve_expression_matrix(adata: sc.AnnData, args: argparse.Namespace) -> tuple[Any, pd.Index, str]:
    if args.layer:
        if args.layer not in adata.layers:
            raise ValueError(f"layer '{args.layer}' not found")
        return adata.layers[args.layer], pd.Index(adata.var_names.astype(str)), f"layer:{args.layer}"
    if args.use_raw and adata.raw is not None:
        return adata.raw.X, pd.Index(adata.raw.var_names.astype(str)), "raw"
    return adata.X, pd.Index(adata.var_names.astype(str)), "X"


def matrix_column_mean(matrix: Any, indices: list[int]) -> np.ndarray:
    if not indices:
        return np.zeros(matrix.shape[0], dtype=float)
    sub = matrix[:, indices]
    values = np.asarray(sub.mean(axis=1)).ravel() if sparse.issparse(sub) else np.asarray(sub).mean(axis=1)
    return values.astype(float)


def assign_obs_labels(
    adata: sc.AnnData,
    matrix: Any,
    var_names: pd.Index,
    present_map: dict[str, list[str]],
    annotation_key: str,
    unknown_label: str,
    min_score: float,
    min_margin: float,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    var_to_idx = {str(name): idx for idx, name in enumerate(var_names)}
    score_columns: dict[str, np.ndarray] = {}
    for label, genes in present_map.items():
        indices = [var_to_idx[gene] for gene in genes if gene in var_to_idx]
        score_columns[label] = matrix_column_mean(matrix, indices)
    score_frame = pd.DataFrame(score_columns, index=adata.obs_names)
    if score_frame.empty:
        adata.obs[annotation_key] = unknown_label
        annotations = pd.DataFrame(
            {
                "obs_name": adata.obs_names,
                annotation_key: unknown_label,
                "best_score": 0.0,
                "second_score": 0.0,
                "margin": 0.0,
            }
        )
        return annotations, pd.DataFrame()

    sorted_scores = np.sort(score_frame.to_numpy(), axis=1)
    best_score = sorted_scores[:, -1]
    second_score = sorted_scores[:, -2] if score_frame.shape[1] > 1 else np.zeros_like(best_score)
    best_label = score_frame.idxmax(axis=1).astype(str)
    margin = best_score - second_score
    low_conf = (best_score <= min_score) | (margin < min_margin)
    assigned = best_label.mask(low_conf, unknown_label)
    adata.obs[annotation_key] = assigned.to_numpy()
    annotations = pd.DataFrame(
        {
            "obs_name": adata.obs_names,
            annotation_key: assigned.to_numpy(),
            "best_label": best_label.to_numpy(),
            "best_score": best_score,
            "second_score": second_score,
            "margin": margin,
        }
    )
    score_summary = score_frame.describe().T.reset_index().rename(columns={"index": "label"})
    return annotations, score_summary


def extract_rankings(adata: sc.AnnData, cluster_key: str, n_genes: int) -> pd.DataFrame:
    names = adata.uns["rank_genes_groups"]["names"]
    scores = adata.uns["rank_genes_groups"]["scores"]
    pvals_adj = adata.uns["rank_genes_groups"].get("pvals_adj")
    logfoldchanges = adata.uns["rank_genes_groups"].get("logfoldchanges")
    groups = list(names.dtype.names or [])
    rows: list[dict[str, Any]] = []
    for group in groups:
        for idx in range(min(n_genes, len(names[group]))):
            rows.append(
                {
                    "cluster": group,
                    "rank": idx + 1,
                    "gene": str(names[group][idx]),
                    "score": float(scores[group][idx]) if scores is not None else None,
                    "pvals_adj": float(pvals_adj[group][idx]) if pvals_adj is not None else None,
                    "logfoldchange": float(logfoldchanges[group][idx]) if logfoldchanges is not None else None,
                }
            )
    return pd.DataFrame(rows)


def assign_cluster_labels(
    adata: sc.AnnData,
    cluster_key: str,
    marker_map: dict[str, list[str]],
    annotation_key: str,
    unknown_label: str,
    min_score: float,
    n_genes: int,
    method: str,
    case_insensitive: bool,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if cluster_key not in adata.obs.columns:
        raise ValueError(f"cluster key '{cluster_key}' not found in adata.obs")
    sc.tl.rank_genes_groups(adata, groupby=cluster_key, method=method)
    rankings = extract_rankings(adata, cluster_key, n_genes)
    rows: list[dict[str, Any]] = []
    selected: dict[str, str] = {}
    for cluster, cluster_df in rankings.groupby("cluster"):
        top_genes_raw = [str(gene) for gene in cluster_df["gene"].tolist()]
        top_genes = [gene.upper() for gene in top_genes_raw] if case_insensitive else top_genes_raw
        best_label = unknown_label
        best_score = -1.0
        for label, markers in marker_map.items():
            marker_set = {marker.upper() if case_insensitive else marker for marker in markers}
            overlap = [gene for gene in top_genes_raw if (gene.upper() if case_insensitive else gene) in marker_set]
            score = len(overlap) / max(1, min(len(marker_set), len(top_genes)))
            rows.append(
                {
                    "cluster": cluster,
                    "candidate_label": label,
                    "score": score,
                    "matched_markers": ",".join(overlap),
                }
            )
            if score > best_score:
                best_score = score
                best_label = label
        if best_score < min_score:
            best_label = unknown_label
        selected[str(cluster)] = best_label

    adata.obs[annotation_key] = adata.obs[cluster_key].astype(str).map(selected).fillna(unknown_label)
    summary = (
        adata.obs[[cluster_key, annotation_key]]
        .drop_duplicates()
        .sort_values([cluster_key, annotation_key])
        .reset_index(drop=True)
    )
    return summary, pd.DataFrame(rows)


def get_spatial_coords(adata: sc.AnnData, key: str) -> np.ndarray | None:
    candidates = ["spatial", "X_spatial", "X_spatial_coords", "coords", "coordinates"] if key == "auto" else [key]
    for candidate in candidates:
        if candidate in adata.obsm:
            coords = np.asarray(adata.obsm[candidate])
            if coords.ndim == 2 and coords.shape[1] >= 2:
                return coords[:, :2]
    return None


def plot_annotation(coords: np.ndarray | None, labels: pd.Series, output_path: Path, title: str) -> bool:
    if coords is None:
        return False
    frame = pd.DataFrame({"x": coords[:, 0], "y": coords[:, 1], "label": labels.astype(str).to_numpy()}, index=labels.index)
    if frame.shape[0] > 25000:
        frame = frame.sample(n=25000, random_state=1)
    categories = pd.Series(frame["label"], dtype="category")
    fig, ax = plt.subplots(figsize=(6, 5))
    for category in categories.cat.categories:
        mask = categories == category
        ax.scatter(frame.loc[mask, "x"], frame.loc[mask, "y"], s=3, alpha=0.7, label=str(category))
    if len(categories.cat.categories) <= 15:
        ax.legend(markerscale=3, fontsize=7, frameon=False)
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title(title)
    ax.set_aspect("equal", adjustable="box")
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def plot_embedding(adata: sc.AnnData, embedding_key: str, annotation_key: str, output_path: Path) -> bool:
    if embedding_key not in adata.obsm or annotation_key not in adata.obs.columns:
        return False
    coords = np.asarray(adata.obsm[embedding_key])
    if coords.ndim != 2 or coords.shape[1] < 2:
        return False
    return plot_annotation(coords[:, :2], adata.obs[annotation_key], output_path, f"{annotation_key} on {embedding_key}")


def write_report(report_path: Path, args: argparse.Namespace, coverage: pd.DataFrame, label_counts: pd.DataFrame, operations: list[str]) -> None:
    lines = [
        "# spatial-marker-annotation report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Marker Panel Coverage",
        "",
        dataframe_to_markdown(coverage),
        "",
        "## Label Counts",
        "",
        dataframe_to_markdown(label_counts),
        "",
        "## Operations",
        "",
    ]
    lines.extend([f"- {item}" for item in operations] or ["- inspect only"])
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


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
    marker_map: dict[str, list[str]] = {}
    coverage = pd.DataFrame()
    present_map: dict[str, list[str]] = {}
    matrix, var_names, matrix_source = resolve_expression_matrix(adata, args)
    if args.marker_file:
        marker_map = read_marker_file(Path(args.marker_file).resolve())
        coverage, present_map = marker_panel_coverage(marker_map, var_names, args.case_insensitive)
    elif args.assignment_unit not in {"existing", "auto"} and args.mode != "inspect":
        raise ValueError("--marker-file is required for marker-based assignment")

    if not coverage.empty:
        coverage.to_csv(tables_dir / "panel_coverage.csv", index=False)

    unit = args.assignment_unit
    if unit == "auto":
        if args.existing_label_key and not args.marker_file:
            unit = "existing"
        elif args.cluster_key:
            unit = "cluster"
        elif args.marker_file:
            unit = "obs"
        else:
            unit = "existing"

    operations: list[str] = []
    if args.mode == "inspect":
        operations.append("inspect marker coverage and existing labels")
    elif unit == "existing":
        if not args.existing_label_key:
            raise ValueError("--existing-label-key is required for existing-label assignment")
        if args.existing_label_key not in adata.obs.columns:
            raise ValueError(f"existing label key '{args.existing_label_key}' not found in adata.obs")
        adata.obs[args.annotation_key] = adata.obs[args.existing_label_key].astype(str).to_numpy()
        operations.append(f"copied existing labels from {args.existing_label_key} to {args.annotation_key}")
    elif unit == "obs":
        annotations, score_summary = assign_obs_labels(
            adata,
            matrix,
            var_names,
            present_map,
            args.annotation_key,
            args.unknown_label,
            args.min_score,
            args.min_margin,
        )
        annotations.to_csv(tables_dir / "observation_annotations.csv", index=False)
        score_summary.to_csv(tables_dir / "label_score_summary.csv", index=False)
        operations.append(f"assigned observation-level labels from marker means using {matrix_source}")
    elif unit == "cluster":
        if not marker_map:
            raise ValueError("--marker-file is required for cluster annotation")
        if not args.cluster_key:
            raise ValueError("--cluster-key is required for cluster annotation")
        summary, score_df = assign_cluster_labels(
            adata,
            args.cluster_key,
            marker_map,
            args.annotation_key,
            args.unknown_label,
            args.min_score,
            args.n_genes,
            args.rank_method,
            args.case_insensitive,
        )
        summary.to_csv(tables_dir / "cluster_annotation_summary.csv", index=False)
        score_df.to_csv(tables_dir / "label_score_summary.csv", index=False)
        operations.append(f"assigned cluster-level labels from rank_genes_groups using {args.cluster_key}")

    if args.annotation_key in adata.obs.columns:
        label_counts = (
            adata.obs[args.annotation_key]
            .astype(str)
            .value_counts(dropna=False)
            .rename_axis(args.annotation_key)
            .reset_index(name="n_obs")
        )
    elif args.existing_label_key and args.existing_label_key in adata.obs.columns:
        label_counts = (
            adata.obs[args.existing_label_key]
            .astype(str)
            .value_counts(dropna=False)
            .rename_axis(args.existing_label_key)
            .reset_index(name="n_obs")
        )
    else:
        label_counts = pd.DataFrame()
    label_counts.to_csv(tables_dir / "label_counts.csv", index=False)

    generated_figures: list[str] = []
    if args.annotation_key in adata.obs.columns:
        if plot_embedding(adata, args.embedding_key, args.annotation_key, figures_dir / "annotation_on_embedding.png"):
            generated_figures.append("annotation_on_embedding.png")
        coords = get_spatial_coords(adata, args.spatial_obsm_key)
        if plot_annotation(coords, adata.obs[args.annotation_key], figures_dir / "annotation_on_spatial.png", f"{args.annotation_key} on spatial coordinates"):
            generated_figures.append("annotation_on_spatial.png")

    adata.write_h5ad(output_dir / "annotated.h5ad")
    write_report(output_dir / "report.md", args, coverage, label_counts, operations)
    result = {
        "skill": "spatial/spatial-marker-annotation",
        "input": str(input_path),
        "output": str(output_dir),
        "mode": args.mode,
        "assignment_unit": unit,
        "annotation_key": args.annotation_key,
        "matrix_source": matrix_source,
        "operations": operations,
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
