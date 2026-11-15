
import json
import re
from pathlib import Path

# ==========================================
# FILE PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

SOURCE_FILE = BASE_DIR / "kaikki.org-dictionary-French.jsonl"
OUTPUT_FILE = BASE_DIR / "nouns" / "nouns_all.json"


# ==========================================
# HELPERS
# ==========================================

def get_genders(entry):
    """Find all grammatical genders."""

    genders = set()

    for tag in entry.get("tags", []):
        if tag == "masculine":
            genders.add("masculine")
        elif tag == "feminine":
            genders.add("feminine")

    for template in entry.get("head_templates", []):
        args = template.get("args", {})

        for key in ("1", "g", "g2"):
            value = str(args.get(key, "")).lower()

            if value in ("m", "m-p", "m-in"):
                genders.add("masculine")
            elif value in ("f", "f-p", "f-in"):
                genders.add("feminine")
            elif value in ("mf", "mf-p", "mfbysense", "m or f"):
                genders.update(("masculine", "feminine"))

        expansion = template.get("expansion", "")

        match = re.search(
            r"(?:^|\s)(m|f|mf)(?=\s|$|\()",
            expansion
        )

        if match:
            marker = match.group(1)

            if marker == "m":
                genders.add("masculine")
            elif marker == "f":
                genders.add("feminine")
            else:
                genders.update(("masculine", "feminine"))

    return sorted(genders)


def get_translations(entry):
    """Collect English definitions."""

    translations = []

    for sense in entry.get("senses", []):
        for gloss in sense.get("glosses", []):
            if not isinstance(gloss, str):
                continue

            gloss = gloss.strip()

            if (
                2 <= len(gloss) <= 200
                and gloss not in translations
            ):
                translations.append(gloss)

    return translations


def get_number(entry):
    """Identify grammatical number when possible."""

    tags = set(entry.get("tags", []))

    for sense in entry.get("senses", []):
        tags.update(sense.get("tags", []))

    for template in entry.get("head_templates", []):
        args = template.get("args", {})

        for key in ("1", "g", "g2"):
            value = str(args.get(key, "")).lower()

            if value in ("m-p", "f-p", "mf-p", "p"):
                return "plural"

        expansion = template.get("expansion", "")

        if re.search(r"\b(?:m|f|mf)\s+p\b", expansion):
            return "plural"

    if "plural" in tags or "plural-only" in tags:
        return "plural"

    if "singular" in tags or "singular-only" in tags:
        return "singular"

    return "unknown"


# ==========================================
# EXTRACT ALL NOUNS
# ==========================================

nouns = {}
processed = 0

if not SOURCE_FILE.exists():
    raise FileNotFoundError(
        f"Source file not found: {SOURCE_FILE}"
    )

with SOURCE_FILE.open("r", encoding="utf-8") as file:

    for line in file:
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        if entry.get("lang_code") != "fr":
            continue

        if entry.get("pos") != "noun":
            continue

        word = entry.get("word", "")

        if not isinstance(word, str):
            continue

        word = word.strip()

        if not word:
            continue

        processed += 1

        key = word.casefold()

        genders = get_genders(entry)
        translations = get_translations(entry)
        number = get_number(entry)

        if key not in nouns:
            nouns[key] = {
                "word": word,
                "translations": [],
                "genders": [],
                "numbers": []
            }

        noun = nouns[key]

        for translation in translations:
            if translation not in noun["translations"]:
                noun["translations"].append(translation)

        for gender in genders:
            if gender not in noun["genders"]:
                noun["genders"].append(gender)

        if number not in noun["numbers"]:
            noun["numbers"].append(number)


# ==========================================
# SORT AND SAVE
# ==========================================

result = sorted(
    nouns.values(),
    key=lambda item: item["word"].casefold()
)

for noun in result:
    noun["genders"].sort()
    noun["numbers"].sort()

OUTPUT_FILE.parent.mkdir(
    parents=True,
    exist_ok=True
)

with OUTPUT_FILE.open("w", encoding="utf-8") as file:
    json.dump(
        result,
        file,
        ensure_ascii=False,
        indent=2
    )


# ==========================================
# SUMMARY
# ==========================================

print()
print("Finished!")
print(f"Processed noun entries: {processed}")
print(f"Saved unique nouns: {len(result)}")
print(f"Output: {OUTPUT_FILE}")
print()
print("Your nouns_singular.json was not modified.")
