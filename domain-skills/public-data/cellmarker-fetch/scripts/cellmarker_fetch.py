#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests


SOURCE_NAME = "CellMarker"
ORGANISM_ALIASES = {
    "human": ["human", "homo sapiens"],
    "mouse": ["mouse", "mus musculus"],
}
DOWNLOAD_URLS = {
    "human": [
        "https://bio-bigdata.hrbmu.edu.cn/CellMarker/download/Cell_marker_Human.xlsx",
        "http://bio-bigdata.hrbmu.edu.cn/CellMarker/download/Cell_marker_Human.xlsx",
    ],
    "mouse": [
        "https://bio-bigdata.hrbmu.edu.cn/CellMarker/download/Cell_marker_Mouse.xlsx",
        "http://bio-bigdata.hrbmu.edu.cn/CellMarker/download/Cell_marker_Mouse.xlsx",
    ],
    "all": [
        "https://bio-bigdata.hrbmu.edu.cn/CellMarker/download/Cell_marker_All.xlsx",
        "http://bio-bigdata.hrbmu.edu.cn/CellMarker/download/Cell_marker_All.xlsx",
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch a bounded CellMarker reference table for QDD.")
    parser.add_argument("--output", required=True, help="Study output directory.")
    parser.add_argument("--organism", choices=["human", "mouse", "all"], default="human")
    parser.add_argument("--query", action="append", default=[], help="Repeatable bounded search term.")
    parser.add_argument("--tissue", default=None, help="Optional tissue filter.")
    parser.add_argument("--system", default=None, help="Optional system filter.")
    parser.add_argument("--cell-type", default=None, help="Optional cell-type filter.")
    parser.add_argument("--exact", action="store_true", help="Use exact equality for direct field filters.")
    parser.add_argument("--max-rows", type=int, default=200)
    parser.add_argument("--max-genes-per-label", type=int, default=50)
    parser.add_argument("--note", default="", help="Optional free-text note written to the aggregated output.")
    parser.add_argument("--refresh", action="store_true", help="Force re-download even if the source file already exists locally.")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def dump_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_markdown(path: Path, lines: list[str]) -> None:
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "none"}:
        return ""
    return text


def normalize_column_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def find_column(frame: pd.DataFrame, candidates: list[str]) -> str | None:
    normalized = {normalize_column_name(str(column)): str(column) for column in frame.columns}
    for candidate in candidates:
        match = normalized.get(normalize_column_name(candidate))
        if match:
            return match
    return None


def download_file(urls: list[str], destination: Path, refresh: bool) -> str:
    if destination.exists() and not refresh:
        return "cache"

    last_error: Exception | None = None
    for url in urls:
        try:
            response = requests.get(url, timeout=180)
            response.raise_for_status()
            destination.write_bytes(response.content)
            return url
        except Exception as exc:  # pragma: no cover - network-dependent
            last_error = exc

    raise RuntimeError(f"failed to download CellMarker source to {destination}") from last_error


def split_gene_text(value: Any) -> list[str]:
    text = normalize_text(value)
    if not text:
        return []
    parts = [entry.strip() for entry in re.split(r"[,;|/+]+", text) if entry.strip()]
    return parts


def load_source_frame(path: Path) -> pd.DataFrame:
    frame = pd.read_excel(path)
    if frame.empty:
        raise ValueError("CellMarker source table is empty.")
    return frame


def build_normalized_frame(frame: pd.DataFrame, organism: str) -> tuple[pd.DataFrame, dict[str, str | None]]:
    column_map = {
        "cell_type": find_column(frame, ["cell name", "cellname", "cell type", "celltype", "cell_name"]),
        "tissue": find_column(frame, ["tissue type", "tissuetype", "tissue", "organ"]),
        "system": find_column(frame, ["class", "system", "cancer type", "disease", "category"]),
        "gene": find_column(frame, ["cell marker", "cellmarker", "marker", "markers", "gene", "genes"]),
        "species": find_column(frame, ["species", "organism"]),
        "evidence": find_column(frame, ["pmid", "pubmed id", "evidence", "source"]),
    }

    if column_map["cell_type"] is None or column_map["gene"] is None:
        raise ValueError("Failed to detect CellMarker cell-type or marker-gene columns.")

    rows: list[dict[str, Any]] = []
    for row in frame.to_dict(orient="records"):
        cell_type = normalize_text(row.get(column_map["cell_type"])) if column_map["cell_type"] else ""
        gene_tokens = split_gene_text(row.get(column_map["gene"])) if column_map["gene"] else []
        if not cell_type or not gene_tokens:
            continue
        tissue = normalize_text(row.get(column_map["tissue"])) if column_map["tissue"] else ""
        system = normalize_text(row.get(column_map["system"])) if column_map["system"] else ""
        source_species = normalize_text(row.get(column_map["species"])) if column_map["species"] else ""
        evidence = normalize_text(row.get(column_map["evidence"])) if column_map["evidence"] else ""
        for gene in gene_tokens:
            rows.append(
                {
                    "cell_type": cell_type,
                    "gene": gene,
                    "tissue": tissue,
                    "system": system,
                    "organism": source_species or organism,
                    "evidence": evidence,
                }
            )

    if not rows:
        raise ValueError("No usable CellMarker rows remained after normalization.")

    return pd.DataFrame(rows), column_map


def match_filter(value: str, pattern: str, exact: bool) -> bool:
    value_normalized = normalize_text(value).lower()
    pattern_normalized = normalize_text(pattern).lower()
    if not pattern_normalized:
        return True
    if exact:
        return value_normalized == pattern_normalized
    return pattern_normalized in value_normalized


def filter_frame(frame: pd.DataFrame, args: argparse.Namespace) -> pd.DataFrame:
    if not any([args.query, args.tissue, args.system, args.cell_type]):
        raise ValueError("At least one of --query, --tissue, --system, or --cell-type must be provided for a bounded fetch.")

    filtered = frame.copy()
    if args.organism != "all":
        aliases = ORGANISM_ALIASES.get(args.organism, [args.organism])
        organism_series = filtered["organism"].astype(str).str.lower()
        organism_mask = organism_series.map(lambda value: any(alias in value for alias in aliases))
        filtered = filtered[organism_mask]
    if args.tissue:
        filtered = filtered[filtered["tissue"].map(lambda value: match_filter(value, args.tissue, args.exact))]
    if args.system:
        filtered = filtered[filtered["system"].map(lambda value: match_filter(value, args.system, args.exact))]
    if args.cell_type:
        filtered = filtered[filtered["cell_type"].map(lambda value: match_filter(value, args.cell_type, args.exact))]

    queries = [normalize_text(entry).lower() for entry in args.query if normalize_text(entry)]
    if queries:
        combined = (
            filtered["cell_type"].astype(str)
            + " "
            + filtered["tissue"].astype(str)
            + " "
            + filtered["system"].astype(str)
            + " "
            + filtered["gene"].astype(str)
        ).str.lower()
        for query in queries:
            filtered = filtered[combined.loc[filtered.index].str.contains(re.escape(query), na=False)]

    filtered = filtered.drop_duplicates().reset_index(drop=True)
    if args.max_rows > 0:
        filtered = filtered.head(args.max_rows)
    return filtered


def aggregate_markers(frame: pd.DataFrame, args: argparse.Namespace) -> pd.DataFrame:
    group_columns = ["cell_type", "organism", "tissue"]
    rows: list[dict[str, Any]] = []

    for keys, group in frame.groupby(group_columns, dropna=False):
        genes = []
        seen = set()
        for gene in group["gene"].astype(str):
            gene_normalized = gene.strip()
            if not gene_normalized or gene_normalized in seen:
                continue
            seen.add(gene_normalized)
            genes.append(gene_normalized)
            if args.max_genes_per_label > 0 and len(genes) >= args.max_genes_per_label:
                break

        cell_type, organism, tissue = keys
        rows.append(
            {
                "cell_type": cell_type,
                "genes": ",".join(genes),
                "source": SOURCE_NAME,
                "organism": organism,
                "tissue": tissue,
                "note": args.note,
            }
        )

    aggregated = pd.DataFrame(rows).sort_values(["cell_type", "tissue", "organism"]).reset_index(drop=True)
    if aggregated.empty:
        raise ValueError("No aggregated marker rows were produced.")
    return aggregated


def dataframe_to_markdown(frame: pd.DataFrame, max_rows: int = 12) -> str:
    if frame.empty:
        return "_No rows_"
    sample = frame.head(max_rows).fillna("")
    columns = [str(column) for column in sample.columns]
    lines = [
        "| " + " | ".join(columns) + " |",
        "| " + " | ".join(["---"] * len(columns)) + " |",
    ]
    for row in sample.itertuples(index=False, name=None):
        lines.append("| " + " | ".join(str(value) for value in row) + " |")
    return "\n".join(lines)


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output)
    tables_dir = output_dir / "tables"
    reports_dir = output_dir / "reports"
    tmp_dir = output_dir / "tmp" / "public-data" / "cellmarker"
    ensure_dir(tables_dir)
    ensure_dir(reports_dir)
    ensure_dir(tmp_dir)

    download_name = {
        "human": "Cell_marker_Human.xlsx",
        "mouse": "Cell_marker_Mouse.xlsx",
        "all": "Cell_marker_All.xlsx",
    }[args.organism]
    source_path = tmp_dir / download_name
    download_origin = download_file(DOWNLOAD_URLS[args.organism], source_path, args.refresh)

    raw_frame = load_source_frame(source_path)
    normalized_frame, detected_columns = build_normalized_frame(raw_frame, args.organism)
    matched_frame = filter_frame(normalized_frame, args)
    if matched_frame.empty:
        raise ValueError("No CellMarker rows matched the bounded filters.")
    aggregated_frame = aggregate_markers(matched_frame, args)

    matches_path = tables_dir / "cellmarker_matches.csv"
    selected_path = tables_dir / "markers_selected.csv"
    matched_frame.to_csv(matches_path, index=False)
    aggregated_frame.to_csv(selected_path, index=False)

    retrieved_at = datetime.now(timezone.utc).isoformat()
    result_payload = {
        "source": SOURCE_NAME,
        "organism": args.organism,
        "queries": args.query,
        "tissue": args.tissue,
        "system": args.system,
        "cell_type": args.cell_type,
        "exact": args.exact,
        "max_rows": args.max_rows,
        "max_genes_per_label": args.max_genes_per_label,
        "download_origin": download_origin,
        "source_file": str(source_path),
        "detected_columns": detected_columns,
        "matched_rows": int(len(matched_frame)),
        "selected_labels": int(len(aggregated_frame)),
        "outputs": {
            "matches": str(matches_path),
            "selected": str(selected_path),
        },
        "note": args.note,
        "retrieved_at": retrieved_at,
    }

    report_lines = [
        "# CellMarker Fetch Report",
        "",
        f"- Source: {SOURCE_NAME}",
        f"- Organism: `{args.organism}`",
        f"- Queries: {', '.join(args.query) if args.query else '(none)'}",
        f"- Tissue: {args.tissue or '(none)'}",
        f"- System: {args.system or '(none)'}",
        f"- Cell type: {args.cell_type or '(none)'}",
        f"- Matched rows: {len(matched_frame)}",
        f"- Selected labels: {len(aggregated_frame)}",
        f"- Retrieved at: {retrieved_at}",
        "",
        "## Aggregated Marker Table Preview",
        "",
        dataframe_to_markdown(aggregated_frame),
    ]

    write_markdown(reports_dir / "cellmarker_fetch_report.md", report_lines)
    dump_json(reports_dir / "cellmarker_fetch_result.json", result_payload)


if __name__ == "__main__":
    main()
