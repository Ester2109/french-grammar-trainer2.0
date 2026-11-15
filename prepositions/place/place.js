"use strict";
const $ = id => document.getElementById(id);
const CATEGORIES = ["basic", "specific", "geographical", "advanced"];
let entries = [], questions = [], index = 0, score = 0, mistakes = [], locked = false;
const categoryChecks = () => [...document.querySelectorAll('input[name="category"]')];
const shuffle = arr => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
function showScreen(screen) {
  ["setup-screen", "quiz-screen", "results-screen"].forEach(id => $(id).classList.toggle("hidden", id !== screen));
}
function updateCategories() {
  const all = categoryChecks().every(input => input.checked);
  $("select-all").checked = all;
  $("select-all").indeterminate = !all && categoryChecks().some(input => input.checked);
  const selected = new Set(categoryChecks().filter(input => input.checked).map(input => input.value));
  const count = entries.filter(e => selected.has(e.category)).length;
  $("setup-message").textContent = entries.length ? `${count} expressions available` : "Loading expressions…";
  $("start-button").disabled = count < 4;
}
async function loadData() {
  try {
    const response = await fetch("./place.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Expected an array");
    entries = data.filter(e => typeof e.french === "string" && typeof e.english === "string" && CATEGORIES.includes(e.category) && e.french.trim() && e.english.trim());
    if (!entries.length) throw new Error("No valid expressions found");
    updateCategories();
  } catch (error) {
    console.error("Failed to load place.json:", error);
    $("setup-message").textContent = "Could not load place.json. Open the project using Live Server and check that place.json is in this folder.";
    $("start-button").disabled = true;
  }
}
function startQuiz() {
  const selected = new Set(categoryChecks().filter(e => e.checked).map(e => e.value));
  const pool = entries.filter(e => selected.has(e.category));
  const count = Math.min(Number($("question-count").value), pool.length);
  if (count < 1) return;
  questions = shuffle(pool).slice(0, count);
  index = 0; score = 0; mistakes = []; locked = false;
  showScreen("quiz-screen");
  renderQuestion();
}
function renderQuestion() {
  if (index >= questions.length) return finishQuiz();
  locked = false;
  $("next-button").classList.add("hidden");
  const question = questions[index];
  $("question-word").textContent = question.french;
  $("progress-label").textContent = `${index + 1} / ${questions.length}`;
  $("progress-fill").style.width = `${index / questions.length * 100}%`;
  $("feedback").textContent = "";
  $("feedback").className = "feedback";
  $("example-box").classList.add("hidden");
  const wrongPool = shuffle(entries.filter(e => e.id !== question.id && e.english.trim().toLowerCase() !== question.english.trim().toLowerCase()));
  const distractors = [];
  const seen = new Set([question.english.trim().toLowerCase()]);
  for (const e of wrongPool) {
    const key = e.english.trim().toLowerCase();
    if (!seen.has(key)) { distractors.push(e.english); seen.add(key); }
    if (distractors.length === 3) break;
  }
  const options = shuffle([question.english, ...distractors]);
  const grid = $("answer-grid");
  grid.replaceChildren();
  options.forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.textContent = option;
    button.addEventListener("click", () => answer(option, question));
    grid.appendChild(button);
  });
}
function answer(chosen, question) {
  if (locked) return;
  locked = true;
  const correct = chosen === question.english;
  if (correct) score++;
  else mistakes.push({ french: question.french, chosen, correct: question.english });
  $("feedback").textContent = correct ? "✓ Correct!" : `✗ Correct answer: ${question.english}`;
  $("feedback").classList.add(correct ? "good" : "bad");
  [...$("answer-grid").children].forEach(button => {
    button.disabled = true;
    if (button.textContent === question.english) button.classList.add("correct");
    else if (button.textContent === chosen) button.classList.add("wrong");
  });
  const example = Array.isArray(question.examples) ? question.examples[0] : null;
  if (example?.sentence) {
    $("example-fr").textContent = example.sentence;
    $("example-en").textContent = example.translation || "";
    $("example-box").classList.remove("hidden");
  }
  $("next-button").textContent = index === questions.length - 1 ? "See results →" : "Next question →";
  $("next-button").classList.remove("hidden");
}
function finishQuiz() {
  showScreen("results-screen");
  const pct = Math.round(score / questions.length * 100);
  $("score-label").textContent = `${score} / ${questions.length} (${pct}%)`;
  $("score-message").textContent = mistakes.length ? "Review the expressions you missed:" : "Perfect score! Well done!";
  const container = $("mistakes");
  container.replaceChildren();
  if (mistakes.length) {
    const list = document.createElement("ul");
    mistakes.forEach(m => {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = m.french;
      li.append(strong, document.createTextNode(` — ${m.correct} (you chose: ${m.chosen})`));
      list.appendChild(li);
    });
    container.appendChild(list);
  }
}
function backToSetup() {
  showScreen("setup-screen");
  updateCategories();
}
document.addEventListener("DOMContentLoaded", () => {
  $("select-all").addEventListener("change", e => {
    categoryChecks().forEach(box => box.checked = e.target.checked);
    updateCategories();
  });
  categoryChecks().forEach(box => box.addEventListener("change", updateCategories));
  $("start-button").addEventListener("click", startQuiz);
  $("next-button").addEventListener("click", () => {
    if (!locked) return;
    index++;
    renderQuestion();
  });
  $("quit-button").addEventListener("click", backToSetup);
  $("again-button").addEventListener("click", backToSetup);
  loadData();
});
