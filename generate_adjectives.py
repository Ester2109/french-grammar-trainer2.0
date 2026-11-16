#!/usr/bin/env python3
"""Generate adjectives/adjectives.json and adjectives/adjectives_review.json.

Usage (from project root):
    python -u generate_adjectives.py kaikki.org-dictionary-French.jsonl

Both output files are replaced on successful generation. No extra packages needed.
"""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "adjectives"
FORM_KEYS = (
    "masculine_singular", "feminine_singular",
    "masculine_plural", "feminine_plural",
)
SPECIAL = {"beau": "bel", "nouveau": "nouvel", "vieux": "vieil", "fou": "fol", "mou": "mol"}
OVERRIDES = {
    "beau": ("beau", "belle", "beaux", "belles"),
    "nouveau": ("nouveau", "nouvelle", "nouveaux", "nouvelles"),
    "vieux": ("vieux", "vieille", "vieux", "vieilles"),
    "fou": ("fou", "folle", "fous", "folles"),
    "mou": ("mou", "molle", "mous", "molles"),
    "blanc": ("blanc", "blanche", "blancs", "blanches"),
    "sec": ("sec", "sèche", "secs", "sèches"),
    "frais": ("frais", "fraîche", "frais", "fraîches"),
    "doux": ("doux", "douce", "doux", "douces"),
    "faux": ("faux", "fausse", "faux", "fausses"),
    "roux": ("roux", "rousse", "roux", "rousses"),
    "long": ("long", "longue", "longs", "longues"),
    "public": ("public", "publique", "publics", "publiques"),
    "grec": ("grec", "grecque", "grecs", "grecques"),
    "turc": ("turc", "turque", "turcs", "turques"),
    "gentil": ("gentil", "gentille", "gentils", "gentilles"),
    "nul": ("nul", "nulle", "nuls", "nulles"),
    "cruel": ("cruel", "cruelle", "cruels", "cruelles"),
    "réel": ("réel", "réelle", "réels", "réelles"),
    "pareil": ("pareil", "pareille", "pareils", "pareilles"),
    "meilleur": ("meilleur", "meilleure", "meilleurs", "meilleures"),
    # Colour adjectives derived from nouns are invariable in this use.
    "orange": ("orange", "orange", "orange", "orange"),
    "marron": ("marron", "marron", "marron", "marron"),
}
FORM_OF_RE = re.compile(
    r"\b(?:feminine|masculine)\s+(?:singular|plural)\s+of\b|"
    r"\b(?:plural|singular|inflection|form)\s+of\b", re.I
)


def clean(value):
    return re.sub(r"\s+", " ", value).strip() if isinstance(value, str) else ""


def norm(value):
    return clean(value).casefold()


def tags(obj):
    return {
        t.lower().replace("_", "-")
        for t in (obj.get("tags") or []) if isinstance(t, str)
    }


def senses(entry):
    return [s for s in (entry.get("senses") or []) if isinstance(s, dict)]


def glosses(sense):
    return [clean(g) for g in (sense.get("glosses") or []) if clean(g)]


def is_form_only(entry):
    ss = senses(entry)
    if not ss:
        return "form-of" in tags(entry)
    return all(
        "form-of" in tags(s) or bool(s.get("form_of"))
        or any(FORM_OF_RE.search(g) for g in glosses(s))
        for s in ss
    )


def english(entry):
    result = []
    for s in senses(entry):
        if "form-of" in tags(s) or s.get("form_of") or any(
            FORM_OF_RE.search(g) for g in glosses(s)
        ):
            continue
        for g in glosses(s):
            if g not in result:
                result.append(g)
    return result


def extract_forms(entry):
    result = defaultdict(set)
    for form in entry.get("forms") or []:
        if not isinstance(form, dict):
            continue
        word = clean(form.get("form"))
        if not word or word in ("-", "—"):
            continue
        ts = tags(form)
        for gender in ("masculine", "feminine"):
            for number in ("singular", "plural"):
                if gender in ts and number in ts:
                    result[f"{gender}_{number}"].add(word)
    return result


def regular(word):
    """Conservative fallback; leave uncertain patterns for manual review."""
    if not re.fullmatch(r"[A-Za-zÀ-ÖØ-öø-ÿœŒæÆ'-]+", word):
        return None
    if "-" in word or "'" in word or " " in word:
        return None
    if norm(word) in OVERRIDES:
        return OVERRIDES[norm(word)]
    if word.endswith((
        "eur", "teur", "oux", "eau", "al", "ail", "c", "g", "f",
        "x", "s", "et", "ot", "el", "eil", "en", "on", "ien"
    )):
        return None
    fs = word if word.endswith("e") else word + "e"
    mp = word if word.endswith(("s", "x")) else word + "s"
    fp = fs if fs.endswith(("s", "x")) else fs + "s"
    return (word, fs, mp, fp)


def build(path):
    print(f"Generating adjectives from: {path.resolve()}", flush=True)
    candidates = {}
    form_entries = set()
    total = 0
    with path.open("r", encoding="utf-8", errors="replace") as source:
        for line in source:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("pos") != "adj":
                continue
            word = clean(entry.get("word"))
            if not word:
                continue
            total += 1
            key = norm(word)
            if is_form_only(entry):
                form_entries.add(key)
                continue
            item = candidates.setdefault(key, {
                "word": word,
                "english": [],
                "forms": defaultdict(set),
                "lemma_evidence": False,
            })
            meanings = english(entry)
            if meanings:
                item["lemma_evidence"] = True
            for meaning in meanings:
                if meaning not in item["english"]:
                    item["english"].append(meaning)
            for slot, values in extract_forms(entry).items():
                item["forms"][slot].update(values)

    inflections = defaultdict(set)
    for key, candidate in candidates.items():
        for slot in FORM_KEYS[1:]:
            for value in candidate["forms"].get(slot, ()):
                if norm(value) != key:
                    inflections[norm(value)].add(key)

    results, review = [], []
    removed = rule_count = explicit_count = 0
    for key, candidate in sorted(candidates.items()):
        if not candidate["lemma_evidence"] and key not in OVERRIDES:
            review.append({"word": candidate["word"], "reason": "No independent lexical meaning"})
            continue
        if (key not in OVERRIDES and key in form_entries and inflections.get(key)
                and key not in {norm(v) for v in candidate["forms"].get("masculine_singular", ())}):
            removed += 1
            review.append({"word": candidate["word"], "reason": "Potential inflected headword; needs review"})
            continue

        forms = candidate["forms"]
        if key in OVERRIDES:
            chosen = OVERRIDES[key]
            explicit_count += 1
        else:
            parsed = []
            for slot in FORM_KEYS:
                values = forms.get(slot, set())
                if slot == "masculine_singular" and not values:
                    values = {candidate["word"]}
                parsed.append(next(iter(values)) if len(values) == 1 else None)
            if all(parsed) and norm(parsed[0]) == key:
                chosen = tuple(parsed)
                explicit_count += 1
            else:
                guessed = regular(candidate["word"])
                if guessed is None:
                    review.append({"word": candidate["word"], "reason": "Insufficient or ambiguous inflection evidence"})
                    continue
                if any(forms.get(slot) and guessed[i] not in forms[slot]
                       for i, slot in enumerate(FORM_KEYS)):
                    review.append({"word": candidate["word"], "reason": "Regular rule conflicts with source paradigm"})
                    continue
                chosen = guessed
                rule_count += 1

        output = {
            "word": candidate["word"],
            "english": candidate["english"],
            "forms": dict(zip(FORM_KEYS, chosen)),
        }
        if key in SPECIAL:
            output["forms"]["masculine_before_vowel"] = SPECIAL[key]
        results.append(output)

    # Ensure both common invariable colour adjectives are available even if
    # the source categorizes their adjective sense inconsistently.
    existing = {norm(item["word"]) for item in results}
    for word, translation in (("orange", "orange (colour)"), ("marron", "brown (colour)")):
        if word not in existing:
            results.append({
                "word": word,
                "english": [translation],
                "forms": dict(zip(FORM_KEYS, OVERRIDES[word])),
            })
            review = [item for item in review if norm(item["word"]) != word]
    results.sort(key=lambda item: norm(item["word"]))

    print(f"Adjective entries read: {total:,}", flush=True)
    print(f"Candidate headwords: {len(candidates):,}", flush=True)
    print(f"Potential inflected headwords excluded: {removed:,}", flush=True)
    print(f"Using documented/verified paradigms or overrides: {explicit_count:,}", flush=True)
    print(f"Using conservative regular rules: {rule_count:,}", flush=True)
    print(f"Complete adjectives: {len(results):,}", flush=True)
    print(f"Need review: {len(review):,}", flush=True)

    if len(results) < 1000:
        raise RuntimeError(
            f"Only {len(results)} adjectives found. Existing JSON files were NOT overwritten."
        )
    for word in ("orange", "marron"):
        found = next(item for item in results if norm(item["word"]) == word)
        assert all(found["forms"][slot] == word for slot in FORM_KEYS)

    OUT.mkdir(parents=True, exist_ok=True)
    for target, data in (
        (OUT / "adjectives.json", results),
        (OUT / "adjectives_review.json", review),
    ):
        temporary = target.with_suffix(target.suffix + ".tmp")
        with temporary.open("w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
        temporary.replace(target)
        print(f"Saved: {target}", flush=True)
    print("DONE: JSON files regenerated successfully.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Kaikki French JSONL source file")
    args = parser.parse_args()
    if not args.source.is_file():
        parser.error(f"File not found: {args.source}")
    build(args.source)


if __name__ == "__main__":
    main()
