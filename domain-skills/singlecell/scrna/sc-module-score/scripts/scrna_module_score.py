#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from anndata import AnnData
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc


SKILL_NAME = "singlecell/scrna/sc-module-score"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Module and signature scoring for scRNA AnnData using Scanpy.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--genes", default=None, help="Comma-separated genes for one signature.")
    parser.add_argument("--signature-file", default=None, help="CSV/TSV/TXT signature definition file.")
    parser.add_argument("--score-name", default="module_score", help="Score name for single-signature runs.")
    parser.add_argument("--group-key", default=None, help="Optional obs column for grouped summaries.")
    parser.add_argument("--subset-key", default=None)
    parser.add_argument("--subset-values", default=None)
    parser.add_argument("--gene-pool-file", default=None)
    parser.add_argument("--ctrl-size", type=int, default=50)
    parser.add_argument("--n-bins", type=int, default=25)
    parser.add_argument("--random-state", type=int, default=0)
    parser.add_argument("--use-raw", action="store_true")
    parser.add_argument("--layer", default=None)
    parser.add_argument("--case-insensitive", action="store_true")
    parser.add_argument("--embedding-key", default="auto", help="Embedding basis, e.g. umap, tsne, pca, or auto.")
    parser.add_argument("--max-plot-signatures", type=int, default=4)
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def validate_args(args: argparse.Namespace) -> None:
    if args.layer and args.use_raw:
        raise ValueError("--layer and --use-raw are mutually exclusive")
    if not args.genes and not args.signature_file:
        raise ValueError("Provide --genes or --signature-file")


def materialize_expression_adata(adata: AnnData, args: argparse.Namespace) -> tuple[AnnData, str]:
    if args.layer:
        if args.layer not in adata.layers:
            raise ValueError(f"layer '{args.layer}' not found")
        return AnnData(X=adata.layers[args.layer], obs=adata.obs.copy(), var=adata.var.copy(), obsm=adata.obsm.copy()), f"layer:{args.layer}"
    if args.use_raw:
        if adata.raw is None:
            raise ValueError("--use-raw was set but adata.raw is empty")
        raw = adata.raw.to_adata()
        raw.obs = adata.obs.copy()
        raw.obsm = adata.obsm.copy()
        return raw, "raw"
    return adata.copy(), "X"


def read_gene_list(path: Path) -> list[str]:
    if path.suffix.lower() in {".csv", ".tsv"}:
        sep = "\t" if path.suffix.lower() == ".tsv" else ","
        frame = pd.read_csv(path, sep=sep)
        column = "gene" if "gene" in frame.columns else frame.columns[0]
        return [str(value).strip() for value in frame[column].tolist() if str(value).strip()]
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def parse_signatures(args: argparse.Namespace) -> dict[str, list[str]]:
    signatures: dict[str, list[str]] = {}
    if args.genes:
        genes = [item.strip() for item in args.genes.split(",") if item.strip()]
        signatures[args.score_name] = genes
    if args.signature_file:
        path = Path(args.signature_file).resolve()
        if path.suffix.lower() not in {".csv", ".tsv"}:
            genes = read_gene_list(path)
            signatures.setdefault(args.score_name, []).extend(genes)
            return {name: list(dict.fromkeys(values)) for name, values in signatures.items()}

        sep = "\t" if path.suffix.lower() == ".tsv" else ","
        frame = pd.read_csv(path, sep=sep)
        columns = {column.lower(): column for column in frame.columns}
        if "signature" in columns and "genes" in columns:
            for row in frame.itertuples(index=False):
                signature = str(getattr(row, columns["signature"])).strip()
                genes = [gene.strip() for gene in str(getattr(row, columns["genes"])).split(",") if gene.strip()]
                signatures.setdefault(signature, []).extend(genes)
        elif "signature" in columns and "gene" in columns:
            sig_col = columns["signature"]
            gene_col = columns["gene"]
            for signature, part in frame.groupby(sig_col, dropna=False):
                genes = [str(value).strip() for value in part[gene_col].tolist() if str(value).strip()]
                signatures.setdefault(str(signature).strip(), []).extend(genes)
        else:
            raise ValueError("signature-file must contain either signature+genes or signature+gene columns")
    parsed = {name: list(dict.fromkeys(values)) for name, values in signatures.items() if values}
    if not parsed:
        raise ValueError("No usable signatures were parsed")
    return parsed


def resolve_gene_pool(args: argparse.Namespace, var_names: pd.Index) -> list[str] | None:
    if not args.gene_pool_file:
        return None
    return resolve_features(read_gene_list(Path(args.gene_pool_file).resolve()), var_names, args.case_insensitive)


def resolve_features(features: list[str], var_names: pd.Index, case_insensitive: bool) -> list[str]:
    mapping: dict[str, str] = {}
    collisions: set[str] = set()
    for name in var_names.astype(str):
        key = name.upper() if case_insensitive else name
        if key in mapping and mapping[key] != name:
            collisions.add(key)
        mapping[key] = name
    if collisions:
        raise ValueError("case-insensitive feature resolution is ambiguous")
    resolved: list[str] = []
    for feature in features:
        key = feature.upper() if case_insensitive else feature
        actual = mapping.get(key)
        if actual is not None:
            resolved.append(actual)
    return list(dict.fromkeys(resolved))


def build_subset_mask(adata: AnnData, args: argparse.Namespace) -> pd.Series:
    mask = pd.Series(True, index=adata.obs_names)
    if args.group_key and args.group_key not in adata.obs.columns:
        raise ValueError(f"group key '{args.group_key}' not found in adata.obs")
    if args.subset_key:
        if args.subset_key not in adata.obs.columns:
            raise ValueError(f"subset key '{args.subset_key}' not found in adata.obs")
        if not args.subset_values:
            raise ValueError("--subset-values is required when --subset-key is set")
        allowed = {item.strip() for item in args.subset_values.split(",") if item.strip()}
        mask &= adata.obs[args.subset_key].astype(str).isin(allowed)
    return mask


def choose_basis(adata: AnnData, embedding_key: str) -> str | None:
    if embedding_key != "auto":
        if embedding_key in adata.obsm:
            return embedding_key[2:] if embedding_key.startswith("X_") else embedding_key
        normalized = f"X_{embedding_key}" if not embedding_key.startswith("X_") else embedding_key
        if normalized in adata.obsm:
            return normalized[2:]
        return None
    for candidate in ["X_umap", "X_tsne", "X_draw_graph_fa", "X_pca"]:
        if candidate in adata.obsm:
            return candidate[2:]
    return None


def plot_embeddings(adata: AnnData, score_names: list[str], basis: str | None, output_dir: Path, max_plot_signatures: int) -> list[str]:
    if basis is None:
        return []
    generated: list[str] = []
    for score_name in score_names[:max_plot_signatures]:
        fig_path = output_dir / f"{score_name}_{basis}.png"
        sc.pl.embedding(adata, basis=basis, color=score_name, show=False)
        plt.gcf().savefig(fig_path, dpi=160, bbox_inches="tight")
        plt.close(plt.gcf())
        generated.append(fig_path.name)
    return generated


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


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    matrix_source: str,
    coverage: pd.DataFrame,
    score_summary: pd.DataFrame,
    group_summary: pd.DataFrame,
    basis: str | None,
) -> None:
    lines = [
        "# sc-module-score report",
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
        "## Embedding Basis",
        "",
        f"- `{basis}`",
        "",
        "## Signature Coverage",
        "",
        dataframe_to_markdown(coverage),
        "",
        "## Score Summary",
        "",
        dataframe_to_markdown(score_summary),
        "",
        "## Group Summary",
        "",
        dataframe_to_markdown(group_summary),
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
    signatures = parse_signatures(args)
    gene_pool = resolve_gene_pool(args, pd.Index(expr_adata.var_names.astype(str)))
    subset_mask = build_subset_mask(expr_adata, args)
    subset_obs = subset_mask[subset_mask].index
    if subset_obs.empty:
        raise ValueError("No observations remained after subset filtering")
    subset = expr_adata[subset_obs].copy()

    coverage_rows: list[dict[str, Any]] = []
    score_columns: list[str] = []
    for signature_name, genes in signatures.items():
        matched = resolve_features(genes, pd.Index(subset.var_names.astype(str)), args.case_insensitive)
        coverage_rows.append(
            {
                "signature": signature_name,
                "n_input_genes": int(len(genes)),
                "n_matched_genes": int(len(matched)),
                "matched_genes": ",".join(matched),
            }
        )
        score_col = signature_name
        score_columns.append(score_col)
        if not matched:
            subset.obs[score_col] = np.nan
            continue
        ctrl_size = min(args.ctrl_size, max(1, len(matched)))
        sc.tl.score_genes(
            subset,
            gene_list=matched,
            ctrl_size=ctrl_size,
            gene_pool=gene_pool,
            n_bins=args.n_bins,
            score_name=score_col,
            random_state=args.random_state,
            use_raw=False,
        )

    adata_out = adata.copy()
    for score_col in score_columns:
        adata_out.obs[score_col] = np.nan
        adata_out.obs.loc[subset.obs_names, score_col] = subset.obs[score_col].to_numpy()

    score_table = adata_out.obs[score_columns].copy()
    score_table.insert(0, "obs_name", adata_out.obs_names.astype(str))
    score_table.to_csv(tables_dir / "signature_scores.csv", index=False)

    coverage = pd.DataFrame(coverage_rows)
    coverage.to_csv(tables_dir / "signature_coverage.csv", index=False)

    score_summary_rows: list[dict[str, Any]] = []
    for score_col in score_columns:
        values = pd.to_numeric(adata_out.obs[score_col], errors="coerce")
        valid = values.dropna()
        score_summary_rows.append(
            {
                "signature": score_col,
                "n_scored_obs": int(valid.shape[0]),
                "mean_score": float(valid.mean()) if not valid.empty else np.nan,
                "median_score": float(valid.median()) if not valid.empty else np.nan,
                "std_score": float(valid.std()) if valid.shape[0] > 1 else np.nan,
                "min_score": float(valid.min()) if not valid.empty else np.nan,
                "max_score": float(valid.max()) if not valid.empty else np.nan,
            }
        )
    score_summary = pd.DataFrame(score_summary_rows)
    score_summary.to_csv(tables_dir / "score_summary.csv", index=False)

    group_summary = pd.DataFrame()
    if args.group_key:
        rows: list[dict[str, Any]] = []
        grouped = adata_out.obs.groupby(args.group_key, dropna=False, observed=False)
        for group_value, frame in grouped:
            for score_col in score_columns:
                values = pd.to_numeric(frame[score_col], errors="coerce").dropna()
                rows.append(
                    {
                        "group": group_value,
                        "signature": score_col,
                        "n_obs": int(values.shape[0]),
                        "mean_score": float(values.mean()) if not values.empty else np.nan,
                        "median_score": float(values.median()) if not values.empty else np.nan,
                    }
                )
        group_summary = pd.DataFrame(rows)
        group_summary.to_csv(tables_dir / "group_score_summary.csv", index=False)

    output_h5ad = output_dir / "scored.h5ad"
    adata_out.write_h5ad(output_h5ad)

    basis = choose_basis(adata_out, args.embedding_key)
    generated_figures = plot_embeddings(adata_out, score_columns, basis, figures_dir, args.max_plot_signatures)

    write_report(output_dir / "report.md", args, matrix_source, coverage, score_summary, group_summary, basis)
    result = {
        "skill": SKILL_NAME,
        "input": str(input_path),
        "output": str(output_dir),
        "matrix_source": matrix_source,
        "basis": basis,
        "score_columns": score_columns,
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
