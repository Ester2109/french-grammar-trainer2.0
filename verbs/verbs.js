
/* =========================================
   FRENCH GRAMMAR TRAINER
   Complete script.js — Part 1
========================================= */

const $ = id => document.getElementById(id);

const pronouns = [
  "je",
  "tu",
  "il / elle / on",
  "nous",
  "vous",
  "ils / elles"
];

const imperativePronouns = ["tu", "nous", "vous"];

const moodNames = {
  indicatif: "Indicatif",
  subjonctif: "Subjonctif",
  conditionnel: "Conditionnel",
  imperatif: "Impératif",
  infinitif: "Infinitif",
  participe: "Participe",
  gerondif: "Gérondif",
  constructions: "Other constructions"
};

const tenseNames = {
  present: "Présent",
  passe_compose: "Passé composé",
  imparfait: "Imparfait",
  plus_que_parfait: "Plus-que-parfait",
  passe_simple: "Passé simple",
  passe_anterieur: "Passé antérieur",
  futur_simple: "Futur simple",
  futur_anterieur: "Futur antérieur",
  passe: "Passé",
  passe_premiere_forme: "Passé (1re forme)",
  passe_deuxieme_forme: "Passé (2e forme)",
  futur_proche: "Futur proche",
  passe_recent: "Passé récent",
  present_progressif: "Présent progressif"
};

const validMoods = Object.keys(moodNames);

/* =========================================
   GLOBAL STATE
========================================= */

let verbs = {};
let sortedVerbNames = [];
let filteredVerbNames = [];

let mode = "practice";
let gameType = "custom";

let selectedPracticeVerb = "";
let selectedCustomVerbs = [];

let gameQuestions = [];
let currentQuestion = 0;

let totalCorrect = 0;
let totalAnswers = 0;
let mistakes = [];

let submitted = false;
let answersRevealed = false;

/* =========================================
   HELPERS
========================================= */

function show(id) {
  $(id)?.classList.remove("hidden");
}

function hide(id) {
  $(id)?.classList.add("hidden");
}

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ");
}

function normalizeSearch(text) {
  return normalize(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMoodName(mood) {
  return moodNames[mood] || mood;
}

function getTenseName(mood, tense) {
  return tenseNames[tense] || tense.replaceAll("_", " ");
}

function getLabels(mood, answers) {
  if (mood === "imperatif") {
    return imperativePronouns.slice(0, answers.length);
  }

  if (answers.length === 1) {
    return ["Form"];
  }

  return pronouns.slice(0, answers.length);
}

function isUsableAnswers(answers) {
  return (
    Array.isArray(answers) &&
    [1, 3, 6].includes(answers.length) &&
    answers.every(
      answer =>
        typeof answer === "string" &&
        answer.trim().length > 0
    )
  );
}

function getTranslations(name) {
  const translations = verbs[name]?.translation_en;

  if (Array.isArray(translations)) {
    return translations
      .filter(value => typeof value === "string")
      .map(value => value.trim())
      .filter(Boolean);
  }

  if (
    typeof translations === "string" &&
    translations.trim()
  ) {
    return [translations.trim()];
  }

  return [];
}

function getShortTranslation(name, maxLength = 100) {
  const text = getTranslations(name).join(" · ");

  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 1).trimEnd() + "…";
}

function getAllTenses() {
  const result = [];
  const seen = new Set();

  for (const name of sortedVerbNames) {
    const verb = verbs[name];

    for (const mood of validMoods) {
      const tenses = verb?.[mood];

      if (!tenses || typeof tenses !== "object") {
        continue;
      }

      for (const [tense, answers] of Object.entries(tenses)) {
        if (!isUsableAnswers(answers)) {
          continue;
        }

        const key = `${mood}:${tense}`;

        if (!seen.has(key)) {
          seen.add(key);
          result.push({ mood, tense });
        }
      }
    }
  }

  return result;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/* =========================================
   SEARCH RESULTS
========================================= */

function createSearchResult(name, symbol, onClick) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "practice-search-result";

  const content = document.createElement("span");
  content.className = "practice-search-result-content";

  const verbName = document.createElement("span");
  verbName.className = "practice-search-result-name";
  verbName.textContent = name;

  const translation = document.createElement("span");
  translation.className = "practice-search-result-translation";
  translation.textContent = getShortTranslation(name, 90);

  content.appendChild(verbName);

  if (translation.textContent) {
    content.appendChild(translation);
  }

  const icon = document.createElement("span");
  icon.className = "practice-search-result-icon";
  icon.textContent = symbol;
  icon.setAttribute("aria-hidden", "true");

  button.append(content, icon);
  button.addEventListener("click", onClick);

  return button;
}

function rankSearchMatch(name, search) {
  const normalizedName = normalizeSearch(name);

  if (normalizedName === search) {
    return 0;
  }

  if (normalizedName.startsWith(search)) {
    return 1;
  }

  if (normalizedName.includes(search)) {
    return 2;
  }

  const translations = getTranslations(name);

  if (
    translations.some(
      value => normalizeSearch(value) === search
    )
  ) {
    return 3;
  }

  if (
    translations.some(
      value => normalizeSearch(value).startsWith(search)
    )
  ) {
    return 4;
  }

  return 5;
}

function sortSearchMatches(names, query) {
  const search = normalizeSearch(query);

  return [...names].sort((a, b) => {
    const rankA = rankSearchMatch(a, search);
    const rankB = rankSearchMatch(b, search);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return a.localeCompare(b, "fr");
  });
}

/* =========================================
   FRENCH GRAMMAR TRAINER
   Complete script.js — Part 2

   PRACTICE MODE
========================================= */

/* =========================================
   LOAD VERB DATABASE
========================================= */

async function loadVerbs() {
  try {
    const response = await fetch("verbs.json");

    if (!response.ok) {
      throw new Error(
        `Could not load verbs.json (${response.status})`
      );
    }

    const document = await response.json();
    const database = document.verbs || document;

    if (!database || typeof database !== "object") {
      throw new Error("Invalid verb database");
    }

    verbs = database;

    sortedVerbNames = Object.keys(verbs)
      .filter(name => {
        return (
          !name.startsWith("_") &&
          verbs[name] &&
          typeof verbs[name] === "object"
        );
      })
      .sort((a, b) => a.localeCompare(b, "fr"));

    filteredVerbNames = [...sortedVerbNames];

    updatePracticeVerbs();
    populateGameTenses();
    renderSelectedCustomVerbs();

    console.log(
      `${sortedVerbNames.length} French verbs loaded.`
    );
  } catch (error) {
    console.error("Error loading verbs:", error);

    const message = document.createElement("p");
    message.className = "error-message";
    message.textContent =
      "Could not load the verb database. Please check verbs.json.";

    $("mode-selection")?.appendChild(message);
  }
}

/* =========================================
   PRACTICE MODE: FILTERING
========================================= */

function matchingVerbs(group, regularity, query = "") {
  const search = normalizeSearch(query);

  return sortedVerbNames.filter(name => {
    const data = verbs[name];

    if (!data) {
      return false;
    }

    if (
      group &&
      group !== "all" &&
      String(data.group) !== String(group)
    ) {
      return false;
    }

    if (
      regularity &&
      regularity !== "all" &&
      String(data.regular) !== String(regularity)
    ) {
      return false;
    }

    if (!search) {
      return true;
    }

    if (normalizeSearch(name).includes(search)) {
      return true;
    }

    return getTranslations(name).some(translation => {
      return normalizeSearch(translation).includes(search);
    });
  });
}

function getPracticeFilterMatches(query = "") {
  const group = $("practice-group")?.value || "all";
  const regularity = $("practice-regular")?.value || "all";

  return matchingVerbs(group, regularity, query);
}

/* =========================================
   PRACTICE MODE: UPDATE FILTERS
========================================= */

function updatePracticeVerbs() {
  const searchInput = $("verb-search");
  const query = searchInput?.value || "";

  const previousVerb = selectedPracticeVerb;

  // The available verbs depend on group and regularity.
  // Search only controls the suggestions, not the
  // currently selected exercise.
  filteredVerbNames = getPracticeFilterMatches("");

  const countElement = $("verb-count");

  if (countElement) {
    const count = filteredVerbNames.length;

    countElement.textContent =
      `${count.toLocaleString("en-US")} ` +
      `${count === 1 ? "verb" : "verbs"} available`;
  }

  const randomButton = $("practice-random-btn");

  if (randomButton) {
    randomButton.disabled =
      filteredVerbNames.length === 0;
  }

  if (!filteredVerbNames.length) {
    selectedPracticeVerb = "";
    clearPracticeExercise(
      "No verbs match the selected filters."
    );
  } else if (
    !selectedPracticeVerb ||
    !filteredVerbNames.includes(selectedPracticeVerb)
  ) {
    selectedPracticeVerb = filteredVerbNames[0];

    populateMoods();
    populateTenses();

    if (mode === "practice") {
      renderExercise();
    }
  } else if (previousVerb !== selectedPracticeVerb) {
    populateMoods();
    populateTenses();

    if (mode === "practice") {
      renderExercise();
    }
  }

  // Only display suggestions while the user is searching.
  if (query.trim()) {
    updatePracticeSearchResults();
  } else {
    hidePracticeSearchResults();
  }
}

/* =========================================
   PRACTICE MODE: SEARCH DROPDOWN
========================================= */

function getPracticeSearchResultsContainer() {
  let container = $("practice-search-results");

  if (container) {
    return container;
  }

  const searchInput = $("verb-search");

  if (!searchInput) {
    return null;
  }

  container = document.createElement("div");

  container.id = "practice-search-results";
  container.className =
    "practice-search-results hidden";

  const searchField =
    searchInput.closest(".practice-search-field") ||
    searchInput.parentElement;

  searchField.style.position = "relative";
  searchField.appendChild(container);

  return container;
}

function hidePracticeSearchResults() {
  const container = $("practice-search-results");

  if (container) {
    container.classList.add("hidden");
  }
}

function updatePracticeSearchResults() {
  const input = $("verb-search");
  const container = getPracticeSearchResultsContainer();

  if (!input || !container) {
    return;
  }

  const query = input.value.trim();

  container.replaceChildren();

  if (!query) {
    hidePracticeSearchResults();
    return;
  }

  const matches = sortSearchMatches(
    getPracticeFilterMatches(query),
    query
  ).slice(0, 20);

  if (!matches.length) {
    const empty = document.createElement("p");

    empty.className = "practice-search-empty";
    empty.textContent = "No matching verbs found.";

    container.appendChild(empty);
    container.classList.remove("hidden");

    return;
  }

  for (const name of matches) {
    const button = createSearchResult(
      name,
      "↗",
      () => selectPracticeVerb(name)
    );

    container.appendChild(button);
  }

  container.classList.remove("hidden");
}

/* =========================================
   PRACTICE MODE: SELECT VERB
========================================= */

function selectPracticeVerb(name) {
  if (!verbs[name]) {
    return;
  }

  selectedPracticeVerb = name;

  const searchInput = $("verb-search");

  if (searchInput) {
    searchInput.value = "";
  }

  hidePracticeSearchResults();

  populateMoods();
  populateTenses();

  if (mode === "practice") {
    renderExercise();
  }
}

/* =========================================
   PRACTICE MODE: RANDOM VERB
========================================= */

function pickRandomPracticeVerb() {
  if (!filteredVerbNames.length) {
    return;
  }

  const available = filteredVerbNames.filter(
    name => name !== selectedPracticeVerb
  );

  const pool = available.length
    ? available
    : filteredVerbNames;

  const name = randomItem(pool);

  selectPracticeVerb(name);
}

/* =========================================
   PRACTICE MODE: GRAMMATICAL MOODS
========================================= */

function populateMoods() {
  const select = $("mood-select");

  if (!select) {
    return;
  }

  const previousValue = select.value;
  const verb = verbs[selectedPracticeVerb];

  select.replaceChildren();

  if (!verb) {
    return;
  }

  const availableMoods = validMoods.filter(mood => {
    const tenses = verb[mood];

    if (!tenses || typeof tenses !== "object") {
      return false;
    }

    return Object.values(tenses).some(
      isUsableAnswers
    );
  });

  for (const mood of availableMoods) {
    const option = document.createElement("option");

    option.value = mood;
    option.textContent = getMoodName(mood);

    select.appendChild(option);
  }

  if (availableMoods.includes(previousValue)) {
    select.value = previousValue;
  } else if (availableMoods.length) {
    select.value = availableMoods[0];
  }
}

/* =========================================
   PRACTICE MODE: VERB TENSES
========================================= */

function populateTenses() {
  const select = $("tense-select");
  const mood = $("mood-select")?.value;

  if (!select) {
    return;
  }

  const previousValue = select.value;
  const verb = verbs[selectedPracticeVerb];

  select.replaceChildren();

  if (!verb || !mood || !verb[mood]) {
    return;
  }

  const availableTenses = Object.entries(
    verb[mood]
  )
    .filter(([, answers]) => {
      return isUsableAnswers(answers);
    })
    .map(([tense]) => tense);

  for (const tense of availableTenses) {
    const option = document.createElement("option");

    option.value = tense;
    option.textContent = getTenseName(mood, tense);

    select.appendChild(option);
  }

  if (availableTenses.includes(previousValue)) {
    select.value = previousValue;
  } else if (availableTenses.length) {
    select.value = availableTenses[0];
  }
}

/* =========================================
   PRACTICE MODE: CURRENT EXERCISE
========================================= */

function getPracticeExercise() {
  const verb = selectedPracticeVerb;
  const mood = $("mood-select")?.value;
  const tense = $("tense-select")?.value;

  if (!verb || !mood || !tense) {
    return null;
  }

  const answers = verbs[verb]?.[mood]?.[tense];

  if (!isUsableAnswers(answers)) {
    return null;
  }

  return {
    verb,
    mood,
    tense
  };
}

/* =========================================
   PRACTICE MODE: EMPTY EXERCISE
========================================= */

function clearPracticeExercise(message = "") {
  const title = $("current-verb");
  const translation = $("verb-translation");
  const tenseLabel = $("current-tense");
  const fields = $("answer-fields");

  if (title) {
    title.textContent = message;
  }

  if (translation) {
    translation.textContent = "";
  }

  if (tenseLabel) {
    tenseLabel.textContent = "";
  }

  if (fields) {
    fields.replaceChildren();
  }

  submitted = false;
  answersRevealed = false;

  hide("submit-btn");
  hide("next-btn");
  hide("show-answers-btn");
  hide("feedback");
}

/* =========================================
   PRACTICE MODE: PAGE LAYOUT

   Desired layout:

   Search French or English
   [ Full-width search field ]

   Regularity         Verb group
   [ Select ]         [ Select ]

   Verb               Grammatical mood     Verb tense
   [ Random verb ]    [ Select ]           [ Select ]
========================================= */

function arrangePracticeLayout() {
  const practice = $("practice-settings");

  const search = $("verb-search");
  const regular = $("practice-regular");
  const group = $("practice-group");
  const random = $("practice-random-btn");
  const mood = $("mood-select");
  const tense = $("tense-select");

  if (
    !practice ||
    !search ||
    !regular ||
    !group ||
    !random ||
    !mood ||
    !tense
  ) {
    return;
  }

  // Prevent the layout from being rebuilt twice.
  if (practice.dataset.layoutReady === "true") {
    return;
  }

  function fieldOf(element) {
    return (
      element.closest(
        ".form-group, .select-group, .field-group"
      ) || element.parentElement
    );
  }

  const searchField = fieldOf(search);
  const regularField = fieldOf(regular);
  const groupField = fieldOf(group);
  const moodField = fieldOf(mood);
  const tenseField = fieldOf(tense);

  // Use the existing filter container.
  const filterPanel = searchField.parentElement;

  const filterGrid = document.createElement("div");
  filterGrid.className = "practice-filter-grid";

  filterPanel.insertBefore(filterGrid, searchField);

  searchField.classList.add("practice-search-field");
  regularField.classList.add("practice-regularity-field");
  groupField.classList.add("practice-group-field");

  filterGrid.appendChild(searchField);
  filterGrid.appendChild(regularField);
  filterGrid.appendChild(groupField);

  // Create a clean three-column exercise row.
  const controlsRow = document.createElement("div");
  controlsRow.className = "practice-controls-row";

  // Insert the row before the original mood field.
  moodField.parentElement.insertBefore(
    controlsRow,
    moodField
  );

  const randomField = document.createElement("div");
  randomField.className = "practice-random-field";

  const randomLabel = document.createElement("label");
  randomLabel.className = "practice-control-label";
  randomLabel.textContent = "Verb";

  randomField.appendChild(randomLabel);
  randomField.appendChild(random);

  controlsRow.appendChild(randomField);
  controlsRow.appendChild(moodField);
  controlsRow.appendChild(tenseField);

  // Remove empty wrappers left behind by the old layout
  // only if they contain no other elements.
  practice.dataset.layoutReady = "true";
}

/* =========================================
   FRENCH GRAMMAR TRAINER
   Complete script.js — Part 3

   GAME MODE
========================================= */

/* =========================================
   GAME MODE: OPEN AND SWITCH TYPE
========================================= */

function startGame() {
  if (!sortedVerbNames.length) {
    return;
  }

  mode = "game";

  hide("mode-selection");
  hide("practice-settings");
  hide("exercise-area");
  hide("final-results");

  show("exercise-panel");
  show("game-settings");

  hide("game-error");

  // Choose verbs is always the default.
  setGameType("custom");
}

function setGameType(type) {
  gameType = type;

  const customButton = $("game-custom-mode-btn");
  const randomButton = $("game-random-mode-btn");

  if (customButton) {
    customButton.classList.toggle(
      "active",
      type === "custom"
    );

    customButton.setAttribute(
      "aria-pressed",
      String(type === "custom")
    );
  }

  if (randomButton) {
    randomButton.classList.toggle(
      "active",
      type === "random"
    );

    randomButton.setAttribute(
      "aria-pressed",
      String(type === "random")
    );
  }

  if (type === "custom") {
    show("game-custom-settings");
    hide("game-random-settings");

    renderSelectedCustomVerbs();
    updateCustomVerbSearch();
  } else {
    hide("game-custom-settings");
    show("game-random-settings");

    hide("game-custom-search-results");
  }

  hide("game-error");
}

/* =========================================
   GAME MODE: SEARCH FOR VERBS
========================================= */

function updateCustomVerbSearch() {
  const input = $("game-custom-search");
  const container = $("game-custom-search-results");

  if (!input || !container) {
    return;
  }

  const query = input.value.trim();

  container.replaceChildren();

  if (!query) {
    hide("game-custom-search-results");
    return;
  }

  const search = normalizeSearch(query);

  const matches = sortedVerbNames.filter(name => {
    if (selectedCustomVerbs.includes(name)) {
      return false;
    }

    if (normalizeSearch(name).includes(search)) {
      return true;
    }

    return getTranslations(name).some(translation => {
      return normalizeSearch(translation).includes(search);
    });
  });

  const sortedMatches = sortSearchMatches(
    matches,
    query
  ).slice(0, 20);

  if (!sortedMatches.length) {
    const empty = document.createElement("p");

    empty.className = "practice-search-empty";
    empty.textContent = "No matching verbs found.";

    container.appendChild(empty);
    show("game-custom-search-results");

    return;
  }

  // Same result design as Practice Mode,
  // with a plus sign instead of an arrow.

  for (const name of sortedMatches) {
    const result = createSearchResult(
      name,
      "+",
      () => addCustomVerb(name)
    );

    container.appendChild(result);
  }

  show("game-custom-search-results");
}

/* =========================================
   GAME MODE: ADD A VERB
========================================= */

function addCustomVerb(name) {
  if (!verbs[name]) {
    return;
  }

  if (selectedCustomVerbs.includes(name)) {
    return;
  }

  selectedCustomVerbs.push(name);

  const search = $("game-custom-search");

  if (search) {
    search.value = "";
  }

  hide("game-custom-search-results");
  renderSelectedCustomVerbs();

  hide("game-error");

  search?.focus();
}

/* =========================================
   GAME MODE: REMOVE A VERB
========================================= */

function removeCustomVerb(name) {
  selectedCustomVerbs = selectedCustomVerbs.filter(
    verb => verb !== name
  );

  renderSelectedCustomVerbs();

  const search = $("game-custom-search");

  if (search?.value.trim()) {
    updateCustomVerbSearch();
  }
}

/* =========================================
   GAME MODE: SELECTED VERB TAGS
========================================= */

function renderSelectedCustomVerbs() {
  const container = $("game-selected-verbs");
  const counter = $("game-selected-count");

  if (!container) {
    return;
  }

  container.replaceChildren();

  const count = selectedCustomVerbs.length;

  if (counter) {
    counter.textContent =
      `${count} ${count === 1 ? "verb" : "verbs"} selected`;
  }

  if (!count) {
    const empty = document.createElement("p");

    empty.className = "game-custom-empty";
    empty.textContent = "No verbs selected yet.";

    container.appendChild(empty);

    return;
  }

  for (const name of selectedCustomVerbs) {
    const tag = document.createElement("span");
    tag.className = "game-selected-tag";

    const text = document.createElement("span");
    text.textContent = name;

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.className = "game-selected-remove";
    removeButton.textContent = "×";

    removeButton.setAttribute(
      "aria-label",
      `Remove ${name}`
    );

    removeButton.addEventListener("click", () => {
      removeCustomVerb(name);
    });

    tag.append(text, removeButton);
    container.appendChild(tag);
  }
}

/* =========================================
   GAME MODE: AVAILABLE TENSES
========================================= */

function populateGameTenses() {
  const container = $("tense-checkboxes");

  if (!container) {
    return;
  }

  container.replaceChildren();

  const allTenses = getAllTenses();

  for (const mood of validMoods) {
    const available = allTenses.filter(
      item => item.mood === mood
    );

    if (!available.length) {
      continue;
    }

    const group = document.createElement("div");
    group.className = "tense-group";

    const title = document.createElement("h4");
    title.textContent = getMoodName(mood);

    group.appendChild(title);

    for (const { tense } of available) {
      const label = document.createElement("label");
      label.className = "tense-option";

      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.value = `${mood}:${tense}`;

      // All tenses are unchecked by default.
      checkbox.checked = false;

      const text = document.createElement("span");
      text.textContent = getTenseName(mood, tense);

      label.append(checkbox, text);
      group.appendChild(label);
    }

    container.appendChild(group);
  }
}

/* =========================================
   GAME MODE: SELECT ALL / DESELECT ALL
========================================= */

function setAllTenses(checked) {
  const checkboxes = document.querySelectorAll(
    "#tense-checkboxes input[type='checkbox']"
  );

  checkboxes.forEach(checkbox => {
    checkbox.checked = checked;
  });
}

function getSelectedTenses() {
  return Array.from(
    document.querySelectorAll(
      "#tense-checkboxes input[type='checkbox']:checked"
    )
  ).map(checkbox => checkbox.value);
}

/* =========================================
   GAME MODE: ERRORS
========================================= */

function showGameError(message) {
  const element = $("game-error");

  if (!element) {
    return;
  }

  element.textContent = message;
  show("game-error");
}

/* =========================================
   GAME MODE: RANDOM QUESTIONS
========================================= */

function buildRandomQuestions(selectedTenses) {
  const count = Number(
    $("question-count")?.value || 10
  );

  if (!Number.isInteger(count) || count < 1) {
    showGameError(
      "Please choose a valid number of questions."
    );

    return null;
  }

  const pool = [];

  // Random Mode uses all verbs in the database.
  // Group and regularity filters only apply
  // to Practice Mode.

  for (const verb of sortedVerbNames) {
    const data = verbs[verb];

    for (const key of selectedTenses) {
      const [mood, tense] = key.split(":");

      if (isUsableAnswers(data?.[mood]?.[tense])) {
        pool.push({
          verb,
          mood,
          tense
        });
      }
    }
  }

  if (!pool.length) {
    showGameError(
      "No exercises are available for the selected tenses."
    );

    return null;
  }

  shuffle(pool);

  const questions = [];

  while (questions.length < count) {
    const remaining = count - questions.length;

    questions.push(
      ...pool.slice(0, remaining)
    );

    if (questions.length < count) {
      shuffle(pool);
    }
  }

  return questions;
}

/* =========================================
   GAME MODE: CHOSEN VERBS
========================================= */

function buildCustomQuestions(selectedTenses) {
  if (!selectedCustomVerbs.length) {
    showGameError(
      "Please select at least one verb."
    );

    return null;
  }

  const questions = [];
  const unavailable = [];

  for (const verb of selectedCustomVerbs) {
    let availableCount = 0;

    for (const key of selectedTenses) {
      const [mood, tense] = key.split(":");

      const answers = verbs[verb]?.[mood]?.[tense];

      if (isUsableAnswers(answers)) {
        questions.push({
          verb,
          mood,
          tense
        });

        availableCount++;
      }
    }

    if (!availableCount) {
      unavailable.push(verb);
    }
  }

  if (unavailable.length) {
    showGameError(
      "No selected tense is available for: " +
      unavailable.join(", ") +
      ". Choose another tense or remove these verbs."
    );

    return null;
  }

  if (!questions.length) {
    showGameError(
      "No exercises are available for this selection."
    );

    return null;
  }

  // Every selected verb is tested in each
  // selected tense that exists in the database.

  return shuffle(questions);
}

/* =========================================
   GAME MODE: BEGIN GAME
========================================= */

function beginGame() {
  const selectedTenses = getSelectedTenses();

  if (!selectedTenses.length) {
    showGameError(
      "Please select at least one verb tense."
    );

    return;
  }

  let questions;

  if (gameType === "random") {
    questions = buildRandomQuestions(selectedTenses);
  } else {
    questions = buildCustomQuestions(selectedTenses);
  }

  if (!questions || !questions.length) {
    return;
  }

  gameQuestions = questions;

  currentQuestion = 0;
  totalCorrect = 0;
  totalAnswers = 0;
  mistakes = [];

  submitted = false;
  answersRevealed = false;

  hide("game-error");
  hide("game-settings");
  hide("final-results");

  show("exercise-area");

  renderExercise(true);
}

/* =========================================
   CURRENT EXERCISE

   Shared by Practice Mode and Game Mode.
========================================= */

function getCurrentExercise() {
  if (mode === "game") {
    return gameQuestions[currentQuestion] || null;
  }

  return getPracticeExercise();
}

/* =========================================
   FRENCH GRAMMAR TRAINER
   Complete script.js — Part 4

   EXERCISES, RESULTS AND INITIALIZATION
========================================= */

/* =========================================
   NAVIGATION
========================================= */

function openTrainer() {
  hide("categories");
  show("trainer");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function backToCategories() {
  window.location.href = "../index.html#categories";
}

function changeMode() {
  hide("exercise-panel");
  hide("exercise-area");
  hide("final-results");

  show("mode-selection");

  hidePracticeSearchResults();
  hide("game-custom-search-results");
}

/* =========================================
   PRACTICE MODE: START
========================================= */

function startPractice() {
  if (!sortedVerbNames.length) {
    return;
  }

  mode = "practice";

  hide("mode-selection");
  hide("game-settings");
  hide("final-results");

  show("exercise-panel");
  show("practice-settings");
  show("exercise-area");

  hidePracticeSearchResults();

  if (!selectedPracticeVerb && filteredVerbNames.length) {
    selectPracticeVerb(filteredVerbNames[0]);
  }

  renderExercise(false);
}

/* =========================================
   EXERCISE: RENDER
========================================= */

function renderExercise(focus = false) {
  const exercise = getCurrentExercise();

  if (!exercise) {
    if (mode === "practice") {
      clearPracticeExercise("No verb selected");
    }

    return;
  }

  const { verb, mood, tense } = exercise;
  const answers = verbs[verb]?.[mood]?.[tense];

  if (!isUsableAnswers(answers)) {
    if (mode === "practice") {
      clearPracticeExercise(
        "No conjugation available"
      );
    }

    return;
  }

  submitted = false;
  answersRevealed = false;

  const submitButton = $("submit-btn");
  const showAnswersButton = $("show-answers-btn");

  if (submitButton) {
    submitButton.textContent = "Check answers →";
  }

  if (showAnswersButton) {
    showAnswersButton.textContent = "Show answers";
  }

  // Verb heading

  const verbTitle =
    $("verb-title") || $("current-verb");

  if (verbTitle) {
    verbTitle.textContent = verb;
  }

  // English translation

  const translationElement = $("verb-translation");

  if (translationElement) {
    translationElement.textContent =
      getTranslations(verb).join(" · ");
  }

  // Mood and tense heading

  const tenseTitle =
    $("tense-title") || $("current-tense");

  if (tenseTitle) {
    tenseTitle.textContent =
      `${getMoodName(mood)} — ${getTenseName(mood, tense)}`;
  }

  // Progress

  const progress = $("progress-label");

  if (progress) {
    progress.textContent =
      mode === "game"
        ? `QUESTION ${currentQuestion + 1} OF ${gameQuestions.length}`
        : "PRACTICE MODE";
  }

  // Answer fields

  const labels = getLabels(mood, answers);
  const container = $("answer-fields");

  if (!container) {
    return;
  }

  container.replaceChildren();

  answers.forEach((answer, index) => {
    const row = document.createElement("div");
    row.className = "answer-row";

    const label = document.createElement("label");

    label.htmlFor = `answer-${index}`;
    label.textContent = labels[index] || "Form";

    const input = document.createElement("input");

    input.type = "text";
    input.id = `answer-${index}`;
    input.className = "answer-input";
    input.autocomplete = "off";
    input.spellcheck = false;

    row.append(label, input);
    container.appendChild(row);
  });

  show("submit-btn");
  hide("feedback");
  hide("next-btn");

  if (mode === "practice") {
    show("show-answers-btn");
  } else {
    hide("show-answers-btn");
  }

  // Do not automatically focus answer inputs
  // when Practice Mode filters are changed.

  if (focus && mode === "game") {
    container.querySelector("input")?.focus();
  }
}

/* =========================================
   PRACTICE MODE: SHOW ANSWERS
========================================= */

function showAnswers() {
  if (mode !== "practice") {
    return;
  }

  const exercise = getCurrentExercise();

  if (!exercise) {
    return;
  }

  const { verb, mood, tense } = exercise;
  const answers = verbs[verb]?.[mood]?.[tense];

  if (!isUsableAnswers(answers)) {
    return;
  }

  answersRevealed = true;
  submitted = false;

  answers.forEach((answer, index) => {
    const input = $(`answer-${index}`);

    if (!input) {
      return;
    }

    input.value = answer;
    input.disabled = true;

    input.classList.remove(
      "correct",
      "incorrect"
    );

    input.classList.add("revealed");

    input.parentElement
      .querySelector(".correction")
      ?.remove();
  });

  $("submit-btn").textContent = "Check answers →";
  $("show-answers-btn").textContent = "Hide answers";

  show("submit-btn");
  hide("feedback");
  hide("next-btn");
}

/* =========================================
   PRACTICE MODE: TRY AGAIN
========================================= */

function tryAgain() {
  submitted = false;
  answersRevealed = false;

  const inputs = document.querySelectorAll(
    "#answer-fields .answer-input"
  );

  inputs.forEach(input => {
    input.value = "";
    input.disabled = false;

    input.classList.remove(
      "correct",
      "incorrect",
      "revealed"
    );

    input.parentElement
      .querySelector(".correction")
      ?.remove();
  });

  $("submit-btn").textContent = "Check answers →";
  $("show-answers-btn").textContent = "Show answers";

  show("submit-btn");
  hide("feedback");
  hide("next-btn");

  inputs[0]?.focus();
}

/* =========================================
   ANSWER NORMALIZATION
========================================= */

function removeOptionalSubject(text, index, mood, length) {
  let answer = normalize(text);

  if (length !== 6 || mood === "imperatif") {
    return answer;
  }

  const prefixes = [
    ["je ", "j'"],
    ["tu "],
    ["il ", "elle ", "on "],
    ["nous "],
    ["vous "],
    ["ils ", "elles "]
  ];

  const possiblePrefixes = prefixes[index] || [];

  for (const prefix of possiblePrefixes) {
    if (answer.startsWith(prefix)) {
      return answer.slice(prefix.length);
    }
  }

  return answer;
}

function isCorrectAnswer(
  input,
  expected,
  index,
  mood,
  length
) {
  const normalizedInput = removeOptionalSubject(
    input,
    index,
    mood,
    length
  );

  return normalizedInput === normalize(expected);
}

/* =========================================
   EXERCISE: CHECK ANSWERS
========================================= */

function checkAnswers(event) {
  event.preventDefault();

  if (answersRevealed) {
    return;
  }

  if (submitted && mode === "practice") {
    tryAgain();
    return;
  }

  if (submitted) {
    return;
  }

  const exercise = getCurrentExercise();

  if (!exercise) {
    return;
  }

  const { verb, mood, tense } = exercise;
  const answers = verbs[verb]?.[mood]?.[tense];

  if (!isUsableAnswers(answers)) {
    return;
  }

  const labels = getLabels(mood, answers);

  let correct = 0;

  answers.forEach((expected, index) => {
    const input = $(`answer-${index}`);

    if (!input) {
      return;
    }

    const userAnswer = input.value;

    const valid = isCorrectAnswer(
      userAnswer,
      expected,
      index,
      mood,
      answers.length
    );

    input.disabled = true;

    if (valid) {
      input.classList.add("correct");
      correct++;
    } else {
      input.classList.add("incorrect");

      const correction = document.createElement("span");

      correction.className = "correction";
      correction.textContent =
        `Correct answer: ${expected}`;

      input.parentElement.appendChild(correction);

      if (mode === "game") {
        mistakes.push({
          verb,
          mood,
          tense,
          pronoun: labels[index] || "Form",
          answer: userAnswer.trim() || "(blank)",
          expected
        });
      }
    }
  });

  submitted = true;

  if (mode === "game") {
    totalCorrect += correct;
    totalAnswers += answers.length;
  }

  const percentage = Math.round(
    (correct / answers.length) * 100
  );

  const feedback = $("feedback");

  if (feedback) {
    feedback.textContent =
      `${correct} / ${answers.length} correct (${percentage}%)`;
  }

  show("feedback");

  if (mode === "practice") {
    $("submit-btn").textContent = "Try again ↻";
    show("submit-btn");
  } else {
    hide("submit-btn");

    $("next-btn").textContent =
      currentQuestion === gameQuestions.length - 1
        ? "See results →"
        : "Next question →";

    show("next-btn");
  }
}

/* =========================================
   GAME MODE: NEXT QUESTION
========================================= */

function nextQuestion() {
  currentQuestion++;

  if (currentQuestion >= gameQuestions.length) {
    finishGame();
  } else {
    renderExercise(true);
  }
}

/* =========================================
   GAME MODE: FINAL RESULTS
========================================= */

function finishGame() {
  hide("exercise-area");
  show("final-results");

  const percentage = totalAnswers
    ? Math.round((totalCorrect / totalAnswers) * 100)
    : 0;

  const container = $("final-results");

  if (!container) {
    return;
  }

  container.replaceChildren();

  const title = document.createElement("h2");
  title.textContent = "Challenge completed!";

  const score = document.createElement("h3");
  score.textContent = `${percentage}%`;

  const summary = document.createElement("p");

  summary.textContent =
    `You got ${totalCorrect} out of ` +
    `${totalAnswers} answers correct.`;

  container.append(title, score, summary);

  if (mistakes.length) {
    const heading = document.createElement("h3");
    heading.textContent = "Review your mistakes";

    const list = document.createElement("ul");
    list.className = "result-detail";

    for (const item of mistakes) {
      const li = document.createElement("li");

      const strong = document.createElement("strong");

      strong.textContent =
        `${item.verb} — ` +
        `${getMoodName(item.mood)}, ` +
        `${getTenseName(item.mood, item.tense)}`;

      const detail = document.createElement("div");

      detail.textContent =
        `${item.pronoun}: ` +
        `${item.answer} → ${item.expected}`;

      li.append(strong, detail);
      list.appendChild(li);
    }

    container.append(heading, list);
  } else {
    const perfect = document.createElement("p");

    perfect.textContent =
      "Perfect score! Excellent work!";

    container.appendChild(perfect);
  }

  const again = document.createElement("button");

  again.type = "button";
  again.className = "primary-button";
  again.textContent = "Play again →";

  again.addEventListener("click", startGame);

  container.appendChild(again);
}

/* =========================================
   EVENT LISTENERS
========================================= */

function initializeEventListeners() {
  // Navigation

  $("back-button")?.addEventListener(
    "click",
    backToCategories
  );

  $("change-mode-btn")?.addEventListener(
    "click",
    changeMode
  );

  // Practice / Game

  $("practice-btn")?.addEventListener(
    "click",
    startPractice
  );

  $("game-btn")?.addEventListener(
    "click",
    startGame
  );

  // Practice filters

  $("practice-group")?.addEventListener(
    "change",
    () => {
      updatePracticeVerbs();
      hidePracticeSearchResults();
    }
  );

  $("practice-regular")?.addEventListener(
    "change",
    () => {
      updatePracticeVerbs();
      hidePracticeSearchResults();
    }
  );

  // Practice search

  $("verb-search")?.addEventListener(
    "input",
    updatePracticeSearchResults
  );

  $("verb-search")?.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        hidePracticeSearchResults();
      }

      if (event.key === "Enter") {
        const first = $("practice-search-results")
          ?.querySelector(".practice-search-result");

        if (first) {
          event.preventDefault();
          first.click();
        }
      }
    }
  );

  // Close search results when clicking outside.

  document.addEventListener("pointerdown", event => {
    const search = $("verb-search");
    const results = $("practice-search-results");

    if (
      search &&
      results &&
      !search.contains(event.target) &&
      !results.contains(event.target)
    ) {
      hidePracticeSearchResults();
    }

    const gameSearch = $("game-custom-search");
    const gameResults = $("game-custom-search-results");

    if (
      gameSearch &&
      gameResults &&
      !gameSearch.contains(event.target) &&
      !gameResults.contains(event.target)
    ) {
      hide("game-custom-search-results");
    }
  });

  // Random verb

  $("practice-random-btn")?.addEventListener(
    "click",
    pickRandomPracticeVerb
  );

  // Mood / Tense

  $("mood-select")?.addEventListener(
    "change",
    () => {
      populateTenses();

      if (mode === "practice") {
        renderExercise(false);
      }
    }
  );

  $("tense-select")?.addEventListener(
    "change",
    () => {
      if (mode === "practice") {
        renderExercise(false);
      }
    }
  );

  // Game type

  $("game-custom-mode-btn")?.addEventListener(
    "click",
    () => setGameType("custom")
  );

  $("game-random-mode-btn")?.addEventListener(
    "click",
    () => setGameType("random")
  );

  // Game verb search

  $("game-custom-search")?.addEventListener(
    "input",
    updateCustomVerbSearch
  );

  // Game tense selection

  $("select-all-btn")?.addEventListener(
    "click",
    () => setAllTenses(true)
  );

  $("deselect-all-btn")?.addEventListener(
    "click",
    () => setAllTenses(false)
  );

  // Start game

  $("start-game-button")?.addEventListener(
    "click",
    beginGame
  );

  // Answer form

  $("conjugation-form")?.addEventListener(
    "submit",
    checkAnswers
  );

  // Show / hide answers

  $("show-answers-btn")?.addEventListener(
    "click",
    () => {
      if (mode !== "practice") {
        return;
      }

      if (answersRevealed) {
        tryAgain();
      } else {
        showAnswers();
      }
    }
  );

  // Next question

  $("next-btn")?.addEventListener(
    "click",
    nextQuestion
  );
}

/* =========================================
   INITIALIZATION
========================================= */

function initializeTrainer() {
  initializeEventListeners();

  // Build the new Practice Mode layout.
  arrangePracticeLayout();

  // Load the French verb database.
  loadVerbs();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeTrainer
  );
} else {
  initializeTrainer();
}
