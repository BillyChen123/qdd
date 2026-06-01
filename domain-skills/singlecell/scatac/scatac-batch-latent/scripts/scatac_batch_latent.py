#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc
import scanpy.external as sce
from scipy import sparse
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import normalize


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone scATAC latent-space diagnosis and batch-correction skill.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--batch-key", required=True, help="obs column describing sample or batch.")
    parser.add_argument("--method", choices=["none", "harmony"], default="none")
    parser.add_argument("--use-rep", choices=["auto", "X_lsi", "X_lsi_harmony"], default="auto")
    parser.add_argument("--label-key", default=None, help="Optional biology label for a diagnostic UMAP.")
    parser.add_argument("--n-components", type=int, default=50)
    parser.add_argument("--n-neighbors", type=int, default=15)
    parser.add_argument("--leiden-resolution", type=float, default=0.5)
    parser.add_argument("--cluster-key", default="leiden")
    parser.add_argument("--harmony-theta", type=float, default=2.0)
    parser.add_argument("--umap-min-dist", type=float, default=0.3)
    parser.add_argument("--random-state", type=int, default=0)
    parser.add_argument("--skip-umap", action="store_true")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def matrix_to_csr(matrix) -> sparse.csr_matrix:
    if sparse.issparse(matrix):
        return matrix.tocsr().astype(np.float32)
    return sparse.csr_matrix(np.asarray(matrix, dtype=np.float32))


def compute_lsi(matrix: sparse.csr_matrix, n_components: int, random_state: int) -> np.ndarray:
    row_sums = np.asarray(matrix.sum(axis=1)).ravel().astype(np.float32)
    row_sums[row_sums == 0] = 1.0
    tf = sparse.diags(1.0 / row_sums) @ matrix
    doc_freq = np.asarray((matrix > 0).sum(axis=0)).ravel().astype(np.float32)
    idf = np.log1p(matrix.shape[0] / (1.0 + doc_freq)) + 1.0
    tfidf = normalize(tf @ sparse.diags(idf), norm="l2", axis=1)
    max_components = min(matrix.shape[0] - 1, matrix.shape[1] - 1, n_components)
    if max_components < 2:
        raise ValueError("Not enough cells/features to rebuild an LSI representation.")
    return TruncatedSVD(n_components=max_components, random_state=random_state).fit_transform(tfidf)


def ensure_lsi(adata: sc.AnnData, n_components: int, random_state: int) -> str:
    if "X_lsi" in adata.obsm:
        return "X_lsi"
    adata.obsm["X_lsi"] = compute_lsi(matrix_to_csr(adata.X), n_components, random_state)
    return "X_lsi"


def resolve_rep(adata: sc.AnnData, requested: str, n_components: int, random_state: int) -> str:
    if requested == "X_lsi_harmony":
        if "X_lsi_harmony" not in adata.obsm:
            raise ValueError("Requested X_lsi_harmony is missing from adata.obsm.")
        return "X_lsi_harmony"
    if requested == "X_lsi":
        return ensure_lsi(adata, n_components, random_state)
    if "X_lsi_harmony" in adata.obsm:
        return "X_lsi_harmony"
    return ensure_lsi(adata, n_components, random_state)


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


def compute_metrics(adata: sc.AnnData, batch_key: str, cluster_key: str, embedding_key: str) -> pd.DataFrame:
    rows: list[dict[str, object]] = [
        {"metric": "embedding_key", "value": embedding_key, "notes": "representation used for neighbors"},
        {"metric": "n_batches", "value": int(adata.obs[batch_key].nunique()), "notes": batch_key},
        {"metric": "n_clusters", "value": int(adata.obs[cluster_key].nunique()), "notes": cluster_key},
    ]

    if adata.obs[batch_key].nunique() > 1:
        try:
            silhouette = silhouette_score(adata.obsm[embedding_key], adata.obs[batch_key].astype(str))
            rows.append({"metric": "batch_silhouette", "value": float(silhouette), "notes": "higher means stronger batch separation"})
        except Exception as error:  # noqa: BLE001
            rows.append({"metric": "batch_silhouette", "value": None, "notes": str(error)})

    cluster_mix = pd.crosstab(adata.obs[cluster_key], adata.obs[batch_key], normalize="index")
    if not cluster_mix.empty:
        rows.append(
            {
                "metric": "mean_major_batch_fraction",
                "value": float(cluster_mix.max(axis=1).mean()),
                "notes": "lower suggests better within-cluster batch mixing",
            }
        )

    return pd.DataFrame(rows)


def write_report(report_path: Path, args: argparse.Namespace, embedding_key: str, metrics: pd.DataFrame) -> None:
    lines = [
        "# scatac-batch-latent report",
        "",
        "## Run Summary",
        "",
        f"- method: `{args.method}`",
        f"- batch_key: `{args.batch_key}`",
        f"- embedding_key: `{embedding_key}`",
        f"- cluster_key: `{args.cluster_key}`",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Metrics",
        "",
    ]
    if metrics.empty:
        lines.append("- none")
    else:
        for row in metrics.to_dict(orient="records"):
            lines.append(f"- {row['metric']}: `{row['value']}` ({row['notes']})")
    lines.extend(
        [
            "",
            "## Boundary Notes",
            "",
            "- This skill diagnoses or lightly corrects batch structure on an LSI manifold.",
            "- It does not upgrade a matrix-only study into a fragment-native workflow.",
            "",
        ]
    )
    report_path.write_text("\n".join(lines), encoding="utf-8")


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
    if args.label_key and args.label_key not in adata.obs.columns:
        raise ValueError(f"label key '{args.label_key}' not found in adata.obs")

    base_rep = resolve_rep(adata, "X_lsi" if args.use_rep == "auto" else args.use_rep, args.n_components, args.random_state)
    embedding_key = base_rep

    if args.method == "harmony":
        try:
            sce.pp.harmony_integrate(
                adata,
                key=args.batch_key,
                basis=base_rep,
                adjusted_basis="X_lsi_harmony",
                theta=args.harmony_theta,
            )
        except Exception as error:  # noqa: BLE001
            raise RuntimeError("Harmony integration failed. Confirm harmonypy is available in the analysis environment.") from error
        embedding_key = "X_lsi_harmony"

    sc.pp.neighbors(adata, use_rep=embedding_key, n_neighbors=args.n_neighbors)
    sc.tl.leiden(adata, resolution=args.leiden_resolution, key_added=args.cluster_key)
    if not args.skip_umap:
        sc.tl.umap(adata, min_dist=args.umap_min_dist, random_state=args.random_state)

    metrics = compute_metrics(adata, args.batch_key, args.cluster_key, embedding_key)
    batch_cluster_counts = (
        adata.obs.groupby([args.batch_key, args.cluster_key], observed=False)
        .size()
        .rename("n_cells")
        .reset_index()
        .sort_values([args.batch_key, args.cluster_key])
    )
    batch_sizes = adata.obs[args.batch_key].value_counts().rename_axis(args.batch_key).reset_index(name="n_cells")
    embeddings = pd.DataFrame(adata.obsm[embedding_key], index=adata.obs_names)
    embeddings.index.name = "cell_id"

    adata.write_h5ad(output_dir / "processed.h5ad")
    batch_sizes.to_csv(tables_dir / "batch_sizes.csv", index=False)
    metrics.to_csv(tables_dir / "integration_metrics.csv", index=False)
    embeddings.to_csv(tables_dir / "cell_embeddings.csv")
    batch_cluster_counts.to_csv(tables_dir / "batch_cluster_counts.csv", index=False)

    save_umap(adata, figures_dir, args.batch_key, "umap_by_batch.png")
    save_umap(adata, figures_dir, args.cluster_key, "umap_by_cluster.png")
    if args.label_key:
        save_umap(adata, figures_dir, args.label_key, "umap_by_label.png")

    write_report(output_dir / "report.md", args, embedding_key, metrics)
    result = {
        "skill": "singlecell/scatac/scatac-batch-latent",
        "input": str(input_path),
        "output": str(output_dir),
        "method": args.method,
        "embedding_key": embedding_key,
        "cluster_key": args.cluster_key,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
