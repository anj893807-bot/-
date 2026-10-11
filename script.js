// 상식 퀴즈. 위쪽은 DOM에 의존하지 않는 순수 로직, 아래쪽은 화면 코드다.

// ===== 순수 로직 =====

const QUESTIONS_PER_CATEGORY = 10;
const CHOICES_PER_QUESTION = 4;

// 문항 데이터 검사 (PRD 6.3). 오류 문자열 목록을 돌려준다. 문제가 없으면 [].
function validateQuestions(categories, questions) {
  const errors = [];
  const isBlank = v => typeof v !== "string" || v.trim() === "";

  categories.forEach(c => {
    const count = questions.filter(q => q.category === c.id).length;
    if (count !== QUESTIONS_PER_CATEGORY) {
      errors.push(`${c.id}: 문항이 ${QUESTIONS_PER_CATEGORY}개가 아니라 ${count}개입니다`);
    }
  });

  const seen = new Set();
  questions.forEach((q, i) => {
    const id = isBlank(q.id) ? `#${i + 1}` : q.id;
    if (seen.has(id)) errors.push(`${id}: id가 중복됩니다`);
    seen.add(id);

    const choices = Array.isArray(q.choices) ? q.choices : [];
    if (choices.length !== CHOICES_PER_QUESTION) {
      errors.push(`${id}: 보기는 ${CHOICES_PER_QUESTION}개여야 합니다`);
    }
    if (new Set(choices).size !== choices.length) {
      errors.push(`${id}: 보기가 중복됩니다`);
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= CHOICES_PER_QUESTION) {
      errors.push(`${id}: answer는 0~3이어야 합니다`);
    }
    if (isBlank(q.question)) errors.push(`${id}: 문제가 비어 있습니다`);
    if (isBlank(q.explanation)) errors.push(`${id}: 해설이 비어 있습니다`);
    if (!q.source || isBlank(q.source.title) || isBlank(q.source.url)) {
      errors.push(`${id}: 출처 제목이나 URL이 비어 있습니다`);
    }
  });

  return errors;
}

// 모드마다 다른 규칙 (PRD 3장)
const MODES = {
  practice: { name: "연습", timeLimit: null, hint: false, ranked: false },
};

// Fisher–Yates. 입력 배열은 바꾸지 않고 새 배열을 돌려준다.
function shuffle(array, rng = Math.random) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 문항 하나를 화면용 Item으로 바꾼다. 보기를 섞고 정답 위치를 다시 계산한다.
function toItem(question, rng = Math.random) {
  const order = shuffle(question.choices.map((_, i) => i), rng);
  return {
    id: question.id,
    question: question.question,
    choices: order.map(i => question.choices[i]),
    correctIndex: order.indexOf(question.answer),
    explanation: question.explanation,
    source: question.source,
  };
}

function buildRound(questions, categoryId, rng = Math.random) {
  const inCategory = questions.filter(q => q.category === categoryId);
  return shuffle(inCategory, rng).map(q => toItem(q, rng));
}

function createGame(modeId, categoryId, items, isRetry = false) {
  return {
    mode: modeId,
    category: categoryId,
    items,
    current: 0,
    results: [],
    answered: false,
    hintRemoved: [],
    isRetry,
  };
}

// 현재 문항에 답한다. 이미 답했으면 null (두 번 채점하지 않는다).
function answerCurrent(game, choiceIndex) {
  if (game.answered) return null;
  const item = game.items[game.current];
  const result = {
    questionId: item.id,
    correct: choiceIndex === item.correctIndex,
    usedHint: false,
    timedOut: false,
    chosenIndex: choiceIndex,
  };
  game.results.push(result);
  game.answered = true;
  return result;
}

function nextQuestion(game) {
  if (!game.answered || game.current >= game.items.length - 1) return false;
  game.current++;
  game.answered = false;
  game.hintRemoved = [];
  return true;
}

function isFinished(game) {
  return game.answered && game.current === game.items.length - 1;
}

// 틀림·시간 초과 0점, 힌트 쓰고 맞힘 0.5점, 맞힘 1점
function scoreResult(result) {
  if (!result.correct) return 0;
  return result.usedHint ? 0.5 : 1;
}

function totalScore(results) {
  return results.reduce((sum, r) => sum + scoreResult(r), 0);
}

function formatScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ===== 화면 =====

const app = {
  modeId: "practice",
  categoryId: null,
  game: null,
};

const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => {
    s.hidden = s.id !== id;
  });
  window.scrollTo(0, 0);
}

function categoryName(categoryId) {
  const c = CATEGORIES.find(c => c.id === categoryId);
  return c ? c.name : categoryId;
}

function initApp() {
  const list = $("category-list");
  CATEGORIES.forEach(c => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.category = c.id;
    btn.textContent = c.name;
    list.appendChild(btn);
  });

  const errors = validateQuestions(CATEGORIES, QUESTIONS);
  if (errors.length > 0) {
    showDataError(errors);
    return;
  }

  list.addEventListener("click", e => {
    const btn = e.target.closest("button[data-category]");
    if (btn) startGame(app.modeId, btn.dataset.category);
  });
  $("choice-list").addEventListener("click", e => {
    const btn = e.target.closest("button.choice");
    if (btn) onChoice(Number(btn.dataset.index));
  });
  $("btn-next").addEventListener("click", onNext);
  $("btn-home").addEventListener("click", () => {
    if (confirm("처음으로 돌아갈까요? 이번 판은 기록되지 않아요.")) showScreen("screen-start");
  });
  $("btn-again").addEventListener("click", () => startGame(app.modeId, app.categoryId));
  $("btn-result-home").addEventListener("click", () => showScreen("screen-start"));

  showScreen("screen-start");
}

function showDataError(errors) {
  console.error("문항 데이터 오류", errors);
  $("category-list").hidden = true;
  const box = $("data-error");
  box.textContent = "";
  const title = document.createElement("strong");
  title.textContent = "문항 데이터 오류";
  const ul = document.createElement("ul");
  errors.forEach(err => {
    const li = document.createElement("li");
    li.textContent = err;
    ul.appendChild(li);
  });
  box.append(title, ul);
  box.hidden = false;
}

function startGame(modeId, categoryId) {
  app.modeId = modeId;
  app.categoryId = categoryId;
  app.game = createGame(modeId, categoryId, buildRound(QUESTIONS, categoryId));
  renderQuestion();
  showScreen("screen-quiz");
}

function renderQuestion() {
  const g = app.game;
  const item = g.items[g.current];
  $("quiz-mode").textContent = MODES[g.mode].name;
  $("quiz-progress").textContent = `${g.current + 1} / ${g.items.length}`;
  $("quiz-score").textContent = formatScore(totalScore(g.results));
  $("quiz-question").textContent = item.question;
  document.querySelectorAll("#choice-list .choice").forEach((btn, i) => {
    btn.textContent = item.choices[i];
    btn.disabled = false;
    btn.classList.remove("is-correct", "is-wrong");
  });
  $("feedback").hidden = true;
  $("btn-next").hidden = true;
}

function onChoice(index) {
  const result = answerCurrent(app.game, index);
  if (result) renderFeedback(result);
}

function renderFeedback(result) {
  const g = app.game;
  const item = g.items[g.current];
  document.querySelectorAll("#choice-list .choice").forEach((btn, i) => {
    btn.disabled = true;
    if (i === item.correctIndex) btn.classList.add("is-correct");
    else if (i === result.chosenIndex) btn.classList.add("is-wrong");
  });

  const verdict = $("feedback-verdict");
  verdict.classList.toggle("is-correct", result.correct);
  verdict.classList.toggle("is-wrong", !result.correct);
  verdict.textContent = result.correct
    ? "정답!"
    : `오답 — 정답은 ${item.choices[item.correctIndex]}`;
  $("feedback-explanation").textContent = item.explanation;
  const link = $("feedback-source");
  link.href = item.source.url;
  link.textContent = `출처: ${item.source.title}`;
  $("feedback").hidden = false;

  $("quiz-score").textContent = formatScore(totalScore(g.results));
  const next = $("btn-next");
  next.textContent = isFinished(g) ? "결과 보기" : "다음";
  next.hidden = false;
  next.focus();
}

function onNext() {
  const g = app.game;
  if (isFinished(g)) {
    renderResult();
    showScreen("screen-result");
  } else if (nextQuestion(g)) {
    renderQuestion();
  }
}

function renderResult() {
  const g = app.game;
  $("result-score").textContent = `${formatScore(totalScore(g.results))} / ${g.items.length}`;
  $("result-meta").textContent = `${categoryName(g.category)} · ${MODES[g.mode].name}`;
  $("result-unranked").hidden = MODES[g.mode].ranked;

  const list = $("result-list");
  list.textContent = "";
  g.results.forEach((r, i) => {
    const text = g.items[i].question;
    const li = document.createElement("li");
    const mark = document.createElement("span");
    mark.className = r.correct ? "mark-correct" : "mark-wrong";
    mark.textContent = r.correct ? "맞음" : "틀림";
    li.append(`${text.length > 30 ? text.slice(0, 30) + "…" : text} — `, mark);
    list.appendChild(li);
  });
}

if (document.getElementById("app")) initApp();
