#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from anndata import AnnData
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scanpy as sc
from scipy.sparse import csr_matrix


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


@dataclass
class BackendState:
    requested: str
    used: str | None
    notes: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Spatial kNN neighborhood and co-localization analysis for AnnData.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--mode", choices=["inspect", "auto", "assisted"], default="auto")
    parser.add_argument("--annotation-key", required=True, help="obs column containing annotation or population labels.")
    parser.add_argument("--neighbor-labels", default=None, help="Comma-separated labels counted as positive neighbors.")
    parser.add_argument("--target-labels", default=None, help="Optional comma-separated focal labels to summarize.")
    parser.add_argument("--group-key", default=None, help="Optional obs column for condition/time summaries.")
    parser.add_argument("--section-key", default=None, help="Optional obs column used to build neighborhoods within sections.")
    parser.add_argument("--spatial-obsm-key", default="auto", help="Coordinate obsm key, or auto.")
    parser.add_argument("--x-key", default=None, help="obs x coordinate column.")
    parser.add_argument("--y-key", default=None, help="obs y coordinate column.")
    parser.add_argument("--n-neighbors", type=int, default=15)
    parser.add_argument("--max-distance", type=float, default=None, help="Optional maximum neighbor distance.")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def parse_label_set(value: str | None) -> set[str] | None:
    if value is None:
        return None
    labels = {item.strip() for item in value.split(",") if item.strip()}
    return labels or None


def coordinate_from_obsm(adata: AnnData, key: str) -> tuple[pd.Series, pd.Series] | None:
    if key not in adata.obsm:
        return None
    coords = np.asarray(adata.obsm[key])
    if coords.ndim != 2 or coords.shape[1] < 2:
        return None
    x = pd.Series(coords[:, 0], index=adata.obs_names, name=f"{key}_1")
    y = pd.Series(coords[:, 1], index=adata.obs_names, name=f"{key}_2")
    return x, y


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


def find_coordinates(adata: AnnData, args: argparse.Namespace) -> tuple[CoordinateState, pd.DataFrame | None]:
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

    preferred = ["spatial", "X_spatial", "X_spatial_coords", "coords", "coordinates", "X_xy"]
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


def validate_obs_key(adata: AnnData, key: str | None, role: str) -> None:
    if key and key not in adata.obs.columns:
        raise ValueError(f"{role} key '{key}' not found in adata.obs")


def get_section_values(adata: AnnData, section_key: str | None) -> pd.Series:
    if section_key is None:
        return pd.Series("all", index=adata.obs_names, dtype="string")
    return adata.obs[section_key].astype("string").fillna("missing")


def squidpy_graph(points: np.ndarray, n_neighbors: int) -> tuple[csr_matrix, csr_matrix]:
    import squidpy as sq

    section = AnnData(X=np.zeros((points.shape[0], 0)))
    section.obsm["spatial"] = points
    sq.gr.spatial_neighbors(section, coord_type="generic", n_neighs=n_neighbors)
    connectivities = section.obsp["spatial_connectivities"].tocsr()
    distances = section.obsp["spatial_distances"].tocsr()
    return connectivities, distances


def build_graph(points: np.ndarray, args: argparse.Namespace, backend_used: str) -> tuple[csr_matrix, csr_matrix]:
    if backend_used != "squidpy":
        raise ValueError(f"Unsupported backend: {backend_used}")
    return squidpy_graph(points, args.n_neighbors)


def sorted_neighbors(connectivities: csr_matrix, distances: csr_matrix, focal_index: int, max_distance: float | None, n_neighbors: int) -> list[int]:
    conn_row = connectivities.getrow(focal_index)
    if conn_row.nnz == 0:
        return []
    dist_row = distances.getrow(focal_index)
    dist_map = {int(col): float(dist) for col, dist in zip(dist_row.indices, dist_row.data)}
    pairs: list[tuple[float, int]] = []
    for neighbor_index in conn_row.indices:
        neighbor_index = int(neighbor_index)
        if neighbor_index == focal_index:
            continue
        dist = dist_map.get(neighbor_index, float("inf"))
        if max_distance is not None and np.isfinite(dist) and dist > max_distance:
            continue
        pairs.append((dist, neighbor_index))
    pairs.sort(key=lambda item: (item[0], item[1]))
    return [neighbor_index for _, neighbor_index in pairs[:n_neighbors]]


def compute_neighborhoods(
    adata: AnnData,
    coords: pd.DataFrame,
    args: argparse.Namespace,
    positive_labels: set[str] | None,
    target_labels: set[str] | None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, BackendState]:
    labels = adata.obs[args.annotation_key].astype("string").fillna("missing")
    groups = adata.obs[args.group_key].astype("string").fillna("missing") if args.group_key else pd.Series("all", index=adata.obs_names, dtype="string")
    sections = get_section_values(adata, args.section_key)
    coord_numeric = coords.apply(pd.to_numeric, errors="coerce")
    valid_coord = coord_numeric.notna().all(axis=1)

    notes: list[str] = []
    try:
        import squidpy as sq  # noqa: F401
    except ModuleNotFoundError as error:
        raise ModuleNotFoundError("squidpy is required for spatial neighborhood analysis in qdd-skill-core.") from error
    backend_used = "squidpy"

    score_rows: list[dict[str, Any]] = []
    composition_counts: dict[tuple[str, str, str], int] = {}
    composition_totals: dict[tuple[str, str], int] = {}

    for section_value, section_index in sections[valid_coord].groupby(sections[valid_coord]).groups.items():
        obs_names = pd.Index(section_index)
        if len(obs_names) <= 1:
            continue
        section_coords = coord_numeric.loc[obs_names, ["x", "y"]].to_numpy(dtype=float)
        connectivities, distances = build_graph(section_coords, args, backend_used)

        for local_i, obs_name in enumerate(obs_names):
            focal_label = str(labels.loc[obs_name])
            if target_labels is not None and focal_label not in target_labels:
                continue
            neighbor_local = sorted_neighbors(connectivities, distances, local_i, args.max_distance, args.n_neighbors)
            neighbor_labels = [str(labels.loc[obs_names[int(local_j)]]) for local_j in neighbor_local]
            n_found = len(neighbor_labels)

            if positive_labels is None:
                positive_fraction = float("nan")
            else:
                positive_count = sum(label in positive_labels for label in neighbor_labels)
                positive_fraction = positive_count / n_found if n_found else float("nan")

            group_value = str(groups.loc[obs_name])
            score_rows.append(
                {
                    "obs_name": str(obs_name),
                    "section": str(section_value),
                    "group": group_value,
                    "focal_label": focal_label,
                    "n_neighbors_found": n_found,
                    "positive_neighbor_fraction": positive_fraction,
                }
            )
            total_key = (group_value, focal_label)
            composition_totals[total_key] = composition_totals.get(total_key, 0) + n_found
            for neighbor_label in neighbor_labels:
                key = (group_value, focal_label, neighbor_label)
                composition_counts[key] = composition_counts.get(key, 0) + 1

    scores = pd.DataFrame(score_rows)
    if scores.empty:
        group_summary = pd.DataFrame()
    else:
        group_summary = (
            scores.groupby(["group", "focal_label"], dropna=False)
            .agg(
                n_focal=("obs_name", "count"),
                mean_positive_neighbor_fraction=("positive_neighbor_fraction", "mean"),
                median_positive_neighbor_fraction=("positive_neighbor_fraction", "median"),
                mean_neighbors_found=("n_neighbors_found", "mean"),
            )
            .reset_index()
        )

    composition_rows: list[dict[str, Any]] = []
    for (group_value, focal_label, neighbor_label), count in composition_counts.items():
        total = composition_totals.get((group_value, focal_label), 0)
        composition_rows.append(
            {
                "group": group_value,
                "focal_label": focal_label,
                "neighbor_label": neighbor_label,
                "neighbor_edges": count,
                "neighbor_fraction": count / max(1, total),
            }
        )
    composition = (
        pd.DataFrame(composition_rows).sort_values(
            ["group", "focal_label", "neighbor_fraction"],
            ascending=[True, True, False],
        )
        if composition_rows
        else pd.DataFrame()
    )
    backend_state = BackendState(requested="squidpy", used=backend_used, notes=notes)
    return scores, group_summary, composition, backend_state


def plot_group_summary(group_summary: pd.DataFrame, output_path: Path) -> bool:
    if group_summary.empty or "mean_positive_neighbor_fraction" not in group_summary.columns:
        return False
    frame = group_summary.copy()
    if frame.shape[0] > 80:
        return False
    labels = frame["group"].astype(str) + " / " + frame["focal_label"].astype(str)
    fig, ax = plt.subplots(figsize=(max(6, frame.shape[0] * 0.45), 4))
    ax.bar(labels, frame["mean_positive_neighbor_fraction"].fillna(0.0))
    ax.set_ylabel("Mean positive neighbor fraction")
    ax.tick_params(axis="x", rotation=45)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def plot_spatial_scores(scores: pd.DataFrame, coords: pd.DataFrame, output_path: Path) -> bool:
    if scores.empty or "positive_neighbor_fraction" not in scores.columns:
        return False
    frame = scores.set_index("obs_name").join(coords, how="left")
    frame = frame.dropna(subset=["x", "y", "positive_neighbor_fraction"])
    if frame.empty:
        return False
    if frame.shape[0] > 25000:
        frame = frame.sample(n=25000, random_state=1)
    fig, ax = plt.subplots(figsize=(6, 5))
    scatter = ax.scatter(frame["x"], frame["y"], c=frame["positive_neighbor_fraction"], s=3, cmap="viridis", vmin=0, vmax=1)
    fig.colorbar(scatter, ax=ax, label="Positive neighbor fraction")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title("Spatial neighborhood score")
    ax.set_aspect("equal", adjustable="box")
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def write_report(
    report_path: Path,
    args: argparse.Namespace,
    coordinate_state: CoordinateState,
    backend_state: BackendState,
    label_counts: pd.DataFrame,
    group_summary: pd.DataFrame,
    positive_labels: set[str] | None,
    target_labels: set[str] | None,
) -> None:
    lines = [
        "# spatial-neighborhood-analysis report",
        "",
        "## Parameters",
        "",
        "```json",
        json.dumps(vars(args), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Coordinate State",
        "",
        "```json",
        json.dumps(asdict(coordinate_state), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Backend",
        "",
        "```json",
        json.dumps(asdict(backend_state), indent=2, ensure_ascii=False),
        "```",
        "",
        "## Label Sets",
        "",
        f"- positive neighbor labels: `{sorted(positive_labels) if positive_labels is not None else None}`",
        f"- target focal labels: `{sorted(target_labels) if target_labels is not None else None}`",
        "",
        "## Label Counts",
        "",
        dataframe_to_markdown(label_counts),
        "",
        "## Group Summary",
        "",
        dataframe_to_markdown(group_summary),
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
    validate_obs_key(adata, args.annotation_key, "annotation")
    validate_obs_key(adata, args.group_key, "group")
    validate_obs_key(adata, args.section_key, "section")
    coordinate_state, coords = find_coordinates(adata, args)
    if coords is None:
        raise ValueError("No usable spatial coordinates found.")

    label_counts = (
        adata.obs[args.annotation_key]
        .astype("string")
        .fillna("missing")
        .value_counts(dropna=False)
        .rename_axis(args.annotation_key)
        .reset_index(name="n_obs")
    )
    label_counts.to_csv(tables_dir / "label_counts.csv", index=False)

    positive_labels = parse_label_set(args.neighbor_labels)
    target_labels = parse_label_set(args.target_labels)

    if args.mode == "inspect":
        scores = pd.DataFrame()
        group_summary = pd.DataFrame()
        composition = pd.DataFrame()
        backend_state = BackendState(requested="squidpy", used=None, notes=[])
    else:
        scores, group_summary, composition, backend_state = compute_neighborhoods(
            adata,
            coords,
            args,
            positive_labels,
            target_labels,
        )

    scores.to_csv(tables_dir / "neighborhood_scores.csv", index=False)
    group_summary.to_csv(tables_dir / "group_summary.csv", index=False)
    composition.to_csv(tables_dir / "neighbor_composition.csv", index=False)

    generated_figures: list[str] = []
    if plot_group_summary(group_summary, figures_dir / "group_score_barplot.png"):
        generated_figures.append("group_score_barplot.png")
    if plot_spatial_scores(scores, coords, figures_dir / "spatial_score_overview.png"):
        generated_figures.append("spatial_score_overview.png")

    write_report(
        output_dir / "report.md",
        args,
        coordinate_state,
        backend_state,
        label_counts,
        group_summary,
        positive_labels,
        target_labels,
    )
    result = {
        "skill": "spatial/spatial-neighborhood-analysis",
        "input": str(input_path),
        "output": str(output_dir),
        "mode": args.mode,
        "annotation_key": args.annotation_key,
        "coordinate_state": asdict(coordinate_state),
        "backend": asdict(backend_state),
        "positive_neighbor_labels": sorted(positive_labels) if positive_labels is not None else None,
        "target_labels": sorted(target_labels) if target_labels is not None else None,
        "n_score_rows": int(scores.shape[0]),
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
