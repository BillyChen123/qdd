#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

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
import numpy as np
import pandas as pd
import scanpy as sc
from scipy import sparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Spatial AnnData graph construction, clustering, and embedding skill.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--threads", type=int, default=BOOTSTRAP_THREADS, help="CPU thread count for BLAS/OpenMP/Numba-backed steps.")
    parser.add_argument("--graph-source", choices=["expression", "spatial", "combined"], default="expression")
    parser.add_argument("--use-rep", default="auto", help="Embedding in adata.obsm to use, or auto.")
    parser.add_argument("--spatial-obsm-key", default="auto", help="Coordinate obsm key, or auto.")
    parser.add_argument("--section-key", default=None, help="Optional obs column used to keep spatial neighbors section-local.")
    parser.add_argument("--n-pcs", type=int, default=50)
    parser.add_argument("--n-neighbors", type=int, default=15)
    parser.add_argument("--spatial-neighbors", type=int, default=15)
    parser.add_argument("--spatial-weight", type=float, default=0.5, help="Combined graph spatial weight in [0, 1].")
    parser.add_argument("--resolution", type=float, default=0.5)
    parser.add_argument("--cluster-key", default="spatial_leiden")
    parser.add_argument("--umap-min-dist", type=float, default=0.3)
    parser.add_argument("--random-state", type=int, default=0)
    parser.add_argument("--color-key", default=None, help="Optional obs column for additional plots.")
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


def pca_components(adata: sc.AnnData, requested: int) -> int:
    upper = min(adata.n_obs, adata.n_vars) - 1
    if upper < 1:
        raise ValueError("PCA requires at least two observations and two usable features.")
    return 1 if upper == 1 else min(requested, upper)


def resolve_use_rep(adata: sc.AnnData, requested: str, n_pcs: int) -> tuple[str | None, int | None]:
    if requested != "auto":
        if requested == "X_pca":
            if "X_pca" not in adata.obsm:
                sc.tl.pca(adata, svd_solver="arpack", n_comps=pca_components(adata, n_pcs))
            return None, min(n_pcs, adata.obsm["X_pca"].shape[1])
        if requested not in adata.obsm:
            raise ValueError(f"use_rep '{requested}' not found in adata.obsm")
        return requested, None

    for candidate in ["X_pca_harmony", "X_scanorama", "X_scvi", "X_scanvi", "X_pca"]:
        if candidate == "X_pca":
            if "X_pca" in adata.obsm:
                return None, min(n_pcs, adata.obsm["X_pca"].shape[1])
        elif candidate in adata.obsm:
            return candidate, None

    sc.tl.pca(adata, svd_solver="arpack", n_comps=pca_components(adata, n_pcs))
    return None, min(n_pcs, adata.obsm["X_pca"].shape[1])


def get_spatial_coords(adata: sc.AnnData, key: str) -> tuple[str | None, np.ndarray | None]:
    candidates = ["spatial", "X_spatial", "coords", "coordinates", "X_xy"] if key == "auto" else [key]
    for candidate in candidates:
        if candidate in adata.obsm:
            coords = np.asarray(adata.obsm[candidate])
            if coords.ndim == 2 and coords.shape[1] >= 2:
                return f"obsm:{candidate}", coords[:, :2].astype(float)
    for x_key, y_key in [
        ("x", "y"),
        ("X", "Y"),
        ("spatial_x", "spatial_y"),
        ("array_col", "array_row"),
        ("pxl_col_in_fullres", "pxl_row_in_fullres"),
        ("x_centroid", "y_centroid"),
        ("center_x", "center_y"),
        ("centroid_x", "centroid_y"),
    ]:
        if x_key in adata.obs.columns and y_key in adata.obs.columns:
            coords = adata.obs[[x_key, y_key]].apply(pd.to_numeric, errors="coerce").to_numpy(dtype=float)
            return f"obs:{x_key},{y_key}", coords
    return None, None


def normalize_connectivities(matrix: sparse.spmatrix) -> sparse.csr_matrix:
    csr = matrix.tocsr().astype(float)
    if csr.nnz == 0:
        return csr
    max_value = float(csr.data.max())
    if max_value > 0:
        csr.data = csr.data / max_value
    return csr


def build_expression_graph(adata: sc.AnnData, args: argparse.Namespace) -> tuple[sparse.csr_matrix, str]:
    use_rep, n_pcs = resolve_use_rep(adata, args.use_rep, args.n_pcs)
    if use_rep is None:
        sc.pp.neighbors(adata, n_neighbors=args.n_neighbors, n_pcs=n_pcs or args.n_pcs)
        resolved = "X_pca"
    else:
        sc.pp.neighbors(adata, n_neighbors=args.n_neighbors, use_rep=use_rep)
        resolved = use_rep
    return normalize_connectivities(adata.obsp["connectivities"]), resolved


def squidpy_spatial_graph(adata: sc.AnnData, coord_key: str, section_key: str | None, n_neighbors: int) -> sparse.csr_matrix:
    try:
        import squidpy as sq
    except ModuleNotFoundError as error:
        raise ModuleNotFoundError("squidpy is required for spatial graph construction in qdd-skill-core.") from error

    kwargs: dict[str, Any] = {
        "spatial_key": coord_key,
        "coord_type": "generic",
        "n_neighs": n_neighbors,
        "key_added": "qdd_spatial",
    }
    if section_key:
        kwargs["library_key"] = section_key
    sq.gr.spatial_neighbors(adata, **kwargs)
    key = "qdd_spatial_connectivities"
    if key not in adata.obsp:
        raise RuntimeError("squidpy did not produce qdd_spatial_connectivities")
    return normalize_connectivities(adata.obsp[key])


def build_spatial_graph(adata: sc.AnnData, args: argparse.Namespace) -> tuple[sparse.csr_matrix, str, str | None]:
    coord_source, coords = get_spatial_coords(adata, args.spatial_obsm_key)
    if coords is None:
        raise ValueError("spatial coordinates were not found; provide --spatial-obsm-key or coordinate obs columns")
    if args.section_key and args.section_key not in adata.obs.columns:
        raise ValueError(f"section key '{args.section_key}' not found in adata.obs")

    coord_key = "_qdd_spatial_coords"
    adata.obsm[coord_key] = coords
    graph = squidpy_spatial_graph(adata, coord_key, args.section_key, args.spatial_neighbors)
    return graph, "squidpy", coord_source


def register_custom_neighbors(adata: sc.AnnData, key: str, connectivities: sparse.spmatrix) -> str:
    conn_key = f"{key}_connectivities"
    dist_key = f"{key}_distances"
    neighbors_key = f"{key}_neighbors"
    normalized = normalize_connectivities(connectivities)
    distances = normalized.copy().tocsr()
    distances.data = 1.0 - distances.data
    adata.obsp[conn_key] = normalized
    adata.obsp[dist_key] = distances
    adata.uns[neighbors_key] = {
        "connectivities_key": conn_key,
        "distances_key": dist_key,
        "params": {"method": key},
    }
    return neighbors_key


def save_embedding_plot(adata: sc.AnnData, output_dir: Path, color_key: str, file_name: str) -> None:
    if "X_umap" not in adata.obsm or color_key not in adata.obs.columns:
        return
    coords = adata.obsm["X_umap"]
    values = adata.obs[color_key]
    fig, ax = plt.subplots(figsize=(6, 5))
    if pd.api.types.is_numeric_dtype(values):
        plot = ax.scatter(coords[:, 0], coords[:, 1], s=5, alpha=0.7, c=pd.to_numeric(values, errors="coerce"), cmap="viridis")
        fig.colorbar(plot, ax=ax, fraction=0.046, pad=0.04)
    else:
        categories = values.astype("category")
        for category in categories.cat.categories:
            mask = categories == category
            ax.scatter(coords[mask, 0], coords[mask, 1], s=5, alpha=0.7, label=str(category))
        if len(categories.cat.categories) <= 15:
            ax.legend(markerscale=3, fontsize=8, frameon=False)
    ax.set_xlabel("UMAP1")
    ax.set_ylabel("UMAP2")
    ax.set_title(f"UMAP by {color_key}")
    fig.tight_layout()
    fig.savefig(output_dir / file_name, dpi=160)
    plt.close(fig)


def save_spatial_plot(coords: np.ndarray | None, adata: sc.AnnData, output_dir: Path, color_key: str, file_name: str) -> None:
    if coords is None or color_key not in adata.obs.columns:
        return
    frame = pd.DataFrame({"x": coords[:, 0], "y": coords[:, 1]}, index=adata.obs_names).apply(pd.to_numeric, errors="coerce").dropna()
    if frame.empty:
        return
    if frame.shape[0] > 30000:
        frame = frame.sample(n=30000, random_state=1)
    values = adata.obs[color_key].reindex(frame.index)
    fig, ax = plt.subplots(figsize=(6, 5))
    if pd.api.types.is_numeric_dtype(values):
        plot = ax.scatter(frame["x"], frame["y"], s=3, alpha=0.7, c=pd.to_numeric(values, errors="coerce"), cmap="viridis")
        fig.colorbar(plot, ax=ax, fraction=0.046, pad=0.04)
    else:
        categories = values.astype("category")
        if len(categories.cat.categories) <= 20:
            for category in categories.cat.categories:
                mask = categories == category
                ax.scatter(frame.loc[mask, "x"], frame.loc[mask, "y"], s=3, alpha=0.7, label=str(category))
            ax.legend(markerscale=3, fontsize=7, frameon=False)
        else:
            ax.scatter(frame["x"], frame["y"], s=3, alpha=0.6, color="#4C78A8")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title(f"Spatial by {color_key}")
    ax.set_aspect("equal", adjustable="box")
    fig.tight_layout()
    fig.savefig(output_dir / file_name, dpi=160)
    plt.close(fig)


def run_clustering(adata: sc.AnnData, args: argparse.Namespace) -> dict[str, Any]:
    expression_rep: str | None = None
    spatial_backend: str | None = None
    coord_source: str | None = None
    adjacency: sparse.spmatrix | None = None
    neighbors_key = "neighbors"

    if args.graph_source == "expression":
        _, expression_rep = build_expression_graph(adata, args)
    elif args.graph_source == "spatial":
        adjacency, spatial_backend, coord_source = build_spatial_graph(adata, args)
        neighbors_key = register_custom_neighbors(adata, "qdd_spatial", adjacency)
    elif args.graph_source == "combined":
        expr_graph, expression_rep = build_expression_graph(adata, args)
        spatial_graph, spatial_backend, coord_source = build_spatial_graph(adata, args)
        weight = min(1.0, max(0.0, args.spatial_weight))
        adjacency = normalize_connectivities(((1.0 - weight) * expr_graph) + (weight * spatial_graph))
        neighbors_key = register_custom_neighbors(adata, "qdd_combined", adjacency)
    else:
        raise ValueError(f"Unsupported graph source: {args.graph_source}")

    if adjacency is None:
        sc.tl.leiden(adata, resolution=args.resolution, key_added=args.cluster_key)
    else:
        sc.tl.leiden(adata, resolution=args.resolution, key_added=args.cluster_key, adjacency=adjacency)

    if not args.skip_umap:
        if args.graph_source == "expression":
            sc.tl.umap(adata, min_dist=args.umap_min_dist, random_state=args.random_state)
        else:
            sc.tl.umap(adata, min_dist=args.umap_min_dist, random_state=args.random_state, neighbors_key=neighbors_key)

    return {
        "expression_rep": expression_rep,
        "spatial_backend": spatial_backend,
        "coordinate_source": coord_source,
        "neighbors_key": neighbors_key,
        "threads": args.threads,
        "skip_umap": bool(args.skip_umap),
    }


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    provenance: dict[str, Any],
    cluster_counts: pd.DataFrame,
) -> None:
    lines = [
        "# spatial-clustering report",
        "",
        "## Run Summary",
        "",
        f"- graph_source: `{args.graph_source}`",
        f"- expression_rep: `{provenance.get('expression_rep') or ''}`",
        f"- spatial_backend: `{provenance.get('spatial_backend') or ''}`",
        f"- coordinate_source: `{provenance.get('coordinate_source') or ''}`",
        f"- section_key: `{args.section_key or ''}`",
        f"- cluster_key: `{args.cluster_key}`",
        f"- n_clusters: `{cluster_counts.shape[0]}`",
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
        "## Interpretation Guardrails",
        "",
        "- Coordinate-based clusters are operational structures, not cell-type labels.",
        "- Provide section_key when coordinates are not globally registered.",
        "- Use marker annotation before making biological label claims.",
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
    if args.section_key and args.section_key not in adata.obs.columns:
        raise ValueError(f"section key '{args.section_key}' not found in adata.obs")

    coord_source, coords = get_spatial_coords(adata, args.spatial_obsm_key)
    provenance = run_clustering(adata, args)
    if provenance.get("coordinate_source") is None:
        provenance["coordinate_source"] = coord_source

    assignments = adata.obs[[args.cluster_key]].copy()
    assignments.index.name = "obs_name"
    assignments.to_csv(tables_dir / "cluster_assignments.csv")
    cluster_counts = (
        adata.obs[args.cluster_key]
        .value_counts()
        .rename_axis(args.cluster_key)
        .reset_index(name="n_obs")
        .sort_values(args.cluster_key)
    )
    cluster_counts.to_csv(tables_dir / "cluster_counts.csv", index=False)
    if args.section_key:
        section_counts = (
            adata.obs.groupby([args.section_key, args.cluster_key], observed=False)
            .size()
            .rename("n_obs")
            .reset_index()
            .sort_values([args.section_key, args.cluster_key])
        )
        section_counts.to_csv(tables_dir / "section_cluster_counts.csv", index=False)

    save_embedding_plot(adata, figures_dir, args.cluster_key, "umap_by_cluster.png")
    if args.color_key and args.color_key in adata.obs.columns:
        save_embedding_plot(adata, figures_dir, args.color_key, "umap_by_color.png")
    save_spatial_plot(coords, adata, figures_dir, args.cluster_key, "spatial_by_cluster.png")
    if args.color_key and args.color_key in adata.obs.columns:
        save_spatial_plot(coords, adata, figures_dir, args.color_key, "spatial_by_color.png")

    adata.write_h5ad(output_dir / "processed.h5ad")
    write_report(output_dir / "report.md", args, provenance, cluster_counts)
    result = {
        "skill": "spatial/spatial-clustering",
        "input": str(input_path),
        "output": str(output_dir),
        "graph_source": args.graph_source,
        "cluster_key": args.cluster_key,
        "n_clusters": int(cluster_counts.shape[0]),
        "provenance": provenance,
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
