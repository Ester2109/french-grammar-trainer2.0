
"use strict";

// ==========================================
// ELEMENTS & SETTINGS
// ==========================================

const $ = (id) => document.getElementById(id);

const FORM_KEYS = ["ms", "fs", "mp", "fp", "special"];

const SPECIAL_EXAMPLES = {
  beau: "un bel homme",
  nouveau: "un nouvel ami",
  vieux: "un vieil homme",
  fou: "un fol espoir",
  mou: "un mol effort"
};

let adjectives = [];
let current = null;
let revealed = false;
let savedAnswers = {};

// ==========================================
// TEXT HELPERS
// ==========================================

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ");
}

function searchNormalize(value) {
  return normalize(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const found = value.find(
        (item) =>
          typeof item === "string" && item.trim()
      );

      if (found) return found.trim();
    }
  }

  return "";
}

function getMeanings(raw) {
  const values = Array.isArray(raw) ? raw : [raw];

  return [
    ...new Set(
      values
        .filter((x) => typeof x === "string")
        .map((x) => x.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  ];
}

function shortMeaning(adjective, max = 105) {
  const meanings = adjective.meanings;

  const concise = meanings.filter(
    (text) =>
      text.length <= 60 &&
      text.split(/\s+/).length <= 9
  );

  const result = (concise.length ? concise : meanings)
    .slice(0, 2)
    .join(" / ");

  if (!result) return "Translation unavailable";

  return result.length > max
    ? result.slice(0, max - 1).trimEnd() + "…"
    : result;
}

// ==========================================
// PARSE ADJECTIVES FROM JSON
// ==========================================

function parseAdjective(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const word = firstString(
    entry.french,
    entry.word,
    entry.lemma
  );

  const raw = entry.forms || {};

  const forms = {
    ms: firstString(
      raw.ms,
      raw.masculine_singular
    ),

    fs: firstString(
      raw.fs,
      raw.feminine_singular
    ),

    mp: firstString(
      raw.mp,
      raw.masculine_plural
    ),

    fp: firstString(
      raw.fp,
      raw.feminine_plural
    ),

    special: firstString(
      raw.special,
      raw.masculine_before_vowel,
      raw.masculine_singular_before_vowel,
      entry.masculine_before_vowel
    )
  };

  if (
    !word ||
    !["ms", "fs", "mp", "fp"].every(
      (key) => forms[key]
    )
  ) {
    return null;
  }

  // Masculine singular is the dictionary form.
  const lemma = forms.ms;

  return {
    word: lemma,

    meanings: getMeanings(
      entry.english ??
      entry.translations ??
      entry.translation_en
    ),

    forms,

    specialExample:
      firstString(
        entry.specialExample,
        entry.special_example
      ) ||
      SPECIAL_EXAMPLES[normalize(lemma)] ||
      ""
  };
}

// ==========================================
// SEARCH RANKING
// ==========================================

function searchScore(adjective, query) {
  const word = searchNormalize(adjective.word);

  const meanings = adjective.meanings.map(
    searchNormalize
  );

  // Exact French word
  if (word === query) return 0;

  // Exact English translation
  if (meanings.some((m) => m === query)) {
    return 1;
  }

  // English translation starts with query
  if (
    meanings.some(
      (m) =>
        m.startsWith(query + " ") ||
        m.startsWith(query + " (") ||
        m.startsWith(query + ",") ||
        m.startsWith(query + ";")
    )
  ) {
    return 2;
  }

  // French word starts with query
  if (word.startsWith(query)) return 3;

  // English meaning starts with query
  if (meanings.some((m) => m.startsWith(query))) {
    return 4;
  }

  // English meaning contains the complete word
  if (
    meanings.some((m) =>
      m.split(/[^\p{L}\p{N}]+/u).includes(query)
    )
  ) {
    return 5;
  }

  // French word contains query
  if (word.includes(query)) return 6;

  // English meaning contains query
  if (meanings.some((m) => m.includes(query))) {
    return 7;
  }

  return Infinity;
}

function findMatches(text, limit = 30) {
  const query = searchNormalize(text);

  if (!query) return [];

  return adjectives
    .map((adj) => ({
      adj,
      rank: searchScore(adj, query)
    }))
    .filter((item) => Number.isFinite(item.rank))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.adj.word.localeCompare(b.adj.word, "fr")
    )
    .slice(0, limit)
    .map((item) => item.adj);
}

// ==========================================
// SEARCH SUGGESTIONS
// ==========================================

function closeSuggestions() {
  $("suggestions").classList.add("hidden");

  $("search").setAttribute(
    "aria-expanded",
    "false"
  );
}

function renderSuggestions() {
  const box = $("suggestions");

  box.replaceChildren();

  if (!$("search").value.trim()) {
    closeSuggestions();
    return;
  }

  const matches = findMatches(
    $("search").value,
    30
  );

  if (!matches.length) {
    const empty = document.createElement("div");

    empty.className = "practice-search-empty";

    empty.textContent =
      "No matching adjectives found.";

    box.append(empty);
  }

  for (const adj of matches) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "practice-search-result";

    button.setAttribute("role", "option");

    const content = document.createElement("span");

    content.className =
      "practice-search-result-content";

    const word = document.createElement("span");

    word.className = "practice-search-result-name";
    word.textContent = adj.word;

    const translation = document.createElement("span");

    translation.className =
      "practice-search-result-translation";

    translation.textContent = shortMeaning(
      adj,
      100
    );

    const icon = document.createElement("span");

    icon.className = "practice-search-result-icon";
    icon.textContent = "+";

    content.append(word, translation);
    button.append(content, icon);

    button.addEventListener("click", () => {
      chooseAdjective(adj);
    });

    box.append(button);
  }

  box.classList.remove("hidden");

  $("search").setAttribute(
    "aria-expanded",
    "true"
  );
}

// ==========================================
// ACTIVE ANSWER FIELDS
// ==========================================

function activeKeys() {
  return current?.forms.special
    ? FORM_KEYS
    : FORM_KEYS.slice(0, 4);
}

// ==========================================
// RESET FEEDBACK
// ==========================================

function resetFeedback() {
  for (const key of FORM_KEYS) {
    const input = $(key);

    const hint = document.querySelector(
      `[data-feedback="${key}"]`
    );

    input.classList.remove(
      "correct",
      "incorrect"
    );

    hint.textContent = "";

    hint.classList.add("hidden");
    hint.classList.remove("correct");
  }

  $("feedback").classList.add("hidden");
  $("feedback").textContent = "";
}

// ==========================================
// RESET ANSWERS
// ==========================================

function resetInputs() {
  revealed = false;
  savedAnswers = {};

  for (const key of FORM_KEYS) {
    $(key).value = "";
    $(key).disabled = false;
  }

  $("show").textContent = "Show answers";

  resetFeedback();
}

// ==========================================
// CHOOSE ADJECTIVE
// ==========================================

function chooseAdjective(adj) {
  current = adj;

  // Display masculine singular in search.
  $("search").value = adj.word;

  closeSuggestions();

  // Display selected adjective.
  $("word").textContent = adj.word;

  $("meaning").textContent = shortMeaning(
    adj,
    130
  );

  // Show special form only when applicable.
  $("special-row").classList.toggle(
    "hidden",
    !adj.forms.special
  );

  $("special-example").textContent =
    adj.specialExample
      ? `Example: ${adj.specialExample}`
      : "";

  $("special-example").classList.toggle(
    "hidden",
    !adj.forms.special || !adj.specialExample
  );

  $("exercise-area").classList.remove("hidden");

  resetInputs();
}

// ==========================================
// CHECK ANSWERS
// ==========================================

function checkAnswers(event) {
  event.preventDefault();

  if (!current) return;

  if (revealed) {
    $("feedback").textContent =
      "Hide answers before checking your own responses.";

    $("feedback").classList.remove("hidden");

    return;
  }

  let correct = 0;

  for (const key of activeKeys()) {
    const input = $(key);

    const hint = document.querySelector(
      `[data-feedback="${key}"]`
    );

    const ok =
      normalize(input.value) ===
      normalize(current.forms[key]);

    input.classList.toggle("correct", ok);
    input.classList.toggle("incorrect", !ok);

    hint.classList.remove("hidden");
    hint.classList.toggle("correct", ok);

    hint.textContent = ok
      ? "✓ Correct"
      : `Correct answer: ${current.forms[key]}`;

    if (ok) correct++;
  }

  $("feedback").textContent =
    `${correct} / ${activeKeys().length} correct`;

  $("feedback").classList.remove("hidden");
}

// ==========================================
// SHOW / HIDE ANSWERS
// ==========================================

function toggleAnswers() {
  if (!current) return;

  if (!revealed) {
    // Save user's answers before revealing.
    savedAnswers = Object.fromEntries(
      activeKeys().map((key) => [
        key,
        $(key).value
      ])
    );

    resetFeedback();

    for (const key of activeKeys()) {
      $(key).value = current.forms[key];
      $(key).disabled = true;
    }

    revealed = true;

    $("show").textContent = "Hide answers";

  } else {
    // Restore user's previous answers.
    for (const key of activeKeys()) {
      $(key).value = savedAnswers[key] ?? "";
      $(key).disabled = false;
    }

    revealed = false;

    $("show").textContent = "Show answers";

    resetFeedback();
  }
}

// ==========================================
// RANDOM ADJECTIVE
// ==========================================

function chooseRandomAdjective() {
  if (!adjectives.length) return;

  let choices = adjectives;

  // Avoid repeating the current adjective
  // when more than one is available.
  if (current && adjectives.length > 1) {
    choices = adjectives.filter(
      (adj) => adj.word !== current.word
    );
  }

  const randomIndex = Math.floor(
    Math.random() * choices.length
  );

  chooseAdjective(choices[randomIndex]);
}

// ==========================================
// LOAD ADJECTIVES JSON
// ==========================================

async function init() {
  const randomButton = $("random-btn");

  // Enable Random only after successful loading.
  randomButton.disabled = true;

  try {
    const response = await fetch(
      "../../adjectives.json"
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const raw = await response.json();

    const entries = Array.isArray(raw)
      ? raw
      : raw?.adjectives;

    if (!Array.isArray(entries)) {
      throw new Error("Invalid JSON structure");
    }

    const seen = new Set();

    adjectives = entries
      .map(parseAdjective)
      .filter((adj) => {
        if (!adj) return false;

        const key = normalize(adj.word);

        if (seen.has(key)) return false;

        seen.add(key);

        return true;
      })
      .sort(
        (a, b) =>
          a.word.localeCompare(b.word, "fr")
      );

    if (!adjectives.length) {
      throw new Error(
        "No valid adjective entries"
      );
    }

    // Random no longer depends on a dropdown.
    randomButton.disabled = false;

    $("status").textContent =
      `${adjectives.length.toLocaleString("en-US")} adjectives available`;

  } catch (error) {
    console.error(
      "Could not load adjectives:",
      error
    );

    randomButton.disabled = true;

    $("status").textContent =
      `Could not load adjectives.json (${error.message}). Use Live Server.`;
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

// Search while typing.
$("search").addEventListener(
  "input",
  renderSuggestions
);

// Enter selects the best search result.
$("search").addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      const first = findMatches(
        $("search").value,
        1
      )[0];

      if (first) chooseAdjective(first);

    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  }
);

// Random button.
$("random-btn").addEventListener(
  "click",
  chooseRandomAdjective
);

// Check answers.
$("agreement-form").addEventListener(
  "submit",
  checkAnswers
);

// Show / hide answers.
$("show").addEventListener(
  "click",
  toggleAnswers
);

// Try again.
$("retry").addEventListener(
  "click",
  () => {
    if (!current) return;

    resetInputs();

    $("ms").focus();
  }
);

// Clear individual feedback when typing.
for (const key of FORM_KEYS) {
  $(key).addEventListener("input", () => {
    const input = $(key);

    const hint = document.querySelector(
      `[data-feedback="${key}"]`
    );

    input.classList.remove(
      "correct",
      "incorrect"
    );

    hint.textContent = "";
    hint.classList.add("hidden");

    $("feedback").classList.add("hidden");
  });
}

// Close suggestions when clicking outside.
document.addEventListener(
  "click",
  (event) => {
    if (
      !$("search").contains(event.target) &&
      !$("suggestions").contains(event.target)
    ) {
      closeSuggestions();
    }
  }
);

// ==========================================
// INITIALIZE
// ==========================================

init();
