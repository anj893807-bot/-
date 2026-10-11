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

if (document.getElementById("app")) initApp();
