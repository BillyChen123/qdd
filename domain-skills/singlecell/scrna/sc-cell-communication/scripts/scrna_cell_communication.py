#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc
from scipy import sparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Lightweight ligand-receptor communication scoring for annotated AnnData.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--group-key", required=True, help="obs column defining sender/receiver groups.")
    parser.add_argument("--lr-file", required=True, help="CSV or TSV interaction table.")
    parser.add_argument("--sample-key", default=None, help="Optional obs column for sample-aware averaging.")
    parser.add_argument("--score-method", choices=["geometric_mean", "product", "min"], default="geometric_mean")
    parser.add_argument("--use-raw", action="store_true", help="Use adata.raw for expression summaries when available.")
    parser.add_argument("--layer", default=None, help="Layer to use instead of X.")
    parser.add_argument("--min-detect-fraction", type=float, default=0.05)
    parser.add_argument("--min-cells-per-group", type=int, default=10)
    parser.add_argument("--top-n", type=int, default=25)
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


def split_genes(value: Any) -> list[str]:
    return [entry.strip() for entry in re.split(r"[+,;|]", str(value)) if entry and entry.strip()]


def read_lr_table(path: Path) -> pd.DataFrame:
    sep = "\t" if path.suffix.lower() in {".tsv", ".txt"} else ","
    frame = pd.read_csv(path, sep=sep)
    ligand_col = next((col for col in ["ligand", "ligand_gene", "ligand_genes"] if col in frame.columns), None)
    receptor_col = next((col for col in ["receptor", "receptor_gene", "receptor_genes"] if col in frame.columns), None)
    if ligand_col is None or receptor_col is None:
        raise ValueError("interaction file must include ligand and receptor columns")
    interaction_col = next((col for col in ["interaction_id", "id", "name"] if col in frame.columns), None)
    source_col = "source" if "source" in frame.columns else None

    rows: list[dict[str, Any]] = []
    for idx, row in frame.iterrows():
        ligands = split_genes(row[ligand_col])
        receptors = split_genes(row[receptor_col])
        if not ligands or not receptors:
            continue
        interaction_id = str(row[interaction_col]).strip() if interaction_col else f"lr_{idx + 1}"
        source = str(row[source_col]).strip() if source_col else ""
        rows.append(
            {
                "interaction_id": interaction_id,
                "ligand": ",".join(ligands),
                "receptor": ",".join(receptors),
                "ligand_genes": ligands,
                "receptor_genes": receptors,
                "source": source,
            }
        )
    if not rows:
        raise ValueError("interaction file did not yield any usable ligand-receptor pairs")
    return pd.DataFrame(rows)


def resolve_expression_matrix(adata: sc.AnnData, args: argparse.Namespace) -> tuple[Any, pd.Index, str]:
    if args.layer:
        if args.layer not in adata.layers:
            raise ValueError(f"layer '{args.layer}' not found in adata.layers")
        return adata.layers[args.layer], pd.Index(adata.var_names.astype(str)), f"layer:{args.layer}"
    if args.use_raw and adata.raw is not None:
        return adata.raw.X, pd.Index(adata.raw.var_names.astype(str)), "raw"
    return adata.X, pd.Index(adata.var_names.astype(str)), "X"


def panel_coverage(lr_frame: pd.DataFrame, var_names: pd.Index) -> tuple[pd.DataFrame, list[str]]:
    gene_lookup = {str(gene): str(gene) for gene in var_names}
    covered: set[str] = set()
    rows: list[dict[str, Any]] = []
    for row in lr_frame.itertuples(index=False):
        ligand_present = [gene_lookup[gene] for gene in row.ligand_genes if gene in gene_lookup]
        receptor_present = [gene_lookup[gene] for gene in row.receptor_genes if gene in gene_lookup]
        covered.update(ligand_present)
        covered.update(receptor_present)
        rows.append(
            {
                "interaction_id": row.interaction_id,
                "ligand": row.ligand,
                "receptor": row.receptor,
                "n_ligand_genes": len(row.ligand_genes),
                "n_ligand_present": len(ligand_present),
                "n_receptor_genes": len(row.receptor_genes),
                "n_receptor_present": len(receptor_present),
                "ligand_present": ",".join(ligand_present),
                "receptor_present": ",".join(receptor_present),
                "source": row.source,
            }
        )
    return pd.DataFrame(rows), sorted(covered)


def to_dense(matrix: Any) -> np.ndarray:
    if sparse.issparse(matrix):
        return matrix.toarray()
    return np.asarray(matrix)


def build_group_gene_summary(
    adata: sc.AnnData,
    matrix: Any,
    var_names: pd.Index,
    genes: list[str],
    group_key: str,
    sample_key: str | None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    var_to_idx = {str(gene): idx for idx, gene in enumerate(var_names)}
    gene_indices = [var_to_idx[gene] for gene in genes if gene in var_to_idx]
    if not gene_indices:
        raise ValueError("no ligand/receptor genes were covered by the expression matrix")

    dense = to_dense(matrix[:, gene_indices]).astype(float)
    gene_names = [str(var_names[idx]) for idx in gene_indices]
    obs = adata.obs[[group_key]].copy()
    if sample_key:
        obs[sample_key] = adata.obs[sample_key]

    mean_rows: list[pd.Series] = []
    detect_rows: list[pd.Series] = []
    for group, group_indices in obs.groupby(group_key, observed=False).indices.items():
        idx = np.asarray(list(group_indices), dtype=int)
        group_dense = dense[idx]
        detect = (group_dense > 0).mean(axis=0)
        if sample_key:
            sample_values = obs.iloc[idx][sample_key].astype("string").to_numpy()
            sample_means: list[np.ndarray] = []
            for sample in pd.unique(sample_values):
                sample_mask = sample_values == sample
                sample_means.append(group_dense[sample_mask].mean(axis=0))
            mean_expr = np.vstack(sample_means).mean(axis=0)
        else:
            mean_expr = group_dense.mean(axis=0)
        mean_rows.append(pd.Series(mean_expr, index=gene_names, name=str(group)))
        detect_rows.append(pd.Series(detect, index=gene_names, name=str(group)))

    mean_frame = pd.DataFrame(mean_rows).sort_index()
    detect_frame = pd.DataFrame(detect_rows).sort_index()
    return mean_frame, detect_frame


def score_pair(ligand_score: float, receptor_score: float, method: str) -> float:
    ligand_score = max(0.0, ligand_score)
    receptor_score = max(0.0, receptor_score)
    if method == "product":
        return ligand_score * receptor_score
    if method == "min":
        return min(ligand_score, receptor_score)
    return math.sqrt(ligand_score * receptor_score)


def score_interactions(
    lr_frame: pd.DataFrame,
    group_sizes: pd.Series,
    mean_frame: pd.DataFrame,
    detect_frame: pd.DataFrame,
    args: argparse.Namespace,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    groups = list(mean_frame.index.astype(str))
    for sender in groups:
        for receiver in groups:
            sender_size = int(group_sizes.get(sender, 0))
            receiver_size = int(group_sizes.get(receiver, 0))
            for row in lr_frame.itertuples(index=False):
                ligand_present = [gene for gene in row.ligand_genes if gene in mean_frame.columns]
                receptor_present = [gene for gene in row.receptor_genes if gene in mean_frame.columns]
                if not ligand_present or not receptor_present:
                    score = 0.0
                    passed = False
                    ligand_mean = 0.0
                    receptor_mean = 0.0
                    ligand_detect = 0.0
                    receptor_detect = 0.0
                else:
                    ligand_mean = float(mean_frame.loc[sender, ligand_present].mean())
                    receptor_mean = float(mean_frame.loc[receiver, receptor_present].mean())
                    ligand_detect = float(detect_frame.loc[sender, ligand_present].mean())
                    receptor_detect = float(detect_frame.loc[receiver, receptor_present].mean())
                    passed = (
                        sender_size >= args.min_cells_per_group
                        and receiver_size >= args.min_cells_per_group
                        and ligand_detect >= args.min_detect_fraction
                        and receptor_detect >= args.min_detect_fraction
                    )
                    score = score_pair(ligand_mean, receptor_mean, args.score_method) if passed else 0.0

                rows.append(
                    {
                        "sender_group": sender,
                        "receiver_group": receiver,
                        "interaction_id": row.interaction_id,
                        "ligand": row.ligand,
                        "receptor": row.receptor,
                        "source": row.source,
                        "sender_n_cells": sender_size,
                        "receiver_n_cells": receiver_size,
                        "ligand_mean_expr": ligand_mean,
                        "receptor_mean_expr": receptor_mean,
                        "ligand_detect_fraction": ligand_detect,
                        "receptor_detect_fraction": receptor_detect,
                        "passed_filters": passed,
                        "score": score,
                    }
                )
    scored = pd.DataFrame(rows)
    return scored.sort_values(["score", "sender_group", "receiver_group", "interaction_id"], ascending=[False, True, True, True])


def save_heatmap(summary: pd.DataFrame, output_path: Path) -> None:
    if summary.empty:
        return
    pivot = summary.pivot(index="sender_group", columns="receiver_group", values="total_score").fillna(0.0)
    fig, ax = plt.subplots(figsize=(max(5, pivot.shape[1] * 0.6), max(4, pivot.shape[0] * 0.6)))
    image = ax.imshow(pivot.to_numpy(), cmap="viridis", aspect="auto")
    ax.set_xticks(np.arange(pivot.shape[1]))
    ax.set_xticklabels(pivot.columns, rotation=45, ha="right")
    ax.set_yticks(np.arange(pivot.shape[0]))
    ax.set_yticklabels(pivot.index)
    ax.set_xlabel("Receiver group")
    ax.set_ylabel("Sender group")
    ax.set_title("Sender-receiver total interaction score")
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    matrix_source: str,
    group_counts: pd.DataFrame,
    coverage: pd.DataFrame,
    summary: pd.DataFrame,
    top_scores: pd.DataFrame,
) -> None:
    lines = [
        "# sc-cell-communication report",
        "",
        "## Run Summary",
        "",
        f"- group_key: `{args.group_key}`",
        f"- sample_key: `{args.sample_key or ''}`",
        f"- matrix_source: `{matrix_source}`",
        f"- score_method: `{args.score_method}`",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Group Sizes",
        "",
        dataframe_to_markdown(group_counts),
        "",
        "## Panel Coverage",
        "",
        dataframe_to_markdown(coverage),
        "",
        "## Sender-Receiver Summary",
        "",
        dataframe_to_markdown(summary),
        "",
        "## Top Interaction Scores",
        "",
        dataframe_to_markdown(top_scores),
        "",
        "## Interpretation Guardrails",
        "",
        "- Scores are ranking signals, not default significance tests.",
        "- Targeted panels can suppress true interactions when ligand or receptor genes are not covered.",
        "- Use biologically meaningful annotation keys before interpreting sender-receiver labels.",
        "",
    ]
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    lr_path = Path(args.lr_file).resolve()
    output_dir = Path(args.output).resolve()
    tables_dir = output_dir / "tables"
    figures_dir = output_dir / "figures"
    ensure_dir(output_dir)
    ensure_dir(tables_dir)
    ensure_dir(figures_dir)

    adata = sc.read_h5ad(input_path)
    if args.group_key not in adata.obs.columns:
        raise ValueError(f"group key '{args.group_key}' not found in adata.obs")
    if args.sample_key and args.sample_key not in adata.obs.columns:
        raise ValueError(f"sample key '{args.sample_key}' not found in adata.obs")

    lr_frame = read_lr_table(lr_path)
    matrix, var_names, matrix_source = resolve_expression_matrix(adata, args)
    coverage, covered_genes = panel_coverage(lr_frame, var_names)
    mean_frame, detect_frame = build_group_gene_summary(adata, matrix, var_names, covered_genes, args.group_key, args.sample_key)

    group_sizes = adata.obs[args.group_key].astype("string").value_counts().sort_index()
    group_counts = group_sizes.rename_axis(args.group_key).reset_index(name="n_cells")
    interaction_scores = score_interactions(lr_frame, group_sizes, mean_frame, detect_frame, args)
    summary = (
        interaction_scores.groupby(["sender_group", "receiver_group"], observed=False)["score"]
        .sum()
        .rename("total_score")
        .reset_index()
        .sort_values("total_score", ascending=False)
    )
    top_scores = interaction_scores.head(max(1, args.top_n)).copy()

    group_counts.to_csv(tables_dir / "group_abundance.csv", index=False)
    coverage.to_csv(tables_dir / "lr_panel_coverage.csv", index=False)
    interaction_scores.to_csv(tables_dir / "interaction_scores.csv", index=False)
    summary.to_csv(tables_dir / "sender_receiver_summary.csv", index=False)
    save_heatmap(summary, figures_dir / "sender_receiver_heatmap.png")
    write_report(output_dir / "report.md", args, matrix_source, group_counts, coverage, summary.head(max(1, args.top_n)), top_scores)

    result = {
        "skill": "singlecell/scrna/sc-cell-communication",
        "input": str(input_path),
        "lr_file": str(lr_path),
        "output": str(output_dir),
        "group_key": args.group_key,
        "sample_key": args.sample_key,
        "matrix_source": matrix_source,
        "score_method": args.score_method,
        "n_groups": int(group_counts.shape[0]),
        "n_interactions": int(lr_frame.shape[0]),
        "n_scored_rows": int(interaction_scores.shape[0]),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
