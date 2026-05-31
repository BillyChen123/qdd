#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import scanpy as sc
import seaborn as sns


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone marker-based annotation skill for clustered scRNA AnnData.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--cluster-key", required=True, help="obs column containing cluster labels.")
    parser.add_argument("--marker-file", required=True, help="TSV or CSV with columns: cell_type, genes.")
    parser.add_argument("--method", choices=["wilcoxon", "t-test", "logreg"], default="wilcoxon")
    parser.add_argument("--n-genes", type=int, default=25)
    parser.add_argument("--annotation-key", default="cell_type_annotation")
    parser.add_argument("--unknown-label", default="unknown")
    parser.add_argument("--min-score", type=float, default=0.35)
    parser.add_argument("--embedding-key", default="X_umap", help="Embedding used for annotation visualization.")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def dataframe_to_markdown(frame: pd.DataFrame) -> str:
    if frame.empty:
        return "_No rows_"
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
    required = {"cell_type", "genes"}
    if not required.issubset(frame.columns):
        raise ValueError(f"marker file must contain columns {sorted(required)}")
    marker_map: dict[str, list[str]] = {}
    for _, row in frame.iterrows():
        genes = [gene.strip() for gene in str(row["genes"]).split(",") if gene.strip()]
        if genes:
            marker_map[str(row["cell_type"]).strip()] = genes
    if not marker_map:
        raise ValueError("marker file did not yield any usable marker sets")
    return marker_map


def extract_rankings(adata: sc.AnnData, cluster_key: str, n_genes: int) -> pd.DataFrame:
    names = adata.uns["rank_genes_groups"]["names"]
    scores = adata.uns["rank_genes_groups"]["scores"]
    pvals_adj = adata.uns["rank_genes_groups"].get("pvals_adj")
    logfoldchanges = adata.uns["rank_genes_groups"].get("logfoldchanges")
    groups = list(names.dtype.names or [])
    rows: list[dict[str, object]] = []
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
                    "cluster_key": cluster_key,
                }
            )
    return pd.DataFrame(rows)


def score_annotations(rankings: pd.DataFrame, marker_map: dict[str, list[str]], min_score: float, unknown_label: str) -> tuple[pd.DataFrame, dict[str, str]]:
    rows: list[dict[str, object]] = []
    selected: dict[str, str] = {}
    for cluster, cluster_df in rankings.groupby("cluster"):
        top_genes = [str(gene) for gene in cluster_df["gene"].tolist()]
        best_label = unknown_label
        best_score = -1.0
        for cell_type, markers in marker_map.items():
            overlap = [gene for gene in top_genes if gene in markers]
            score = len(overlap) / max(1, min(len(markers), len(top_genes)))
            rows.append(
                {
                    "cluster": cluster,
                    "candidate_label": cell_type,
                    "score": score,
                    "matched_markers": ",".join(overlap),
                }
            )
            if score > best_score:
                best_score = score
                best_label = cell_type
        if best_score < min_score:
            best_label = unknown_label
        selected[str(cluster)] = best_label
    return pd.DataFrame(rows), selected


def save_annotation_heatmap(score_df: pd.DataFrame, output_path: Path) -> None:
    if score_df.empty:
        return
    pivot = score_df.pivot(index="candidate_label", columns="cluster", values="score").fillna(0.0)
    fig, ax = plt.subplots(figsize=(max(6, pivot.shape[1] * 0.8), max(4, pivot.shape[0] * 0.5)))
    sns.heatmap(pivot, cmap="viridis", ax=ax)
    ax.set_title("Annotation score heatmap")
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def save_umap_annotation(adata: sc.AnnData, annotation_key: str, embedding_key: str, output_path: Path) -> None:
    if embedding_key not in adata.obsm or annotation_key not in adata.obs.columns:
        return
    coords = adata.obsm[embedding_key]
    categories = adata.obs[annotation_key].astype("category")
    fig, ax = plt.subplots(figsize=(6, 5))
    for category in categories.cat.categories:
        mask = categories == category
        ax.scatter(coords[mask, 0], coords[mask, 1], s=5, alpha=0.7, label=str(category))
    ax.set_xlabel(f"{embedding_key}_1")
    ax.set_ylabel(f"{embedding_key}_2")
    ax.set_title(f"{annotation_key} on {embedding_key}")
    if len(categories.cat.categories) <= 15:
        ax.legend(markerscale=3, fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def write_report(report_path: Path, args: argparse.Namespace, summary: pd.DataFrame) -> None:
    lines = [
        "# sc-marker-annotation report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Cluster Annotation Summary",
        "",
        dataframe_to_markdown(summary),
        "",
    ]
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    marker_path = Path(args.marker_file).resolve()
    output_dir = Path(args.output).resolve()
    figures_dir = output_dir / "figures"
    tables_dir = output_dir / "tables"
    ensure_dir(output_dir)
    ensure_dir(figures_dir)
    ensure_dir(tables_dir)

    adata = sc.read_h5ad(input_path)
    if args.cluster_key not in adata.obs.columns:
        raise ValueError(f"cluster key '{args.cluster_key}' not found in adata.obs")

    marker_map = read_marker_file(marker_path)
    sc.tl.rank_genes_groups(adata, groupby=args.cluster_key, method=args.method)
    rankings = extract_rankings(adata, args.cluster_key, args.n_genes)
    score_df, selected = score_annotations(rankings, marker_map, args.min_score, args.unknown_label)

    adata.obs[args.annotation_key] = adata.obs[args.cluster_key].astype(str).map(selected).fillna(args.unknown_label)
    summary = (
        adata.obs[[args.cluster_key, args.annotation_key]]
        .drop_duplicates()
        .sort_values([args.cluster_key, args.annotation_key])
        .reset_index(drop=True)
    )

    rankings.to_csv(tables_dir / "marker_rankings.csv", index=False)
    score_df.to_csv(tables_dir / "annotation_scores.csv", index=False)
    summary.to_csv(tables_dir / "cluster_annotation_summary.csv", index=False)

    save_annotation_heatmap(score_df, figures_dir / "annotation_score_heatmap.png")
    save_umap_annotation(adata, args.annotation_key, args.embedding_key, figures_dir / "umap_by_annotation.png")

    adata.write_h5ad(output_dir / "annotated.h5ad")
    write_report(output_dir / "report.md", args, summary)
    result = {
        "skill": "singlecell/scrna/sc-marker-annotation",
        "input": str(input_path),
        "marker_file": str(marker_path),
        "output": str(output_dir),
        "annotation_key": args.annotation_key,
        "unknown_label": args.unknown_label,
        "assigned_labels": summary.to_dict(orient="records"),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
