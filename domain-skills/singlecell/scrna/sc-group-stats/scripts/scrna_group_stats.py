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
from scipy import sparse, stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generic downstream descriptive grouped statistics for scRNA AnnData.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--analysis", choices=["detection-rate", "fold-change", "correlation", "two-group-test", "abundance"], required=True)
    parser.add_argument("--features", default=None, help="Comma-separated feature list.")
    parser.add_argument("--feature-file", default=None, help="Text/CSV file containing feature names.")
    parser.add_argument("--feature-a", default=None)
    parser.add_argument("--feature-b", default=None)
    parser.add_argument("--group-key", default=None)
    parser.add_argument("--group-a", default=None)
    parser.add_argument("--group-b", default=None)
    parser.add_argument("--label-key", default=None)
    parser.add_argument("--subset-key", default=None)
    parser.add_argument("--subset-values", default=None, help="Comma-separated values used to subset --subset-key.")
    parser.add_argument("--test", choices=["t-test", "mannwhitney"], default="t-test")
    parser.add_argument("--correlation-method", choices=["spearman", "pearson"], default="spearman")
    parser.add_argument("--p-threshold", type=float, default=0.05)
    parser.add_argument("--count-threshold", type=float, default=0.0)
    parser.add_argument("--pseudocount", type=float, default=1e-9)
    parser.add_argument("--use-raw", action="store_true")
    parser.add_argument("--layer", default=None)
    parser.add_argument("--case-insensitive", action="store_true")
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


def resolve_expression_matrix(adata: sc.AnnData, args: argparse.Namespace) -> tuple[Any, pd.Index, str]:
    if args.layer:
        if args.layer not in adata.layers:
            raise ValueError(f"layer '{args.layer}' not found")
        return adata.layers[args.layer], pd.Index(adata.var_names.astype(str)), f"layer:{args.layer}"
    if args.use_raw and adata.raw is not None:
        return adata.raw.X, pd.Index(adata.raw.var_names.astype(str)), "raw"
    return adata.X, pd.Index(adata.var_names.astype(str)), "X"


def read_feature_file(path: Path) -> list[str]:
    if path.suffix.lower() in {".csv", ".tsv"}:
        sep = "\t" if path.suffix.lower() == ".tsv" else ","
        frame = pd.read_csv(path, sep=sep)
        if "feature" in frame.columns:
            return [str(value).strip() for value in frame["feature"].tolist() if str(value).strip()]
        return [str(value).strip() for value in frame.iloc[:, 0].tolist() if str(value).strip()]
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def resolve_features(args: argparse.Namespace, var_names: pd.Index) -> list[str]:
    features: list[str] = []
    if args.features:
        features.extend([item.strip() for item in args.features.split(",") if item.strip()])
    if args.feature_file:
        features.extend(read_feature_file(Path(args.feature_file).resolve()))
    if args.analysis == "correlation":
        if not args.feature_a or not args.feature_b:
            raise ValueError("--feature-a and --feature-b are required for correlation")
        features.extend([args.feature_a, args.feature_b])
    if not features and args.analysis in {"detection-rate", "two-group-test"}:
        features = [str(name) for name in var_names]
    if not features and args.analysis == "fold-change":
        raise ValueError("--features or --feature-file is required for fold-change")
    return list(dict.fromkeys(features))


def feature_lookup(var_names: pd.Index, case_insensitive: bool) -> dict[str, int]:
    if case_insensitive:
        return {str(name).upper(): idx for idx, name in enumerate(var_names)}
    return {str(name): idx for idx, name in enumerate(var_names)}


def get_feature_vector(matrix: Any, lookup: dict[str, int], feature: str, case_insensitive: bool) -> np.ndarray:
    key = feature.upper() if case_insensitive else feature
    if key not in lookup:
        raise ValueError(f"feature '{feature}' not found")
    column = matrix[:, lookup[key]]
    if sparse.issparse(column):
        return np.asarray(column.toarray()).ravel().astype(float)
    return np.asarray(column).ravel().astype(float)


def base_mask(adata: sc.AnnData, args: argparse.Namespace) -> pd.Series:
    mask = pd.Series(True, index=adata.obs_names)
    if args.subset_key:
        if args.subset_key not in adata.obs.columns:
            raise ValueError(f"subset key '{args.subset_key}' not found in adata.obs")
        if not args.subset_values:
            raise ValueError("--subset-values is required when --subset-key is set")
        allowed = {value.strip() for value in args.subset_values.split(",") if value.strip()}
        mask &= adata.obs[args.subset_key].astype(str).isin(allowed)
    return mask


def group_masks(adata: sc.AnnData, args: argparse.Namespace, base: pd.Series) -> tuple[pd.Series, pd.Series]:
    if not args.group_key or args.group_a is None or args.group_b is None:
        raise ValueError("--group-key, --group-a, and --group-b are required")
    if args.group_key not in adata.obs.columns:
        raise ValueError(f"group key '{args.group_key}' not found in adata.obs")
    group_values = adata.obs[args.group_key].astype(str)
    return base & (group_values == str(args.group_a)), base & (group_values == str(args.group_b))


def detection_rate(adata: sc.AnnData, matrix: Any, lookup: dict[str, int], features: list[str], base: pd.Series, args: argparse.Namespace) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    mask = base.to_numpy()
    for feature in features:
        values = get_feature_vector(matrix, lookup, feature, args.case_insensitive)[mask]
        n = int(values.size)
        detected = int(np.sum(values > args.count_threshold))
        rows.append(
            {
                "feature": feature,
                "n_obs": n,
                "n_detected": detected,
                "detection_pct": 100.0 * detected / max(1, n),
                "threshold": args.count_threshold,
            }
        )
    return pd.DataFrame(rows)


def fold_change(adata: sc.AnnData, matrix: Any, lookup: dict[str, int], features: list[str], base: pd.Series, args: argparse.Namespace) -> pd.DataFrame:
    mask_a, mask_b = group_masks(adata, args, base)
    rows: list[dict[str, Any]] = []
    for feature in features:
        values = get_feature_vector(matrix, lookup, feature, args.case_insensitive)
        a = values[mask_a.to_numpy()]
        b = values[mask_b.to_numpy()]
        mean_a = float(np.mean(a)) if a.size else float("nan")
        mean_b = float(np.mean(b)) if b.size else float("nan")
        rows.append(
            {
                "feature": feature,
                "group_a": args.group_a,
                "group_b": args.group_b,
                "n_a": int(a.size),
                "n_b": int(b.size),
                "mean_a": mean_a,
                "mean_b": mean_b,
                "log2fc_group_b_vs_group_a": float(np.log2((mean_b + args.pseudocount) / (mean_a + args.pseudocount))),
            }
        )
    return pd.DataFrame(rows)


def feature_correlation(matrix: Any, lookup: dict[str, int], base: pd.Series, args: argparse.Namespace) -> pd.DataFrame:
    x = get_feature_vector(matrix, lookup, args.feature_a, args.case_insensitive)[base.to_numpy()]
    y = get_feature_vector(matrix, lookup, args.feature_b, args.case_insensitive)[base.to_numpy()]
    if args.correlation_method == "pearson":
        stat, pvalue = stats.pearsonr(x, y)
    else:
        stat, pvalue = stats.spearmanr(x, y)
    return pd.DataFrame(
        [
            {
                "feature_a": args.feature_a,
                "feature_b": args.feature_b,
                "method": args.correlation_method,
                "n_obs": int(x.size),
                "correlation": float(stat),
                "pvalue": float(pvalue),
            }
        ]
    )


def two_group_test(adata: sc.AnnData, matrix: Any, lookup: dict[str, int], features: list[str], base: pd.Series, args: argparse.Namespace) -> pd.DataFrame:
    mask_a, mask_b = group_masks(adata, args, base)
    a_mask = mask_a.to_numpy()
    b_mask = mask_b.to_numpy()
    rows: list[dict[str, Any]] = []
    for feature in features:
        values = get_feature_vector(matrix, lookup, feature, args.case_insensitive)
        a = values[a_mask]
        b = values[b_mask]
        mean_a = float(np.mean(a)) if a.size else float("nan")
        mean_b = float(np.mean(b)) if b.size else float("nan")
        if args.test == "mannwhitney":
            stat, pvalue = stats.mannwhitneyu(a, b, alternative="two-sided")
        else:
            stat, pvalue = stats.ttest_ind(a, b, equal_var=False, nan_policy="omit")
        rows.append(
            {
                "feature": feature,
                "test": args.test,
                "group_a": args.group_a,
                "group_b": args.group_b,
                "n_a": int(a.size),
                "n_b": int(b.size),
                "mean_a": mean_a,
                "mean_b": mean_b,
                "log2fc_group_b_vs_group_a": float(np.log2((mean_b + args.pseudocount) / (mean_a + args.pseudocount))),
                "statistic": float(stat),
                "pvalue": float(pvalue),
                "significant": bool(pvalue < args.p_threshold),
                "group_b_higher": bool(mean_b > mean_a),
            }
        )
    return pd.DataFrame(rows)


def abundance(adata: sc.AnnData, base: pd.Series, args: argparse.Namespace) -> pd.DataFrame:
    if not args.label_key:
        raise ValueError("--label-key is required for abundance")
    if args.label_key not in adata.obs.columns:
        raise ValueError(f"label key '{args.label_key}' not found in adata.obs")
    frame = adata.obs.loc[base, [args.label_key]].copy()
    frame[args.label_key] = frame[args.label_key].astype(str)
    if args.group_key:
        if args.group_key not in adata.obs.columns:
            raise ValueError(f"group key '{args.group_key}' not found in adata.obs")
        frame[args.group_key] = adata.obs.loc[base, args.group_key].astype(str)
        counts = frame.groupby([args.group_key, args.label_key]).size().reset_index(name="n_obs")
        totals = counts.groupby(args.group_key)["n_obs"].transform("sum")
        counts["pct_within_group"] = 100.0 * counts["n_obs"] / totals
        return counts.sort_values([args.group_key, "pct_within_group"], ascending=[True, False]).reset_index(drop=True)
    counts = frame[args.label_key].value_counts(dropna=False).rename_axis(args.label_key).reset_index(name="n_obs")
    counts["pct"] = 100.0 * counts["n_obs"] / max(1, int(counts["n_obs"].sum()))
    return counts


def plot_statistics(frame: pd.DataFrame, output_path: Path) -> bool:
    if frame.empty:
        return False
    if "detection_pct" in frame.columns and frame.shape[0] <= 30:
        fig, ax = plt.subplots(figsize=(max(6, frame.shape[0] * 0.5), 4))
        ax.bar(frame["feature"].astype(str), frame["detection_pct"])
        ax.set_ylabel("Detection pct")
        ax.tick_params(axis="x", rotation=45)
    elif "pct_within_group" in frame.columns and frame.shape[0] <= 80:
        pivot = frame.pivot(index=frame.columns[0], columns=frame.columns[1], values="pct_within_group").fillna(0)
        fig, ax = plt.subplots(figsize=(max(6, pivot.shape[0] * 0.7), 5))
        bottom = np.zeros(pivot.shape[0])
        for column in pivot.columns:
            ax.bar(pivot.index.astype(str), pivot[column].to_numpy(), bottom=bottom, label=str(column))
            bottom += pivot[column].to_numpy()
        ax.set_ylabel("Pct within group")
        ax.tick_params(axis="x", rotation=45)
        if len(pivot.columns) <= 15:
            ax.legend(fontsize=7, frameon=False)
    else:
        return False
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def write_report(report_path: Path, args: argparse.Namespace, matrix_source: str, stats_frame: pd.DataFrame, summary: dict[str, Any]) -> None:
    lines = [
        "# sc-group-stats report",
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
        "## Statistics Preview",
        "",
        dataframe_to_markdown(stats_frame),
        "",
    ]
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def summarize_result(frame: pd.DataFrame, args: argparse.Namespace) -> dict[str, Any]:
    summary: dict[str, Any] = {"analysis": args.analysis, "n_rows": int(frame.shape[0])}
    if "significant" in frame.columns:
        n_sig = int(frame["significant"].sum())
        summary["n_significant"] = n_sig
        summary["pct_significant"] = 100.0 * n_sig / max(1, int(frame.shape[0]))
        if "group_b_higher" in frame.columns:
            summary["n_significant_group_b_higher"] = int((frame["significant"] & frame["group_b_higher"]).sum())
    if "detection_pct" in frame.columns:
        summary["mean_detection_pct"] = float(frame["detection_pct"].mean()) if not frame.empty else None
    if "correlation" in frame.columns and not frame.empty:
        summary["correlation"] = float(frame["correlation"].iloc[0])
        summary["pvalue"] = float(frame["pvalue"].iloc[0])
    return summary


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
    matrix, var_names, matrix_source = resolve_expression_matrix(adata, args)
    lookup = feature_lookup(var_names, args.case_insensitive)
    base = base_mask(adata, args)
    features = resolve_features(args, var_names)

    if args.analysis == "detection-rate":
        stats_frame = detection_rate(adata, matrix, lookup, features, base, args)
    elif args.analysis == "fold-change":
        stats_frame = fold_change(adata, matrix, lookup, features, base, args)
    elif args.analysis == "correlation":
        stats_frame = feature_correlation(matrix, lookup, base, args)
    elif args.analysis == "two-group-test":
        stats_frame = two_group_test(adata, matrix, lookup, features, base, args)
    elif args.analysis == "abundance":
        stats_frame = abundance(adata, base, args)
    else:
        raise ValueError(f"unsupported analysis: {args.analysis}")

    stats_frame.to_csv(tables_dir / "statistics.csv", index=False)
    generated_figures: list[str] = []
    if plot_statistics(stats_frame, figures_dir / "statistics_barplot.png"):
        generated_figures.append("statistics_barplot.png")

    summary = summarize_result(stats_frame, args)
    write_report(output_dir / "report.md", args, matrix_source, stats_frame, summary)
    result = {
        "skill": "singlecell/scrna/sc-group-stats",
        "input": str(input_path),
        "output": str(output_dir),
        "analysis": args.analysis,
        "matrix_source": matrix_source,
        "summary": summary,
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
