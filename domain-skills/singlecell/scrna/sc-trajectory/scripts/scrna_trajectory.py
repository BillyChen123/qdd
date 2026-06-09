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
import scvelo as scv
from scipy import sparse


SKILL_NAME = "singlecell/scrna/sc-trajectory"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Trajectory analysis for scRNA AnnData using Scanpy or scVelo.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--threads", type=int, default=BOOTSTRAP_THREADS, help="CPU thread count for BLAS/OpenMP/Numba-backed steps.")
    parser.add_argument("--method", choices=["paga-dpt", "rna-velocity"], required=True)
    parser.add_argument("--cluster-key", default=None)
    parser.add_argument("--root-cell", default=None)
    parser.add_argument("--root-key", default=None)
    parser.add_argument("--root-values", default=None)
    parser.add_argument("--embedding-key", default="auto")
    parser.add_argument("--use-rep", default="auto")
    parser.add_argument("--n-neighbors", type=int, default=30)
    parser.add_argument("--n-pcs", type=int, default=30)
    parser.add_argument("--velocity-mode", choices=["stochastic", "deterministic", "dynamical"], default="stochastic")
    parser.add_argument("--compute-latent-time", action="store_true")
    parser.add_argument("--rank-velocity-genes", action="store_true")
    parser.add_argument("--n-top-genes", type=int, default=50)
    parser.add_argument("--min-shared-counts", type=int, default=20)
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def configure_threads(threads: int) -> int:
    threads = max(1, int(threads))
    for env_name in THREAD_ENV_VARS:
        os.environ[env_name] = str(threads)
    if hasattr(sc.settings, "n_jobs"):
        sc.settings.n_jobs = threads
    if hasattr(scv.settings, "n_jobs"):
        scv.settings.n_jobs = threads
    return threads


def validate_args(args: argparse.Namespace, adata) -> None:
    if args.cluster_key and args.cluster_key not in adata.obs.columns:
        raise ValueError(f"cluster key '{args.cluster_key}' not found in adata.obs")
    if args.root_key and args.root_key not in adata.obs.columns:
        raise ValueError(f"root key '{args.root_key}' not found in adata.obs")
    if args.method == "paga-dpt" and not args.cluster_key:
        raise ValueError("paga-dpt requires --cluster-key")
    if args.method == "paga-dpt" and not (args.root_cell or (args.root_key and args.root_values)):
        raise ValueError("paga-dpt requires --root-cell or --root-key with --root-values")


def choose_basis(adata, embedding_key: str) -> str | None:
    if embedding_key != "auto":
        if embedding_key in adata.obsm:
            return embedding_key[2:] if embedding_key.startswith("X_") else embedding_key
        normalized = f"X_{embedding_key}" if not embedding_key.startswith("X_") else embedding_key
        if normalized in adata.obsm:
            return normalized[2:]
        return None
    for candidate in ["X_umap", "X_draw_graph_fa", "X_tsne", "X_pca"]:
        if candidate in adata.obsm:
            return candidate[2:]
    return None


def choose_use_rep(adata, use_rep: str) -> str | None:
    if use_rep != "auto":
        return use_rep
    if "X_pca" in adata.obsm:
        return "X_pca"
    return None


def ensure_pca_if_needed(adata, n_pcs: int) -> None:
    if "X_pca" in adata.obsm:
        return
    n_comps = min(max(2, n_pcs), max(2, min(adata.n_obs - 1, adata.n_vars - 1)))
    sc.pp.pca(adata, n_comps=n_comps)


def ensure_neighbors(adata, n_neighbors: int, n_pcs: int, use_rep: str | None) -> None:
    if "neighbors" in adata.uns and "connectivities" in adata.obsp:
        return
    if use_rep is None and "X_pca" not in adata.obsm:
        ensure_pca_if_needed(adata, n_pcs)
        use_rep = "X_pca"
    sc.pp.neighbors(adata, n_neighbors=n_neighbors, n_pcs=None if use_rep else n_pcs, use_rep=use_rep)


def ensure_umap(adata) -> None:
    if "X_umap" not in adata.obsm and "neighbors" in adata.uns:
        sc.tl.umap(adata)


def resolve_root_index(adata, args: argparse.Namespace) -> tuple[int, str]:
    if args.root_cell:
        matches = np.where(adata.obs_names.astype(str) == str(args.root_cell))[0]
        if matches.size == 0:
            raise ValueError(f"root cell '{args.root_cell}' not found")
        return int(matches[0]), str(args.root_cell)
    allowed = {item.strip() for item in str(args.root_values).split(",") if item.strip()}
    mask = adata.obs[args.root_key].astype(str).isin(allowed)
    selected = adata.obs_names[mask]
    if selected.empty:
        raise ValueError("No cells matched the requested root selection")
    return int(np.where(adata.obs_names == selected[0])[0][0]), str(selected[0])


def export_paga_edges(adata, cluster_key: str) -> pd.DataFrame:
    paga = adata.uns.get("paga", {})
    connectivities = paga.get("connectivities")
    if connectivities is None:
        return pd.DataFrame()
    conn = connectivities.tocoo() if sparse.issparse(connectivities) else sparse.coo_matrix(connectivities)
    categories = list(adata.obs[cluster_key].astype("category").cat.categories)
    rows: list[dict[str, Any]] = []
    for i, j, value in zip(conn.row, conn.col, conn.data):
        if int(i) >= int(j):
            continue
        rows.append(
            {
                "source": str(categories[int(i)]),
                "target": str(categories[int(j)]),
                "weight": float(value),
            }
        )
    return pd.DataFrame(rows).sort_values("weight", ascending=False) if rows else pd.DataFrame()


def plot_paga(adata, output_path: Path) -> bool:
    try:
        sc.pl.paga(adata, show=False)
        plt.gcf().savefig(output_path, dpi=160, bbox_inches="tight")
        plt.close(plt.gcf())
        return True
    except Exception:
        plt.close("all")
        return False


def plot_embedding(adata, basis: str | None, color: str, output_path: Path) -> bool:
    if basis is None:
        return False
    try:
        sc.pl.embedding(adata, basis=basis, color=color, show=False)
        plt.gcf().savefig(output_path, dpi=160, bbox_inches="tight")
        plt.close(plt.gcf())
        return True
    except Exception:
        plt.close("all")
        return False


def parse_velocity_rankings(adata) -> pd.DataFrame:
    payload = adata.uns.get("rank_velocity_genes")
    if not payload or "names" not in payload:
        return pd.DataFrame()
    names = payload["names"]
    scores = payload.get("scores")
    rows: list[dict[str, Any]] = []
    if isinstance(names, np.ndarray) and names.dtype.names is not None:
        groups = names.dtype.names
        for group in groups:
            score_values = scores[group] if scores is not None else [np.nan] * len(names[group])
            for rank, (gene, score) in enumerate(zip(names[group], score_values), start=1):
                rows.append({"group": str(group), "rank": rank, "feature": str(gene), "score": float(score)})
    return pd.DataFrame(rows)


def trajectory_metrics_table(adata, cluster_key: str | None) -> pd.DataFrame:
    columns = []
    for name in ["dpt_pseudotime", "velocity_pseudotime", "latent_time"]:
        if name in adata.obs.columns:
            columns.append(name)
    frame = adata.obs[columns].copy() if columns else pd.DataFrame(index=adata.obs_names)
    if cluster_key:
        frame.insert(0, cluster_key, adata.obs[cluster_key].astype(str))
    frame.insert(0, "obs_name", adata.obs_names.astype(str))
    return frame.reset_index(drop=True)


def group_summary(metrics: pd.DataFrame, cluster_key: str | None) -> pd.DataFrame:
    if not cluster_key or cluster_key not in metrics.columns:
        return pd.DataFrame()
    value_cols = [col for col in ["dpt_pseudotime", "velocity_pseudotime", "latent_time"] if col in metrics.columns]
    if not value_cols:
        return pd.DataFrame()
    rows: list[dict[str, Any]] = []
    for group_value, frame in metrics.groupby(cluster_key, dropna=False, observed=False):
        row: dict[str, Any] = {cluster_key: group_value, "n_obs": int(frame.shape[0])}
        for col in value_cols:
            values = pd.to_numeric(frame[col], errors="coerce").dropna()
            row[f"{col}_mean"] = float(values.mean()) if not values.empty else np.nan
            row[f"{col}_median"] = float(values.median()) if not values.empty else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


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


def write_report(report_path: Path, args: argparse.Namespace, summary: dict[str, Any], metrics: pd.DataFrame, group_df: pd.DataFrame) -> None:
    lines = [
        "# sc-trajectory report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Summary",
        "",
        "```json",
        json.dumps(summary, indent=2, ensure_ascii=False),
        "```",
        "",
        "## Trajectory Metrics",
        "",
        dataframe_to_markdown(metrics),
        "",
        "## Group Summary",
        "",
        dataframe_to_markdown(group_df),
        "",
    ]
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_paga_dpt(adata, args: argparse.Namespace, tables_dir: Path, figures_dir: Path) -> tuple[dict[str, Any], list[str]]:
    use_rep = choose_use_rep(adata, args.use_rep)
    ensure_neighbors(adata, args.n_neighbors, args.n_pcs, use_rep)
    ensure_umap(adata)
    sc.tl.paga(adata, groups=args.cluster_key)
    root_index, root_cell = resolve_root_index(adata, args)
    adata.uns["iroot"] = root_index
    sc.tl.diffmap(adata)
    sc.tl.dpt(adata)

    paga_edges = export_paga_edges(adata, args.cluster_key)
    if not paga_edges.empty:
        paga_edges.to_csv(tables_dir / "paga_edges.csv", index=False)

    generated_figures: list[str] = []
    if plot_paga(adata, figures_dir / "paga_graph.png"):
        generated_figures.append("paga_graph.png")
    basis = choose_basis(adata, args.embedding_key)
    if plot_embedding(adata, basis, "dpt_pseudotime", figures_dir / "dpt_pseudotime.png"):
        generated_figures.append("dpt_pseudotime.png")

    summary = {
        "status": "completed",
        "method": "paga-dpt",
        "threads": args.threads,
        "cluster_key": args.cluster_key,
        "root_cell": root_cell,
        "basis": basis,
        "n_obs": int(adata.n_obs),
        "n_vars": int(adata.n_vars),
        "n_paga_edges": int(paga_edges.shape[0]),
    }
    return summary, generated_figures


def velocity_var_metrics(adata) -> pd.DataFrame:
    keep = [col for col in ["velocity_genes", "fit_likelihood", "fit_alpha", "fit_beta", "fit_gamma", "fit_r2"] if col in adata.var.columns]
    if not keep:
        return pd.DataFrame()
    frame = adata.var[keep].copy()
    frame.insert(0, "feature", adata.var_names.astype(str))
    return frame.reset_index(drop=True)


def run_rna_velocity(adata, args: argparse.Namespace, tables_dir: Path, figures_dir: Path) -> tuple[dict[str, Any], list[str]]:
    if "spliced" not in adata.layers or "unspliced" not in adata.layers:
        raise ValueError("rna-velocity requires 'spliced' and 'unspliced' layers")

    basis = choose_basis(adata, args.embedding_key)
    use_rep = choose_use_rep(adata, args.use_rep)
    if use_rep is None and "X_pca" not in adata.obsm:
        ensure_pca_if_needed(adata, args.n_pcs)
        use_rep = "X_pca"
    if "neighbors" not in adata.uns or "connectivities" not in adata.obsp:
        ensure_neighbors(adata, args.n_neighbors, args.n_pcs, use_rep)
    if "Ms" not in adata.layers or "Mu" not in adata.layers:
        scv.pp.filter_and_normalize(adata, min_shared_counts=args.min_shared_counts)
        scv.pp.moments(adata, n_neighbors=args.n_neighbors, n_pcs=args.n_pcs, use_rep=use_rep)

    if args.velocity_mode == "dynamical" or args.compute_latent_time:
        scv.tl.recover_dynamics(adata, n_jobs=args.threads)
    scv.tl.velocity(adata, mode=args.velocity_mode)
    scv.tl.velocity_graph(adata)
    scv.tl.velocity_pseudotime(adata)
    if args.compute_latent_time:
        scv.tl.latent_time(adata)
    if args.rank_velocity_genes and args.cluster_key:
        scv.tl.rank_velocity_genes(adata, groupby=args.cluster_key, n_genes=args.n_top_genes)

    if basis is None:
        ensure_umap(adata)
        basis = choose_basis(adata, "auto")

    generated_figures: list[str] = []
    if basis is not None:
        try:
            scv.pl.velocity_embedding_stream(adata, basis=basis, show=False)
            plt.gcf().savefig(figures_dir / "velocity_stream.png", dpi=160, bbox_inches="tight")
            plt.close(plt.gcf())
            generated_figures.append("velocity_stream.png")
        except Exception:
            plt.close("all")
        if args.compute_latent_time and "latent_time" in adata.obs.columns and plot_embedding(adata, basis, "latent_time", figures_dir / "latent_time.png"):
            generated_figures.append("latent_time.png")

    rankings = parse_velocity_rankings(adata)
    if not rankings.empty:
        rankings.to_csv(tables_dir / "velocity_gene_rankings.csv", index=False)
    var_metrics = velocity_var_metrics(adata)
    if not var_metrics.empty:
        var_metrics.to_csv(tables_dir / "velocity_gene_metrics.csv", index=False)

    summary = {
        "status": "completed",
        "method": "rna-velocity",
        "threads": args.threads,
        "velocity_mode": args.velocity_mode,
        "basis": basis,
        "cluster_key": args.cluster_key,
        "n_obs": int(adata.n_obs),
        "n_vars": int(adata.n_vars),
        "n_velocity_genes": int(adata.var["velocity_genes"].sum()) if "velocity_genes" in adata.var.columns else None,
        "computed_latent_time": bool(args.compute_latent_time),
        "ranked_velocity_genes": bool(args.rank_velocity_genes and args.cluster_key),
    }
    return summary, generated_figures


def main() -> None:
    args = parse_args()
    args.threads = configure_threads(args.threads)
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    tables_dir = output_dir / "tables"
    figures_dir = output_dir / "figures"
    ensure_dir(output_dir)
    ensure_dir(tables_dir)
    ensure_dir(figures_dir)

    adata = sc.read_h5ad(input_path)
    validate_args(args, adata)

    if args.method == "paga-dpt":
        summary, generated_figures = run_paga_dpt(adata, args, tables_dir, figures_dir)
    else:
        summary, generated_figures = run_rna_velocity(adata, args, tables_dir, figures_dir)

    metrics = trajectory_metrics_table(adata, args.cluster_key)
    metrics.to_csv(tables_dir / "trajectory_metrics.csv", index=False)
    group_df = group_summary(metrics, args.cluster_key)
    group_df.to_csv(tables_dir / "group_trajectory_summary.csv", index=False)

    output_h5ad = output_dir / "trajectory.h5ad"
    adata.write_h5ad(output_h5ad)

    write_report(output_dir / "report.md", args, summary, metrics, group_df)
    result = {
        "skill": SKILL_NAME,
        "input": str(input_path),
        "output": str(output_dir),
        "summary": summary,
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
