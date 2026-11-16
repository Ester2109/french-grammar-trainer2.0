#!/usr/bin/env python3
"""Generate adverbs/adverbs.json from the same Kaikki French JSONL as the adjective generator.

Run from french-grammar-trainer/: python generate_adverbs.py kaikki.org-dictionary-French.jsonl
No third-party dependencies. Existing output is preserved if no adverbs are found.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FORM_OF = re.compile(r"\b(?:plural|singular|inflection|form)\s+of\b", re.I)

def norm(s):
    return " ".join(s.strip().split()).casefold()

def is_form_sense(s):
    tags = {str(t).lower() for t in s.get("tags", [])}
    glosses = s.get("glosses") or []
    return "form-of" in tags or bool(s.get("form_of")) or any(FORM_OF.search(g) for g in glosses if isinstance(g, str))

def generate(source):
    found = {}
    with source.open(encoding="utf-8", errors="replace") as stream:
        for line in stream:
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            if item.get("pos") != "adv":
                continue
            word = item.get("word")
            if not isinstance(word, str) or not word.strip():
                continue
            meanings = []
            for sense in item.get("senses") or []:
                if not isinstance(sense, dict) or is_form_sense(sense):
                    continue
                for gloss in sense.get("glosses") or []:
                    if isinstance(gloss, str) and gloss.strip() and gloss not in meanings:
                        meanings.append(gloss.strip())
            if not meanings:
                continue
            key = norm(word)
            record = found.setdefault(key, {"word": word.strip(), "english": []})
            for meaning in meanings:
                if meaning not in record["english"]:
                    record["english"].append(meaning)
    result = sorted(found.values(), key=lambda r: norm(r["word"]))
    print(f"Adverbs found: {len(result):,}", flush=True)
    if len(result) < 100:
        raise RuntimeError("Too few adverbs; existing output was not overwritten. Check the input file.")
    output = ROOT / "adverbs" / "adverbs.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".json.tmp")
    with temporary.open("w", encoding="utf-8") as file:
        json.dump(result, file, ensure_ascii=False, indent=2)
    temporary.replace(output)
    print(f"Saved: {output}", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    if not args.source.is_file():
        parser.error(f"File not found: {args.source}")
    generate(args.source)
