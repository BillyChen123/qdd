#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
import warnings

from anndata import AnnData
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc
from scipy import sparse


SKILL_NAME = "singlecell/scrna/sc-differential-expression"
GROUP_COLUMN = "_qdd_de_group"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Differential expression testing for scRNA AnnData.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--method", choices=["cell-level", "pseudobulk"], default="cell-level")
    parser.add_argument("--group-key", required=True)
    parser.add_argument("--group-a", required=True)
    parser.add_argument("--group-b", required=True)
    parser.add_argument("--sample-key", default=None)
    parser.add_argument("--features", default=None)
    parser.add_argument("--feature-file", default=None)
    parser.add_argument("--subset-key", default=None)
    parser.add_argument("--subset-values", default=None)
    parser.add_argument("--test", choices=["wilcoxon"], default="wilcoxon")
    parser.add_argument("--p-threshold", type=float, default=0.05)
    parser.add_argument("--min-pct", type=float, default=0.0)
    parser.add_argument("--pseudocount", type=float, default=1e-9)
    parser.add_argument("--pseudobulk-agg", choices=["sum", "mean"], default="sum")
    parser.add_argument("--pseudobulk-normalize", choices=["log1p-cpm", "log1p", "none"], default="log1p-cpm")
    parser.add_argument("--pseudobulk-backend", choices=["auto", "export-only", "pydeseq2"], default="auto")
    parser.add_argument("--use-raw", action="store_true")
    parser.add_argument("--layer", default=None)
    parser.add_argument("--case-insensitive", action="store_true")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def validate_args(args: argparse.Namespace) -> None:
    if args.layer and args.use_raw:
        raise ValueError("--layer and --use-raw are mutually exclusive")
    if args.method == "pseudobulk" and args.pseudobulk_agg != "sum":
        raise ValueError("pseudobulk DE currently requires --pseudobulk-agg sum")


def materialize_expression_adata(adata: AnnData, args: argparse.Namespace) -> tuple[AnnData, str]:
    if args.layer:
        if args.layer not in adata.layers:
            raise ValueError(f"layer '{args.layer}' not found")
        return AnnData(X=adata.layers[args.layer], obs=adata.obs.copy(), var=adata.var.copy()), f"layer:{args.layer}"
    if args.use_raw:
        if adata.raw is None:
            raise ValueError("--use-raw was set but adata.raw is empty")
        raw = adata.raw.to_adata()
        raw.obs = adata.obs.copy()
        return raw, "raw"
    return AnnData(X=adata.X, obs=adata.obs.copy(), var=adata.var.copy()), "X"


def read_feature_file(path: Path) -> list[str]:
    if path.suffix.lower() in {".csv", ".tsv"}:
        sep = "\t" if path.suffix.lower() == ".tsv" else ","
        frame = pd.read_csv(path, sep=sep)
        column = "feature" if "feature" in frame.columns else frame.columns[0]
        return [str(value).strip() for value in frame[column].tolist() if str(value).strip()]
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def resolve_requested_features(args: argparse.Namespace, var_names: pd.Index) -> list[str]:
    if not args.features and not args.feature_file:
        return [str(name) for name in var_names]

    mapping: dict[str, str] = {}
    collisions: set[str] = set()
    for name in var_names.astype(str):
        key = name.upper() if args.case_insensitive else name
        if key in mapping and mapping[key] != name:
            collisions.add(key)
        mapping[key] = name
    if collisions:
        raise ValueError(
            "case-insensitive feature resolution is ambiguous for: "
            + ", ".join(sorted(collisions)[:10])
        )

    requested: list[str] = []
    if args.features:
        requested.extend([item.strip() for item in args.features.split(",") if item.strip()])
    if args.feature_file:
        requested.extend(read_feature_file(Path(args.feature_file).resolve()))

    resolved: list[str] = []
    missing: list[str] = []
    for feature in requested:
        key = feature.upper() if args.case_insensitive else feature
        actual = mapping.get(key)
        if actual is None:
            missing.append(feature)
        else:
            resolved.append(actual)
    if missing:
        raise ValueError(f"features not found: {', '.join(missing[:10])}")
    return list(dict.fromkeys(resolved))


def build_base_mask(adata: AnnData, args: argparse.Namespace) -> pd.Series:
    if args.group_key not in adata.obs.columns:
        raise ValueError(f"group key '{args.group_key}' not found in adata.obs")
    mask = pd.Series(True, index=adata.obs_names)
    if args.subset_key:
        if args.subset_key not in adata.obs.columns:
            raise ValueError(f"subset key '{args.subset_key}' not found in adata.obs")
        if not args.subset_values:
            raise ValueError("--subset-values is required when --subset-key is set")
        allowed = {value.strip() for value in args.subset_values.split(",") if value.strip()}
        mask &= adata.obs[args.subset_key].astype(str).isin(allowed)
    return mask


def subset_for_contrast(adata: AnnData, args: argparse.Namespace, features: list[str]) -> AnnData:
    base_mask = build_base_mask(adata, args)
    group_values = adata.obs[args.group_key].astype(str)
    selected_obs = base_mask & group_values.isin({str(args.group_a), str(args.group_b)})
    n_selected = int(selected_obs.sum())
    if n_selected == 0:
        raise ValueError("no observations remained after applying group/subset filters")

    n_a = int((selected_obs & (group_values == str(args.group_a))).sum())
    n_b = int((selected_obs & (group_values == str(args.group_b))).sum())
    if n_a == 0 or n_b == 0:
        raise ValueError("both comparison groups must have at least one observation after filtering")

    subset = adata[selected_obs.to_numpy(), features].copy()
    subset.obs[GROUP_COLUMN] = subset.obs[args.group_key].astype(str)
    return subset


def mean_and_pct(matrix: Any, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    sub = matrix[mask, :]
    if sparse.issparse(sub):
        mean = np.asarray(sub.mean(axis=0)).ravel().astype(float)
        pct = np.asarray((sub > 0).mean(axis=0)).ravel().astype(float)
    else:
        arr = np.asarray(sub, dtype=float)
        mean = np.mean(arr, axis=0)
        pct = np.mean(arr > 0, axis=0)
    return mean, pct


def cell_level_de(adata: AnnData, args: argparse.Namespace, matrix_source: str) -> tuple[pd.DataFrame, dict[str, Any]]:
    features = resolve_requested_features(args, pd.Index(adata.var_names.astype(str)))
    adata_sub = subset_for_contrast(adata, args, features)

    sc.tl.rank_genes_groups(
        adata_sub,
        groupby=GROUP_COLUMN,
        groups=[str(args.group_b)],
        reference=str(args.group_a),
        method="wilcoxon",
        corr_method="benjamini-hochberg",
        pts=True,
        n_genes=adata_sub.n_vars,
    )
    de = sc.get.rank_genes_groups_df(adata_sub, group=str(args.group_b))
    de = de.rename(
        columns={
            "names": "feature",
            "scores": "score",
            "pvals": "pvalue",
            "pvals_adj": "padj_bh",
        }
    )

    group_mask = adata_sub.obs[GROUP_COLUMN].astype(str)
    mask_a = (group_mask == str(args.group_a)).to_numpy()
    mask_b = (group_mask == str(args.group_b)).to_numpy()
    mean_a, pct_a = mean_and_pct(adata_sub.X, mask_a)
    mean_b, pct_b = mean_and_pct(adata_sub.X, mask_b)
    stats_frame = pd.DataFrame(
        {
            "feature": adata_sub.var_names.astype(str),
            "mean_a": mean_a,
            "mean_b": mean_b,
            "pct_a": pct_a,
            "pct_b": pct_b,
        }
    )
    de = de.merge(stats_frame, on="feature", how="left")
    if args.min_pct > 0:
        de = de.loc[de[["pct_a", "pct_b"]].max(axis=1) >= args.min_pct].copy()
    de["method"] = "cell-level"
    de["backend"] = "scanpy.rank_genes_groups"
    de["test"] = "scanpy-wilcoxon"
    de["group_a"] = str(args.group_a)
    de["group_b"] = str(args.group_b)
    de["n_a"] = int(mask_a.sum())
    de["n_b"] = int(mask_b.sum())
    de["significant"] = de["padj_bh"] < args.p_threshold
    de["log2fc_group_b_vs_group_a"] = de["logfoldchanges"]
    de = de[
        [
            "feature",
            "method",
            "backend",
            "test",
            "group_a",
            "group_b",
            "n_a",
            "n_b",
            "mean_a",
            "mean_b",
            "pct_a",
            "pct_b",
            "log2fc_group_b_vs_group_a",
            "score",
            "pvalue",
            "padj_bh",
            "significant",
        ]
    ].sort_values(["padj_bh", "pvalue"], na_position="last").reset_index(drop=True)

    summary = {
        "status": "completed",
        "method": args.method,
        "backend": "scanpy.rank_genes_groups",
        "matrix_source": matrix_source,
        "n_features_tested": int(de.shape[0]),
        "n_significant": int(de["significant"].sum()),
        "group_a": str(args.group_a),
        "group_b": str(args.group_b),
        "n_a": int(mask_a.sum()),
        "n_b": int(mask_b.sum()),
    }
    return de, summary


def matrix_to_frame(matrix: Any, index: pd.Index, columns: pd.Index) -> pd.DataFrame:
    values = matrix.toarray() if sparse.issparse(matrix) else np.asarray(matrix)
    return pd.DataFrame(values, index=index.astype(str), columns=columns.astype(str))


def write_empty_de_table(path: Path) -> None:
    pd.DataFrame(
        columns=[
            "feature",
            "method",
            "backend",
            "test",
            "group_a",
            "group_b",
            "pvalue",
            "padj_bh",
            "significant",
        ]
    ).to_csv(path, index=False)


def build_pseudobulk_tables(adata: AnnData, args: argparse.Namespace) -> tuple[pd.DataFrame, pd.DataFrame]:
    if not args.sample_key:
        raise ValueError("--sample-key is required for pseudobulk")
    if args.sample_key not in adata.obs.columns:
        raise ValueError(f"sample key '{args.sample_key}' not found in adata.obs")

    features = resolve_requested_features(args, pd.Index(adata.var_names.astype(str)))
    adata_sub = subset_for_contrast(adata, args, features)

    agg = sc.get.aggregate(adata_sub, by=[args.sample_key, GROUP_COLUMN], func=args.pseudobulk_agg)
    layer_name = args.pseudobulk_agg
    matrix = agg.layers[layer_name]
    pb_frame = matrix_to_frame(matrix, agg.obs_names, agg.var_names)
    pb_frame.index.name = "pseudobulk_id"
    obs = adata_sub.obs[[args.sample_key, GROUP_COLUMN]].copy()
    if sparse.issparse(adata_sub.X):
        library_size = np.asarray(adata_sub.X.sum(axis=1)).ravel().astype(float)
    else:
        library_size = np.asarray(adata_sub.X, dtype=float).sum(axis=1)
    obs["_library_size"] = library_size
    grouped = obs.groupby([args.sample_key, GROUP_COLUMN], dropna=False, observed=False)
    design = (
        grouped.size().rename("n_obs").to_frame()
        .join(grouped["_library_size"].sum().rename("library_size"))
        .reset_index()
        .rename(columns={args.sample_key: "sample", GROUP_COLUMN: "group"})
    )
    design["pseudobulk_id"] = design["sample"].astype(str) + "_" + design["group"].astype(str)
    design = design[["pseudobulk_id", "sample", "group", "n_obs", "library_size"]]
    return pb_frame, design


def normalize_pseudobulk(pb_frame: pd.DataFrame, design: pd.DataFrame, args: argparse.Namespace) -> pd.DataFrame | None:
    if args.pseudobulk_normalize == "none":
        return None
    norm = pb_frame.copy()
    if args.pseudobulk_normalize == "log1p-cpm":
        scale = design.set_index("pseudobulk_id")["library_size"].reindex(norm.index).clip(lower=args.pseudocount)
        norm = np.log1p(norm.div(scale, axis=0) * 1e6)
    else:
        norm = np.log1p(norm)
    norm.index.name = "pseudobulk_id"
    return norm


def choose_pseudobulk_backend(args: argparse.Namespace) -> str:
    if args.pseudobulk_backend == "export-only":
        return "export-only"
    try:
        from pydeseq2.dds import DeseqDataSet  # noqa: F401
        from pydeseq2.ds import DeseqStats  # noqa: F401
    except ModuleNotFoundError:
        return "export-only"
    return "pydeseq2"


def is_count_like(frame: pd.DataFrame) -> bool:
    values = frame.to_numpy(dtype=float, copy=False)
    if values.size == 0:
        return False
    if np.isnan(values).any() or np.isinf(values).any():
        return False
    if (values < 0).any():
        return False
    return np.allclose(values, np.rint(values), atol=1e-6)


def export_only_summary(
    args: argparse.Namespace,
    matrix_source: str,
    pb_frame: pd.DataFrame,
    reason: str,
    backend_used: str = "export-only",
) -> dict[str, Any]:
    return {
        "status": "export-only",
        "method": args.method,
        "backend": backend_used,
        "matrix_source": matrix_source,
        "pseudobulk_backend_requested": args.pseudobulk_backend,
        "reason": reason,
        "group_a": str(args.group_a),
        "group_b": str(args.group_b),
        "n_pseudobulk_samples": int(pb_frame.shape[0]),
        "n_features_exported": int(pb_frame.shape[1]),
    }


def run_pydeseq2(
    pb_frame: pd.DataFrame,
    design: pd.DataFrame,
    args: argparse.Namespace,
    matrix_source: str,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    from pydeseq2.dds import DeseqDataSet
    from pydeseq2.ds import DeseqStats

    group_counts = design["group"].astype(str).value_counts()
    n_a = int(group_counts.get(str(args.group_a), 0))
    n_b = int(group_counts.get(str(args.group_b), 0))
    if n_a < 2 or n_b < 2:
        return pd.DataFrame(), export_only_summary(
            args,
            matrix_source,
            pb_frame,
            "PyDESeq2 requires at least two pseudobulk samples per group for a defensible contrast.",
            backend_used="pydeseq2-unavailable-for-contrast",
        )
    if not is_count_like(pb_frame):
        return pd.DataFrame(), export_only_summary(
            args,
            matrix_source,
            pb_frame,
            "The selected matrix does not look like raw non-negative counts after pseudobulk aggregation. Use raw counts, --use-raw, or a count layer for PyDESeq2.",
            backend_used="pydeseq2-count-check-failed",
        )

    counts = pb_frame.round().astype(int)
    keep = counts.sum(axis=0) > 0
    counts = counts.loc[:, keep]
    if counts.shape[1] == 0:
        return pd.DataFrame(), export_only_summary(
            args,
            matrix_source,
            pb_frame,
            "All selected features had zero aggregated counts across pseudobulk samples.",
            backend_used="pydeseq2-all-zero",
        )

    metadata = design[["pseudobulk_id", "group"]].copy()
    metadata["condition"] = metadata["group"].astype(str)
    metadata = metadata.set_index("pseudobulk_id")[["condition"]]
    counts = counts.reindex(metadata.index)

    caught_messages: list[str] = []
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        dds = DeseqDataSet(
            counts=counts,
            metadata=metadata,
            design_factors="condition",
            ref_level=["condition", str(args.group_a)],
            quiet=True,
        )
        dds.deseq2()
        stats_res = DeseqStats(
            dds,
            contrast=["condition", str(args.group_b), str(args.group_a)],
            alpha=args.p_threshold,
            quiet=True,
        )
        stats_res.summary()
        caught_messages = [str(item.message) for item in caught]

    de = stats_res.results_df.reset_index().rename(
        columns={
            "index": "feature",
            "baseMean": "base_mean",
            "log2FoldChange": "log2fc_group_b_vs_group_a",
            "lfcSE": "lfc_se",
            "stat": "statistic",
            "padj": "padj_bh",
        }
    )
    mean_a = counts.loc[metadata["condition"] == str(args.group_a)].mean(axis=0)
    mean_b = counts.loc[metadata["condition"] == str(args.group_b)].mean(axis=0)
    de = de.merge(
        pd.DataFrame(
            {
                "feature": counts.columns.astype(str),
                "mean_a": mean_a.reindex(counts.columns).to_numpy(dtype=float),
                "mean_b": mean_b.reindex(counts.columns).to_numpy(dtype=float),
            }
        ),
        on="feature",
        how="left",
    )
    de["method"] = "pseudobulk"
    de["backend"] = "pydeseq2"
    de["test"] = "deseq2-wald"
    de["group_a"] = str(args.group_a)
    de["group_b"] = str(args.group_b)
    de["n_samples_a"] = n_a
    de["n_samples_b"] = n_b
    de["significant"] = de["padj_bh"] < args.p_threshold
    de = de[
        [
            "feature",
            "method",
            "backend",
            "test",
            "group_a",
            "group_b",
            "n_samples_a",
            "n_samples_b",
            "base_mean",
            "mean_a",
            "mean_b",
            "log2fc_group_b_vs_group_a",
            "lfc_se",
            "statistic",
            "pvalue",
            "padj_bh",
            "significant",
        ]
    ].sort_values(["padj_bh", "pvalue"], na_position="last").reset_index(drop=True)
    summary = {
        "status": "completed",
        "method": args.method,
        "backend": "pydeseq2",
        "matrix_source": matrix_source,
        "group_a": str(args.group_a),
        "group_b": str(args.group_b),
        "n_pseudobulk_samples": int(pb_frame.shape[0]),
        "n_samples_a": n_a,
        "n_samples_b": n_b,
        "n_features_tested": int(de.shape[0]),
        "n_features_all_zero_filtered": int((~keep).sum()),
        "n_significant": int(de["significant"].sum()),
        "warnings": caught_messages[:10],
    }
    return de, summary


def pseudobulk_de(adata: AnnData, args: argparse.Namespace, matrix_source: str, tables_dir: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    pb_frame, design = build_pseudobulk_tables(adata, args)
    pb_frame.to_csv(tables_dir / "pseudobulk_counts.csv")
    design.to_csv(tables_dir / "pseudobulk_design.csv", index=False)

    norm = normalize_pseudobulk(pb_frame, design, args)
    if norm is not None:
        norm.to_csv(tables_dir / "pseudobulk_normalized.csv")

    backend = choose_pseudobulk_backend(args)
    if backend == "pydeseq2":
        de, summary = run_pydeseq2(pb_frame, design, args, matrix_source)
        if summary["status"] == "completed":
            de.to_csv(tables_dir / "de_results.csv", index=False)
            return de, summary

    write_empty_de_table(tables_dir / "de_results.csv")
    return pd.DataFrame(), export_only_summary(
        args,
        matrix_source,
        pb_frame,
        "No verified Python pseudobulk DE backend is available for this contrast. Exported pseudobulk matrices for downstream analysis.",
        backend_used=backend,
    )


def plot_volcano(frame: pd.DataFrame, output_path: Path) -> bool:
    if frame.empty or "log2fc_group_b_vs_group_a" not in frame.columns or "padj_bh" not in frame.columns:
        return False
    plot_df = frame.replace([np.inf, -np.inf], np.nan).dropna(subset=["log2fc_group_b_vs_group_a", "padj_bh"])
    if plot_df.empty:
        return False
    y = -np.log10(np.clip(plot_df["padj_bh"].to_numpy(dtype=float), 1e-300, 1))
    x = plot_df["log2fc_group_b_vs_group_a"].to_numpy(dtype=float)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.scatter(x, y, s=6, alpha=0.5)
    ax.set_xlabel("log2FC group_b vs group_a")
    ax.set_ylabel("-log10 BH-adjusted p")
    ax.set_title("Differential expression")
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


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


def write_report(report_path: Path, args: argparse.Namespace, matrix_source: str, de: pd.DataFrame, summary: dict[str, Any]) -> None:
    lines = [
        "# sc-differential-expression report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Matrix Source",
        "",
        f"- `{matrix_source}`",
        "",
        "## Summary",
        "",
        "```json",
        json.dumps(summary, indent=2, ensure_ascii=False),
        "```",
        "",
        "## Top Results",
        "",
        dataframe_to_markdown(de),
        "",
    ]
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    validate_args(args)
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    tables_dir = output_dir / "tables"
    figures_dir = output_dir / "figures"
    ensure_dir(output_dir)
    ensure_dir(tables_dir)
    ensure_dir(figures_dir)

    adata = sc.read_h5ad(input_path)
    expr_adata, matrix_source = materialize_expression_adata(adata, args)

    generated_figures: list[str] = []
    if args.method == "cell-level":
        de, summary = cell_level_de(expr_adata, args, matrix_source)
        de.to_csv(tables_dir / "de_results.csv", index=False)
        if plot_volcano(de, figures_dir / "volcano.png"):
            generated_figures.append("volcano.png")
    else:
        de, summary = pseudobulk_de(expr_adata, args, matrix_source, tables_dir)
        if summary["status"] == "completed" and plot_volcano(de, figures_dir / "volcano.png"):
            generated_figures.append("volcano.png")

    write_report(output_dir / "report.md", args, matrix_source, de, summary)
    result = {
        "skill": SKILL_NAME,
        "input": str(input_path),
        "output": str(output_dir),
        "matrix_source": matrix_source,
        "summary": summary,
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
