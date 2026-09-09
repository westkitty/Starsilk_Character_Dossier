#!/usr/bin/env python3
"""Generate the fan-facing sample-data analytics dashboard and derivatives.

Deterministic sample-data publication: `src/analytics/dashboard.json` declares
segments, collections, folio rows, and seeded generation parameters; this
script expands them into `docs/analytics/` (human page plus machine JSON).

Every number is illustrative sample data. Nothing is measured from real
readers and nothing here is canon, relationship, chronology, or
media-provenance evidence.

Usage: python3 build/analytics_publication.py [--check]
"""
from __future__ import annotations

import argparse
import json
import math
import random
import re
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
ANALYTICS_DIR = DOCS_DIR / "analytics"
TEMPLATES_DIR = ROOT / "src" / "templates"
SOURCE_FILE = ROOT / "src" / "analytics" / "dashboard.json"
AUTHORITY_FILE = ROOT / "src" / "analytics" / "AUTHORITY.md"
SECTIONS_FILE = ROOT / "src" / "content" / "sections.json"
PROJECT_ID = "starsilk-character-dossier"
PROJECT_NAME = "Starsilk Compendium"

sys.path.insert(0, str(ROOT / "build"))
import machine_publication as machine  # noqa: E402

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
FORBIDDEN_OUTPUT_PATTERNS = (
    "localhost",
    "127.0.0.1",
    "file://",
    "/Users/",
    "/home/",
)


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def randn(rng: random.Random) -> float:
    """Explicit Box-Muller normal sample from rng.random() only.

    random.Random.random() is a documented-stable Mersenne Twister stream, so
    this stays byte-deterministic across Python versions without depending on
    random.gauss internals.
    """
    u1 = max(rng.random(), 1e-12)
    u2 = rng.random()
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


def load_source() -> dict:
    try:
        source = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot load analytics source: {exc}") from exc
    if source.get("schema") != "starsilk-analytics-dashboard-source/1":
        raise RuntimeError("unsupported analytics dashboard source schema")
    if source.get("project_id") != PROJECT_ID:
        raise RuntimeError("analytics source project_id mismatch")
    if source.get("audience") != "fans":
        raise RuntimeError("analytics dashboard audience must be 'fans'")
    return source


def validate_source(source: dict) -> dict:
    sample = source.get("sample_data")
    segments = source.get("segments")
    collections = source.get("collections")
    folios = source.get("folios")
    if not isinstance(sample, dict):
        raise RuntimeError("analytics source needs a sample_data object")
    for key in ("seed", "days", "end_date", "base_daily_visits", "daily_growth",
                "weekend_lift", "monday_dip", "noise_sigma", "affinity_favorite",
                "affinity_other", "affinity_jitter", "events"):
        if key not in sample:
            raise RuntimeError(f"analytics sample_data is missing {key!r}")
    if not isinstance(sample["seed"], int) or not isinstance(sample["days"], int):
        raise RuntimeError("analytics seed/days must be integers")
    if not 30 <= sample["days"] <= 366:
        raise RuntimeError("analytics days must be within 30..366")
    try:
        end = date.fromisoformat(sample["end_date"])
    except ValueError as exc:
        raise RuntimeError("analytics end_date must be ISO YYYY-MM-DD") from exc
    for key in ("base_daily_visits", "daily_growth", "weekend_lift", "monday_dip",
                "noise_sigma", "affinity_favorite", "affinity_other", "affinity_jitter"):
        if not isinstance(sample[key], (int, float)) or sample[key] <= 0:
            raise RuntimeError(f"analytics sample_data.{key} must be a positive number")
    if not isinstance(sample["events"], list):
        raise RuntimeError("analytics sample_data.events must be a list")
    for event in sample["events"]:
        if not isinstance(event, dict):
            raise RuntimeError("analytics events must be objects")
        if not isinstance(event.get("day_offset"), int) or not 0 <= event["day_offset"] < sample["days"]:
            raise RuntimeError("analytics event day_offset is out of range")
        if not isinstance(event.get("label"), str) or not event["label"].strip():
            raise RuntimeError("analytics event label must be non-empty")
        if not isinstance(event.get("lift"), (int, float)) or event["lift"] <= 1.0:
            raise RuntimeError("analytics event lift must exceed 1.0")
        if not isinstance(event.get("span"), int) or event["span"] < 0:
            raise RuntimeError("analytics event span must be a non-negative integer")

    if not isinstance(segments, list) or len(segments) < 2:
        raise RuntimeError("analytics source needs at least two segments")
    seg_ids: list[str] = []
    for seg in segments:
        for key in ("id", "label", "blurb", "share", "color", "reader_ratio",
                    "dwell_sec", "completion", "favorite_collection"):
            if key not in seg:
                raise RuntimeError(f"analytics segment is missing {key!r}")
        seg_ids.append(seg["id"])
        if not HEX_COLOR.match(seg["color"]):
            raise RuntimeError(f"analytics segment {seg['id']} color must be #rrggbb")
        if not 0 < seg["share"] < 1:
            raise RuntimeError(f"analytics segment {seg['id']} share must be within (0, 1)")
        if not 0 < seg["reader_ratio"] <= 1:
            raise RuntimeError(f"analytics segment {seg['id']} reader_ratio must be within (0, 1]")
        if not seg["dwell_sec"] > 0 or not 0 < seg["completion"] < 1:
            raise RuntimeError(f"analytics segment {seg['id']} dwell/completion out of range")
    if len(set(seg_ids)) != len(seg_ids):
        raise RuntimeError("analytics segment ids must be unique")
    if abs(sum(seg["share"] for seg in segments) - 1.0) > 1e-9:
        raise RuntimeError("analytics segment shares must sum to 1.0")

    if not isinstance(collections, list) or len(collections) < 2:
        raise RuntimeError("analytics source needs at least two collections")
    col_ids = [c.get("id") for c in collections]
    if any(not isinstance(v, str) or not v for v in col_ids) or len(set(col_ids)) != len(col_ids):
        raise RuntimeError("analytics collection ids must be unique non-empty strings")
    for col in collections:
        if not isinstance(col.get("label"), str) or not col["label"].strip():
            raise RuntimeError("analytics collection label must be non-empty")
        if not HEX_COLOR.match(col.get("color", "")):
            raise RuntimeError(f"analytics collection {col['id']} color must be #rrggbb")
    for seg in segments:
        if seg["favorite_collection"] not in col_ids:
            raise RuntimeError(f"analytics segment {seg['id']} has an unknown favorite_collection")

    if not isinstance(folios, list) or len(folios) < 5:
        raise RuntimeError("analytics source needs at least five folios")
    folio_ids = [f.get("id") for f in folios]
    if any(not isinstance(v, str) or not v for v in folio_ids) or len(set(folio_ids)) != len(folio_ids):
        raise RuntimeError("analytics folio ids must be unique non-empty strings")
    sections = json.loads(SECTIONS_FILE.read_text(encoding="utf-8"))
    section_ids = {record["id"] for record in sections.get("sections", [])}
    for folio in folios:
        for key in ("id", "label", "collection", "weight", "dwell_sec", "completion"):
            if key not in folio:
                raise RuntimeError(f"analytics folio is missing {key!r}")
        if folio["collection"] not in col_ids:
            raise RuntimeError(f"analytics folio {folio['id']} has an unknown collection")
        if not 0 < folio["weight"] < 1:
            raise RuntimeError(f"analytics folio {folio['id']} weight must be within (0, 1)")
        if not folio["dwell_sec"] > 0 or not 0 < folio["completion"] < 1:
            raise RuntimeError(f"analytics folio {folio['id']} dwell/completion out of range")
        entity = folio.get("entity")
        record_url = folio.get("record_url")
        if entity is not None and record_url is not None:
            raise RuntimeError(f"analytics folio {folio['id']} must set only one of entity/record_url")
        if entity is None and record_url is None:
            raise RuntimeError(f"analytics folio {folio['id']} needs an entity or record_url link target")
        if entity is not None and entity not in section_ids:
            raise RuntimeError(f"analytics folio {folio['id']} cites unknown entity {entity!r}")
        if record_url is not None:
            target = DOCS_DIR / record_url / "index.html"
            if not target.exists():
                raise RuntimeError(f"analytics folio {folio['id']} record_url target is missing: {record_url}")
    if abs(sum(folio["weight"] for folio in folios) - 1.0) > 1e-9:
        raise RuntimeError("analytics folio weights must sum to 1.0")
    return {"end": end, "section_ids": section_ids}


def build_affinity(source: dict, rng: random.Random) -> dict[str, list[float]]:
    sample = source["sample_data"]
    affinity: dict[str, list[float]] = {}
    for seg in source["segments"]:
        row = []
        for folio in source["folios"]:
            if folio["collection"] == seg["favorite_collection"]:
                row.append(round(sample["affinity_favorite"], 4))
            else:
                row.append(round(sample["affinity_other"] + sample["affinity_jitter"] * rng.random(), 4))
        affinity[seg["id"]] = row
    return affinity


def distribute(total: int, weights: list[float]) -> list[int]:
    wsum = sum(weights)
    if wsum <= 0:
        return [0] * len(weights)
    raw = [total * w / wsum for w in weights]
    out = [int(math.floor(v)) for v in raw]
    remainder = total - sum(out)
    order = sorted(range(len(raw)), key=lambda i: (raw[i] - out[i], raw[i]), reverse=True)
    for i in order[:remainder]:
        out[i] += 1
    return out


def build_daily(source: dict, rng: random.Random, end: date) -> list[dict]:
    sample = source["sample_data"]
    days = sample["days"]
    segments = source["segments"]
    folios = source["folios"]
    rows: list[dict] = []
    for i in range(days):
        day = end - timedelta(days=days - 1 - i)
        dow = day.weekday()
        if dow >= 4:
            dow_factor = sample["weekend_lift"]
        elif dow == 0:
            dow_factor = sample["monday_dip"]
        else:
            dow_factor = 1.0
        event_factor = 1.0
        for event in sample["events"]:
            distance = abs(i - event["day_offset"])
            if distance <= event["span"]:
                event_factor *= 1.0 + (event["lift"] - 1.0) * (1.0 - distance / (event["span"] + 1))
        total = max(50, int(round(
            sample["base_daily_visits"] * (sample["daily_growth"] ** i)
            * dow_factor * event_factor * (1.0 + sample["noise_sigma"] * randn(rng))
        )))
        seg_weights = [seg["share"] * (1.0 + 0.05 * randn(rng)) for seg in segments]
        seg_visits = distribute(total, seg_weights)
        by_segment: dict[str, dict[str, int]] = {}
        for seg, visits in zip(segments, seg_visits):
            readers = min(visits, max(0, int(round(
                visits * seg["reader_ratio"] * (1.0 + 0.03 * randn(rng))))))
            dwell = max(0, int(round(visits * seg["dwell_sec"] * (1.0 + 0.04 * randn(rng)))))
            completions = max(0, int(round(visits * seg["completion"] * (1.0 + 0.06 * randn(rng)))))
            by_segment[seg["id"]] = {
                "visits": visits, "readers": readers,
                "dwell_sec": dwell, "completions": completions,
            }
        folio_weights = [folio["weight"] * (1.0 + 0.08 * randn(rng)) for folio in folios]
        by_folio = distribute(total, folio_weights)
        rows.append({
            "date": day.isoformat(),
            "visits": sum(seg_visits),
            "readers": sum(v["readers"] for v in by_segment.values()),
            "dwell_sec": sum(v["dwell_sec"] for v in by_segment.values()),
            "completions": sum(v["completions"] for v in by_segment.values()),
            "by_segment": by_segment,
            "by_folio": by_folio,
        })
    return rows


def folio_links(source: dict) -> list[dict]:
    folios = []
    for folio in source["folios"]:
        if folio.get("entity") is not None:
            rel = f"../entities/{folio['entity']}/"
            url = machine.entity_permalink(folio["entity"])
        else:
            rel = f"../{folio['record_url']}"
            url = machine.canonical(folio["record_url"])
        folios.append({
            "id": folio["id"],
            "label": folio["label"],
            "collection": folio["collection"],
            "weight": folio["weight"],
            "dwell_sec": folio["dwell_sec"],
            "completion": folio["completion"],
            "rel": rel,
            "url": url,
        })
    return folios


def build_model(source: dict, validated: dict) -> dict:
    sample = source["sample_data"]
    rng = random.Random(sample["seed"])
    affinity = build_affinity(source, rng)
    daily = build_daily(source, rng, validated["end"])
    start = date.fromisoformat(daily[0]["date"])
    end = date.fromisoformat(daily[-1]["date"])
    events = []
    for event in sample["events"]:
        day = start + timedelta(days=event["day_offset"])
        events.append({
            "date": day.isoformat(),
            "label": event["label"],
            "lift": event["lift"],
            "span": event["span"],
        })
    return {
        "schema": "starsilk-analytics-dashboard/1",
        "project_id": PROJECT_ID,
        "audience": "fans",
        "data_kind": "illustrative-sample",
        "canonical_url": machine.canonical("analytics/"),
        "human_url": machine.canonical("analytics/"),
        "data_url": machine.canonical("analytics/analytics.json"),
        "generated_from": {
            "source": "src/analytics/dashboard.json",
            "seed": sample["seed"],
            "generator": "build/analytics_publication.py",
        },
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "day_count": len(daily),
        "segments": [
            {
                "id": seg["id"], "label": seg["label"], "blurb": seg["blurb"],
                "share": seg["share"], "color": seg["color"],
                "reader_ratio": seg["reader_ratio"], "dwell_sec": seg["dwell_sec"],
                "completion": seg["completion"], "favorite_collection": seg["favorite_collection"],
            }
            for seg in source["segments"]
        ],
        "collections": [
            {"id": col["id"], "label": col["label"], "color": col["color"]}
            for col in source["collections"]
        ],
        "folios": folio_links(source),
        "affinity": affinity,
        "events": events,
        "daily": daily,
        "interpretation_rules": [
            "Every figure is deterministic illustrative sample data from the declared seed; nothing is measured from real readers.",
            "Daily folio views sum to daily visits; segment rows sum to the daily totals.",
            "Segment folio mixes are affinity-weighted in the page so each segment's folio total equals its visit total.",
            "Trends compare per-day rates against the prior equivalent window (or the range's own halves when history is short).",
            "Sample analytics never outrank repository authority and are not canon, relationship, chronology, or media-provenance evidence.",
        ],
    }


def build_markdown(model: dict, source: dict) -> str:
    total_visits = sum(day["visits"] for day in model["daily"])
    total_readers = sum(day["readers"] for day in model["daily"])
    total_completions = sum(day["completions"] for day in model["daily"])
    avg_dwell = sum(day["dwell_sec"] for day in model["daily"]) / total_visits if total_visits else 0
    folio_totals = [0] * len(model["folios"])
    for day in model["daily"]:
        for i, views in enumerate(day["by_folio"]):
            folio_totals[i] += views
    ranked = sorted(zip(model["folios"], folio_totals), key=lambda pair: pair[1], reverse=True)
    lines = [
        "# Starsilk fan analytics (sample data)",
        "",
        "> Illustrative sample data for fans. Nothing here is measured from real",
        "> readers, and nothing is canon or publication evidence.",
        "",
        f"- Sample window: {model['start_date']} to {model['end_date']} ({model['day_count']} days).",
        f"- Visits: {total_visits:,}; active readers: {total_readers:,}.",
        f"- Average dwell: {avg_dwell / 60:.1f} minutes; folios completed: {total_completions:,}.",
        f"- Segments: {', '.join(seg['label'] for seg in model['segments'])}.",
        "- Top folios:",
    ]
    for folio, views in ranked[:5]:
        lines.append(f"  - {folio['label']} ({folio['collection']}): {views:,} views.")
    lines += [
        "",
        "## Reading the dashboard",
        "",
        "- Date-range presets (7D / 30D / 90D / All) and custom dates bound every view.",
        "- The reader-segment filter rescales KPIs, charts, and the folio table together.",
        "- KPI trends compare per-day rates with the prior equivalent window.",
        "- The folio table sorts, searches, and filters by collection without reloading.",
        "",
        f"Source: `src/analytics/dashboard.json` (seed {source['sample_data']['seed']}).",
        f"Human page: {model['human_url']}",
        f"Machine data: {model['data_url']}",
        "",
    ]
    return "\n".join(lines)


def check_output_safety(outputs: dict[str, str]) -> None:
    for relative, content in outputs.items():
        lowered = content.lower()
        if relative.endswith((".js", ".css")) and ("http://" in lowered or "https://" in lowered):
            raise RuntimeError(f"analytics output must not embed remote URLs: {relative}")
        for pattern in FORBIDDEN_OUTPUT_PATTERNS:
            if pattern in content:
                raise RuntimeError(f"analytics output contains forbidden pattern {pattern!r}: {relative}")
    html = outputs["index.html"]
    for tag in re.findall(r"<(?:script|img|link)[^>]*>", html, flags=re.IGNORECASE):
        if re.search(r"(?:src|href)\s*=\s*[\"']https?://", tag, flags=re.IGNORECASE):
            if "rel=\"canonical\"" in tag or "rel='canonical'" in tag:
                continue
            raise RuntimeError(f"analytics page must not load remote resources: {tag[:80]}")


def render_outputs() -> dict[str, str]:
    source = load_source()
    validated = validate_source(source)
    model = build_model(source, validated)
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True, trim_blocks=False, lstrip_blocks=False,
    )
    try:
        template = env.get_template("analytics.html.j2")
        index_html = template.render(
            project_name=PROJECT_NAME,
            canonical_url=machine.canonical("analytics/"),
            start_date=model["start_date"],
            end_date=model["end_date"],
            segments=model["segments"],
            collections=model["collections"],
            seed=source["sample_data"]["seed"],
        )
    except jinja2.TemplateError as exc:
        raise RuntimeError(f"analytics template render failed: {exc}") from exc
    outputs = {
        "index.html": index_html,
        "analytics.css": (TEMPLATES_DIR / "analytics.css").read_text(encoding="utf-8").rstrip() + "\n",
        "analytics.js": (TEMPLATES_DIR / "analytics.js").read_text(encoding="utf-8").rstrip() + "\n",
        "analytics.json": json_text(model),
        "analytics.md": build_markdown(model, source),
        "AUTHORITY.md": AUTHORITY_FILE.read_text(encoding="utf-8").rstrip() + "\n",
    }
    check_output_safety(outputs)
    return outputs


def actual_files() -> set[str]:
    if not ANALYTICS_DIR.exists():
        return set()
    return {path.relative_to(ANALYTICS_DIR).as_posix() for path in ANALYTICS_DIR.rglob("*") if path.is_file()}


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors: list[str] = []
    if actual_files() != set(outputs):
        errors.append("generated analytics file set differs from expected output")
    for relative, expected in outputs.items():
        path = ANALYTICS_DIR / relative
        if not path.exists():
            errors.append(f"generated analytics output differs: docs/analytics/{relative}")
            continue
        try:
            current = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated analytics output docs/analytics/{relative}: {exc}")
            continue
        if current != expected:
            errors.append(f"generated analytics output differs: docs/analytics/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if ANALYTICS_DIR.exists():
        shutil.rmtree(ANALYTICS_DIR)
    for relative, content in outputs.items():
        path = ANALYTICS_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: analytics publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            print("\n".join(f"ERROR: {error}" for error in errors), file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} analytics outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
