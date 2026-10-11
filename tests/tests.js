// 개발용 로직 테스트. tests/run.sh가 headless Edge로 test.html을 열어 실행한다.

const out = document.getElementById("out");
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    out.textContent += `PASS ${name}\n`;
  } catch (e) {
    failed++;
    out.textContent += `FAIL ${name} — ${e && e.message ? e.message : e}\n`;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg ? msg + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg || "expected true");
}

// 망가진 문항 데이터를 만들기 위한 깊은 복사본
const broken = () => JSON.parse(JSON.stringify(QUESTIONS));
const hasErrorFor = (qs, text) =>
  validateQuestions(CATEGORIES, qs).some(e => e.includes(text));

// ---- Task 1: 문항 데이터와 검사 ----

test("실제 문항 데이터는 검사를 통과한다", () => {
  assertEqual(validateQuestions(CATEGORIES, QUESTIONS).length, 0);
});

test("40문항, 카테고리마다 10문항", () => {
  assertEqual(QUESTIONS.length, 40);
  CATEGORIES.forEach(c =>
    assertEqual(QUESTIONS.filter(q => q.category === c.id).length, 10, c.id));
});

test("보기가 3개면 해당 id가 오류에 나온다", () => {
  const qs = broken();
  qs[0].choices.pop();
  assertTrue(hasErrorFor(qs, qs[0].id));
});

test("보기 중복을 잡는다", () => {
  const qs = broken();
  qs[0].choices[1] = qs[0].choices[0];
  assertTrue(hasErrorFor(qs, qs[0].id));
});

test("answer가 0~3 밖이면 잡는다", () => {
  const qs = broken();
  qs[0].answer = 4;
  assertTrue(hasErrorFor(qs, qs[0].id));
});

test("id 중복을 잡는다", () => {
  const qs = broken();
  qs[1].id = qs[0].id;
  assertTrue(hasErrorFor(qs, qs[0].id));
});

test("출처 url이 비면 잡는다", () => {
  const qs = broken();
  qs[0].source.url = "";
  assertTrue(hasErrorFor(qs, qs[0].id));
});

test("카테고리 문항이 9개면 카테고리 id가 나온다", () => {
  const qs = broken();
  qs.splice(0, 1);
  assertTrue(hasErrorFor(qs, "korean-history"));
});

// ---- Task 2: 판 만들기와 채점 ----

const scienceGame = (modeId = "practice") =>
  createGame(modeId, "science", buildRound(QUESTIONS, "science"));

test("shuffle은 원소를 보존하고 입력을 바꾸지 않는다", () => {
  const a = [1, 2, 3, 4];
  const b = shuffle(a);
  assertEqual(a.join(), "1,2,3,4");
  assertEqual([...b].sort().join(), "1,2,3,4");
});

test("buildRound: 해당 카테고리 10문항, 정답 위치가 맞다", () => {
  const items = buildRound(QUESTIONS, "science");
  assertEqual(items.length, 10);
  items.forEach(it => {
    const q = QUESTIONS.find(q => q.id === it.id);
    assertEqual(q.category, "science");
    assertEqual(it.choices[it.correctIndex], q.choices[q.answer], it.id);
  });
});

test("buildRound: rng가 다르면 순서가 다르다", () => {
  const a = buildRound(QUESTIONS, "science", () => 0).map(i => i.id).join();
  const b = buildRound(QUESTIONS, "science", () => 0.99).map(i => i.id).join();
  assertTrue(a !== b);
});

test("scoreResult", () => {
  assertEqual(scoreResult({ correct: false, usedHint: false, timedOut: true }), 0);
  assertEqual(scoreResult({ correct: true, usedHint: true, timedOut: false }), 0.5);
  assertEqual(scoreResult({ correct: true, usedHint: false, timedOut: false }), 1);
});

test("formatScore", () => {
  assertEqual(formatScore(9), "9");
  assertEqual(formatScore(7.5), "7.5");
  assertEqual(formatScore(0), "0");
});

test("답은 한 번만 채점된다", () => {
  const g = scienceGame();
  const r = answerCurrent(g, g.items[0].correctIndex);
  assertEqual(r.correct, true);
  assertEqual(answerCurrent(g, 0), null);
  assertEqual(g.results.length, 1);
});

test("답하기 전에는 다음으로 못 간다", () => {
  const g = scienceGame();
  assertEqual(nextQuestion(g), false);
  assertEqual(g.current, 0);
});

test("10문항을 모두 맞히면 끝나고 10점", () => {
  const g = scienceGame();
  for (let i = 0; i < 10; i++) {
    answerCurrent(g, g.items[g.current].correctIndex);
    if (i < 9) assertEqual(nextQuestion(g), true);
  }
  assertEqual(isFinished(g), true);
  assertEqual(totalScore(g.results), 10);
});

test("MODES 값", () => {
  assertEqual(MODES.speed.timeLimit, 15);
  assertEqual(MODES.hint.hint, true);
  assertEqual(MODES.practice.ranked, false);
});

test("shouldRecord: 연습·다시 풀기는 기록 안 함", () => {
  const items = buildRound(QUESTIONS, "science");
  assertEqual(shouldRecord(createGame("practice", "science", items)), false);
  assertEqual(shouldRecord(createGame("speed", "science", items)), true);
  assertEqual(shouldRecord(createGame("hint", "science", items)), true);
  assertEqual(shouldRecord(createGame("practice", "science", items, true)), false);
});

test("remainingSeconds", () => {
  assertEqual(remainingSeconds(15000, 0), 15);
  assertEqual(remainingSeconds(15000, 100), 15);
  assertEqual(remainingSeconds(15000, 14001), 1);
  assertEqual(remainingSeconds(15000, 15000), 0);
  assertEqual(remainingSeconds(15000, 99999), 0);
});

test("시간 초과는 오답 0점", () => {
  const g = createGame("speed", "science", buildRound(QUESTIONS, "science"));
  const r = timeoutCurrent(g);
  assertEqual(r.correct, false);
  assertEqual(r.timedOut, true);
  assertEqual(scoreResult(r), 0);
});

test("답한 뒤 시간 초과는 무시", () => {
  const g = createGame("speed", "science", buildRound(QUESTIONS, "science"));
  answerCurrent(g, g.items[0].correctIndex);
  assertEqual(timeoutCurrent(g), null);
  assertEqual(g.results.length, 1);
  assertEqual(g.results[0].correct, true);
});

test("시간 초과 뒤 답은 무시", () => {
  const g = createGame("speed", "science", buildRound(QUESTIONS, "science"));
  timeoutCurrent(g);
  assertEqual(answerCurrent(g, g.items[0].correctIndex), null);
  assertEqual(g.results.length, 1);
});

const hintGame = () => createGame("hint", "science", buildRound(QUESTIONS, "science"));

test("힌트는 서로 다른 오답 2개를 지운다", () => {
  const g = hintGame(), removed = useHint(g);
  assertEqual(removed.length, 2);
  assertTrue(removed[0] !== removed[1]);
  assertTrue(!removed.includes(g.items[0].correctIndex));
});

test("힌트는 문항마다 한 번", () => {
  const g = hintGame(); useHint(g);
  assertEqual(useHint(g), null);
});

test("연습 모드와 답한 뒤에는 힌트 없음", () => {
  const p = createGame("practice", "science", buildRound(QUESTIONS, "science"));
  assertEqual(useHint(p), null);
  const g = hintGame(); answerCurrent(g, g.items[0].correctIndex);
  assertEqual(useHint(g), null);
});

test("지운 보기는 고를 수 없다", () => {
  const g = hintGame(), removed = useHint(g);
  assertEqual(answerCurrent(g, removed[0]), null);
  assertEqual(g.results.length, 0);
});

test("힌트 쓰고 맞히면 0.5점, 다음 문항에서 힌트 다시 가능", () => {
  const g = hintGame(); useHint(g);
  const r = answerCurrent(g, g.items[0].correctIndex);
  assertEqual(r.usedHint, true);
  assertEqual(scoreResult(r), 0.5);
  nextQuestion(g);
  assertTrue(useHint(g) !== null);
});

test("틀린 문항만 다시 푼다", () => {
  const g = createGame("practice", "science", buildRound(QUESTIONS, "science"));
  for (let i = 0; i < 10; i++) {          // 짝수 번째만 맞힘
    const it = g.items[g.current];
    answerCurrent(g, i % 2 === 0 ? it.correctIndex : (it.correctIndex + 1) % 4);
    nextQuestion(g);
  }
  const ids = wrongQuestionIds(g);
  assertEqual(ids.length, 5);
  const retry = buildRetryRound(QUESTIONS, ids);
  assertEqual(retry.map(i => i.id).sort().join(), [...ids].sort().join());
  const rg = createGame("practice", "science", retry, true);
  assertEqual(shouldRecord(rg), false);
  answerCurrent(rg, rg.items[0].correctIndex);
  assertEqual(retrySummary(rg).correct, 1);
  assertEqual(retrySummary(rg).total, 5);
  assertEqual(totalScore(g.results), 5);   // 처음 판 점수는 그대로
});

out.textContent += `SUMMARY passed=${passed} failed=${failed}\n`;
