#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc
from scipy import sparse


@dataclass
class MatrixState:
    source: str
    looks_like_counts: bool
    integer_fraction: float
    min_value: float
    max_value: float
    mean_value: float
    n_obs: int
    n_vars: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Independent Scanpy preprocessing and QC skill for scRNA-seq h5ad files.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--mode", choices=["auto", "force", "inspect"], default="auto")
    parser.add_argument("--counts-layer", default="auto", help="Which matrix to treat as counts: auto | X | <layer>.")
    parser.add_argument("--min-genes", type=int, default=200)
    parser.add_argument("--min-cells", type=int, default=3)
    parser.add_argument("--max-mt-pct", type=float, default=20.0)
    parser.add_argument("--target-sum", type=float, default=1e4)
    parser.add_argument("--hvg-flavor", choices=["seurat", "seurat_v3", "cell_ranger"], default="seurat")
    parser.add_argument("--n-top-genes", type=int, default=2000)
    parser.add_argument("--batch-key", default=None, help="Optional obs column for batch-aware HVG.")
    parser.add_argument("--run-scale", action="store_true", help="Apply sc.pp.scale before PCA. Off by default.")
    parser.add_argument("--scale-max-value", type=float, default=10.0)
    parser.add_argument("--n-pcs", type=int, default=50)
    parser.add_argument("--skip-filter", action="store_true")
    parser.add_argument("--skip-normalize", action="store_true")
    parser.add_argument("--skip-log1p", action="store_true")
    parser.add_argument("--skip-hvg", action="store_true")
    parser.add_argument("--skip-scale", action="store_true", help="Compatibility flag. Scaling is off by default unless --run-scale is set.")
    parser.add_argument("--skip-pca", action="store_true")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def resolve_percent_top(n_vars: int) -> list[int] | None:
    candidates = [50, 100, 200, 500]
    valid = [value for value in candidates if value < n_vars]
    return valid or None


def matrix_to_dense_preview(matrix, limit: int = 50000) -> np.ndarray:
    if sparse.issparse(matrix):
        values = matrix.data
    else:
        values = np.asarray(matrix).ravel()
    if values.size == 0:
        return np.array([], dtype=float)
    if values.size > limit:
        step = max(1, values.size // limit)
        values = values[::step]
    return np.asarray(values, dtype=float)


def infer_counts_state(matrix, source: str, n_obs: int, n_vars: int) -> MatrixState:
    values = matrix_to_dense_preview(matrix)
    if values.size == 0:
        return MatrixState(source, False, 0.0, 0.0, 0.0, 0.0, n_obs, n_vars)
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return MatrixState(source, False, 0.0, float("nan"), float("nan"), float("nan"), n_obs, n_vars)
    rounded = np.round(finite)
    integer_fraction = float(np.mean(np.isclose(finite, rounded, atol=1e-8)))
    min_value = float(np.min(finite))
    max_value = float(np.max(finite))
    mean_value = float(np.mean(finite))
    looks_like_counts = min_value >= 0 and integer_fraction >= 0.95 and max_value >= 5
    return MatrixState(source, looks_like_counts, integer_fraction, min_value, max_value, mean_value, n_obs, n_vars)


def resolve_matrix(adata: sc.AnnData, counts_layer: str) -> tuple[str, object]:
    if counts_layer == "X":
        return "X", adata.X
    if counts_layer not in {"auto", "X"}:
        if counts_layer not in adata.layers:
            raise ValueError(f"counts layer '{counts_layer}' not found in adata.layers.")
        return counts_layer, adata.layers[counts_layer]

    candidates: list[tuple[str, object]] = [("X", adata.X)]
    for layer_name in ["counts", "raw_counts"]:
        if layer_name in adata.layers:
            candidates.append((layer_name, adata.layers[layer_name]))
    for layer_name, layer_value in adata.layers.items():
        if layer_name not in {"counts", "raw_counts"}:
            candidates.append((layer_name, layer_value))

    states = [infer_counts_state(matrix, source, adata.n_obs, adata.n_vars) for source, matrix in candidates]
    for state, (_, matrix) in zip(states, candidates):
        if state.looks_like_counts:
            return state.source, matrix
    return "X", adata.X


def write_qc_figures(adata: sc.AnnData, figure_dir: Path) -> list[str]:
    generated: list[str] = []
    obs = adata.obs.copy()
    if "total_counts" in obs.columns and "n_genes_by_counts" in obs.columns:
        fig, axes = plt.subplots(1, 2, figsize=(10, 4))
        axes[0].hist(obs["total_counts"].to_numpy(), bins=50, color="#4C78A8")
        axes[0].set_title("Total Counts")
        axes[1].hist(obs["n_genes_by_counts"].to_numpy(), bins=50, color="#F58518")
        axes[1].set_title("Genes per Cell")
        fig.tight_layout()
        path = figure_dir / "qc_histograms.png"
        fig.savefig(path, dpi=160)
        plt.close(fig)
        generated.append(path.name)

    if "pct_counts_mt" in obs.columns and "total_counts" in obs.columns:
        fig, ax = plt.subplots(figsize=(5, 4))
        ax.scatter(obs["total_counts"], obs["pct_counts_mt"], s=5, alpha=0.4)
        ax.set_xlabel("total_counts")
        ax.set_ylabel("pct_counts_mt")
        ax.set_title("Mitochondrial Fraction")
        fig.tight_layout()
        path = figure_dir / "mt_scatter.png"
        fig.savefig(path, dpi=160)
        plt.close(fig)
        generated.append(path.name)

    return generated


def write_report(report_path: Path, state: MatrixState, args: argparse.Namespace, operations: list[str]) -> None:
    lines = [
        "# sc-preprocess-qc report",
        "",
        "## Matrix State",
        "",
        f"- source: `{state.source}`",
        f"- looks_like_counts: `{state.looks_like_counts}`",
        f"- integer_fraction: `{state.integer_fraction:.4f}`",
        f"- min_value: `{state.min_value:.4f}`",
        f"- max_value: `{state.max_value:.4f}`",
        f"- mean_value: `{state.mean_value:.4f}`",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Operations",
        "",
    ]
    lines.extend([f"- {item}" for item in operations] or ["- no matrix-transforming operation executed"])
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
    matrix_source, matrix = resolve_matrix(adata, args.counts_layer)
    state = infer_counts_state(matrix, matrix_source, adata.n_obs, adata.n_vars)

    working = adata.copy()
    if matrix_source != "X":
        working.X = working.layers[matrix_source].copy()

    if "mt" not in working.var.columns:
        working.var["mt"] = working.var_names.str.upper().str.startswith("MT-")

    sc.pp.calculate_qc_metrics(
        working,
        qc_vars=["mt"],
        percent_top=resolve_percent_top(working.n_vars),
        inplace=True,
    )
    operations: list[str] = []

    should_preprocess = args.mode == "force" or (args.mode == "auto" and state.looks_like_counts)
    if args.mode == "inspect":
        should_preprocess = False

    if should_preprocess:
        if not args.skip_filter:
            before = (working.n_obs, working.n_vars)
            sc.pp.filter_cells(working, min_genes=args.min_genes)
            sc.pp.filter_genes(working, min_cells=args.min_cells)
            if "pct_counts_mt" in working.obs.columns:
                working = working[working.obs["pct_counts_mt"] <= args.max_mt_pct].copy()
            operations.append(f"filter_cells/filter_genes/mt_filter: {before} -> {(working.n_obs, working.n_vars)}")

        if not args.skip_normalize:
            sc.pp.normalize_total(working, target_sum=args.target_sum)
            operations.append(f"normalize_total(target_sum={args.target_sum})")

        if not args.skip_log1p:
            sc.pp.log1p(working)
            operations.append("log1p")
            # Preserve a marker-analysis-friendly matrix before HVG subsetting and scaling.
            working.raw = working.copy()

        if not args.skip_hvg:
            hvg_kwargs = {"flavor": args.hvg_flavor, "n_top_genes": args.n_top_genes}
            if args.batch_key:
                hvg_kwargs["batch_key"] = args.batch_key
            sc.pp.highly_variable_genes(working, **hvg_kwargs)
            if "highly_variable" in working.var.columns:
                working = working[:, working.var["highly_variable"]].copy()
            operations.append(f"highly_variable_genes(flavor={args.hvg_flavor}, n_top_genes={args.n_top_genes})")

        if args.run_scale and not args.skip_scale:
            sc.pp.scale(working, max_value=args.scale_max_value)
            operations.append(f"scale(max_value={args.scale_max_value})")

        if not args.skip_pca:
            sc.tl.pca(working, svd_solver="arpack", n_comps=min(args.n_pcs, max(2, working.n_vars - 1)))
            operations.append(f"pca(n_comps<={args.n_pcs})")

    working.write_h5ad(output_dir / "processed.h5ad")
    working.obs.to_csv(tables_dir / "qc_metrics_obs.csv")
    working.var.to_csv(tables_dir / "qc_metrics_var.csv")
    if "highly_variable" in working.var.columns:
        working.var.loc[working.var["highly_variable"]].to_csv(tables_dir / "highly_variable_genes.csv")

    figure_files = write_qc_figures(working, figures_dir)
    write_report(output_dir / "report.md", state, args, operations)

    result = {
        "skill": "singlecell/scrna/sc-preprocess-qc",
        "input": str(input_path),
        "output": str(output_dir),
        "matrix_state": asdict(state),
        "mode": args.mode,
        "operations": operations,
        "generated_figures": figure_files,
        "generated_tables": [
            "tables/qc_metrics_obs.csv",
            "tables/qc_metrics_var.csv",
            *(
                ["tables/highly_variable_genes.csv"]
                if (tables_dir / "highly_variable_genes.csv").exists()
                else []
            ),
        ],
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
