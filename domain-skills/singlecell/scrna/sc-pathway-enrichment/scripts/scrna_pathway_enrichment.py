#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import gseapy as gp
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


SKILL_NAME = "singlecell/scrna/sc-pathway-enrichment"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pathway and gene-set enrichment for scRNA downstream outputs.")
    parser.add_argument("--output", required=True)
    parser.add_argument("--method", choices=["prerank", "ora"], required=True)
    parser.add_argument("--gene-sets", required=True, help="GMT path, Enrichr library, or comma-separated list.")
    parser.add_argument("--de-table", default=None)
    parser.add_argument("--ranking-file", default=None)
    parser.add_argument("--gene-file", default=None)
    parser.add_argument("--feature-column", default="feature")
    parser.add_argument("--rank-column", default=None)
    parser.add_argument("--padj-column", default="padj_bh")
    parser.add_argument("--padj-threshold", type=float, default=0.05)
    parser.add_argument("--lfc-column", default="log2fc_group_b_vs_group_a")
    parser.add_argument("--min-abs-lfc", type=float, default=0.0)
    parser.add_argument("--top-n", type=int, default=None)
    parser.add_argument("--organism", default="Human")
    parser.add_argument("--min-size", type=int, default=15)
    parser.add_argument("--max-size", type=int, default=500)
    parser.add_argument("--permutation-num", type=int, default=1000)
    parser.add_argument("--threads", type=int, default=4)
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".tsv":
        return pd.read_csv(path, sep="\t")
    return pd.read_csv(path)


def parse_gene_sets(value: str) -> str | list[str]:
    items = [item.strip() for item in value.split(",") if item.strip()]
    resolved = [str(Path(item).resolve()) if Path(item).exists() else item for item in items]
    if len(resolved) == 1:
        return resolved[0]
    return resolved


def resolve_ranking(args: argparse.Namespace) -> tuple[pd.Series, str]:
    if args.ranking_file:
        frame = read_table(Path(args.ranking_file).resolve())
    elif args.de_table:
        frame = read_table(Path(args.de_table).resolve())
    else:
        raise ValueError("prerank requires --ranking-file or --de-table")

    feature_column = args.feature_column if args.feature_column in frame.columns else frame.columns[0]
    rank_column = args.rank_column
    if rank_column is None:
        for candidate in ["score", "log2fc_group_b_vs_group_a", "statistic", "stat", "NES"]:
            if candidate in frame.columns:
                rank_column = candidate
                break
    if rank_column is None or rank_column not in frame.columns:
        raise ValueError("Could not resolve a ranking column from the input table")

    ranking = frame[[feature_column, rank_column]].copy()
    ranking = ranking.dropna()
    ranking[feature_column] = ranking[feature_column].astype(str)
    ranking = ranking.groupby(feature_column, dropna=False)[rank_column].mean().sort_values(ascending=False)
    if args.top_n:
        ranking = ranking.head(args.top_n)
    if ranking.empty:
        raise ValueError("Resolved ranking is empty")
    return ranking, rank_column


def resolve_gene_list(args: argparse.Namespace) -> tuple[list[str], str]:
    if args.gene_file:
        path = Path(args.gene_file).resolve()
        if path.suffix.lower() in {".csv", ".tsv"}:
            frame = read_table(path)
            column = "gene" if "gene" in frame.columns else frame.columns[0]
            genes = [str(value).strip() for value in frame[column].tolist() if str(value).strip()]
        else:
            genes = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        return list(dict.fromkeys(genes)), "gene-file"

    if not args.de_table:
        raise ValueError("ora requires --gene-file or --de-table")
    frame = read_table(Path(args.de_table).resolve())
    feature_column = args.feature_column if args.feature_column in frame.columns else frame.columns[0]
    selected = frame.copy()
    if args.padj_column in selected.columns:
        selected = selected.loc[pd.to_numeric(selected[args.padj_column], errors="coerce") <= args.padj_threshold]
    if args.lfc_column in selected.columns and args.min_abs_lfc > 0:
        selected = selected.loc[pd.to_numeric(selected[args.lfc_column], errors="coerce").abs() >= args.min_abs_lfc]
    genes = [str(value).strip() for value in selected[feature_column].tolist() if str(value).strip()]
    if args.top_n:
        genes = genes[: args.top_n]
    genes = list(dict.fromkeys(genes))
    if not genes:
        raise ValueError("No genes passed the ORA filters")
    return genes, "de-table"


def plot_prerank_results(frame: pd.DataFrame, output_path: Path) -> bool:
    if frame.empty or "NES" not in frame.columns:
        return False
    plot_df = frame.head(15).iloc[::-1].copy()
    plot_df["NES"] = pd.to_numeric(plot_df["NES"], errors="coerce")
    plot_df = plot_df.dropna(subset=["NES"])
    if plot_df.empty:
        return False
    colors = ["#4C78A8" if value >= 0 else "#E45756" for value in plot_df["NES"]]
    fig, ax = plt.subplots(figsize=(8, max(4, 0.35 * plot_df.shape[0])))
    ax.barh(plot_df["Term"].astype(str), plot_df["NES"], color=colors)
    ax.set_xlabel("NES")
    ax.set_ylabel("Gene set")
    ax.set_title("Top prerank enrichments")
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def plot_ora_results(frame: pd.DataFrame, output_path: Path) -> bool:
    if frame.empty:
        return False
    plot_df = frame.head(15).iloc[::-1].copy()
    col = "Adjusted P-value" if "Adjusted P-value" in plot_df.columns else "P-value"
    plot_df[col] = pd.to_numeric(plot_df[col], errors="coerce")
    plot_df = plot_df.dropna(subset=[col])
    if plot_df.empty:
        return False
    scores = -np.log10(np.clip(plot_df[col].to_numpy(dtype=float), 1e-300, 1))
    fig, ax = plt.subplots(figsize=(8, max(4, 0.35 * plot_df.shape[0])))
    ax.barh(plot_df["Term"].astype(str), scores, color="#4C78A8")
    ax.set_xlabel(f"-log10({col})")
    ax.set_ylabel("Gene set")
    ax.set_title("Top ORA enrichments")
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


def write_report(report_path: Path, args: argparse.Namespace, input_summary: dict[str, Any], results: pd.DataFrame) -> None:
    lines = [
        "# sc-pathway-enrichment report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Input Summary",
        "",
        "```json",
        json.dumps(input_summary, indent=2, ensure_ascii=False),
        "```",
        "",
        "## Top Results",
        "",
        dataframe_to_markdown(results),
        "",
    ]
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output).resolve()
    tables_dir = output_dir / "tables"
    figures_dir = output_dir / "figures"
    ensure_dir(output_dir)
    ensure_dir(tables_dir)
    ensure_dir(figures_dir)

    gene_sets = parse_gene_sets(args.gene_sets)
    generated_figures: list[str] = []
    input_summary: dict[str, Any]

    if args.method == "prerank":
        ranking, rank_column = resolve_ranking(args)
        ranking_df = ranking.rename("score").reset_index().rename(columns={ranking.index.name or "index": "feature"})
        ranking_df.to_csv(tables_dir / "ranking_used.csv", index=False)
        outdir = output_dir / "gseapy_prerank"
        pre_res = gp.prerank(
            rnk=ranking,
            gene_sets=gene_sets,
            outdir=str(outdir),
            min_size=args.min_size,
            max_size=args.max_size,
            permutation_num=args.permutation_num,
            threads=args.threads,
            format="png",
            no_plot=False,
            seed=123,
            verbose=False,
        )
        results = pre_res.res2d.copy().reset_index(drop=True)
        results.to_csv(tables_dir / "enrichment_results.csv", index=False)
        if plot_prerank_results(results, figures_dir / "prerank_top_terms.png"):
            generated_figures.append("prerank_top_terms.png")
        input_summary = {
            "input_type": "ranking",
            "rank_column": rank_column,
            "n_ranked_features": int(ranking.shape[0]),
            "gene_sets": gene_sets,
        }
    else:
        genes, gene_source = resolve_gene_list(args)
        pd.DataFrame({"gene": genes}).to_csv(tables_dir / "genes_used.csv", index=False)
        outdir = output_dir / "gseapy_ora"
        ora_res = gp.enrichr(
            gene_list=genes,
            gene_sets=gene_sets,
            organism=args.organism,
            outdir=str(outdir),
            cutoff=args.padj_threshold,
            format="png",
            no_plot=False,
            verbose=False,
        )
        results = ora_res.results.copy().reset_index(drop=True)
        results.to_csv(tables_dir / "enrichment_results.csv", index=False)
        if plot_ora_results(results, figures_dir / "ora_top_terms.png"):
            generated_figures.append("ora_top_terms.png")
        input_summary = {
            "input_type": "gene-list",
            "gene_source": gene_source,
            "n_input_genes": int(len(genes)),
            "gene_sets": gene_sets,
        }

    write_report(output_dir / "report.md", args, input_summary, results)
    result = {
        "skill": SKILL_NAME,
        "output": str(output_dir),
        "method": args.method,
        "gene_sets": gene_sets,
        "n_results": int(results.shape[0]),
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
