#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import pyreadr
import requests


SOURCES: dict[str, dict[str, dict[str, str]]] = {
    "celltalkdb": {
        "human": {
            "url": "https://raw.githubusercontent.com/ZJUFanLab/CellTalkDB/master/database/human_lr_pair.rds",
            "format": "rds",
        },
        "mouse": {
            "url": "https://raw.githubusercontent.com/ZJUFanLab/CellTalkDB/master/database/mouse_lr_pair.rds",
            "format": "rds",
        },
    },
    "cellchatdb": {
        "human": {
            "url": "https://raw.githubusercontent.com/jinworks/CellChat/main/data/CellChatDB.human.rda",
            "format": "rda",
        },
        "mouse": {
            "url": "https://raw.githubusercontent.com/jinworks/CellChat/main/data/CellChatDB.mouse.rda",
            "format": "rda",
        },
        "zebrafish": {
            "url": "https://raw.githubusercontent.com/jinworks/CellChat/main/data/CellChatDB.zebrafish.rda",
            "format": "rda",
        },
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch a bounded public ligand-receptor table for QDD.")
    parser.add_argument("--output", required=True, help="Study output directory.")
    parser.add_argument("--source", choices=["celltalkdb", "cellchatdb"], default="celltalkdb")
    parser.add_argument("--organism", choices=["human", "mouse", "zebrafish"], default="human")
    parser.add_argument("--query", action="append", default=[], help="Repeatable bounded search term.")
    parser.add_argument("--category", default=None, help="Optional category or annotation filter.")
    parser.add_argument("--pathway", default=None, help="Optional pathway filter.")
    parser.add_argument("--exact", action="store_true", help="Use exact equality for direct field filters.")
    parser.add_argument("--max-rows", type=int, default=500)
    parser.add_argument("--note", default="", help="Optional free-text note written to the output.")
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


def download_file(url: str, destination: Path, refresh: bool) -> str:
    if destination.exists() and not refresh:
        return "cache"

    response = requests.get(url, timeout=180)
    response.raise_for_status()
    destination.write_bytes(response.content)
    return url


def read_r_object(path: Path) -> dict[str, Any]:
    result = pyreadr.read_r(str(path))
    if not result:
        raise ValueError(f"No readable objects were found in {path}.")
    return dict(result)


def first_dataframe(payload: dict[str, Any]) -> pd.DataFrame:
    for value in payload.values():
        if isinstance(value, pd.DataFrame):
            return value
    raise ValueError("No dataframe object was found in the R data payload.")


def normalize_celltalkdb(payload: dict[str, Any], organism: str) -> tuple[pd.DataFrame, dict[str, str | None]]:
    frame = first_dataframe(payload).copy()
    column_map = {
        "ligand_symbol": find_column(frame, ["ligand_gene_symbol", "ligand_symbol", "ligand"]),
        "receptor_symbol": find_column(frame, ["receptor_gene_symbol", "receptor_symbol", "receptor"]),
        "ligand_raw": find_column(frame, ["ligand"]),
        "receptor_raw": find_column(frame, ["receptor"]),
        "evidence_count": find_column(frame, ["count", "evidence_count"]),
    }

    if column_map["ligand_symbol"] is None or column_map["receptor_symbol"] is None:
        raise ValueError("Failed to detect ligand/receptor columns in CellTalkDB payload.")

    rows: list[dict[str, Any]] = []
    for row in frame.to_dict(orient="records"):
        ligand = normalize_text(row.get(column_map["ligand_symbol"]))
        receptor = normalize_text(row.get(column_map["receptor_symbol"]))
        if not ligand or not receptor:
            continue
        rows.append(
            {
                "ligand": ligand,
                "receptor": receptor,
                "source": "CellTalkDB",
                "organism": organism,
                "category": "",
                "pathway": "",
                "evidence": normalize_text(row.get(column_map["evidence_count"])) if column_map["evidence_count"] else "",
                "ligand_raw": normalize_text(row.get(column_map["ligand_raw"])) if column_map["ligand_raw"] else ligand,
                "receptor_raw": normalize_text(row.get(column_map["receptor_raw"])) if column_map["receptor_raw"] else receptor,
            }
        )

    if not rows:
        raise ValueError("No usable CellTalkDB interaction rows remained after normalization.")
    return pd.DataFrame(rows), column_map


def normalize_complex_name(name: str, complex_frame: pd.DataFrame | None) -> str:
    if complex_frame is None or name not in complex_frame.index:
        return name
    series = complex_frame.loc[name]
    if isinstance(series, pd.DataFrame):
        series = series.iloc[0]
    genes = [normalize_text(value) for value in series.tolist() if normalize_text(value)]
    return "+".join(genes) if genes else name


def normalize_cellchatdb(payload: dict[str, Any], organism: str) -> tuple[pd.DataFrame, dict[str, str | None]]:
    db_like = next((value for value in payload.values() if isinstance(value, dict) and "interaction" in value), None)
    if not isinstance(db_like, dict):
        raise ValueError("Failed to detect CellChatDB interaction payload.")

    interaction = db_like.get("interaction")
    if not isinstance(interaction, pd.DataFrame):
        raise ValueError("CellChatDB interaction payload is not a dataframe.")

    complex_frame = db_like.get("complex")
    if isinstance(complex_frame, pd.DataFrame):
        complex_frame = complex_frame.copy()
    else:
        complex_frame = None

    column_map = {
        "ligand": find_column(interaction, ["ligand"]),
        "receptor": find_column(interaction, ["receptor"]),
        "category": find_column(interaction, ["annotation", "category"]),
        "pathway": find_column(interaction, ["pathway_name", "pathway"]),
        "evidence": find_column(interaction, ["evidence"]),
    }

    if column_map["ligand"] is None or column_map["receptor"] is None:
        raise ValueError("Failed to detect ligand/receptor columns in CellChatDB payload.")

    rows: list[dict[str, Any]] = []
    for row in interaction.to_dict(orient="records"):
        ligand = normalize_complex_name(normalize_text(row.get(column_map["ligand"])), complex_frame)
        receptor = normalize_complex_name(normalize_text(row.get(column_map["receptor"])), complex_frame)
        if not ligand or not receptor:
            continue
        rows.append(
            {
                "ligand": ligand,
                "receptor": receptor,
                "source": "CellChatDB",
                "organism": organism,
                "category": normalize_text(row.get(column_map["category"])) if column_map["category"] else "",
                "pathway": normalize_text(row.get(column_map["pathway"])) if column_map["pathway"] else "",
                "evidence": normalize_text(row.get(column_map["evidence"])) if column_map["evidence"] else "",
            }
        )

    if not rows:
        raise ValueError("No usable CellChatDB interaction rows remained after normalization.")
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
    if not any([args.query, args.category, args.pathway]):
        raise ValueError("At least one of --query, --category, or --pathway must be provided for a bounded fetch.")

    filtered = frame.copy()
    filtered = filtered[filtered["organism"].astype(str).str.lower() == args.organism]

    if args.category:
        filtered = filtered[filtered["category"].map(lambda value: match_filter(value, args.category, args.exact))]
    if args.pathway:
        filtered = filtered[filtered["pathway"].map(lambda value: match_filter(value, args.pathway, args.exact))]

    queries = [normalize_text(entry).lower() for entry in args.query if normalize_text(entry)]
    if queries:
        combined = (
            filtered["ligand"].astype(str)
            + " "
            + filtered["receptor"].astype(str)
            + " "
            + filtered["category"].astype(str)
            + " "
            + filtered["pathway"].astype(str)
            + " "
            + filtered["evidence"].astype(str)
        ).str.lower()
        for query in queries:
            filtered = filtered[combined.loc[filtered.index].str.contains(re.escape(query), na=False)]

    filtered = filtered.drop_duplicates().reset_index(drop=True)
    if args.max_rows > 0:
        filtered = filtered.head(args.max_rows)
    return filtered


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
    if args.organism not in SOURCES.get(args.source, {}):
        raise ValueError(f"source '{args.source}' does not support organism '{args.organism}'")

    output_dir = Path(args.output)
    tables_dir = output_dir / "tables"
    reports_dir = output_dir / "reports"
    tmp_dir = output_dir / "tmp" / "public-data" / "lrdb"
    ensure_dir(tables_dir)
    ensure_dir(reports_dir)
    ensure_dir(tmp_dir)

    source_meta = SOURCES[args.source][args.organism]
    extension = source_meta["format"]
    source_path = tmp_dir / f"{args.source}_{args.organism}.{extension}"
    download_origin = download_file(source_meta["url"], source_path, args.refresh)
    payload = read_r_object(source_path)

    if args.source == "celltalkdb":
        normalized_frame, detected_columns = normalize_celltalkdb(payload, args.organism)
    else:
        normalized_frame, detected_columns = normalize_cellchatdb(payload, args.organism)

    filtered_frame = filter_frame(normalized_frame, args)
    if filtered_frame.empty:
        raise ValueError("No ligand-receptor rows matched the bounded filters.")

    filtered_frame = filtered_frame.copy()
    filtered_frame["note"] = args.note
    output_columns = ["ligand", "receptor", "source", "organism", "category", "pathway", "evidence", "note"]
    selected_path = tables_dir / "lr_selected.tsv"
    filtered_frame[output_columns].to_csv(selected_path, sep="\t", index=False)

    retrieved_at = datetime.now(timezone.utc).isoformat()
    result_payload = {
        "source": args.source,
        "organism": args.organism,
        "queries": args.query,
        "category": args.category,
        "pathway": args.pathway,
        "exact": args.exact,
        "max_rows": args.max_rows,
        "download_origin": download_origin,
        "source_file": str(source_path),
        "detected_columns": detected_columns,
        "selected_rows": int(len(filtered_frame)),
        "output": str(selected_path),
        "note": args.note,
        "retrieved_at": retrieved_at,
    }

    report_lines = [
        "# LRDB Fetch Report",
        "",
        f"- Source: `{args.source}`",
        f"- Organism: `{args.organism}`",
        f"- Queries: {', '.join(args.query) if args.query else '(none)'}",
        f"- Category: {args.category or '(none)'}",
        f"- Pathway: {args.pathway or '(none)'}",
        f"- Selected rows: {len(filtered_frame)}",
        f"- Retrieved at: {retrieved_at}",
        "",
        "## Selected Interaction Preview",
        "",
        dataframe_to_markdown(filtered_frame[output_columns]),
    ]

    write_markdown(reports_dir / "lrdb_fetch_report.md", report_lines)
    dump_json(reports_dir / "lrdb_fetch_result.json", result_payload)


if __name__ == "__main__":
    main()
