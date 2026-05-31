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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone Scanpy clustering skill.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--use-rep", default="auto", help="Embedding in adata.obsm to use, or auto.")
    parser.add_argument("--n-pcs", type=int, default=50)
    parser.add_argument("--n-neighbors", type=int, default=15)
    parser.add_argument("--resolution", type=float, default=0.5)
    parser.add_argument("--cluster-key", default="leiden")
    parser.add_argument("--umap-min-dist", type=float, default=0.3)
    parser.add_argument("--random-state", type=int, default=0)
    parser.add_argument("--color-key", default=None, help="Optional obs column for an additional UMAP.")
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


def resolve_use_rep(adata: sc.AnnData, requested: str) -> tuple[str | None, int | None]:
    if requested != "auto":
        if requested == "X_pca":
            return None, None
        if requested not in adata.obsm:
            raise ValueError(f"use_rep '{requested}' not found in adata.obsm")
        return requested, None

    for candidate in ["X_pca_harmony", "X_scanorama", "X_scvi", "X_scanvi", "X_pca"]:
        if candidate == "X_pca":
            if "X_pca" in adata.obsm:
                return None, min(50, adata.obsm["X_pca"].shape[1])
        elif candidate in adata.obsm:
            return candidate, None

    if "X_pca" not in adata.obsm:
        sc.tl.pca(adata, svd_solver="arpack", n_comps=min(50, max(2, adata.n_vars - 1)))
    return None, min(50, adata.obsm["X_pca"].shape[1])


def save_umap(adata: sc.AnnData, figure_dir: Path, color_key: str, file_name: str) -> None:
    if "X_umap" not in adata.obsm or color_key not in adata.obs.columns:
        return
    coords = adata.obsm["X_umap"]
    categories = adata.obs[color_key].astype("category")
    fig, ax = plt.subplots(figsize=(6, 5))
    for category in categories.cat.categories:
        mask = categories == category
        ax.scatter(coords[mask, 0], coords[mask, 1], s=5, alpha=0.7, label=str(category))
    ax.set_xlabel("UMAP1")
    ax.set_ylabel("UMAP2")
    ax.set_title(f"UMAP by {color_key}")
    if len(categories.cat.categories) <= 15:
        ax.legend(markerscale=3, fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(figure_dir / file_name, dpi=160)
    plt.close(fig)


def write_report(report_path: Path, args: argparse.Namespace, resolved_use_rep: str | None, cluster_counts: pd.DataFrame) -> None:
    lines = [
        "# sc-clustering report",
        "",
        "## Run Summary",
        "",
        f"- use_rep: `{resolved_use_rep if resolved_use_rep is not None else 'X_pca'}`",
        f"- n_neighbors: `{args.n_neighbors}`",
        f"- resolution: `{args.resolution}`",
        f"- cluster_key: `{args.cluster_key}`",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Cluster Counts",
        "",
        dataframe_to_markdown(cluster_counts),
        "",
    ]
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    figures_dir = output_dir / "figures"
    tables_dir = output_dir / "tables"
    ensure_dir(output_dir)
    ensure_dir(figures_dir)
    ensure_dir(tables_dir)

    adata = sc.read_h5ad(input_path)
    use_rep, n_pcs = resolve_use_rep(adata, args.use_rep)
    if use_rep is None:
        sc.pp.neighbors(adata, n_neighbors=args.n_neighbors, n_pcs=n_pcs or args.n_pcs)
    else:
        sc.pp.neighbors(adata, n_neighbors=args.n_neighbors, use_rep=use_rep)

    sc.tl.leiden(adata, resolution=args.resolution, key_added=args.cluster_key)
    sc.tl.umap(adata, min_dist=args.umap_min_dist, random_state=args.random_state)

    cluster_df = adata.obs[[args.cluster_key]].copy()
    cluster_df.index.name = "cell_id"
    cluster_df.to_csv(tables_dir / "cluster_assignments.csv")

    cluster_counts = (
        adata.obs[args.cluster_key]
        .value_counts()
        .rename_axis(args.cluster_key)
        .reset_index(name="n_cells")
        .sort_values(args.cluster_key)
    )
    cluster_counts.to_csv(tables_dir / "cluster_counts.csv", index=False)

    save_umap(adata, figures_dir, args.cluster_key, "umap_by_cluster.png")
    if args.color_key and args.color_key in adata.obs.columns:
        save_umap(adata, figures_dir, args.color_key, "umap_by_color.png")

    adata.write_h5ad(output_dir / "processed.h5ad")
    write_report(output_dir / "report.md", args, use_rep, cluster_counts)

    result = {
        "skill": "singlecell/scrna/sc-clustering",
        "input": str(input_path),
        "output": str(output_dir),
        "use_rep": use_rep if use_rep is not None else "X_pca",
        "cluster_key": args.cluster_key,
        "n_clusters": int(cluster_counts.shape[0]),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
