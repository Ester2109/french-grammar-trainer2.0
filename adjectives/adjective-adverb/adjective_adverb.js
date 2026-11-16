
"use strict";

/* ==========================================
   ADJECTIVE OR ADVERB — GAME MODE
========================================== */

const $ = (id) => document.getElementById(id);

// Correct paths relative to adjective_adverb.html
const DATA_URL = "../adjectives.json";
const ADVERBS_URL = "../../adverbs/adverbs.json";

const classes = ["adjective", "both", "adverb"];

let words = [];
let questions = [];
let currentIndex = 0;
let correctAnswers = 0;
let mistakes = [];
let answerLocked = false;
let nextQuestionTimer = null;

/* ==========================================
   HELPERS
========================================== */

function cleanWord(value) {
  return typeof value === "string" ? value.trim() : "";
}

function wordKey(value) {
  return cleanWord(value)
    .normalize("NFC")
    .toLocaleLowerCase("fr");
}

function translation(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.find(
      (x) => typeof x === "string" && x.trim()
    ) || "";
  }

  return "";
}

async function loadJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(`${url}: expected JSON array`);
  }

  return data;
}

/* ==========================================
   LOAD ADJECTIVES AND ADVERBS
========================================== */

async function loadWords() {
  try {
    const [adjectives, adverbs] = await Promise.all([
      loadJSON(DATA_URL),
      loadJSON(ADVERBS_URL)
    ]);

    const byWord = new Map();

    for (const [entries, pos] of [
      [adjectives, "adjective"],
      [adverbs, "adverb"]
    ]) {
      for (const entry of entries) {
        const word = cleanWord(entry?.word);

        if (!word) continue;

        const key = wordKey(word);

        if (!byWord.has(key)) {
          byWord.set(key, {
            word,
            english: "",
            classes: new Set()
          });
        }

        const record = byWord.get(key);

        record.classes.add(pos);

        if (!record.english) {
          record.english = translation(
            entry.english || entry.translation
          );
        }
      }
    }

    words = [...byWord.values()].map((item) => ({
      word: item.word,
      translation: item.english,
      answer:
        item.classes.size === 2
          ? "both"
          : [...item.classes][0]
    }));

    if (!words.length) {
      throw new Error("No valid words found");
    }

    $("start-game-btn").disabled = false;

    console.log(
      `Loaded ${words.length} unique words; ` +
      `${words.filter((x) => x.answer === "both").length} are both.`
    );

  } catch (error) {
    console.error(
      "Could not load adjective/adverb databases:",
      error
    );

    $("start-game-btn").disabled = true;

    let message = $("word-loading-error");

    if (!message) {
      message = document.createElement("p");
      message.id = "word-loading-error";
      $("game-start").appendChild(message);
    }

    message.style.color = "#d9475b";

    message.textContent =
      "Could not load the word databases. " +
      error.message;
  }
}

/* ==========================================
   NAVIGATION
========================================== */

function showModeSelection() {
  clearTimeout(nextQuestionTimer);

  $("mode-selection").classList.remove("hidden");
  $("word-class-panel").classList.add("hidden");

  $("back-to-categories").classList.remove("hidden");
  $("back-to-modes").classList.add("hidden");

  $("page-title").textContent =
    "Practice French adjectives and adverbs";

  $("page-description").textContent =
    "Choose what you would like to practice.";
}

function showWordClassMode() {
  clearTimeout(nextQuestionTimer);

  $("mode-selection").classList.add("hidden");
  $("word-class-panel").classList.remove("hidden");

  $("back-to-categories").classList.add("hidden");
  $("back-to-modes").classList.remove("hidden");

  $("page-title").textContent =
    "Adjective or Adverb?";

  $("page-description").textContent =
    "Choose whether each word is an adjective, " +
    "an adverb, or both.";

  showStartScreen();
}

function showStartScreen() {
  $("game-start").classList.remove("hidden");
  $("game-play").classList.add("hidden");
  $("game-results").classList.add("hidden");
}

/* ==========================================
   RANDOM QUESTIONS
========================================== */

function shuffleArray(input) {
  const result = [...input];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i]
    ];
  }

  return result;
}

function createQuestions(count) {
  // Distribute questions across all three classes.
  const pools = Object.fromEntries(
    classes.map((c) => [
      c,
      shuffleArray(
        words.filter((w) => w.answer === c)
      )
    ])
  );

  const result = [];

  while (result.length < count) {
    let added = false;

    for (const c of shuffleArray(classes)) {
      if (result.length >= count) break;

      if (pools[c].length) {
        result.push(pools[c].pop());
        added = true;
      }
    }

    if (!added) break;
  }

  return shuffleArray(result);
}

/* ==========================================
   START GAME
========================================== */

function startGame() {
  if (!words.length) return;

  clearTimeout(nextQuestionTimer);

  const requestedCount =
    Number($("question-count").value);

  questions = createQuestions(
    Math.min(requestedCount, words.length)
  );

  currentIndex = 0;
  correctAnswers = 0;
  mistakes = [];
  answerLocked = false;

  $("game-start").classList.add("hidden");
  $("game-results").classList.add("hidden");
  $("game-play").classList.remove("hidden");

  showQuestion();
}

/* ==========================================
   DISPLAY QUESTION
========================================== */

function showQuestion() {
  if (currentIndex >= questions.length) {
    showResults();
    return;
  }

  answerLocked = false;

  const item = questions[currentIndex];

  $("practice-word").textContent = item.word;

  $("practice-translation").textContent =
    item.translation || "";

  $("question-progress").textContent =
    `${currentIndex + 1} / ${questions.length}`;

  const percentage =
    (currentIndex / questions.length) * 100;

  $("progress-fill").style.width =
    `${percentage}%`;

  $("progress-track").setAttribute(
    "aria-valuenow",
    String(Math.round(percentage))
  );

  for (const c of classes) {
    const button = $(`${c}-btn`);

    button.disabled = false;

    button.classList.remove(
      "is-correct",
      "is-incorrect"
    );
  }

  const feedback = $("answer-feedback");

  feedback.textContent = "";

  feedback.classList.remove(
    "correct",
    "incorrect"
  );
}

/* ==========================================
   CHECK ANSWER
========================================== */

function checkAnswer(selected) {
  if (
    answerLocked ||
    currentIndex >= questions.length
  ) {
    return;
  }

  answerLocked = true;

  const item = questions[currentIndex];
  const correct = selected === item.answer;

  for (const c of classes) {
    $(`${c}-btn`).disabled = true;
  }

  $(`${item.answer}-btn`).classList.add(
    "is-correct"
  );

  const feedback = $("answer-feedback");

  if (correct) {
    correctAnswers++;

    feedback.textContent = "✓ Correct!";
    feedback.classList.add("correct");

  } else {
    $(`${selected}-btn`).classList.add(
      "is-incorrect"
    );

    feedback.textContent =
      `✗ Incorrect. ${item.word}: ${item.answer}.`;

    feedback.classList.add("incorrect");

    mistakes.push({
      ...item,
      selected
    });
  }

  nextQuestionTimer = setTimeout(() => {
    nextQuestionTimer = null;
    currentIndex++;
    showQuestion();
  }, 2000);
}

/* ==========================================
   RESULTS
========================================== */

function showResults() {
  $("game-play").classList.add("hidden");
  $("game-results").classList.remove("hidden");

  const percent = Math.round(
    (correctAnswers / questions.length) * 100
  );

  $("result-score").textContent =
    `${correctAnswers} / ${questions.length} (${percent}%)`;

  const container = $("result-mistakes");

  container.replaceChildren();

  if (!mistakes.length) {
    const message = document.createElement("p");

    message.textContent =
      "Perfect score! All answers correct.";

    container.appendChild(message);
    return;
  }

  const heading = document.createElement("h3");
  heading.textContent = "Review your mistakes";

  const list = document.createElement("ul");

  for (const mistake of mistakes) {
    const item = document.createElement("li");

    const word = document.createElement("strong");
    word.textContent = mistake.word;

    item.append(
      word,
      document.createTextNode(
        ` (${mistake.translation}) — ` +
        `Your answer: ${mistake.selected}. ` +
        `Correct: ${mistake.answer}.`
      )
    );

    list.appendChild(item);
  }

  container.append(heading, list);
}

/* ==========================================
   EVENT LISTENERS
========================================== */

document.addEventListener("DOMContentLoaded", () => {
  $("word-class-mode-btn").addEventListener(
    "click",
    showWordClassMode
  );

  $("back-to-modes").addEventListener(
    "click",
    showModeSelection
  );

  $("start-game-btn").disabled = true;

  $("start-game-btn").addEventListener(
    "click",
    startGame
  );

  for (const c of classes) {
    $(`${c}-btn`).addEventListener(
      "click",
      () => checkAnswer(c)
    );
  }

  $("play-again-btn").addEventListener(
    "click",
    showStartScreen
  );

  loadWords();
});
