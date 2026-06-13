#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import pandas as pd
import requests


EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
SENSITIVE_PARAM_KEYS = {"api_key", "email", "token", "secret", "password", "auth"}
DEFAULT_HEADERS = {
    "User-Agent": "qdd-pubmed-evidence-capture/0.1 (+https://github.com/)",
    "Accept": "application/json, text/xml;q=0.9, */*;q=0.1",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture a bounded PubMed evidence table for QDD.")
    parser.add_argument("--output", required=True, help="Study output directory.")
    parser.add_argument("--query", action="append", default=[], help="Repeatable bounded PubMed search term.")
    parser.add_argument("--pmid", action="append", default=[], help="Repeatable PMID.")
    parser.add_argument("--claim", default="", help="Optional study claim carried into the output table.")
    parser.add_argument("--journal", default=None, help="Optional journal filter applied at search time.")
    parser.add_argument("--year-from", type=int, default=None)
    parser.add_argument("--year-to", type=int, default=None)
    parser.add_argument("--max-results", type=int, default=12)
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


def redacted_credential_fields(args: argparse.Namespace) -> list[str]:
    fields = []
    if args.api_key:
        fields.append("api_key")
    if args.email:
        fields.append("email")
    return fields


def public_request_params(params: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in params.items()
        if key.lower() not in SENSITIVE_PARAM_KEYS
    }


def build_ncbi_url(endpoint: str, params: dict[str, Any]) -> str:
    safe_params = public_request_params(params)
    return f"{EUTILS_BASE}/{endpoint}?{urlencode(safe_params, doseq=True)}"


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "none"}:
        return ""
    return text


def request_json(endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
    response = request_with_retry(endpoint, params)
    return response.json()


def request_text(endpoint: str, params: dict[str, Any]) -> str:
    response = request_with_retry(endpoint, params)
    return response.text


def request_with_retry(endpoint: str, params: dict[str, Any]) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            response = requests.get(f"{EUTILS_BASE}/{endpoint}", params=params, timeout=180, headers=DEFAULT_HEADERS)
            if response.status_code in {429, 500, 502, 503, 504}:
                response.raise_for_status()
            response.raise_for_status()
            return response
        except requests.HTTPError as error:
            last_error = error
            status_code = error.response.status_code if error.response is not None else None
            if status_code not in {429, 500, 502, 503, 504} or attempt == 3:
                raise
        except requests.RequestException as error:
            last_error = error
            if attempt == 3:
                raise
        time.sleep(min(2 ** attempt, 8))

    raise RuntimeError("PubMed request failed after retries.") from last_error


def build_search_term(args: argparse.Namespace) -> str:
    query_terms = [normalize_text(entry) for entry in args.query if normalize_text(entry)]
    clauses: list[str] = []

    if query_terms:
        clauses.append(" AND ".join(f"({term})" for term in query_terms))
    if args.journal:
        clauses.append(f"({normalize_text(args.journal)}[Journal])")
    if args.year_from or args.year_to:
        year_from = args.year_from or 1900
        year_to = args.year_to or datetime.now(timezone.utc).year
        clauses.append(f'("{year_from}"[Date - Publication] : "{year_to}"[Date - Publication])')

    if not clauses:
        raise ValueError("At least one of --query or --pmid must be provided.")

    return " AND ".join(clauses)


def common_params(args: argparse.Namespace) -> dict[str, Any]:
    params: dict[str, Any] = {"tool": "qdd-pubmed-evidence-capture"}
    if args.api_key:
        params["api_key"] = args.api_key
    if args.email:
        params["email"] = args.email
    return params


def search_pmids(args: argparse.Namespace, search_term: str) -> tuple[list[str], str]:
    if args.pmid:
        return [normalize_text(entry) for entry in args.pmid if normalize_text(entry)], ""

    params = {
        "db": "pubmed",
        "retmode": "json",
        "retmax": max(args.max_results, 1),
        "term": search_term,
        **common_params(args),
    }
    payload = request_json("esearch.fcgi", params)
    pmids = payload.get("esearchresult", {}).get("idlist", [])
    return pmids, build_ncbi_url("esearch.fcgi", params)


def fetch_pubmed_xml(args: argparse.Namespace, pmids: list[str]) -> str:
    params = {
        "db": "pubmed",
        "retmode": "xml",
        "rettype": "abstract",
        "id": ",".join(pmids),
        **common_params(args),
    }
    return request_text("efetch.fcgi", params)


def joined_xml_text(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return " ".join(part.strip() for part in element.itertext() if part and part.strip()).strip()


def extract_year(article: ET.Element) -> str:
    year = article.findtext(".//PubDate/Year")
    if year and year.strip():
        return year.strip()
    medline_date = article.findtext(".//PubDate/MedlineDate")
    if medline_date:
        match = re.search(r"(19|20)\d{2}", medline_date)
        if match:
            return match.group(0)
    return ""


def article_rows(xml_text: str, args: argparse.Namespace, query_label: str) -> pd.DataFrame:
    root = ET.fromstring(xml_text)
    rows: list[dict[str, Any]] = []

    for article in root.findall(".//PubmedArticle"):
        pmid = normalize_text(article.findtext(".//PMID"))
        title = joined_xml_text(article.find(".//ArticleTitle"))
        journal = normalize_text(article.findtext(".//Journal/Title")) or normalize_text(
            article.findtext(".//Journal/ISOAbbreviation")
        )
        doi = ""
        for article_id in article.findall(".//ArticleId"):
            if normalize_text(article_id.attrib.get("IdType")).lower() == "doi":
                doi = joined_xml_text(article_id)
                break
        abstract_texts = [joined_xml_text(node) for node in article.findall(".//Abstract/AbstractText")]
        abstract = " ".join(part for part in abstract_texts if part).strip()
        excerpt = abstract[:1000]
        if len(abstract) > 1000:
            excerpt += "..."

        rows.append(
            {
                "pmid": pmid,
                "doi": doi,
                "title": title,
                "year": extract_year(article),
                "journal": journal,
                "query": query_label,
                "claim": args.claim,
                "evidence_type": "pubmed_record",
                "support_level": "unreviewed",
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else "",
                "abstract_excerpt": excerpt,
                "note": args.note,
            }
        )

    frame = pd.DataFrame(rows).drop_duplicates(subset=["pmid", "title"]).reset_index(drop=True)
    if frame.empty:
        raise ValueError("No PubMed records were parsed from the bounded fetch.")
    return frame


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
    search_term = build_search_term(args) if not args.pmid else ""

    output_dir = Path(args.output)
    tables_dir = output_dir / "tables"
    reports_dir = output_dir / "reports"
    ensure_dir(tables_dir)
    ensure_dir(reports_dir)

    pmids, search_url = search_pmids(args, search_term)
    if not pmids:
        raise ValueError("No PubMed records matched the bounded search.")

    xml_text = fetch_pubmed_xml(args, pmids)
    query_label = search_term or ",".join(pmids)
    evidence = article_rows(xml_text, args, query_label).head(max(args.max_results, 1))

    table_path = tables_dir / "pubmed_evidence.csv"
    report_path = reports_dir / "pubmed_evidence_capture_report.md"
    result_path = reports_dir / "pubmed_evidence_capture_result.json"
    evidence.to_csv(table_path, index=False)

    retrieved_at = datetime.now(timezone.utc).isoformat()
    result_payload = {
        "source": "pubmed",
        "queries": args.query,
        "pmids": pmids,
        "claim": args.claim,
        "journal": args.journal,
        "year_from": args.year_from,
        "year_to": args.year_to,
        "max_results": args.max_results,
        "selected_rows": int(len(evidence)),
        "output": str(table_path),
        "note": args.note,
        "search_term": search_term,
        "ncbi_esearch_url": search_url,
        "credential_fields_redacted": redacted_credential_fields(args),
        "retrieved_at": retrieved_at,
    }
    dump_json(result_path, result_payload)

    report_lines = [
        "# PubMed Evidence Capture Report",
        "",
        "- Source: PubMed via NCBI E-utilities",
        f"- Search term: `{search_term}`",
        f"- PMIDs provided: `{', '.join(args.pmid)}`",
        f"- Claim: `{args.claim}`",
        f"- Journal filter: `{args.journal or ''}`",
        f"- Year range: `{args.year_from or ''}` -> `{args.year_to or ''}`",
        f"- Rows captured: `{len(evidence)}`",
        f"- Output table: `{table_path}`",
        f"- Retrieved at: `{retrieved_at}`",
        f"- Credential fields redacted: `{', '.join(redacted_credential_fields(args)) or 'none'}`",
        f"- Note: `{args.note}`",
        "",
        "## Evidence Preview",
        "",
        dataframe_to_markdown(evidence[["pmid", "title", "year", "journal", "support_level", "url"]]),
    ]
    write_markdown(report_path, report_lines)


if __name__ == "__main__":
    main()
