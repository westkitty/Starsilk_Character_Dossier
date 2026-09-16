#!/usr/bin/env python3
"""Deterministic claim-level evidence helpers for the Starsilk Canon Loom.

The Loom does not create canon. It parses the authored canon ledger into
claim-shaped evidence records so browser and agent surfaces can point back to
what the repository already says. Machine locks remain a separate subsystem.
"""
from __future__ import annotations

import re
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER_PATH = ROOT / "src" / "content" / "sections" / "canon-ledger.body.html"

_ONES = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19,
}
_TENS = {
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}
_SCALES = {"hundred": 100, "thousand": 1_000, "million": 1_000_000, "billion": 1_000_000_000}
_UNITS = {"percent", "percentage", "year", "years", "day", "days", "month", "months"}


def _collapse(parts: list[str]) -> str:
    return " ".join(" ".join(parts).split())


def _word_number(tokens: list[str]) -> int | None:
    total = 0
    current = 0
    saw = False
    for token in tokens:
        token = token.lower()
        if token == "and":
            continue
        if token in _ONES:
            current += _ONES[token]
            saw = True
        elif token in _TENS:
            current += _TENS[token]
            saw = True
        elif token == "hundred":
            current = max(1, current) * 100
            saw = True
        elif token in ("thousand", "million", "billion"):
            total += max(1, current) * _SCALES[token]
            current = 0
            saw = True
        else:
            return None
    return total + current if saw else None


def extract_numeric_facts(text: str) -> list[dict]:
    """Extract explicit numeric literals, including common English number words.

    These are evidence atoms only. They do not infer what a number means beyond
    an immediately following simple unit such as years, days, or percent.
    """
    normalized = text.replace("-", " ")
    tokens = re.findall(r"\d[\d,]*(?:\.\d+)?|[A-Za-z]+", normalized)
    out: list[dict] = []
    seen: set[tuple[float, str | None, str]] = set()
    i = 0
    number_words = set(_ONES) | set(_TENS) | set(_SCALES) | {"and"}
    while i < len(tokens):
        token = tokens[i]
        unit = None
        source_tokens: list[str] = []
        value: float | int | None = None
        if re.fullmatch(r"\d[\d,]*(?:\.\d+)?", token):
            raw = token.replace(",", "")
            value = float(raw) if "." in raw else int(raw)
            source_tokens = [token]
            j = i + 1
            if j < len(tokens) and tokens[j].lower() in ("thousand", "million", "billion"):
                scale = tokens[j].lower()
                value *= _SCALES[scale]
                source_tokens.append(tokens[j])
                j += 1
            if j < len(tokens) and tokens[j].lower() in _UNITS:
                unit = tokens[j].lower()
                source_tokens.append(tokens[j])
                j += 1
            i = j
        elif token.lower() in number_words and token.lower() != "and":
            j = i
            phrase: list[str] = []
            while j < len(tokens) and tokens[j].lower() in number_words:
                phrase.append(tokens[j])
                j += 1
            value = _word_number(phrase)
            source_tokens = phrase[:]
            if value is not None and j < len(tokens) and tokens[j].lower() in _UNITS:
                unit = tokens[j].lower()
                source_tokens.append(tokens[j])
                j += 1
            i = j
        else:
            i += 1
            continue
        if value is None:
            continue
        if isinstance(value, float) and value.is_integer():
            value = int(value)
        source_text = " ".join(source_tokens)
        key = (float(value), unit, source_text.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append({"value": value, "unit": unit, "source_text": source_text})
    return out


class _LedgerParser(HTMLParser):
    """Parse the fixed authored ledger structure without external dependencies."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.claims: list[dict] = []
        self.current_domain = ""
        self._group_depth = 0
        self._domain_capture = False
        self._domain_parts: list[str] = []
        self._claim: dict | None = None
        self._capture: tuple[str, str] | None = None

    @staticmethod
    def _attrs(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key: value or "" for key, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = self._attrs(attrs)
        classes = set(values.get("class", "").split())
        if tag == "section" and "lore-group" in classes:
            self._group_depth += 1
        if tag == "h3" and self._group_depth and self._claim is None:
            self._domain_capture = True
            self._domain_parts = []
        if tag == "article" and "lore-record" in classes:
            claim_id = values.get("data-lore-record", "").strip()
            self._claim = {
                "claim_id": claim_id,
                "domain": self.current_domain,
                "tag_parts": [],
                "label_parts": [],
                "statement_parts": [],
                "refs": [],
            }
            self._capture = None
            return
        if self._claim is None:
            return
        if "lore-tag" in classes:
            self._capture = (tag, "tag_parts")
        elif tag == "h4":
            self._capture = (tag, "label_parts")
        elif tag == "p" and not self._claim["statement_parts"]:
            self._capture = (tag, "statement_parts")
        if tag == "a" and "xref-link" in classes:
            href = values.get("href", "")
            if href.startswith("#") and len(href) > 1:
                self._claim["refs"].append(href[1:])

    def handle_data(self, data: str) -> None:
        if self._domain_capture:
            self._domain_parts.append(data)
        if self._claim is not None and self._capture is not None:
            self._claim[self._capture[1]].append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._claim is not None and self._capture is not None and tag == self._capture[0]:
            self._capture = None
        if tag == "article" and self._claim is not None:
            raw = self._claim
            statement = _collapse(raw["statement_parts"])
            self.claims.append({
                "claim_id": raw["claim_id"],
                "order": len(self.claims) + 1,
                "domain": raw["domain"],
                "tag": _collapse(raw["tag_parts"]),
                "label": _collapse(raw["label_parts"]),
                "statement": statement,
                "source_ref": "src/content/sections/canon-ledger.body.html",
                "source_locator": f'data-lore-record="{raw["claim_id"]}"',
                "authority": "authored-source",
                "evidence_class": "authored-lore-record",
                "entity_stable_ids": sorted(set(raw["refs"])),
                "numeric_facts": extract_numeric_facts(statement),
            })
            self._claim = None
            self._capture = None
        if tag == "h3" and self._domain_capture:
            self.current_domain = _collapse(self._domain_parts)
            self._domain_capture = False
            self._domain_parts = []
        if tag == "section" and self._group_depth:
            self._group_depth -= 1


@lru_cache(maxsize=1)
def load_claims() -> list[dict]:
    """Parse the authored Canon Ledger into ordered source-backed claims."""
    raw = LEDGER_PATH.read_text(encoding="utf-8")
    parser = _LedgerParser()
    parser.feed(raw)
    parser.close()
    claims = parser.claims
    seen: set[str] = set()
    for claim in claims:
        claim_id = claim["claim_id"]
        if not claim_id or claim_id in seen:
            raise RuntimeError(f"Canon Loom claim identity is missing or duplicated: {claim_id!r}")
        seen.add(claim_id)
        if not claim["label"] or not claim["statement"]:
            raise RuntimeError(f"Canon Loom claim {claim_id} is missing authored label or statement")
    declared = re.search(r"<b>(\d+)</b>\s*discrete records", raw, flags=re.IGNORECASE)
    if declared and len(claims) != int(declared.group(1)):
        raise RuntimeError(f"Canon Loom parsed {len(claims)} claims but the authored ledger declares {declared.group(1)}")
    if not claims:
        raise RuntimeError("Canon Loom found no authored lore records")
    return claims


def claims_for_record(claims: list[dict], stable_id: str, display_label: str) -> list[dict]:
    """Return claims that mechanically name or xref one stable record.

    This is retrieval linkage, not a semantic relation. It deliberately does
    not infer causality, ownership, kinship, chronology, or importance.
    """
    sid = stable_id.lower().strip()
    label = display_label.lower().strip()
    label_pattern = re.compile(rf"(?<![a-z0-9]){re.escape(label)}(?![a-z0-9])", re.IGNORECASE) if label else None
    out = []
    for claim in claims:
        material = " ".join((claim.get("tag", ""), claim.get("label", ""), claim.get("statement", "")))
        refs = {str(value).lower() for value in claim.get("entity_stable_ids", [])}
        if sid in refs or (label_pattern and label_pattern.search(material)):
            out.append(claim)
    return out


def numeric_fact_map(claims: list[dict] | None = None) -> dict[str, list[float | int]]:
    """Compact numeric evidence keyed by authored claim ID for browser analysis."""
    out: dict[str, list[float | int]] = {}
    for claim in claims or load_claims():
        values = []
        for fact in claim.get("numeric_facts", []):
            value = fact.get("value")
            if value not in values:
                values.append(value)
        if values:
            out[claim["claim_id"]] = values
    return out


def public_claim(claim: dict) -> dict:
    """Compact proof-carrying claim representation for generated derivatives."""
    return {
        "claim_id": claim["claim_id"],
        "order": claim["order"],
        "domain": claim["domain"],
        "tag": claim["tag"],
        "label": claim["label"],
        "statement": claim["statement"],
        "source_ref": claim["source_ref"],
        "source_locator": claim["source_locator"],
        "authority": claim["authority"],
        "evidence_class": claim["evidence_class"],
    }
