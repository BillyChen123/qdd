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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone scATAC annotation skill with marker and label-evidence support.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--cluster-key", required=True, help="Cluster column in obs.")
    parser.add_argument("--marker-file", default=None, help="Optional CSV/TSV marker file.")
    parser.add_argument("--marker-mode", choices=["auto", "peak", "gene"], default="auto")
    parser.add_argument("--feature-column", default="gene_symbol", help="var column used when marker mode is gene.")
    parser.add_argument("--existing-label-key", default=None, help="Optional existing obs label column for majority-vote evidence.")
    parser.add_argument("--annotation-key", default="cell_type")
    parser.add_argument("--unknown-label", default="unknown")
    parser.add_argument("--min-marker-score", type=float, default=0.15)
    parser.add_argument("--min-label-purity", type=float, default=0.6)
    parser.add_argument("--n-top-features", type=int, default=30)
    parser.add_argument("--rank-method", choices=["wilcoxon", "t-test", "logreg"], default="wilcoxon")
    parser.add_argument("--compute-umap-if-missing", action="store_true", help="Rebuild UMAP from an existing latent representation if needed.")
    parser.set_defaults(compute_umap_if_missing=True)
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_marker_file(marker_path: Path, marker_mode: str) -> tuple[pd.DataFrame, str]:
    if marker_path.suffix.lower() == ".csv":
        frame = pd.read_csv(marker_path)
    else:
        frame = pd.read_csv(marker_path, sep=None, engine="python")
    frame.columns = [str(column).strip().lower() for column in frame.columns]
    if "cell_type" not in frame.columns:
        raise ValueError("Marker file must include a 'cell_type' column.")

    if "features" in frame.columns:
        value_column = "features"
    elif "genes" in frame.columns:
        value_column = "genes"
    elif "peaks" in frame.columns:
        value_column = "peaks"
    else:
        raise ValueError("Marker file must include one of: features, genes, peaks.")

    inferred_mode = marker_mode
    if marker_mode == "auto":
        inferred_mode = "peak" if value_column == "peaks" else "gene" if value_column == "genes" else "peak"

    frame = frame[["cell_type", value_column]].copy()
    frame.rename(columns={value_column: "features"}, inplace=True)
    frame["features"] = frame["features"].fillna("").astype(str)
    return frame, inferred_mode


def resolve_rep_for_umap(adata: sc.AnnData) -> str | None:
    for candidate in ["X_lsi_harmony", "X_lsi", "X_pca"]:
        if candidate in adata.obsm:
            return candidate
    return None


def ensure_umap(adata: sc.AnnData) -> None:
    if "X_umap" in adata.obsm:
        return
    rep = resolve_rep_for_umap(adata)
    if rep is None:
        return
    if "neighbors" not in adata.uns:
        sc.pp.neighbors(adata, use_rep=rep)
    sc.tl.umap(adata)


def save_umap(adata: sc.AnnData, figure_dir: Path, color_key: str, file_name: str) -> None:
    if "X_umap" not in adata.obsm or color_key not in adata.obs.columns:
        return
    coords = adata.obsm["X_umap"]
    categories = adata.obs[color_key].astype("category")
    fig, ax = plt.subplots(figsize=(6, 5))
    for category in categories.cat.categories:
        mask = categories == category
        ax.scatter(coords[mask, 0], coords[mask, 1], s=5, alpha=0.7, label=str(category))
    ax.set_xlabel("UMAP1")
    ax.set_ylabel("UMAP2")
    ax.set_title(f"UMAP by {color_key}")
    if len(categories.cat.categories) <= 15:
        ax.legend(markerscale=3, fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(figure_dir / file_name, dpi=160)
    plt.close(fig)


def build_marker_rankings(adata: sc.AnnData, cluster_key: str, n_top_features: int, rank_method: str) -> pd.DataFrame:
    sc.tl.rank_genes_groups(adata, groupby=cluster_key, method=rank_method, n_genes=n_top_features, use_raw=False)
    groups = list(map(str, adata.obs[cluster_key].astype("category").cat.categories))
    frames: list[pd.DataFrame] = []
    for group in groups:
        frame = sc.get.rank_genes_groups_df(adata, group=group)
        frame["cluster"] = group
        frames.append(frame)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def marker_value_set(feature_series: pd.Series) -> set[str]:
    values = [str(value).strip() for value in feature_series.fillna("").astype(str) if str(value).strip()]
    return set(values)


def score_marker_evidence(
    ranking_df: pd.DataFrame,
    adata: sc.AnnData,
    marker_frame: pd.DataFrame | None,
    marker_mode: str | None,
    feature_column: str,
    n_top_features: int,
) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    if marker_frame is None or marker_mode is None or ranking_df.empty:
        return pd.DataFrame(rows)

    cluster_top = ranking_df.sort_values(["cluster", "scores"], ascending=[True, False]).groupby("cluster", sort=False).head(n_top_features)
    mapped_top = cluster_top.copy()
    if marker_mode == "gene" and feature_column in adata.var.columns:
        mapping = adata.var[feature_column].astype(str).to_dict()
        mapped_top["feature_label"] = mapped_top["names"].map(lambda value: str(mapping.get(value, "")).strip())
    else:
        mapped_top["feature_label"] = mapped_top["names"].astype(str)

    for cluster, frame in mapped_top.groupby("cluster", sort=False):
        top_values = marker_value_set(frame["feature_label"])
        for marker_row in marker_frame.itertuples(index=False):
            marker_values = {value.strip() for value in str(marker_row.features).split(",") if value.strip()}
            if not marker_values:
                continue
            hits = sorted(top_values & marker_values)
            score = len(hits) / len(marker_values)
            rows.append(
                {
                    "cluster": str(cluster),
                    "candidate_label": str(marker_row.cell_type),
                    "source": "marker_file",
                    "score": score,
                    "details": ",".join(hits[:10]),
                }
            )

    return pd.DataFrame(rows)


def score_existing_labels(adata: sc.AnnData, cluster_key: str, label_key: str) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    grouped = adata.obs.groupby(cluster_key, observed=False)
    for cluster, frame in grouped:
        counts = frame[label_key].astype(str).value_counts()
        if counts.empty:
            continue
        top_label = str(counts.index[0])
        purity = float(counts.iloc[0] / counts.sum())
        rows.append(
            {
                "cluster": str(cluster),
                "candidate_label": top_label,
                "source": "existing_labels",
                "score": purity,
                "details": f"n={int(counts.iloc[0])}/{int(counts.sum())}",
            }
        )
    return pd.DataFrame(rows)


def choose_annotations(
    clusters: list[str],
    scores: pd.DataFrame,
    min_marker_score: float,
    min_label_purity: float,
    unknown_label: str,
) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for cluster in clusters:
        cluster_scores = scores[scores["cluster"] == cluster].copy()
        chosen_label = unknown_label
        chosen_source = "none"
        chosen_score = 0.0

        label_scores = cluster_scores[cluster_scores["source"] == "existing_labels"].sort_values("score", ascending=False)
        marker_scores = cluster_scores[cluster_scores["source"] == "marker_file"].sort_values("score", ascending=False)

        if not label_scores.empty and float(label_scores.iloc[0]["score"]) >= min_label_purity:
            chosen_label = str(label_scores.iloc[0]["candidate_label"])
            chosen_source = "existing_labels"
            chosen_score = float(label_scores.iloc[0]["score"])
        elif not marker_scores.empty and float(marker_scores.iloc[0]["score"]) >= min_marker_score:
            chosen_label = str(marker_scores.iloc[0]["candidate_label"])
            chosen_source = "marker_file"
            chosen_score = float(marker_scores.iloc[0]["score"])

        rows.append(
            {
                "cluster": cluster,
                "annotation": chosen_label,
                "source": chosen_source,
                "score": chosen_score,
            }
        )
    return pd.DataFrame(rows)


def save_score_heatmap(scores: pd.DataFrame, figure_path: Path) -> None:
    marker_scores = scores[scores["source"] == "marker_file"].copy()
    if marker_scores.empty:
        return
    pivot = marker_scores.pivot_table(index="cluster", columns="candidate_label", values="score", fill_value=0.0)
    if pivot.empty:
        return
    fig, ax = plt.subplots(figsize=(max(6, pivot.shape[1] * 0.5), max(4, pivot.shape[0] * 0.5)))
    im = ax.imshow(pivot.to_numpy(), aspect="auto", cmap="viridis")
    ax.set_xticks(range(pivot.shape[1]))
    ax.set_xticklabels(pivot.columns, rotation=45, ha="right")
    ax.set_yticks(range(pivot.shape[0]))
    ax.set_yticklabels(pivot.index)
    ax.set_title("Annotation scores from marker evidence")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(figure_path, dpi=160)
    plt.close(fig)


def write_report(report_path: Path, args: argparse.Namespace, annotation_summary: pd.DataFrame) -> None:
    lines = [
        "# scatac-annotation-geneactivity report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Cluster Annotation Summary",
        "",
    ]
    if annotation_summary.empty:
        lines.append("- no annotations assigned")
    else:
        for row in annotation_summary.to_dict(orient="records"):
            lines.append(f"- cluster `{row['cluster']}` -> `{row['annotation']}` via `{row['source']}` score=`{row['score']}`")
    lines.extend(
        [
            "",
            "## Boundary Notes",
            "",
            "- This skill prefers explicit evidence sources and may leave clusters as unknown.",
            "- It does not claim full fragment-native gene activity inference.",
            "",
        ]
    )
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
    if args.cluster_key not in adata.obs.columns:
        raise ValueError(f"cluster key '{args.cluster_key}' not found in adata.obs")
    if args.existing_label_key and args.existing_label_key not in adata.obs.columns:
        raise ValueError(f"existing label key '{args.existing_label_key}' not found in adata.obs")
    if not args.marker_file and not args.existing_label_key:
        raise ValueError("Provide --marker-file or --existing-label-key. Refuse to invent ATAC annotations without evidence.")

    if args.compute_umap_if_missing:
        ensure_umap(adata)

    ranking_df = build_marker_rankings(adata, args.cluster_key, args.n_top_features, args.rank_method)
    ranking_df.to_csv(tables_dir / "marker_rankings.csv", index=False)

    marker_frame = None
    marker_mode = None
    if args.marker_file:
        marker_frame, marker_mode = read_marker_file(Path(args.marker_file).resolve(), args.marker_mode)

    scores = score_marker_evidence(ranking_df, adata, marker_frame, marker_mode, args.feature_column, args.n_top_features)
    if args.existing_label_key:
        scores = pd.concat([scores, score_existing_labels(adata, args.cluster_key, args.existing_label_key)], ignore_index=True)
    scores.to_csv(tables_dir / "annotation_scores.csv", index=False)

    clusters = list(map(str, adata.obs[args.cluster_key].astype("category").cat.categories))
    summary = choose_annotations(clusters, scores, args.min_marker_score, args.min_label_purity, args.unknown_label)
    summary.to_csv(tables_dir / "cluster_annotation_summary.csv", index=False)

    mapping = dict(zip(summary["cluster"], summary["annotation"]))
    adata.obs[args.annotation_key] = adata.obs[args.cluster_key].astype(str).map(mapping).fillna(args.unknown_label)
    adata.write_h5ad(output_dir / "annotated.h5ad")

    save_umap(adata, figures_dir, args.annotation_key, "umap_by_annotation.png")
    save_score_heatmap(scores, figures_dir / "annotation_score_heatmap.png")
    write_report(output_dir / "report.md", args, summary)

    result = {
        "skill": "singlecell/scatac/scatac-annotation-geneactivity",
        "input": str(input_path),
        "output": str(output_dir),
        "annotation_key": args.annotation_key,
        "n_clusters": len(clusters),
        "n_unknown": int((summary["annotation"] == args.unknown_label).sum()),
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
        "generated_figures": sorted(path.name for path in figures_dir.glob("*.png")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
