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
import scanpy.external as sce


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone scRNA integration and batch-diagnosis skill.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--threads", type=int, default=BOOTSTRAP_THREADS, help="CPU thread count for BLAS/OpenMP/Numba-backed steps.")
    parser.add_argument("--batch-key", required=True, help="obs column identifying batch/sample.")
    parser.add_argument("--method", choices=["none", "harmony", "scanorama", "bbknn"], default="harmony")
    parser.add_argument("--label-key", default=None, help="Optional biology label for scIB metrics.")
    parser.add_argument("--cluster-key", default="leiden", help="Where to store clustering labels.")
    parser.add_argument("--use-hvg", action="store_true", help="Restrict PCA to HVGs if highly_variable is present or computed.")
    parser.add_argument("--n-hvg", type=int, default=2000)
    parser.add_argument("--n-pcs", type=int, default=50)
    parser.add_argument("--n-neighbors", type=int, default=15)
    parser.add_argument("--leiden-resolution", type=float, default=0.5)
    parser.add_argument("--harmony-theta", type=float, default=2.0)
    parser.add_argument("--scanorama-knn", type=int, default=20)
    parser.add_argument("--bbknn-neighbors-within-batch", type=int, default=3)
    parser.add_argument("--umap-min-dist", type=float, default=0.3)
    parser.add_argument("--random-state", type=int, default=0)
    parser.add_argument("--skip-metrics", action="store_true")
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


def maybe_prepare_hvg(adata: sc.AnnData, args: argparse.Namespace) -> tuple[sc.AnnData, str, int | None]:
    if not args.use_hvg:
        return adata, "all_features", None
    if "highly_variable" not in adata.var.columns:
        sc.pp.highly_variable_genes(adata, n_top_genes=args.n_hvg, flavor="seurat")
    if "highly_variable" in adata.var.columns:
        n_hvg = int(adata.var["highly_variable"].fillna(False).sum())
        if n_hvg > 0:
            return adata, "highly_variable", n_hvg
    return adata, "all_features", None


def pca_components(adata: sc.AnnData, requested: int, n_vars: int | None = None) -> int:
    upper = min(adata.n_obs, n_vars or adata.n_vars) - 1
    if upper < 1:
        raise ValueError("PCA requires at least two observations and two usable features.")
    return 1 if upper == 1 else min(requested, upper)


def run_pca_basis(adata: sc.AnnData, args: argparse.Namespace) -> tuple[sc.AnnData, str, int | None]:
    working, pca_feature_space, n_hvg = maybe_prepare_hvg(adata, args)
    if "X_pca" not in working.obsm:
        pca_kwargs: dict[str, object] = {
            "n_comps": pca_components(working, args.n_pcs, n_hvg),
            "svd_solver": "arpack",
        }
        if pca_feature_space == "highly_variable":
            pca_kwargs["mask_var"] = "highly_variable"
        sc.tl.pca(working, **pca_kwargs)
    else:
        pca_feature_space = "precomputed"
    return working, pca_feature_space, n_hvg


def integrate(adata: sc.AnnData, args: argparse.Namespace) -> tuple[sc.AnnData, str, dict[str, object]]:
    working, pca_feature_space, n_hvg = run_pca_basis(adata, args)
    embedding_key = "X_pca"

    if args.method == "none":
        sc.pp.neighbors(working, n_neighbors=args.n_neighbors, n_pcs=min(args.n_pcs, working.obsm["X_pca"].shape[1]))
        embedding_key = "X_pca"
    elif args.method == "harmony":
        sce.pp.harmony_integrate(
            working,
            key=args.batch_key,
            basis="X_pca",
            adjusted_basis="X_pca_harmony",
            theta=args.harmony_theta,
        )
        embedding_key = "X_pca_harmony"
        sc.pp.neighbors(working, use_rep=embedding_key, n_neighbors=args.n_neighbors)
    elif args.method == "scanorama":
        sce.pp.scanorama_integrate(
            working,
            key=args.batch_key,
            basis="X_pca",
            adjusted_basis="X_scanorama",
            knn=args.scanorama_knn,
        )
        embedding_key = "X_scanorama"
        sc.pp.neighbors(working, use_rep=embedding_key, n_neighbors=args.n_neighbors)
    elif args.method == "bbknn":
        try:
            import bbknn
        except ImportError as error:
            raise RuntimeError("bbknn is not installed in the current environment.") from error
        bbknn.bbknn(
            working,
            batch_key=args.batch_key,
            neighbors_within_batch=args.bbknn_neighbors_within_batch,
        )
        embedding_key = "X_pca"
    else:
        raise ValueError(f"Unsupported method: {args.method}")

    sc.tl.leiden(working, resolution=args.leiden_resolution, key_added=args.cluster_key)
    if not args.skip_umap:
        sc.tl.umap(working, min_dist=args.umap_min_dist, random_state=args.random_state)
    provenance = {
        "threads": args.threads,
        "skip_umap": bool(args.skip_umap),
        "pca_feature_space": pca_feature_space,
        "n_hvg_used": n_hvg,
        "raw_retained": False,
    }
    return working, embedding_key, provenance


def compute_metrics(adata: sc.AnnData, args: argparse.Namespace, embedding_key: str) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    if args.skip_metrics:
        return pd.DataFrame(rows)
    try:
        import scib.metrics as sm
    except ImportError:
        return pd.DataFrame([{"metric": "scib_available", "value": False, "notes": "scib not installed"}])

    try:
        ilisi = sm.ilisi_graph(adata, batch_key=args.batch_key, type_="embed", use_rep=embedding_key)
        rows.append({"metric": "ilisi_graph", "value": float(ilisi), "notes": f"use_rep={embedding_key}"})
    except Exception as error:  # noqa: BLE001
        rows.append({"metric": "ilisi_graph", "value": None, "notes": str(error)})

    if args.label_key and args.label_key in adata.obs.columns:
        try:
            clisi = sm.clisi_graph(adata, label_key=args.label_key, type_="embed", use_rep=embedding_key)
            rows.append({"metric": "clisi_graph", "value": float(clisi), "notes": f"use_rep={embedding_key}"})
        except Exception as error:  # noqa: BLE001
            rows.append({"metric": "clisi_graph", "value": None, "notes": str(error)})
        try:
            batch_asw = sm.silhouette_batch(
                adata,
                batch_key=args.batch_key,
                label_key=args.label_key,
                embed=embedding_key,
                scale=True,
                verbose=False,
            )
            rows.append({"metric": "silhouette_batch", "value": float(batch_asw), "notes": f"embed={embedding_key}"})
        except Exception as error:  # noqa: BLE001
            rows.append({"metric": "silhouette_batch", "value": None, "notes": str(error)})
    return pd.DataFrame(rows)


def save_umap(adata: sc.AnnData, output_dir: Path, color_key: str, file_name: str) -> None:
    if "X_umap" not in adata.obsm or color_key not in adata.obs.columns:
        return
    coords = adata.obsm["X_umap"]
    fig, ax = plt.subplots(figsize=(6, 5))
    categories = adata.obs[color_key].astype("category")
    for category in categories.cat.categories:
        mask = categories == category
        ax.scatter(coords[mask, 0], coords[mask, 1], s=5, alpha=0.7, label=str(category))
    ax.set_xlabel("UMAP1")
    ax.set_ylabel("UMAP2")
    ax.set_title(f"UMAP by {color_key}")
    if len(categories.cat.categories) <= 15:
        ax.legend(markerscale=3, fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(output_dir / file_name, dpi=160)
    plt.close(fig)


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    embedding_key: str,
    metrics: pd.DataFrame,
    provenance: dict[str, object],
) -> None:
    lines = [
        "# sc-batch-integration report",
        "",
        "## Run Summary",
        "",
        f"- method: `{args.method}`",
        f"- batch_key: `{args.batch_key}`",
        f"- embedding_key: `{embedding_key}`",
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
    ]
    if not metrics.empty:
        lines.extend(["## Metrics", "", dataframe_to_markdown(metrics), ""])
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
    if args.batch_key not in adata.obs.columns:
        raise ValueError(f"batch key '{args.batch_key}' not found in adata.obs")

    working, embedding_key, provenance = integrate(adata, args)
    metrics = compute_metrics(working, args, embedding_key)

    working.raw = None
    working.write_h5ad(output_dir / "processed.h5ad")
    cluster_counts = (
        working.obs.groupby([args.batch_key, args.cluster_key], observed=False)
        .size()
        .rename("n_cells")
        .reset_index()
        .sort_values([args.batch_key, args.cluster_key])
    )
    cluster_counts.to_csv(tables_dir / "batch_cluster_counts.csv", index=False)
    working.obs[args.batch_key].value_counts().rename_axis(args.batch_key).reset_index(name="n_cells").to_csv(
        tables_dir / "batch_sizes.csv", index=False
    )

    embedding = pd.DataFrame(working.obsm[embedding_key], index=working.obs_names)
    embedding.index.name = "cell_id"
    embedding.to_csv(tables_dir / "cell_embeddings.csv")
    metrics.to_csv(tables_dir / "integration_metrics.csv", index=False)

    save_umap(working, figures_dir, args.batch_key, "umap_by_batch.png")
    save_umap(working, figures_dir, args.cluster_key, "umap_by_cluster.png")
    if args.label_key and args.label_key in working.obs.columns:
        save_umap(working, figures_dir, args.label_key, "umap_by_label.png")

    write_report(output_dir / "report.md", args, embedding_key, metrics, provenance)
    result = {
        "skill": "singlecell/scrna/sc-batch-integration",
        "input": str(input_path),
        "output": str(output_dir),
        "method": args.method,
        "embedding_key": embedding_key,
        "cluster_key": args.cluster_key,
        "provenance": provenance,
        "metrics": metrics.to_dict(orient="records"),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
