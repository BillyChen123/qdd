#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("PyYAML is required for cellxgene_discover.py") from exc


@dataclass
class Candidate:
    dataset_id: str
    dataset_title: str
    collection_name: str
    collection_doi: str
    citation: str
    cell_count: int
    matched_fields: list[str]
    score: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone CELLxGENE search/download skill for QDD.")
    parser.add_argument("--action", choices=["search", "download"], required=True)
    parser.add_argument("--request", required=True, help="Path to public_data_request.yaml")
    parser.add_argument("--output", required=True, help="Study output directory")
    parser.add_argument("--artifact-data-dir", required=True, help="artifacts/data directory")
    parser.add_argument("--max-results", type=int, default=None)
    parser.add_argument("--allow-non-primary", action="store_true", help="Include non-primary data in metadata search results")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a YAML object.")
    return data


def dump_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def sanitize_alias(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("_.-")
    return cleaned or "cellxgene_dataset"


def write_markdown(path: Path, lines: list[str]) -> None:
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def normalize_constraints(payload: dict[str, Any]) -> dict[str, Any]:
    constraints = payload.get("constraints")
    if isinstance(constraints, dict):
        return dict(constraints)

    legacy_query = payload.get("query")
    if isinstance(legacy_query, dict):
        return {key: value for key, value in legacy_query.items() if key != "max_results"}

    raise ValueError("public_data_request.yaml must define constraints or legacy query.")


def normalize_source_query(payload: dict[str, Any]) -> dict[str, Any]:
    source_query = payload.get("source_query")
    if isinstance(source_query, dict):
        return dict(source_query)

    legacy_query = payload.get("query")
    if isinstance(legacy_query, dict):
        max_results = legacy_query.get("max_results")
        return {"max_results": max_results} if max_results is not None else {}

    return {}


def load_request(path: Path) -> dict[str, Any]:
    payload = load_yaml(path)
    if normalize_text(payload.get("source")).lower() != "cellxgene":
        raise ValueError("public_data_request.yaml source must be 'cellxgene'.")
    modality = normalize_text(payload.get("modality")).lower()
    if modality not in {"scrna", "spatial"}:
        raise ValueError("public_data_request.yaml modality must be 'scrna' or 'spatial' for cellxgene_discover.")
    if not isinstance(payload.get("selected", []), list):
        raise ValueError("public_data_request.yaml selected must be a list.")
    normalize_constraints(payload)
    return payload


def optional_import_cellxgene() -> tuple[Any, Any]:
    try:
        import cellxgene_census  # type: ignore
        import pandas as pd  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "cellxgene_census and pandas are required for this skill. Install them in the configured python environment."
        ) from exc
    return cellxgene_census, pd


def build_candidate_from_row(row: dict[str, Any], constraints: dict[str, Any]) -> Candidate:
    matched_fields: list[str] = []
    score = 0

    for field_name in ["organism", "tissue", "disease", "cell_type"]:
        query_value = normalize_text(constraints.get(field_name)).lower()
        row_value = normalize_text(row.get(field_name)).lower()
        if query_value and row_value and query_value == row_value:
            matched_fields.append(field_name)
            score += 3

    state_value = normalize_text(constraints.get("state")).lower()
    title_value = normalize_text(row.get("dataset_title")).lower()
    citation_value = normalize_text(row.get("citation")).lower()
    collection_value = normalize_text(row.get("collection_name")).lower()

    if state_value:
        if state_value in title_value:
            matched_fields.append("title-match")
            score += 2
        if state_value in citation_value or state_value in collection_value:
            matched_fields.append("citation")
            score += 1

    dataset_title = normalize_text(row.get("dataset_title"))
    collection_name = normalize_text(row.get("collection_name"))
    collection_doi = normalize_text(row.get("collection_doi"))
    citation = normalize_text(row.get("citation"))
    cell_count = int(row.get("dataset_total_cell_count") or 0)

    if dataset_title:
        score += 1
    if citation or collection_doi:
        score += 1

    return Candidate(
        dataset_id=normalize_text(row.get("dataset_id")),
        dataset_title=dataset_title,
        collection_name=collection_name,
        collection_doi=collection_doi,
        citation=citation,
        cell_count=cell_count,
        matched_fields=matched_fields,
        score=score,
    )


def search_action(args: argparse.Namespace, request_path: Path, output_dir: Path) -> None:
    cellxgene_census, _ = optional_import_cellxgene()
    request = load_request(request_path)
    constraints = normalize_constraints(request)
    source_query = normalize_source_query(request)
    max_results = args.max_results or int(source_query.get("max_results") or 5)
    if max_results < 1:
        raise ValueError("--max-results must be >= 1.")

    tables_dir = output_dir / "tables"
    reports_dir = output_dir / "reports"
    ensure_dir(tables_dir)
    ensure_dir(reports_dir)

    census = cellxgene_census.open_soma()
    try:
        datasets_df = census["census_info"]["datasets"].read().concat().to_pandas()
        organism = normalize_text(constraints.get("organism")) or "Homo sapiens"
        value_filters: list[str] = []
        for field_name in ["tissue", "disease", "cell_type"]:
            value = normalize_text(constraints.get(field_name))
            if value:
                escaped_value = value.replace("'", "\\'")
                value_filters.append(f"{field_name} == '{escaped_value}'")
        if not args.allow_non_primary:
            value_filters.append("is_primary_data == True")

        obs_df = cellxgene_census.get_obs(
            census,
            organism=organism,
            value_filter=" and ".join(value_filters) if value_filters else None,
            column_names=["dataset_id", "tissue", "disease", "cell_type", "is_primary_data"],
        )
    finally:
        census.close()

    if obs_df.empty:
        candidates: list[Candidate] = []
    else:
        grouped = obs_df.groupby("dataset_id").agg(
            tissue=("tissue", lambda series: "; ".join(sorted({normalize_text(v) for v in series if normalize_text(v)}))),
            disease=("disease", lambda series: "; ".join(sorted({normalize_text(v) for v in series if normalize_text(v)}))),
            cell_type=("cell_type", lambda series: "; ".join(sorted({normalize_text(v) for v in series if normalize_text(v)})[:5])),
        ).reset_index()
        merged = grouped.merge(
            datasets_df[["dataset_id", "dataset_title", "collection_name", "collection_doi", "citation", "dataset_total_cell_count"]],
            on="dataset_id",
            how="left",
        )

        candidates = [build_candidate_from_row(row, constraints) for row in merged.to_dict(orient="records")]
        candidates.sort(key=lambda item: (-item.score, -item.cell_count, item.dataset_title.lower()))
        candidates = candidates[:max_results]

    csv_path = tables_dir / "cellxgene_candidates.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "dataset_id",
                "dataset_title",
                "collection_name",
                "collection_doi",
                "citation",
                "cell_count",
                "matched_fields",
                "score",
            ],
        )
        writer.writeheader()
        for candidate in candidates:
            writer.writerow(
                {
                    "dataset_id": candidate.dataset_id,
                    "dataset_title": candidate.dataset_title,
                    "collection_name": candidate.collection_name,
                    "collection_doi": candidate.collection_doi,
                    "citation": candidate.citation,
                    "cell_count": candidate.cell_count,
                    "matched_fields": ",".join(candidate.matched_fields),
                    "score": candidate.score,
                }
            )

    result_payload = {
        "action": "search",
        "request": str(request_path),
        "constraints": constraints,
        "source_query": source_query,
        "max_results": max_results,
        "candidate_count": len(candidates),
        "candidates": [
            {
                "dataset_id": candidate.dataset_id,
                "dataset_title": candidate.dataset_title,
                "collection_name": candidate.collection_name,
                "collection_doi": candidate.collection_doi,
                "citation": candidate.citation,
                "cell_count": candidate.cell_count,
                "matched_fields": candidate.matched_fields,
                "score": candidate.score,
            }
            for candidate in candidates
        ],
    }
    dump_json(reports_dir / "cellxgene_search_result.json", result_payload)

    report_lines = [
        "# cellxgene search report",
        "",
        "## Request",
        "",
        "```yaml",
        yaml.safe_dump(request, sort_keys=False, allow_unicode=True).rstrip(),
        "```",
        "",
        "## Candidates",
        "",
    ]
    if candidates:
        report_lines.extend(
            [
                f"- `{candidate.dataset_id}` | {candidate.dataset_title or 'untitled'} | {candidate.collection_name or 'no collection'} | score={candidate.score} | cells={candidate.cell_count}"
                for candidate in candidates
            ]
        )
    else:
        report_lines.append("- No candidates found from the structured query.")
    write_markdown(reports_dir / "cellxgene_search_report.md", report_lines)


def download_action(args: argparse.Namespace, request_path: Path, output_dir: Path, artifact_data_dir: Path) -> None:
    cellxgene_census, _ = optional_import_cellxgene()
    request = load_request(request_path)
    selected = request.get("selected", [])
    if not selected:
        raise ValueError("public_data_request.yaml selected is empty. Planning must finalize selected datasets before download.")
    if len(selected) > 2:
        raise ValueError("public_data_request.yaml selected must stay small. Expected at most 2 selected datasets.")

    reports_dir = output_dir / "reports"
    ensure_dir(reports_dir)
    ensure_dir(artifact_data_dir)

    downloaded: list[dict[str, str]] = []
    for entry in selected:
        if not isinstance(entry, dict):
            raise ValueError("Each selected entry must be an object.")
        dataset_id = normalize_text(entry.get("dataset_id"))
        alias = sanitize_alias(normalize_text(entry.get("alias")) or dataset_id)
        if not dataset_id:
            raise ValueError("Each selected entry must define dataset_id.")
        target_path = artifact_data_dir / f"{alias}.h5ad"
        cellxgene_census.download_source_h5ad(dataset_id=dataset_id, to_path=str(target_path))
        downloaded.append(
            {
                "dataset_id": dataset_id,
                "alias": alias,
                "path": str(target_path),
            }
        )

    payload = {
        "action": "download",
        "request": str(request_path),
        "downloaded": downloaded,
    }
    dump_json(reports_dir / "cellxgene_download_result.json", payload)

    report_lines = [
        "# cellxgene download report",
        "",
        "## Selected Targets",
        "",
    ]
    report_lines.extend([f"- `{entry['dataset_id']}` -> `{entry['path']}`" for entry in downloaded])
    write_markdown(reports_dir / "cellxgene_download_report.md", report_lines)


def main() -> None:
    args = parse_args()
    request_path = Path(args.request).resolve()
    output_dir = Path(args.output).resolve()
    artifact_data_dir = Path(args.artifact_data_dir).resolve()
    ensure_dir(output_dir)

    if args.action == "search":
        search_action(args, request_path, output_dir)
        return

    if args.action == "download":
        download_action(args, request_path, output_dir, artifact_data_dir)
        return

    raise ValueError(f"Unsupported action: {args.action}")


if __name__ == "__main__":
    main()
