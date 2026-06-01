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
from scipy import sparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone scATAC differential accessibility ranking skill.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--groupby", required=True, help="obs column defining the DAR contrast.")
    parser.add_argument("--reference", default="rest", help="Reference group name, or 'rest'.")
    parser.add_argument("--subset-key", default=None, help="Optional obs column used to subset before DAR.")
    parser.add_argument("--subset-value", default=None, help="Optional value for subset-key.")
    parser.add_argument("--method", choices=["wilcoxon", "t-test", "logreg"], default="wilcoxon")
    parser.add_argument("--n-features", type=int, default=30)
    parser.add_argument("--min-pct", type=float, default=0.05)
    parser.add_argument("--use-binary", action="store_true", default=True, help="Use a binary accessibility matrix for ranking.")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def matrix_to_binary(matrix):
    if sparse.issparse(matrix):
        binary = matrix.copy().tocsr()
        binary.data = np.ones_like(binary.data)
        return binary
    return (np.asarray(matrix) > 0).astype(np.float32)


def detection_fraction(matrix, feature_index: int) -> float:
    column = matrix[:, feature_index]
    if sparse.issparse(column):
        return float(column.getnnz() / column.shape[0])
    dense = np.asarray(column).ravel()
    return float(np.mean(dense > 0))


def build_rankings(adata: sc.AnnData, groupby: str, method: str, n_features: int, reference: str) -> pd.DataFrame:
    sc.tl.rank_genes_groups(adata, groupby=groupby, method=method, n_genes=n_features, reference=reference, use_raw=False)
    groups = list(map(str, adata.obs[groupby].astype("category").cat.categories))
    frames: list[pd.DataFrame] = []
    for group in groups:
        frame = sc.get.rank_genes_groups_df(adata, group=group)
        frame["group"] = group
        frames.append(frame)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def build_dar_summary(adata: sc.AnnData, rankings: pd.DataFrame, groupby: str, min_pct: float) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    groups = adata.obs[groupby].astype("category").cat.categories
    binary_matrix = matrix_to_binary(adata.X)
    name_to_index = {str(name): index for index, name in enumerate(map(str, adata.var_names))}

    for group in map(str, groups):
        group_mask = adata.obs[groupby].astype(str).to_numpy() == group
        rest_mask = ~group_mask
        group_rankings = rankings[rankings["group"] == group].copy()
        for row in group_rankings.itertuples(index=False):
            feature_name = str(row.names)
            feature_index = name_to_index.get(feature_name)
            if feature_index is None:
                continue
            pct_in = detection_fraction(binary_matrix[group_mask], feature_index)
            pct_out = detection_fraction(binary_matrix[rest_mask], feature_index) if rest_mask.any() else 0.0
            if max(pct_in, pct_out) < min_pct:
                continue
            rows.append(
                {
                    "group": group,
                    "feature": feature_name,
                    "score": float(row.scores),
                    "logfoldchanges": None if pd.isna(row.logfoldchanges) else float(row.logfoldchanges),
                    "pvals_adj": None if pd.isna(row.pvals_adj) else float(row.pvals_adj),
                    "pct_in_group": pct_in,
                    "pct_out_group": pct_out,
                }
            )
    return pd.DataFrame(rows)


def save_heatmap(adata: sc.AnnData, summary: pd.DataFrame, groupby: str, figure_path: Path) -> None:
    if summary.empty:
        return
    top_features = (
        summary.sort_values(["group", "score"], ascending=[True, False])
        .groupby("group", sort=False)
        .head(5)["feature"]
        .drop_duplicates()
        .tolist()
    )
    if not top_features:
        return
    mean_rows: list[list[float]] = []
    groups = list(map(str, adata.obs[groupby].astype("category").cat.categories))
    for group in groups:
        mask = adata.obs[groupby].astype(str).to_numpy() == group
        subset = adata[mask, top_features].X
        if sparse.issparse(subset):
            mean_rows.append(np.asarray(subset.mean(axis=0)).ravel().tolist())
        else:
            mean_rows.append(np.asarray(subset).mean(axis=0).ravel().tolist())
    matrix = np.asarray(mean_rows, dtype=float)
    fig, ax = plt.subplots(figsize=(max(6, len(top_features) * 0.5), max(4, len(groups) * 0.5)))
    im = ax.imshow(matrix, aspect="auto", cmap="magma")
    ax.set_xticks(range(len(top_features)))
    ax.set_xticklabels(top_features, rotation=45, ha="right")
    ax.set_yticks(range(len(groups)))
    ax.set_yticklabels(groups)
    ax.set_title("Top DAR mean accessibility")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(figure_path, dpi=160)
    plt.close(fig)


def write_report(report_path: Path, args: argparse.Namespace, ranking_count: int) -> None:
    lines = [
        "# scatac-dar report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Summary",
        "",
        f"- retained_rankings: `{ranking_count}`",
        "- This is a matrix-first DAR result and not a full regulatory inference layer.",
        "",
    ]
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
    if args.groupby not in adata.obs.columns:
        raise ValueError(f"groupby key '{args.groupby}' not found in adata.obs")
    if args.subset_key and args.subset_key not in adata.obs.columns:
        raise ValueError(f"subset key '{args.subset_key}' not found in adata.obs")
    if args.subset_key and args.subset_value is None:
        raise ValueError("Provide --subset-value when using --subset-key.")

    if args.subset_key and args.subset_value is not None:
        mask = adata.obs[args.subset_key].astype(str) == str(args.subset_value)
        adata = adata[mask].copy()
        if adata.n_obs == 0:
            raise ValueError("Subset removed all cells. Adjust subset-key/subset-value.")

    if args.use_binary:
        adata.X = matrix_to_binary(adata.X)

    rankings = build_rankings(adata, args.groupby, args.method, args.n_features, args.reference)
    summary = build_dar_summary(adata, rankings, args.groupby, args.min_pct)

    rankings.to_csv(tables_dir / "dar_rankings.csv", index=False)
    summary.to_csv(tables_dir / "dar_summary.csv", index=False)
    save_heatmap(adata, summary, args.groupby, figures_dir / "top_dar_heatmap.png")
    adata.write_h5ad(output_dir / "ranked.h5ad")
    write_report(output_dir / "report.md", args, int(summary.shape[0]))

    result = {
        "skill": "singlecell/scatac/scatac-dar",
        "input": str(input_path),
        "output": str(output_dir),
        "groupby": args.groupby,
        "n_rankings": int(summary.shape[0]),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
