#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc
import scanpy.external as sce


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Spatial AnnData batch diagnosis and optional integration skill.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--batch-key", required=True, help="obs column identifying batch/sample/slide.")
    parser.add_argument("--method", choices=["none", "harmony", "scanorama", "bbknn"], default="harmony")
    parser.add_argument("--section-key", default=None, help="Optional obs column identifying spatial sections.")
    parser.add_argument("--label-key", default=None, help="Optional biology label for integration metrics.")
    parser.add_argument("--cluster-key", default="spatial_leiden", help="Where to store diagnostic Leiden labels.")
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
    parser.add_argument("--spatial-obsm-key", default="auto", help="Coordinate obsm key, or auto.")
    parser.add_argument("--color-key", default=None, help="Optional obs column for additional plots.")
    parser.add_argument("--skip-metrics", action="store_true")
    parser.add_argument("--skip-umap", action="store_true")
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


def maybe_prepare_hvg(adata: sc.AnnData, args: argparse.Namespace) -> sc.AnnData:
    if not args.use_hvg:
        return adata
    if "highly_variable" not in adata.var.columns:
        sc.pp.highly_variable_genes(adata, n_top_genes=args.n_hvg, flavor="seurat")
    if "highly_variable" in adata.var.columns and bool(adata.var["highly_variable"].sum()):
        return adata[:, adata.var["highly_variable"]].copy()
    return adata


def pca_components(adata: sc.AnnData, requested: int) -> int:
    upper = min(adata.n_obs, adata.n_vars) - 1
    return max(2, min(requested, upper))


def run_pca_basis(adata: sc.AnnData, args: argparse.Namespace) -> sc.AnnData:
    working = maybe_prepare_hvg(adata, args)
    if getattr(adata, "raw", None) is not None and getattr(working, "raw", None) is None:
        working.raw = adata.raw
    if "X_pca" not in working.obsm:
        sc.tl.pca(working, n_comps=pca_components(working, args.n_pcs), svd_solver="arpack")
    return working


def integrate(adata: sc.AnnData, args: argparse.Namespace) -> tuple[sc.AnnData, str]:
    working = run_pca_basis(adata, args)
    embedding_key = "X_pca"

    if args.method == "none":
        sc.pp.neighbors(working, n_neighbors=args.n_neighbors, n_pcs=min(args.n_pcs, working.obsm["X_pca"].shape[1]))
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
    return working, embedding_key


def compute_metrics(adata: sc.AnnData, args: argparse.Namespace, embedding_key: str) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
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


def get_spatial_coords(adata: sc.AnnData, key: str) -> tuple[str | None, pd.DataFrame | None]:
    candidates = ["spatial", "X_spatial", "coords", "coordinates", "X_xy"] if key == "auto" else [key]
    for candidate in candidates:
        if candidate in adata.obsm:
            coords = np.asarray(adata.obsm[candidate])
            if coords.ndim == 2 and coords.shape[1] >= 2:
                return f"obsm:{candidate}", pd.DataFrame({"x": coords[:, 0], "y": coords[:, 1]}, index=adata.obs_names)
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
            return f"obs:{x_key},{y_key}", pd.DataFrame({"x": adata.obs[x_key], "y": adata.obs[y_key]}, index=adata.obs_names)
    return None, None


def save_embedding_plot(adata: sc.AnnData, output_dir: Path, color_key: str, file_name: str) -> None:
    if "X_umap" not in adata.obsm or color_key not in adata.obs.columns:
        return
    coords = adata.obsm["X_umap"]
    fig, ax = plt.subplots(figsize=(6, 5))
    values = adata.obs[color_key]
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


def save_spatial_plot(coords: pd.DataFrame | None, adata: sc.AnnData, output_dir: Path, color_key: str, file_name: str) -> None:
    if coords is None or color_key not in adata.obs.columns:
        return
    numeric = coords.apply(pd.to_numeric, errors="coerce").dropna()
    if numeric.empty:
        return
    if numeric.shape[0] > 30000:
        numeric = numeric.sample(n=30000, random_state=1)
    values = adata.obs[color_key].reindex(numeric.index)
    fig, ax = plt.subplots(figsize=(6, 5))
    if pd.api.types.is_numeric_dtype(values):
        plot = ax.scatter(numeric["x"], numeric["y"], s=3, alpha=0.7, c=pd.to_numeric(values, errors="coerce"), cmap="viridis")
        fig.colorbar(plot, ax=ax, fraction=0.046, pad=0.04)
    else:
        categories = values.astype("category")
        if len(categories.cat.categories) <= 20:
            for category in categories.cat.categories:
                mask = categories == category
                ax.scatter(numeric.loc[mask, "x"], numeric.loc[mask, "y"], s=3, alpha=0.7, label=str(category))
            ax.legend(markerscale=3, fontsize=7, frameon=False)
        else:
            ax.scatter(numeric["x"], numeric["y"], s=3, alpha=0.6, color="#4C78A8")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title(f"Spatial by {color_key}")
    ax.set_aspect("equal", adjustable="box")
    fig.tight_layout()
    fig.savefig(output_dir / file_name, dpi=160)
    plt.close(fig)


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    embedding_key: str,
    coord_source: str | None,
    metrics: pd.DataFrame,
    batch_counts: pd.DataFrame,
) -> None:
    lines = [
        "# spatial-batch-integration report",
        "",
        "## Run Summary",
        "",
        f"- method: `{args.method}`",
        f"- batch_key: `{args.batch_key}`",
        f"- section_key: `{args.section_key or ''}`",
        f"- embedding_key: `{embedding_key}`",
        f"- cluster_key: `{args.cluster_key}`",
        f"- coordinate_source: `{coord_source or 'not found'}`",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Batch Sizes",
        "",
        dataframe_to_markdown(batch_counts),
        "",
    ]
    if not metrics.empty:
        lines.extend(["## Metrics", "", dataframe_to_markdown(metrics), ""])
    lines.extend(
        [
            "## Interpretation Guardrails",
            "",
            "- Coordinates were preserved but not registered.",
            "- Section-local coordinates should not be compared across sections unless registration is documented.",
            "- Integration metrics are diagnostic, not a substitute for biological marker checks.",
            "",
        ]
    )
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
    if args.batch_key not in adata.obs.columns:
        raise ValueError(f"batch key '{args.batch_key}' not found in adata.obs")
    if args.section_key and args.section_key not in adata.obs.columns:
        raise ValueError(f"section key '{args.section_key}' not found in adata.obs")

    coord_source, coords = get_spatial_coords(adata, args.spatial_obsm_key)
    working, embedding_key = integrate(adata, args)
    metrics = compute_metrics(working, args, embedding_key)

    working.write_h5ad(output_dir / "processed.h5ad")
    batch_counts = working.obs[args.batch_key].value_counts().rename_axis(args.batch_key).reset_index(name="n_obs")
    batch_counts.to_csv(tables_dir / "batch_sizes.csv", index=False)
    cluster_counts = (
        working.obs.groupby([args.batch_key, args.cluster_key], observed=False)
        .size()
        .rename("n_obs")
        .reset_index()
        .sort_values([args.batch_key, args.cluster_key])
    )
    cluster_counts.to_csv(tables_dir / "batch_cluster_counts.csv", index=False)
    if args.section_key:
        section_counts = (
            working.obs.groupby([args.section_key, args.cluster_key], observed=False)
            .size()
            .rename("n_obs")
            .reset_index()
            .sort_values([args.section_key, args.cluster_key])
        )
        section_counts.to_csv(tables_dir / "section_cluster_counts.csv", index=False)

    embedding = pd.DataFrame(working.obsm[embedding_key], index=working.obs_names)
    embedding.index.name = "obs_name"
    embedding.to_csv(tables_dir / "observation_embeddings.csv")
    metrics.to_csv(tables_dir / "integration_metrics.csv", index=False)

    save_embedding_plot(working, figures_dir, args.batch_key, "umap_by_batch.png")
    save_embedding_plot(working, figures_dir, args.cluster_key, "umap_by_cluster.png")
    if args.label_key and args.label_key in working.obs.columns:
        save_embedding_plot(working, figures_dir, args.label_key, "umap_by_label.png")
    if args.color_key and args.color_key in working.obs.columns:
        save_embedding_plot(working, figures_dir, args.color_key, "umap_by_color.png")
    save_spatial_plot(coords, working, figures_dir, args.batch_key, "spatial_by_batch.png")
    save_spatial_plot(coords, working, figures_dir, args.cluster_key, "spatial_by_cluster.png")

    write_report(output_dir / "report.md", args, embedding_key, coord_source, metrics, batch_counts)
    result = {
        "skill": "spatial/spatial-batch-integration",
        "input": str(input_path),
        "output": str(output_dir),
        "method": args.method,
        "batch_key": args.batch_key,
        "section_key": args.section_key,
        "embedding_key": embedding_key,
        "cluster_key": args.cluster_key,
        "coordinate_source": coord_source,
        "metrics": metrics.to_dict(orient="records"),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
