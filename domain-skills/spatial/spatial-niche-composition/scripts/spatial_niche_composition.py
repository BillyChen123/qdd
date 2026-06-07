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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Spatial niche or region composition and enrichment analysis for AnnData.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--niche-key", required=True, help="obs column containing niche, CN, region, or compartment labels.")
    parser.add_argument("--label-key", required=True, help="obs column containing annotated cell/spot/bead labels.")
    parser.add_argument("--niche-values", default=None, help="Optional comma-separated niche values to analyze.")
    parser.add_argument("--label-values", default=None, help="Optional comma-separated label values to report.")
    parser.add_argument("--group-key", default=None, help="Optional condition/time/sample column for group-aware summaries.")
    parser.add_argument("--subset-key", default=None, help="Optional obs column used to subset before analysis.")
    parser.add_argument("--subset-values", default=None, help="Comma-separated values used with --subset-key.")
    parser.add_argument("--background-scope", choices=["same-group", "all"], default="same-group")
    parser.add_argument("--pseudocount", type=float, default=1e-9)
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def parse_value_set(value: str | None) -> set[str] | None:
    if value is None:
        return None
    parsed = {item.strip() for item in value.split(",") if item.strip()}
    return parsed or None


def validate_obs_key(adata: sc.AnnData, key: str | None, role: str) -> None:
    if key and key not in adata.obs.columns:
        raise ValueError(f"{role} key '{key}' not found in adata.obs")


def base_mask(adata: sc.AnnData, args: argparse.Namespace) -> pd.Series:
    mask = pd.Series(True, index=adata.obs_names)
    if args.subset_key:
        validate_obs_key(adata, args.subset_key, "subset")
        if not args.subset_values:
            raise ValueError("--subset-values is required when --subset-key is set")
        allowed = parse_value_set(args.subset_values) or set()
        mask &= adata.obs[args.subset_key].astype(str).isin(allowed)
    return mask


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


def compute_composition(adata: sc.AnnData, args: argparse.Namespace) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    mask = base_mask(adata, args)
    niche_values = parse_value_set(args.niche_values)
    label_values = parse_value_set(args.label_values)
    frame = pd.DataFrame(
        {
            "niche": adata.obs[args.niche_key].astype("string").fillna("missing"),
            "label": adata.obs[args.label_key].astype("string").fillna("missing"),
            "group": adata.obs[args.group_key].astype("string").fillna("all") if args.group_key else "all",
        },
        index=adata.obs_names,
    )
    frame = frame.loc[mask].copy()
    if label_values is not None:
        frame = frame.loc[frame["label"].astype(str).isin(label_values)].copy()
    focal_frame = frame
    if niche_values is not None:
        focal_frame = frame.loc[frame["niche"].astype(str).isin(niche_values)].copy()
    if frame.empty or focal_frame.empty:
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

    count_rows: list[dict[str, Any]] = []
    enrichment_rows: list[dict[str, Any]] = []
    summary_rows: list[dict[str, Any]] = []
    all_labels = sorted(frame["label"].astype(str).unique())

    for (group_value, niche_value), niche_df in focal_frame.groupby(["group", "niche"], dropna=False):
        if args.background_scope == "same-group":
            background = frame.loc[frame["group"].astype(str) == str(group_value)]
        else:
            background = frame
        n_niche = int(niche_df.shape[0])
        n_background = int(background.shape[0])
        niche_counts = niche_df["label"].astype(str).value_counts()
        background_counts = background["label"].astype(str).value_counts()
        top_label = None
        top_pct = -1.0
        enriched_label = None
        enriched_value = -np.inf

        for label in all_labels:
            n_label_niche = int(niche_counts.get(label, 0))
            n_label_background = int(background_counts.get(label, 0))
            pct_niche = 100.0 * n_label_niche / max(1, n_niche)
            pct_background = 100.0 * n_label_background / max(1, n_background)
            enrichment = (pct_niche + args.pseudocount) / (pct_background + args.pseudocount)
            log2_enrichment = float(np.log2(enrichment))
            count_rows.append(
                {
                    "group": str(group_value),
                    "niche": str(niche_value),
                    "label": label,
                    "n_niche": n_niche,
                    "n_label_niche": n_label_niche,
                    "pct_niche": pct_niche,
                    "n_background": n_background,
                    "n_label_background": n_label_background,
                    "pct_background": pct_background,
                }
            )
            enrichment_rows.append(
                {
                    "group": str(group_value),
                    "niche": str(niche_value),
                    "label": label,
                    "enrichment": float(enrichment),
                    "log2_enrichment": log2_enrichment,
                    "pct_niche": pct_niche,
                    "pct_background": pct_background,
                }
            )
            if pct_niche > top_pct:
                top_pct = pct_niche
                top_label = label
            if log2_enrichment > enriched_value and n_label_niche > 0:
                enriched_value = log2_enrichment
                enriched_label = label

        summary_rows.append(
            {
                "group": str(group_value),
                "niche": str(niche_value),
                "n_niche": n_niche,
                "top_label": top_label,
                "top_label_pct": top_pct,
                "most_enriched_label": enriched_label,
                "max_log2_enrichment": float(enriched_value) if enriched_label is not None else None,
                "background_scope": args.background_scope,
            }
        )

    composition = pd.DataFrame(count_rows)
    enrichment = pd.DataFrame(enrichment_rows)
    summary = pd.DataFrame(summary_rows)
    return composition, enrichment, summary


def plot_top_composition(summary: pd.DataFrame, output_path: Path) -> bool:
    if summary.empty or summary.shape[0] > 80:
        return False
    labels = summary["group"].astype(str) + " / " + summary["niche"].astype(str)
    fig, ax = plt.subplots(figsize=(max(6, summary.shape[0] * 0.5), 4))
    ax.bar(labels, summary["top_label_pct"].fillna(0.0))
    ax.set_ylabel("Top label pct in niche")
    ax.tick_params(axis="x", rotation=45)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def plot_enrichment(enrichment: pd.DataFrame, output_path: Path) -> bool:
    if enrichment.empty:
        return False
    frame = enrichment.loc[enrichment["pct_niche"] > 0].copy()
    if frame.empty:
        return False
    frame = frame.sort_values("log2_enrichment", ascending=False).head(30)
    labels = frame["group"].astype(str) + " / " + frame["niche"].astype(str) + " / " + frame["label"].astype(str)
    fig, ax = plt.subplots(figsize=(max(6, frame.shape[0] * 0.35), 4))
    ax.bar(labels, frame["log2_enrichment"])
    ax.set_ylabel("log2 enrichment")
    ax.tick_params(axis="x", rotation=60)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def write_report(report_path: Path, args: argparse.Namespace, summary: pd.DataFrame) -> None:
    lines = [
        "# spatial-niche-composition report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Niche Summary",
        "",
        dataframe_to_markdown(summary),
        "",
    ]
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
    validate_obs_key(adata, args.niche_key, "niche")
    validate_obs_key(adata, args.label_key, "label")
    validate_obs_key(adata, args.group_key, "group")

    composition, enrichment, summary = compute_composition(adata, args)
    composition.to_csv(tables_dir / "niche_composition.csv", index=False)
    enrichment.to_csv(tables_dir / "niche_enrichment.csv", index=False)
    summary.to_csv(tables_dir / "niche_summary.csv", index=False)

    generated_figures: list[str] = []
    if plot_top_composition(summary, figures_dir / "niche_composition_barplot.png"):
        generated_figures.append("niche_composition_barplot.png")
    if plot_enrichment(enrichment, figures_dir / "niche_enrichment_barplot.png"):
        generated_figures.append("niche_enrichment_barplot.png")

    write_report(output_dir / "report.md", args, summary)
    result = {
        "skill": "spatial/spatial-niche-composition",
        "input": str(input_path),
        "output": str(output_dir),
        "n_niches": int(summary.shape[0]),
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
