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

out.textContent += `SUMMARY passed=${passed} failed=${failed}\n`;
