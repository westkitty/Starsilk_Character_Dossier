#!/usr/bin/env python3
"""Validate candidate text against reusable Starsilk canon invariants.

Default candidate mode checks forbidden patterns only, which is appropriate for
partial scenes/prompts. --complete additionally requires all positive patterns
for the selected scope. --section may be repeated to apply section-specific
locks (for example --section dao).
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CANON = ROOT / "src" / "canon" / "invariants.json"


def evaluate(text: str, canon: dict, sections: list[str], complete: bool) -> dict:
    violations = []
    checked = []

    def apply(lock: dict, scope: str):
        checked.append(lock["id"])
        if complete:
            for pat in lock.get("must_match", []):
                if not re.search(pat, text):
                    violations.append({
                        "lock": lock["id"],
                        "scope": scope,
                        "kind": "required_missing",
                        "pattern": pat,
                        "description": lock.get("description", ""),
                    })
        for pat in lock.get("must_not_match", []):
            if re.search(pat, text):
                violations.append({
                    "lock": lock["id"],
                    "scope": scope,
                    "kind": "forbidden_present",
                    "pattern": pat,
                    "description": lock.get("description", ""),
                })

    for lock in canon.get("document_locks", []):
        apply(lock, "document")

    wanted = set(sections)
    known_sections = {lock.get("section") for lock in canon.get("section_locks", [])}
    unknown = sorted(s for s in wanted if s not in known_sections)
    for section in unknown:
        violations.append({
            "lock": None,
            "scope": section,
            "kind": "unknown_section",
            "pattern": None,
            "description": "No section-specific canon locks are registered for this section.",
        })

    for lock in canon.get("section_locks", []):
        if lock.get("section") in wanted:
            apply(lock, lock["section"])

    return {
        "schema": "starsilk-canon-validation/1",
        "mode": "complete" if complete else "candidate",
        "sections": sorted(wanted),
        "locks_checked": checked,
        "valid": not violations,
        "violations": violations,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate candidate material against Starsilk canon locks")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--file", help="UTF-8 text/HTML file to validate")
    src.add_argument("--text", help="Literal text to validate")
    ap.add_argument("--canon", default=str(DEFAULT_CANON))
    ap.add_argument("--section", action="append", default=[])
    ap.add_argument("--complete", action="store_true", help="Require positive must_match locks as well as forbidden-pattern checks")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    canon_path = Path(args.canon)
    if not canon_path.exists():
        print(f"ERROR: canon file not found: {canon_path}", file=sys.stderr)
        return 2
    canon = json.loads(canon_path.read_text(encoding="utf-8"))
    text = Path(args.file).read_text(encoding="utf-8") if args.file else args.text
    result = evaluate(text, canon, args.section, args.complete)

    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        state = "PASS" if result["valid"] else "FAIL"
        print(f"{state}: {len(result['locks_checked'])} lock(s) checked, {len(result['violations'])} violation(s)")
        for v in result["violations"]:
            lock = v["lock"] or "unregistered-section"
            print(f"- {lock} [{v['scope']}]: {v['kind']} — {v['description']}")
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
