
"use strict";

/* ==========================================
   FRENCH NOUNS — GAME MODE
========================================== */

const $ = (id) => document.getElementById(id);

let nouns = [];
let questions = [];
let currentIndex = 0;
let correctAnswers = 0;
let mistakes = [];
let answerLocked = false;
let nextQuestionTimer = null;

/* ==========================================
   LOAD NOUN DATABASE
========================================== */

async function loadNouns() {
  try {
    const response = await fetch("./nouns_singular.json");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid nouns.json format");
    }

    nouns = data.filter((noun) =>
      typeof noun.word === "string" &&
      typeof noun.translation === "string" &&
      ["masculine", "feminine"].includes(noun.gender)
    );

    console.log(`Loaded ${nouns.length} French nouns`);

    const startButton = $("start-game-btn");

    if (startButton) {
      startButton.disabled = nouns.length === 0;
    }

    if (nouns.length === 0) {
      showLoadingError("No valid nouns were found.");
    }
  } catch (error) {
    console.error("Error loading nouns:", error);
    showLoadingError(
      "Could not load nouns.json. Check that the file exists."
    );
  }
}

function showLoadingError(message) {
  const startButton = $("start-game-btn");

  if (startButton) {
    startButton.disabled = true;
  }

  const startScreen = $("game-start");

  if (startScreen) {
    let errorMessage = $("noun-loading-error");

    if (!errorMessage) {
      errorMessage = document.createElement("p");
      errorMessage.id = "noun-loading-error";
      startScreen.appendChild(errorMessage);
    }

    errorMessage.textContent = message;
    errorMessage.style.color = "#d9475b";
  }
}

/* ==========================================
   NAVIGATION
========================================== */

function showModeSelection() {
  clearTimeout(nextQuestionTimer);

  $("mode-selection").classList.remove("hidden");
  $("gender-panel").classList.add("hidden");

  $("back-to-categories").classList.remove("hidden");
  $("back-to-modes").classList.add("hidden");

  $("page-title").textContent = "Practice your French nouns";
  $("page-description").textContent =
    "Choose what you would like to practice.";
}

function showGenderMode() {
  clearTimeout(nextQuestionTimer);

  $("mode-selection").classList.add("hidden");
  $("gender-panel").classList.remove("hidden");

  $("back-to-categories").classList.add("hidden");
  $("back-to-modes").classList.remove("hidden");

  $("page-title").textContent = "Masculine or Feminine?";
  $("page-description").textContent =
    "Choose the correct grammatical gender of each French noun.";

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

function shuffleArray(array) {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  return shuffled;
}

function createQuestions(count) {
  return shuffleArray(nouns).slice(
    0,
    Math.min(count, nouns.length)
  );
}

/* ==========================================
   START GAME
========================================== */

function startGame() {
  if (nouns.length === 0) {
    return;
  }

  clearTimeout(nextQuestionTimer);

  const requestedCount = Number($("question-count").value);

  questions = createQuestions(requestedCount);
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

  const noun = questions[currentIndex];

  $("noun-word").textContent = noun.word;
  $("noun-translation").textContent = noun.translation;

  $("question-progress").textContent =
    `${currentIndex + 1} / ${questions.length}`;

  updateProgress();

  const masculineButton = $("masculine-btn");
  const feminineButton = $("feminine-btn");

  masculineButton.disabled = false;
  feminineButton.disabled = false;

  masculineButton.classList.remove(
    "is-correct",
    "is-incorrect"
  );

  feminineButton.classList.remove(
    "is-correct",
    "is-incorrect"
  );

  const feedback = $("answer-feedback");

  feedback.textContent = "";
  feedback.classList.remove("correct", "incorrect");
}

function updateProgress() {
  const percentage =
    (currentIndex / questions.length) * 100;

  $("progress-fill").style.width = `${percentage}%`;

  $("progress-track").setAttribute(
    "aria-valuenow",
    String(Math.round(percentage))
  );
}

/* ==========================================
   CHECK ANSWER
========================================== */

function checkAnswer(selectedGender) {
  if (answerLocked || currentIndex >= questions.length) {
    return;
  }

  answerLocked = true;

  const noun = questions[currentIndex];
  const isCorrect = selectedGender === noun.gender;

  const masculineButton = $("masculine-btn");
  const feminineButton = $("feminine-btn");
  const feedback = $("answer-feedback");

  masculineButton.disabled = true;
  feminineButton.disabled = true;

  const correctButton =
    noun.gender === "masculine"
      ? masculineButton
      : feminineButton;

  const selectedButton =
    selectedGender === "masculine"
      ? masculineButton
      : feminineButton;

  correctButton.classList.add("is-correct");

  if (isCorrect) {
    correctAnswers++;

    feedback.textContent = "✓ Correct!";
    feedback.classList.add("correct");
  } else {
    selectedButton.classList.add("is-incorrect");

    feedback.textContent =
      `✗ Incorrect. ${noun.word} is ${noun.gender}.`;

    feedback.classList.add("incorrect");

    mistakes.push({
      word: noun.word,
      translation: noun.translation,
      selected: selectedGender,
      correct: noun.gender
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

  const percentage = Math.round(
    (correctAnswers / questions.length) * 100
  );

  $("result-score").textContent =
    `${correctAnswers} / ${questions.length} (${percentage}%)`;

  const mistakesContainer = $("result-mistakes");
  mistakesContainer.replaceChildren();

  if (mistakes.length === 0) {
    const message = document.createElement("p");
    message.textContent = "Perfect score! All answers correct.";
    mistakesContainer.appendChild(message);
    return;
  }

  const heading = document.createElement("h3");
  heading.textContent = "Review your mistakes";

  const list = document.createElement("ul");

  mistakes.forEach((mistake) => {
    const item = document.createElement("li");

    const word = document.createElement("strong");
    word.textContent = mistake.word;

    item.appendChild(word);

    item.appendChild(
      document.createTextNode(
        ` (${mistake.translation}) — ` +
        `Your answer: ${mistake.selected}. ` +
        `Correct: ${mistake.correct}.`
      )
    );

    list.appendChild(item);
  });

  mistakesContainer.appendChild(heading);
  mistakesContainer.appendChild(list);
}

/* ==========================================
   EVENT LISTENERS
========================================== */

document.addEventListener("DOMContentLoaded", () => {
  const genderModeButton = $("gender-mode-btn");

  if (genderModeButton) {
    genderModeButton.addEventListener(
      "click",
      showGenderMode
    );
  }

  const backToModes = $("back-to-modes");

  if (backToModes) {
    backToModes.addEventListener(
      "click",
      showModeSelection
    );
  }

  $("start-game-btn").disabled = true;

  $("start-game-btn").addEventListener(
    "click",
    startGame
  );

  $("masculine-btn").addEventListener(
    "click",
    () => checkAnswer("masculine")
  );

  $("feminine-btn").addEventListener(
    "click",
    () => checkAnswer("feminine")
  );

  $("play-again-btn").addEventListener(
    "click",
    showStartScreen
  );

  loadNouns();
});
