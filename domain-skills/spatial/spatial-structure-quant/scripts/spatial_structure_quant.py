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
from scipy.sparse.csgraph import connected_components


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
    parser = argparse.ArgumentParser(description="Spatial connected-structure quantification for AnnData.")
    parser.add_argument("--input", required=True, help="Input h5ad path.")
    parser.add_argument("--output", required=True, help="Output directory.")
    parser.add_argument("--label-key", required=True, help="obs column containing annotation labels.")
    parser.add_argument("--component-labels", required=True, help="Comma-separated labels included in the structure graph.")
    parser.add_argument("--seed-labels", default=None, help="Optional comma-separated labels that must anchor passing components.")
    parser.add_argument("--required-labels", default=None, help="Optional comma-separated labels required in passing components.")
    parser.add_argument("--group-key", default=None)
    parser.add_argument("--section-key", default=None)
    parser.add_argument("--spatial-obsm-key", default="auto")
    parser.add_argument("--x-key", default=None)
    parser.add_argument("--y-key", default=None)
    parser.add_argument("--graph-method", choices=["knn", "radius"], default="knn")
    parser.add_argument("--n-neighbors", type=int, default=8)
    parser.add_argument("--radius", type=float, default=None)
    parser.add_argument("--min-size", type=int, default=1)
    parser.add_argument("--min-seed-count", type=int, default=1)
    parser.add_argument("--min-required-count", type=int, default=1)
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def parse_label_set(value: str | None) -> set[str] | None:
    if value is None:
        return None
    labels = {item.strip() for item in value.split(",") if item.strip()}
    return labels or None


def validate_obs_key(adata: AnnData, key: str | None, role: str) -> None:
    if key and key not in adata.obs.columns:
        raise ValueError(f"{role} key '{key}' not found in adata.obs")


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


def squidpy_graph(points: np.ndarray, args: argparse.Namespace) -> csr_matrix:
    import squidpy as sq

    section = AnnData(X=np.zeros((points.shape[0], 0)))
    section.obsm["spatial"] = points
    kwargs: dict[str, Any] = {"coord_type": "generic"}
    if args.graph_method == "radius":
        if args.radius is None:
            raise ValueError("--radius is required when --graph-method radius")
        kwargs["radius"] = args.radius
    else:
        kwargs["n_neighs"] = args.n_neighbors
    sq.gr.spatial_neighbors(section, **kwargs)
    return section.obsp["spatial_connectivities"].tocsr()


def build_graph(points: np.ndarray, args: argparse.Namespace, backend_used: str) -> csr_matrix:
    if backend_used != "squidpy":
        raise ValueError(f"Unsupported backend: {backend_used}")
    return squidpy_graph(points, args)


def component_passes(labels: pd.Series, seed_labels: set[str] | None, required_labels: set[str] | None, args: argparse.Namespace) -> tuple[bool, int, dict[str, int]]:
    label_counts = labels.astype(str).value_counts().to_dict()
    seed_count = 0
    if seed_labels is not None:
        seed_count = sum(int(label_counts.get(label, 0)) for label in seed_labels)
        if seed_count < args.min_seed_count:
            return False, seed_count, label_counts
    if required_labels is not None:
        for label in required_labels:
            if int(label_counts.get(label, 0)) < args.min_required_count:
                return False, seed_count, label_counts
    if int(labels.shape[0]) < args.min_size:
        return False, seed_count, label_counts
    return True, seed_count, label_counts


def quantify_structures(adata: AnnData, coords: pd.DataFrame, args: argparse.Namespace) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, BackendState]:
    component_labels = parse_label_set(args.component_labels) or set()
    seed_labels = parse_label_set(args.seed_labels)
    required_labels = parse_label_set(args.required_labels)
    labels = adata.obs[args.label_key].astype("string").fillna("missing")
    groups = adata.obs[args.group_key].astype("string").fillna("all") if args.group_key else pd.Series("all", index=adata.obs_names, dtype="string")
    sections = adata.obs[args.section_key].astype("string").fillna("all") if args.section_key else pd.Series("all", index=adata.obs_names, dtype="string")
    coord_numeric = coords.apply(pd.to_numeric, errors="coerce")
    valid = coord_numeric.notna().all(axis=1) & labels.astype(str).isin(component_labels)

    notes: list[str] = []
    try:
        import squidpy as sq  # noqa: F401
    except ModuleNotFoundError as error:
        raise ModuleNotFoundError("squidpy is required for spatial structure quantification in qdd-skill-core.") from error
    backend_used = "squidpy"

    component_rows: list[dict[str, Any]] = []
    assignment_rows: list[dict[str, Any]] = []
    component_counter = 0

    for section_value, section_index in sections[valid].groupby(sections[valid]).groups.items():
        obs_names = pd.Index(section_index)
        if obs_names.empty:
            continue
        section_coords = coord_numeric.loc[obs_names, ["x", "y"]].to_numpy(dtype=float)
        graph = build_graph(section_coords, args, backend_used)
        n_components, comp_labels = connected_components(graph, directed=False, connection="weak")
        roots: dict[int, list[int]] = {}
        for local_i, comp_id in enumerate(comp_labels):
            roots.setdefault(int(comp_id), []).append(local_i)

        for local_indices in roots.values():
            comp_obs = obs_names[local_indices]
            comp_cell_labels = labels.loc[comp_obs].astype(str)
            passes, seed_count, label_counts = component_passes(comp_cell_labels, seed_labels, required_labels, args)
            comp_coords = coord_numeric.loc[comp_obs, ["x", "y"]]
            group_counts = groups.loc[comp_obs].astype(str).value_counts()
            group_value = str(group_counts.index[0]) if len(group_counts) else "all"
            component_id = f"C{component_counter:06d}"
            component_counter += 1
            component_rows.append(
                {
                    "component_id": component_id,
                    "section": str(section_value),
                    "group": group_value,
                    "n_obs": int(len(comp_obs)),
                    "passes_filters": bool(passes),
                    "seed_count": int(seed_count),
                    "label_counts_json": json.dumps({str(k): int(v) for k, v in label_counts.items()}, sort_keys=True),
                    "centroid_x": float(comp_coords["x"].mean()),
                    "centroid_y": float(comp_coords["y"].mean()),
                    "x_min": float(comp_coords["x"].min()),
                    "x_max": float(comp_coords["x"].max()),
                    "y_min": float(comp_coords["y"].min()),
                    "y_max": float(comp_coords["y"].max()),
                }
            )
            for obs_name in comp_obs:
                assignment_rows.append(
                    {
                        "obs_name": str(obs_name),
                        "component_id": component_id,
                        "section": str(section_value),
                        "group": str(groups.loc[obs_name]),
                        "label": str(labels.loc[obs_name]),
                    }
                )

    components = pd.DataFrame(component_rows)
    assignments = pd.DataFrame(assignment_rows)
    if components.empty:
        group_summary = pd.DataFrame()
    else:
        group_summary = (
            components.groupby(["group", "section"], dropna=False)
            .agg(
                n_components=("component_id", "count"),
                n_passing_components=("passes_filters", "sum"),
                median_component_size=("n_obs", "median"),
                max_component_size=("n_obs", "max"),
            )
            .reset_index()
        )
    backend_state = BackendState(requested="squidpy", used=backend_used, notes=notes)
    return components, assignments, group_summary, backend_state


def plot_components(components: pd.DataFrame, assignments: pd.DataFrame, coords: pd.DataFrame, output_path: Path) -> bool:
    if components.empty or assignments.empty:
        return False
    passing = set(components.loc[components["passes_filters"], "component_id"].astype(str))
    frame = assignments.loc[assignments["component_id"].astype(str).isin(passing)].set_index("obs_name").join(coords, how="left")
    frame = frame.dropna(subset=["x", "y"])
    if frame.empty:
        return False
    if frame.shape[0] > 25000:
        frame = frame.sample(n=25000, random_state=1)
    categories = frame["component_id"].astype("category")
    fig, ax = plt.subplots(figsize=(6, 5))
    if len(categories.cat.categories) <= 40:
        for component_id in categories.cat.categories:
            mask = categories == component_id
            ax.scatter(frame.loc[mask, "x"], frame.loc[mask, "y"], s=4, alpha=0.7)
    else:
        ax.scatter(frame["x"], frame["y"], s=4, alpha=0.7, color="#4C78A8")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title("Passing spatial components")
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
    group_summary: pd.DataFrame,
) -> None:
    lines = [
        "# spatial-structure-quant report",
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
    validate_obs_key(adata, args.label_key, "label")
    validate_obs_key(adata, args.group_key, "group")
    validate_obs_key(adata, args.section_key, "section")
    coordinate_state, coords = find_coordinates(adata, args)
    if coords is None:
        raise ValueError("No usable spatial coordinates found.")

    components, assignments, group_summary, backend_state = quantify_structures(adata, coords, args)
    components.to_csv(tables_dir / "component_summary.csv", index=False)
    assignments.to_csv(tables_dir / "component_assignments.csv", index=False)
    group_summary.to_csv(tables_dir / "group_summary.csv", index=False)

    generated_figures: list[str] = []
    if plot_components(components, assignments, coords, figures_dir / "spatial_components.png"):
        generated_figures.append("spatial_components.png")

    write_report(output_dir / "report.md", args, coordinate_state, backend_state, group_summary)
    n_passing = int(components["passes_filters"].sum()) if "passes_filters" in components.columns else 0
    result = {
        "skill": "spatial/spatial-structure-quant",
        "input": str(input_path),
        "output": str(output_dir),
        "backend": asdict(backend_state),
        "graph_method": args.graph_method,
        "n_components": int(components.shape[0]),
        "n_passing_components": n_passing,
        "coordinate_state": asdict(coordinate_state),
        "generated_figures": generated_figures,
        "generated_tables": sorted(f"tables/{path.name}" for path in tables_dir.glob("*.csv")),
    }
    (output_dir / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
