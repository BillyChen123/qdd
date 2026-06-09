#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict, dataclass
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
    sparsity: float


@dataclass
class CoordinateState:
    source: str | None
    x_key: str | None
    y_key: str | None
    n_complete: int
    x_min: float | None
    x_max: float | None
    y_min: float | None
    y_max: float | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Conservative preprocessing and audit skill for spatial AnnData h5ad files.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--threads", type=int, default=BOOTSTRAP_THREADS, help="CPU thread count for BLAS/OpenMP/Numba-backed steps.")
    parser.add_argument("--mode", choices=["inspect", "auto", "force"], default="auto")
    parser.add_argument("--counts-layer", default="auto", help="Which matrix to treat as counts: auto | X | <layer>.")
    parser.add_argument("--assay", choices=["auto", "targeted", "genome-wide", "feature-activity"], default="auto")
    parser.add_argument("--sample-key", default=None)
    parser.add_argument("--section-key", default=None)
    parser.add_argument("--time-key", default=None)
    parser.add_argument("--condition-key", default=None)
    parser.add_argument("--batch-key", default=None)
    parser.add_argument("--spatial-obsm-key", default="auto", help="Coordinate obsm key, or auto.")
    parser.add_argument("--x-key", default=None, help="obs column for x coordinate.")
    parser.add_argument("--y-key", default=None, help="obs column for y coordinate.")
    parser.add_argument("--target-sum", type=float, default=1e4)
    parser.add_argument("--run-hvg", action="store_true")
    parser.add_argument("--hvg-flavor", choices=["seurat", "seurat_v3", "cell_ranger"], default="seurat")
    parser.add_argument("--n-top-genes", type=int, default=2000)
    parser.add_argument("--run-pca", action="store_true")
    parser.add_argument("--n-pcs", type=int, default=50)
    parser.add_argument("--skip-normalize", action="store_true")
    parser.add_argument("--skip-log1p", action="store_true")
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


def matrix_values_preview(matrix: Any, limit: int = 50000) -> np.ndarray:
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


def matrix_sparsity(matrix: Any, n_obs: int, n_vars: int) -> float:
    denom = max(1, n_obs * n_vars)
    if sparse.issparse(matrix):
        nnz = matrix.nnz
    else:
        nnz = int(np.count_nonzero(np.asarray(matrix)))
    return float(1.0 - (nnz / denom))


def infer_counts_state(matrix: Any, source: str, n_obs: int, n_vars: int) -> MatrixState:
    values = matrix_values_preview(matrix)
    sparsity = matrix_sparsity(matrix, n_obs, n_vars)
    if values.size == 0:
        return MatrixState(source, False, 0.0, 0.0, 0.0, 0.0, n_obs, n_vars, sparsity)
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return MatrixState(source, False, 0.0, float("nan"), float("nan"), float("nan"), n_obs, n_vars, sparsity)
    rounded = np.round(finite)
    integer_fraction = float(np.mean(np.isclose(finite, rounded, atol=1e-8)))
    min_value = float(np.min(finite))
    max_value = float(np.max(finite))
    mean_value = float(np.mean(finite))
    looks_like_counts = min_value >= 0 and integer_fraction >= 0.95 and max_value >= 2
    return MatrixState(source, looks_like_counts, integer_fraction, min_value, max_value, mean_value, n_obs, n_vars, sparsity)


def resolve_matrix(adata: sc.AnnData, counts_layer: str) -> tuple[str, Any, list[MatrixState]]:
    candidates: list[tuple[str, Any]] = [("X", adata.X)]
    for layer_name in ["counts", "raw_counts"]:
        if layer_name in adata.layers:
            candidates.append((layer_name, adata.layers[layer_name]))
    for layer_name, layer_value in adata.layers.items():
        if layer_name not in {"counts", "raw_counts"}:
            candidates.append((layer_name, layer_value))

    states = [infer_counts_state(matrix, source, adata.n_obs, adata.n_vars) for source, matrix in candidates]

    if counts_layer == "X":
        return "X", adata.X, states
    if counts_layer != "auto":
        if counts_layer not in adata.layers:
            raise ValueError(f"counts layer '{counts_layer}' not found in adata.layers")
        return counts_layer, adata.layers[counts_layer], states

    for state, (_, matrix) in zip(states, candidates):
        if state.looks_like_counts:
            return state.source, matrix, states
    return "X", adata.X, states


def resolve_percent_top(n_vars: int) -> list[int] | None:
    candidates = [50, 100, 200, 500]
    valid = [value for value in candidates if value < n_vars]
    return valid or None


def pca_components(n_obs: int, n_vars: int, requested: int) -> int:
    upper = min(n_obs, n_vars) - 1
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


def infer_assay(adata: sc.AnnData, requested: str) -> str:
    if requested != "auto":
        return requested
    n_vars = adata.n_vars
    var_names = pd.Index(adata.var_names.astype(str))
    peak_like = var_names.str.contains(r"chr[\w]*[:_-]\d+", regex=True).mean() if len(var_names) else 0
    if peak_like >= 0.25:
        return "feature-activity"
    if n_vars <= 1000:
        return "targeted"
    return "genome-wide"


def find_metadata_candidates(adata: sc.AnnData) -> dict[str, list[str]]:
    patterns = {
        "sample": ["sample", "donor", "patient", "replicate", "library"],
        "section": ["section", "slice", "fov", "field", "slide"],
        "time": ["time", "timepoint", "hour", "day", "week"],
        "condition": ["condition", "treatment", "group", "sex", "disease"],
        "batch": ["batch", "run", "lane"],
        "annotation": ["cell_type", "celltype", "annotation", "cluster", "leiden", "niche"],
    }
    columns = [str(column) for column in adata.obs.columns]
    lower = {column: column.lower() for column in columns}
    result: dict[str, list[str]] = {}
    for role, tokens in patterns.items():
        matches = [column for column in columns if any(token in lower[column] for token in tokens)]
        result[role] = matches
    return result


def summarize_obs_column(adata: sc.AnnData, key: str | None, role: str) -> dict[str, Any] | None:
    if not key:
        return None
    if key not in adata.obs.columns:
        raise ValueError(f"{role} key '{key}' not found in adata.obs")
    series = adata.obs[key]
    counts = series.astype("string").value_counts(dropna=False).head(20)
    return {
        "role": role,
        "key": key,
        "n_unique": int(series.nunique(dropna=True)),
        "n_missing": int(series.isna().sum()),
        "top_values": {str(index): int(value) for index, value in counts.items()},
    }


def coordinate_from_obsm(adata: sc.AnnData, key: str) -> tuple[pd.Series, pd.Series] | None:
    if key not in adata.obsm:
        return None
    coords = np.asarray(adata.obsm[key])
    if coords.ndim != 2 or coords.shape[1] < 2:
        return None
    x = pd.Series(coords[:, 0], index=adata.obs_names, name=f"{key}_1")
    y = pd.Series(coords[:, 1], index=adata.obs_names, name=f"{key}_2")
    return x, y


def find_coordinates(adata: sc.AnnData, args: argparse.Namespace) -> tuple[CoordinateState, pd.DataFrame | None]:
    if args.x_key or args.y_key:
        if not (args.x_key and args.y_key):
            raise ValueError("--x-key and --y-key must be provided together")
        if args.x_key not in adata.obs.columns or args.y_key not in adata.obs.columns:
            raise ValueError("requested coordinate columns were not found in adata.obs")
        coords = pd.DataFrame({"x": adata.obs[args.x_key], "y": adata.obs[args.y_key]}, index=adata.obs_names)
        return summarize_coordinates("obs", args.x_key, args.y_key, coords), coords

    obsm_keys = list(adata.obsm.keys())
    if args.spatial_obsm_key != "auto":
        found = coordinate_from_obsm(adata, args.spatial_obsm_key)
        if found is None:
            raise ValueError(f"spatial obsm key '{args.spatial_obsm_key}' was not found or is not 2D")
        x, y = found
        coords = pd.DataFrame({"x": x, "y": y}, index=adata.obs_names)
        return summarize_coordinates(f"obsm:{args.spatial_obsm_key}", x.name, y.name, coords), coords

    preferred = ["spatial", "X_spatial", "coords", "coordinates", "X_xy"]
    for key in preferred + [key for key in obsm_keys if key not in preferred]:
        found = coordinate_from_obsm(adata, key)
        if found is not None:
            x, y = found
            coords = pd.DataFrame({"x": x, "y": y}, index=adata.obs_names)
            return summarize_coordinates(f"obsm:{key}", x.name, y.name, coords), coords

    column_pairs = [
        ("x", "y"),
        ("X", "Y"),
        ("spatial_x", "spatial_y"),
        ("array_col", "array_row"),
        ("pxl_col_in_fullres", "pxl_row_in_fullres"),
        ("x_centroid", "y_centroid"),
        ("center_x", "center_y"),
        ("centroid_x", "centroid_y"),
    ]
    for x_key, y_key in column_pairs:
        if x_key in adata.obs.columns and y_key in adata.obs.columns:
            coords = pd.DataFrame({"x": adata.obs[x_key], "y": adata.obs[y_key]}, index=adata.obs_names)
            return summarize_coordinates("obs", x_key, y_key, coords), coords

    return CoordinateState(None, None, None, 0, None, None, None, None), None


def summarize_coordinates(source: str, x_key: str | None, y_key: str | None, coords: pd.DataFrame) -> CoordinateState:
    numeric = coords.apply(pd.to_numeric, errors="coerce")
    complete = numeric.dropna()
    if complete.empty:
        return CoordinateState(source, x_key, y_key, 0, None, None, None, None)
    return CoordinateState(
        source=source,
        x_key=x_key,
        y_key=y_key,
        n_complete=int(complete.shape[0]),
        x_min=float(complete["x"].min()),
        x_max=float(complete["x"].max()),
        y_min=float(complete["y"].min()),
        y_max=float(complete["y"].max()),
    )


def write_qc_figures(adata: sc.AnnData, figure_dir: Path) -> list[str]:
    generated: list[str] = []
    obs = adata.obs.copy()
    if "total_counts" in obs.columns and "n_genes_by_counts" in obs.columns:
        fig, axes = plt.subplots(1, 2, figsize=(10, 4))
        axes[0].hist(obs["total_counts"].to_numpy(), bins=50, color="#4C78A8")
        axes[0].set_title("Total Counts")
        axes[1].hist(obs["n_genes_by_counts"].to_numpy(), bins=50, color="#F58518")
        axes[1].set_title("Genes per Observation")
        fig.tight_layout()
        path = figure_dir / "qc_histograms.png"
        fig.savefig(path, dpi=160)
        plt.close(fig)
        generated.append(path.name)
    return generated


def write_spatial_figure(coords: pd.DataFrame | None, figure_dir: Path, color: pd.Series | None = None) -> list[str]:
    if coords is None:
        return []
    numeric = coords.apply(pd.to_numeric, errors="coerce").dropna()
    if numeric.empty:
        return []
    if numeric.shape[0] > 25000:
        numeric = numeric.sample(n=25000, random_state=1)
    fig, ax = plt.subplots(figsize=(6, 5))
    if color is not None:
        color = color.reindex(numeric.index)
        categories = color.astype("category")
        if len(categories.cat.categories) <= 20:
            for category in categories.cat.categories:
                mask = categories == category
                ax.scatter(numeric.loc[mask, "x"], numeric.loc[mask, "y"], s=3, alpha=0.7, label=str(category))
            ax.legend(markerscale=3, fontsize=7, frameon=False)
        else:
            ax.scatter(numeric["x"], numeric["y"], s=3, alpha=0.6, color="#4C78A8")
    else:
        ax.scatter(numeric["x"], numeric["y"], s=3, alpha=0.6, color="#4C78A8")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title("Spatial coordinate overview")
    ax.set_aspect("equal", adjustable="box")
    fig.tight_layout()
    path = figure_dir / "spatial_overview.png"
    fig.savefig(path, dpi=160)
    plt.close(fig)
    return [path.name]


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


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    selected_state: MatrixState,
    coordinate_state: CoordinateState,
    assay: str,
    metadata_summary: pd.DataFrame,
    operations: list[str],
    metadata_candidates: dict[str, list[str]],
    provenance: dict[str, object],
) -> None:
    lines = [
        "# spatial-preprocess-qc report",
        "",
        "## Matrix State",
        "",
        f"- source: `{selected_state.source}`",
        f"- looks_like_counts: `{selected_state.looks_like_counts}`",
        f"- integer_fraction: `{selected_state.integer_fraction:.4f}`",
        f"- min_value: `{selected_state.min_value:.4f}`",
        f"- max_value: `{selected_state.max_value:.4f}`",
        f"- mean_value: `{selected_state.mean_value:.4f}`",
        f"- sparsity: `{selected_state.sparsity:.4f}`",
        "",
        "## Spatial State",
        "",
        f"- assay: `{assay}`",
        f"- coordinate_source: `{coordinate_state.source}`",
        f"- coordinate_complete_observations: `{coordinate_state.n_complete}`",
        "",
        "## Runtime Provenance",
        "",
        "```json",
        json.dumps(provenance, indent=2, ensure_ascii=False),
        "```",
        "",
        "## Metadata Candidates",
        "",
        "```json",
        json.dumps(metadata_candidates, indent=2, ensure_ascii=False),
        "```",
        "",
        "## User-Selected Metadata",
        "",
        dataframe_to_markdown(metadata_summary),
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
    args.threads = configure_threads(args.threads)
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    tables_dir = output_dir / "tables"
    figures_dir = output_dir / "figures"
    ensure_dir(output_dir)
    ensure_dir(tables_dir)
    ensure_dir(figures_dir)

    adata = sc.read_h5ad(input_path)
    matrix_source, matrix, matrix_states = resolve_matrix(adata, args.counts_layer)
    selected_state = infer_counts_state(matrix, matrix_source, adata.n_obs, adata.n_vars)
    coordinate_state, coords = find_coordinates(adata, args)
    assay = infer_assay(adata, args.assay)
    metadata_candidates = find_metadata_candidates(adata)

    selected_metadata = [
        summarize_obs_column(adata, args.sample_key, "sample"),
        summarize_obs_column(adata, args.section_key, "section"),
        summarize_obs_column(adata, args.time_key, "time"),
        summarize_obs_column(adata, args.condition_key, "condition"),
        summarize_obs_column(adata, args.batch_key, "batch"),
    ]
    metadata_rows = [row for row in selected_metadata if row is not None]
    metadata_summary = pd.DataFrame(metadata_rows)

    working = adata.copy()
    if matrix_source != "X":
        working.X = working.layers[matrix_source].copy()

    if "mt" not in working.var.columns:
        working.var["mt"] = working.var_names.astype(str).str.upper().str.startswith("MT-")

    sc.pp.calculate_qc_metrics(
        working,
        qc_vars=["mt"],
        percent_top=resolve_percent_top(working.n_vars),
        inplace=True,
    )

    operations: list[str] = []
    should_preprocess = args.mode == "force" or (args.mode == "auto" and selected_state.looks_like_counts)
    if args.mode == "inspect":
        should_preprocess = False

    if should_preprocess:
        if not args.skip_normalize:
            sc.pp.normalize_total(working, target_sum=args.target_sum)
            operations.append(f"normalize_total(target_sum={args.target_sum})")
        if not args.skip_log1p:
            sc.pp.log1p(working)
            operations.append("log1p")
        if args.run_hvg:
            hvg_kwargs = {"flavor": args.hvg_flavor, "n_top_genes": min(args.n_top_genes, working.n_vars)}
            if args.batch_key:
                hvg_kwargs["batch_key"] = args.batch_key
            sc.pp.highly_variable_genes(working, **hvg_kwargs)
            operations.append(f"highly_variable_genes(flavor={args.hvg_flavor}, n_top_genes<={args.n_top_genes})")
        pca_space = "not_run"
        if args.run_pca:
            feature_space, n_features = pca_feature_space(working)
            pca_kwargs: dict[str, object] = {
                "svd_solver": "arpack",
                "n_comps": pca_components(working.n_obs, n_features or working.n_vars, args.n_pcs),
            }
            if feature_space == "highly_variable":
                pca_kwargs["mask_var"] = "highly_variable"
            sc.tl.pca(working, **pca_kwargs)
            pca_space = feature_space
            operations.append(f"pca(n_comps={pca_kwargs['n_comps']}, feature_space={feature_space})")
    else:
        pca_space = "not_run"

    working.raw = None
    working.write_h5ad(output_dir / "processed.h5ad")
    working.obs.to_csv(tables_dir / "qc_metrics_obs.csv")
    working.var.to_csv(tables_dir / "qc_metrics_var.csv")
    pd.DataFrame([asdict(state) for state in matrix_states]).to_csv(tables_dir / "matrix_state.csv", index=False)
    pd.DataFrame([asdict(coordinate_state)]).to_csv(tables_dir / "coordinate_summary.csv", index=False)
    metadata_summary.to_csv(tables_dir / "metadata_summary.csv", index=False)

    figure_files = []
    figure_files.extend(write_qc_figures(working, figures_dir))
    color = working.obs[args.sample_key] if args.sample_key and args.sample_key in working.obs.columns else None
    figure_files.extend(write_spatial_figure(coords, figures_dir, color=color))

    provenance = {
        "threads": args.threads,
        "pca_feature_space": pca_space,
        "raw_retained": False,
    }
    write_report(
        output_dir / "report.md",
        args,
        selected_state,
        coordinate_state,
        assay,
        metadata_summary,
        operations,
        metadata_candidates,
        provenance,
    )

    result = {
        "skill": "spatial/spatial-preprocess-qc",
        "input": str(input_path),
        "output": str(output_dir),
        "mode": args.mode,
        "assay": assay,
        "matrix_state": asdict(selected_state),
        "coordinate_state": asdict(coordinate_state),
        "provenance": provenance,
        "metadata_candidates": metadata_candidates,
        "selected_metadata": metadata_rows,
        "operations": operations,
        "generated_figures": sorted(figure_files),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
