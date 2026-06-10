#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

THREAD_ENV_VARS = (
    "OMP_NUM_THREADS",
    "MKL_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "NUMBA_NUM_THREADS",
)


def bootstrap_threads(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--threads", type=int, default=1)
    known, _ = parser.parse_known_args(argv)
    threads = max(1, int(known.threads))
    for env_name in THREAD_ENV_VARS:
        os.environ[env_name] = str(threads)
    return threads


BOOTSTRAP_THREADS = bootstrap_threads(sys.argv[1:])

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import scanpy as sc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone Scanpy clustering skill.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--threads", type=int, default=BOOTSTRAP_THREADS, help="CPU thread count for BLAS/OpenMP/Numba-backed steps.")
    parser.add_argument("--use-rep", default="auto", help="Embedding in adata.obsm to use, or auto.")
    parser.add_argument("--n-pcs", type=int, default=50)
    parser.add_argument("--n-neighbors", type=int, default=15)
    parser.add_argument("--resolution", type=float, default=0.5)
    parser.add_argument("--cluster-key", default="leiden")
    parser.add_argument("--umap-min-dist", type=float, default=0.3)
    parser.add_argument("--random-state", type=int, default=0)
    parser.add_argument("--color-key", default=None, help="Optional obs column for an additional UMAP.")
    parser.add_argument("--skip-umap", action="store_true")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def configure_threads(threads: int) -> int:
    threads = max(1, int(threads))
    for env_name in THREAD_ENV_VARS:
        os.environ[env_name] = str(threads)
    if hasattr(sc.settings, "n_jobs"):
        sc.settings.n_jobs = threads
    return threads


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


def pca_components(adata: sc.AnnData, requested: int, n_vars: int | None = None) -> int:
    upper = min(adata.n_obs, n_vars or adata.n_vars) - 1
    if upper < 1:
        raise ValueError("PCA requires at least two observations and two usable features.")
    return 1 if upper == 1 else min(requested, upper)


def pca_feature_space(adata: sc.AnnData) -> tuple[str, int | None]:
    if "highly_variable" not in adata.var.columns:
        return "all_features", None
    mask = adata.var["highly_variable"].fillna(False).to_numpy(dtype=bool)
    if not mask.any():
        return "all_features", None
    return "highly_variable", int(mask.sum())


def ensure_pca(adata: sc.AnnData, n_pcs: int) -> tuple[int, str]:
    feature_space, n_hvg = pca_feature_space(adata)
    if "X_pca" not in adata.obsm:
        pca_kwargs: dict[str, object] = {
            "svd_solver": "arpack",
            "n_comps": pca_components(adata, n_pcs, n_hvg),
        }
        if feature_space == "highly_variable":
            pca_kwargs["mask_var"] = "highly_variable"
        sc.tl.pca(adata, **pca_kwargs)
    return min(n_pcs, adata.obsm["X_pca"].shape[1]), feature_space


def resolve_use_rep(adata: sc.AnnData, requested: str, n_pcs: int) -> tuple[str | None, int | None, str]:
    if requested != "auto":
        if requested == "X_pca":
            resolved_n_pcs, feature_space = ensure_pca(adata, n_pcs)
            return None, resolved_n_pcs, feature_space
        if requested not in adata.obsm:
            raise ValueError(f"use_rep '{requested}' not found in adata.obsm")
        return requested, None, "precomputed"

    for candidate in ["X_pca_harmony", "X_scanorama", "X_scvi", "X_scanvi", "X_pca"]:
        if candidate == "X_pca":
            if "X_pca" in adata.obsm:
                return None, min(n_pcs, adata.obsm["X_pca"].shape[1]), "precomputed"
        elif candidate in adata.obsm:
            return candidate, None, "precomputed"

    resolved_n_pcs, feature_space = ensure_pca(adata, n_pcs)
    return None, resolved_n_pcs, feature_space


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


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    resolved_use_rep: str | None,
    cluster_counts: pd.DataFrame,
    provenance: dict[str, object],
) -> None:
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
        "## Runtime Provenance",
        "",
        "```json",
        json.dumps(provenance, indent=2, ensure_ascii=False),
        "```",
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
    args.threads = configure_threads(args.threads)
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    figures_dir = output_dir / "figures"
    tables_dir = output_dir / "tables"
    ensure_dir(output_dir)
    ensure_dir(figures_dir)
    ensure_dir(tables_dir)

    adata = sc.read_h5ad(input_path)
    use_rep, n_pcs, pca_feature_space = resolve_use_rep(adata, args.use_rep, args.n_pcs)
    if use_rep is None:
        sc.pp.neighbors(adata, n_neighbors=args.n_neighbors, n_pcs=n_pcs or args.n_pcs)
    else:
        sc.pp.neighbors(adata, n_neighbors=args.n_neighbors, use_rep=use_rep)

    sc.tl.leiden(adata, resolution=args.resolution, key_added=args.cluster_key)
    if not args.skip_umap:
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
    provenance = {
        "threads": args.threads,
        "skip_umap": bool(args.skip_umap),
        "pca_feature_space": pca_feature_space,
    }
    write_report(output_dir / "report.md", args, use_rep, cluster_counts, provenance)

    result = {
        "skill": "singlecell/scrna/sc-clustering",
        "input": str(input_path),
        "output": str(output_dir),
        "use_rep": use_rep if use_rep is not None else "X_pca",
        "cluster_key": args.cluster_key,
        "n_clusters": int(cluster_counts.shape[0]),
        "provenance": provenance,
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
