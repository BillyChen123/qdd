#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import pandas as pd
import requests


EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture a bounded GEO candidate table for QDD.")
    parser.add_argument("--output", required=True, help="Study output directory.")
    parser.add_argument("--query", action="append", default=[], help="Repeatable bounded GEO search term.")
    parser.add_argument("--accession", action="append", default=[], help="Repeatable accession such as GSE12345.")
    parser.add_argument("--organism", default=None, help="Optional organism hint such as Homo sapiens.")
    parser.add_argument("--modality", choices=["scrna", "spatial", "bulk", "other"], default=None)
    parser.add_argument("--title-contains", default=None, help="Optional title keyword filter after retrieval.")
    parser.add_argument("--max-results", type=int, default=10)
    parser.add_argument("--note", default="", help="Optional free-text note written to the output.")
    parser.add_argument("--api-key", default=None, help="Optional NCBI API key.")
    parser.add_argument("--email", default=None, help="Optional NCBI contact email.")
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


def pick_first(mapping: dict[str, Any], candidates: list[str]) -> Any:
    lowered = {str(key).lower(): value for key, value in mapping.items()}
    for candidate in candidates:
        if candidate.lower() in lowered:
            return lowered[candidate.lower()]
    return None


def joined_value(value: Any) -> str:
    if isinstance(value, list):
        return "; ".join(normalize_text(entry) for entry in value if normalize_text(entry))
    return normalize_text(value)


def search_params(args: argparse.Namespace, term: str) -> dict[str, Any]:
    params: dict[str, Any] = {
        "db": "gds",
        "retmode": "json",
        "retmax": max(args.max_results, 1),
        "term": term,
        "tool": "qdd-geo-candidate-capture",
    }
    if args.api_key:
        params["api_key"] = args.api_key
    if args.email:
        params["email"] = args.email
    return params


def build_search_term(args: argparse.Namespace) -> str:
    query_terms = [normalize_text(entry) for entry in args.query if normalize_text(entry)]
    accessions = [normalize_text(entry).upper() for entry in args.accession if normalize_text(entry)]
    clauses: list[str] = []

    if query_terms:
        clauses.append(" AND ".join(f"({term})" for term in query_terms))
    if accessions:
        accession_clause = " OR ".join(f"{accession}[ACCN]" for accession in accessions)
        clauses.append(f"({accession_clause})")
    if args.organism:
        clauses.append(f"({normalize_text(args.organism)})")

    modality = args.modality
    if modality == "scrna":
        clauses.append('("single cell" OR "single-cell" OR scrna OR snrna)')
    elif modality == "spatial":
        clauses.append('("spatial transcriptomics" OR visium OR xenium OR merfish OR seqfish OR "slide-seq" OR "stereo-seq")')
    elif modality == "bulk":
        clauses.append('("RNA-seq" OR transcriptome OR bulk)')

    if not clauses:
        raise ValueError("At least one of --query, --accession, --organism, or --modality must be provided.")

    return " AND ".join(clause for clause in clauses if clause)


def request_json(endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
    response = requests.get(f"{EUTILS_BASE}/{endpoint}", params=params, timeout=180)
    response.raise_for_status()
    return response.json()


def fetch_summary(ids: list[str], args: argparse.Namespace) -> dict[str, Any]:
    params: dict[str, Any] = {
        "db": "gds",
        "retmode": "json",
        "id": ",".join(ids),
        "tool": "qdd-geo-candidate-capture",
    }
    if args.api_key:
        params["api_key"] = args.api_key
    if args.email:
        params["email"] = args.email
    return request_json("esummary.fcgi", params)


def infer_modality_hint(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ["xenium", "visium", "merfish", "seqfish", "slide-seq", "stereo-seq", "spatial"]):
        return "spatial"
    if any(token in lowered for token in ["single cell", "single-cell", "scrna", "snrna"]):
        return "scrna"
    if any(token in lowered for token in ["bulk", "transcriptome", "rna-seq"]):
        return "bulk"
    return "unknown"


def extract_year(value: str) -> str:
    match = re.search(r"(19|20)\d{2}", value)
    return match.group(0) if match else ""


def parse_sample_count(record: dict[str, Any]) -> str:
    for key in ["n_samples", "samples", "samplecount", "sample_count"]:
        value = pick_first(record, [key])
        if value is None:
            continue
        if isinstance(value, list):
            return str(len(value))
        text = normalize_text(value)
        if text:
            return text
    return ""


def build_candidate_frame(summary_json: dict[str, Any], args: argparse.Namespace, search_term: str) -> pd.DataFrame:
    result = summary_json.get("result", {})
    uids = result.get("uids", [])
    rows: list[dict[str, Any]] = []

    for rank, uid in enumerate(uids, start=1):
        record = result.get(str(uid), {})
        if not isinstance(record, dict):
            continue
        accession = normalize_text(pick_first(record, ["accession"]))
        title = normalize_text(pick_first(record, ["title"]))
        summary = normalize_text(pick_first(record, ["summary"]))
        organism = joined_value(pick_first(record, ["taxon", "organism"]))
        entry_type = normalize_text(pick_first(record, ["entrytype", "gdstype", "type"]))
        year = extract_year(normalize_text(pick_first(record, ["pdat", "updatedate", "pubdate"])))
        platform = joined_value(pick_first(record, ["gpl", "platform", "platforms"]))
        modality_text = " ".join(part for part in [title, summary, platform] if part)
        modality_hint = args.modality or infer_modality_hint(modality_text)
        if args.title_contains and args.title_contains.lower() not in title.lower():
            continue

        rows.append(
            {
                "accession": accession or f"uid:{uid}",
                "geo_id": str(uid),
                "title": title,
                "organism": organism,
                "entry_type": entry_type,
                "modality_hint": modality_hint,
                "sample_count": parse_sample_count(record),
                "platform": platform,
                "year": year,
                "source_url": f"https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={accession}" if accession else "",
                "search_term": search_term,
                "recommended": "review" if rank <= max(args.max_results, 1) else "",
                "note": args.note,
            }
        )

    frame = pd.DataFrame(rows)
    if frame.empty:
        raise ValueError("No GEO candidates matched the bounded search.")
    return frame.drop_duplicates().reset_index(drop=True)


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
    search_term = build_search_term(args)

    output_dir = Path(args.output)
    tables_dir = output_dir / "tables"
    reports_dir = output_dir / "reports"
    ensure_dir(tables_dir)
    ensure_dir(reports_dir)

    esearch = request_json("esearch.fcgi", search_params(args, search_term))
    id_list = esearch.get("esearchresult", {}).get("idlist", [])
    if not id_list:
        raise ValueError("No GEO records matched the bounded search.")

    summary_json = fetch_summary(id_list, args)
    candidates = build_candidate_frame(summary_json, args, search_term).head(max(args.max_results, 1))

    table_path = tables_dir / "geo_candidates.csv"
    report_path = reports_dir / "geo_candidate_capture_report.md"
    result_path = reports_dir / "geo_candidate_capture_result.json"
    candidates.to_csv(table_path, index=False)

    retrieved_at = datetime.now(timezone.utc).isoformat()
    result_payload = {
        "source": "geo",
        "search_term": search_term,
        "queries": args.query,
        "accessions": args.accession,
        "organism": args.organism,
        "modality": args.modality,
        "title_contains": args.title_contains,
        "max_results": args.max_results,
        "selected_rows": int(len(candidates)),
        "output": str(table_path),
        "note": args.note,
        "ncbi_esearch_url": f"{EUTILS_BASE}/esearch.fcgi?{urlencode(search_params(args, search_term), doseq=True)}",
        "retrieved_at": retrieved_at,
    }
    dump_json(result_path, result_payload)

    report_lines = [
        "# GEO Candidate Capture Report",
        "",
        "- Source: GEO via NCBI E-utilities",
        f"- Search term: `{search_term}`",
        f"- Organism hint: `{args.organism or ''}`",
        f"- Modality hint: `{args.modality or ''}`",
        f"- Accessions provided: `{', '.join(args.accession)}`",
        f"- Rows captured: `{len(candidates)}`",
        f"- Output table: `{table_path}`",
        f"- Retrieved at: `{retrieved_at}`",
        f"- Note: `{args.note}`",
        "",
        "## Candidate Preview",
        "",
        dataframe_to_markdown(candidates),
    ]
    write_markdown(report_path, report_lines)


if __name__ == "__main__":
    main()
