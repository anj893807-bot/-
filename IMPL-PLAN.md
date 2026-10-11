# 상식 퀴즈 웹 앱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서버 없이 `index.html`을 열면 동작하는 4지선다 상식 퀴즈(카테고리 4개 × 10문항, 연습·스피드·힌트 모드, localStorage 순위표)를 3단계로 만든다.

**Architecture:**
- `index.html`에 화면 4개를 `<section>`으로 미리 두고, `script.js`가 내용을 채우고 화면을 전환한다(PRD 접근 방식 A).
- `script.js`는 두 부분으로 나뉜다.
  - 위쪽 순수 로직: 섞기, 판 만들기, 채점, 타이머 계산, 힌트, 순위표. DOM에 의존하지 않는다.
  - 아래쪽 화면 코드: 로직을 호출하고 결과를 그린다.
- 순수 로직은 개발용 `tests/test.html`을 headless Edge로 열어 자동 테스트한다.

**Tech Stack:** HTML, CSS, 바닐라 JS(일반 `<script>`, 모듈 없음), localStorage. 테스트는 Microsoft Edge headless(`--dump-dom`)와 Git Bash로 돌린다.

**Spec:** `PRD.md`

## Global Constraints

- 앱 파일은 `index.html`, `style.css`, `script.js`, `questions.js` 4개뿐이다. `tests/` 폴더는 개발용이며 앱이 불러오지 않는다.
- `file://`로 열어도 동작해야 한다.
  - `import`, `fetch`, 외부 라이브러리, CDN을 쓰지 않는다.
  - `<script>` 순서는 `questions.js` → `script.js`.
- `questions.js`는 전역 상수 `CATEGORIES`, `QUESTIONS`만 정의한다. 형식은 PRD 6.1절이고, 내용은 PRD 부록 A를 그대로 옮긴다.
- 화면 문구는 한국어다. 고정 문구는 아래 그대로 쓴다.
  - "순위표에 기록되지 않음"
  - "정답!"
  - "오답 — 정답은 {보기}"
  - "시간 초과 — 정답은 {보기}"
  - "출처: {제목}"
  - "다시 풀기 {맞힌 수} / {문항 수}"
  - "모두 맞혔어요!"
  - "순위표 {n}위"
  - "순위표 10위 밖"
  - "아직 기록이 없어요"
  - "기록을 저장할 수 없음"
  - "문항 데이터 오류"
- 점수 규칙: 틀림·시간 초과 0점, 힌트 쓰고 맞힘 0.5점, 맞힘 1점. 한 판 만점은 10점이다.
- 스피드 모드 제한 시간은 문항당 15초다.
- localStorage 키는 `"commonsense-quiz.leaderboard.v1"`이고, 순위표마다 상위 10개만 저장한다.
- 대상 브라우저는 Chrome·Edge 최신판이다. 360px 폭에서 가로 스크롤이 생기지 않아야 한다.
- 정오 표시는 색과 ✓/✗ 기호를 함께 쓴다.

## Review Focus

- **스피드 모드에서 답 클릭과 0초가 거의 동시에 일어날 때:** 한 번만 채점해야 한다. → Task 5: `timeoutCurrent`는 답한 뒤 `null`을 반환하고, `answerCurrent`는 시간 초과 뒤 `null`을 반환한다.
- **힌트로 지운 보기를 누를 때:** 아무 일도 일어나지 않아야 한다. → Task 6: 지운 인덱스로 `answerCurrent`를 부르면 `null`을 반환한다.
- **다시 풀기 판이나 연습 판:** 순위표에 저장되지 않아야 하고, 처음 점수도 바뀌지 않아야 한다. → Task 4, Task 7: `shouldRecord`가 `false`를 반환하는지 테스트한다.
- **localStorage에 깨진 JSON이나 엉뚱한 형식이 있을 때:** 앱이 멈추지 않고 빈 순위표로 시작해야 한다. → Task 8: `loadBoards` 테스트에서 확인한다.
- **동점과 11번째 기록:** 먼저 세운 기록이 위에 와야 한다. 10위 밖 기록은 "순위표 10위 밖"이 되고 목록은 10개를 유지해야 한다. → Task 8: `insertRecord` 테스트에서 확인한다.

## 공통: 테스트 실행 방법

- 실행 명령은 아래와 같다.

  ```bash
  bash tests/run.sh
  ```

- **통과 기준:** 마지막 줄이 `SUMMARY passed=N failed=0`이고 종료 코드가 0이다.
- **실패할 때:** `FAIL 테스트이름 — 메시지` 줄이 나오고 종료 코드가 1이다.
- **스크립트 오류가 날 때:** `SUMMARY` 줄이 아예 나오지 않는다. 이 경우도 실패로 본다.

## 공통: `script.js`에서 쓰는 이름

이후 Task들이 모두 이 이름을 쓴다.

```
// 데이터 형식
Item   = { id, question, choices: string[4](섞인 순서), correctIndex: 0-3, explanation, source: {title, url} }
Result = { questionId, correct: boolean, usedHint: boolean, timedOut: boolean, chosenIndex: number|null }
Game   = { mode, category, items: Item[], current, results: Result[], answered: boolean, hintRemoved: number[], isRetry }
Record = { score: number, playedAt: string(ISO) }
rng    = () => [0, 1) 숫자. 기본값은 Math.random
```

`script.js`는 마지막 줄에서 `if (document.getElementById("app")) initApp();`일 때만 화면을 시작한다. `tests/test.html`에는 `#app`이 없으므로 로직만 불러온다.

---

## 1단계: 연습 모드와 점수

### 만들 것

- 저장소 준비(git)와 개발용 테스트 도구(`tests/`)
- `questions.js`: 40문항과 시작할 때 데이터 검사
- 판 만들기(섞기)와 채점 로직
- 화면: 시작(카테고리 4개) → 퀴즈 → 결과
  - 모드 선택은 아직 없다. 항상 연습 모드로 시작한다.
  - 틀린 문제 다시 풀기도 아직 없다.

### 완료 기준

- `bash tests/run.sh` 결과가 `failed=0`이다.
- PRD 7장 1단계 체크리스트를 모두 만족한다.

### Task 1: 저장소 준비, 테스트 도구, 문항 데이터와 검사

**Files:**
- Create: `questions.js`, `script.js`, `tests/test.html`, `tests/tests.js`, `tests/run.sh`

**Interfaces:**
- Produces:
  - `CATEGORIES`, `QUESTIONS` (전역)
  - `validateQuestions(categories, questions) -> string[]`: 오류 목록이다. 각 오류 문자열에는 문항 id나 카테고리 id가 들어 있다. 오류가 없으면 `[]`.
  - 테스트 도우미: `test(name, fn)`, `assertEqual(actual, expected, msg)`, `assertTrue(cond, msg)`

- [x] **Step 1: git 저장소를 준비한다** (완료됨, 2026-10-11)
  - `git init -b main`과 `git remote add origin https://github.com/anj893807-bot/-.git`를 실행했다.
  - 커밋 정보는 이 폴더에만 설정했다(`git config --local`). 이메일은 GitHub noreply 주소다.
  - `PRD.md`와 `IMPL-PLAN.md`는 첫 커밋으로 먼저 올렸다. 이후 Task마다 `bash tests/run.sh`를 통과하면 커밋한다.

- [ ] **Step 2: 테스트 도구를 만든다**
  - `tests/test.html`: `../questions.js` → `../script.js` → `tests.js`를 차례로 불러오고, 결과를 쓸 `<pre id="out">`을 둔다.
  - `tests/tests.js`: 맨 위에 도우미를 정의한다.
    - `test()`는 예외를 잡아서 `PASS 이름` 또는 `FAIL 이름 — 메시지` 줄을 `#out`에 쓴다.
    - 파일 끝에서 `SUMMARY passed=N failed=M` 줄을 쓴다.
  - `tests/run.sh`는 아래 내용으로 만든다.

```bash
#!/usr/bin/env bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
DIR="$(cd "$(dirname "$0")" && pwd -W)"
OUT="$("$EDGE" --headless=new --disable-gpu --user-data-dir="$TMP/quiz-edge-profile" \
  --dump-dom "file:///$DIR/test.html" 2>/dev/null | grep -oE '(PASS|FAIL|SUMMARY)[^<]*')"
echo "$OUT"
echo "$OUT" | grep -q '^SUMMARY passed=[0-9]* failed=0$'
```

- [ ] **Step 3: 실패하는 테스트를 쓴다** (`tests/tests.js`)

```js
test("실제 문항 데이터는 검사를 통과한다", () => {
  assertEqual(validateQuestions(CATEGORIES, QUESTIONS).length, 0);
});
test("40문항, 카테고리마다 10문항", () => {
  assertEqual(QUESTIONS.length, 40);
  CATEGORIES.forEach(c =>
    assertEqual(QUESTIONS.filter(q => q.category === c.id).length, 10, c.id));
});
// 망가진 복사본: const broken = () => JSON.parse(JSON.stringify(QUESTIONS));
test("보기가 3개면 해당 id가 오류에 나온다", () => {
  const qs = broken(); qs[0].choices.pop();
  assertTrue(validateQuestions(CATEGORIES, qs).some(e => e.includes(qs[0].id)));
});
test("보기 중복을 잡는다", ...);         // qs[0].choices[1] = qs[0].choices[0]
test("answer가 0~3 밖이면 잡는다", ...);   // qs[0].answer = 4
test("id 중복을 잡는다", ...);            // qs[1].id = qs[0].id → 오류에 그 id
test("출처 url이 비면 잡는다", ...);       // qs[0].source.url = ""
test("카테고리 문항이 9개면 카테고리 id가 나온다", ...); // qs.splice(0,1) → "korean-history" 포함
```

- [ ] **Step 4: 실행해서 실패를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `FAIL ... validateQuestions is not defined`(또는 `QUESTIONS is not defined`), 종료 코드 1

- [ ] **Step 5: `questions.js`와 `validateQuestions`를 구현한다**
  - **`questions.js`:**
    - PRD 부록 A의 40문항을 부록 순서대로 옮긴다.
    - `answer`는 굵게 표시된 보기의 위치(0부터)다. `source`는 링크의 제목과 URL이다.
    - `CATEGORIES`는 PRD 6.1절 그대로다.
  - **`validateQuestions`:** PRD 6.3절의 다섯 가지 검사를 모두 한다. 오류 문자열 형식은 `"{id}: {무엇이 잘못됐는지}"`이다.

- [ ] **Step 6: 실행해서 통과를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=8 failed=0`

- [ ] **Step 7: Commit**

```bash
git add questions.js script.js tests/
git commit -m "feat: 문항 데이터 40개와 데이터 검사, 테스트 도구 추가"
```

### Task 2: 판 만들기와 채점 로직

**Files:**
- Modify: `script.js` (순수 로직 부분)
- Test: `tests/tests.js`

**Interfaces:**
- Consumes: `QUESTIONS`, 테스트 도우미
- Produces:
  - `MODES = { practice: { name: "연습", timeLimit: null, hint: false, ranked: false } }`
  - `shuffle(array, rng = Math.random) -> 새 배열`: Fisher–Yates로 섞고, 입력 배열은 바꾸지 않는다.
  - `toItem(question, rng) -> Item`: 보기를 섞고 `correctIndex`를 다시 계산한다.
  - `buildRound(questions, categoryId, rng = Math.random) -> Item[]`: 해당 카테고리 문항을 섞은 순서로 돌려준다.
  - `createGame(modeId, categoryId, items, isRetry = false) -> Game`
  - `answerCurrent(game, choiceIndex) -> Result | null`: 이미 답했으면 `null`.
  - `nextQuestion(game) -> boolean`: 답하지 않았거나 마지막 문항이면 `false`. 이동하면 `answered`와 `hintRemoved`를 초기화한다.
  - `isFinished(game) -> boolean`: 마지막 문항에 답했으면 `true`.
  - `scoreResult(result) -> 0 | 0.5 | 1`
  - `totalScore(results) -> number`
  - `formatScore(n) -> string`: `9 → "9"`, `7.5 → "7.5"`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
test("shuffle은 원소를 보존하고 입력을 바꾸지 않는다", () => {
  const a = [1, 2, 3, 4], b = shuffle(a);
  assertEqual(a.join(), "1,2,3,4");
  assertEqual([...b].sort().join(), "1,2,3,4");
});
test("buildRound: 해당 카테고리 10문항, 정답 위치가 맞다", () => {
  const items = buildRound(QUESTIONS, "science");
  assertEqual(items.length, 10);
  items.forEach(it => {
    const q = QUESTIONS.find(q => q.id === it.id);
    assertEqual(q.category, "science");
    assertEqual(it.choices[it.correctIndex], q.choices[q.answer]);
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
  const g = createGame("practice", "science", buildRound(QUESTIONS, "science"));
  const r = answerCurrent(g, g.items[0].correctIndex);
  assertEqual(r.correct, true);
  assertEqual(answerCurrent(g, 0), null);
  assertEqual(g.results.length, 1);
});
test("답하기 전에는 다음으로 못 간다", () => {
  const g = createGame("practice", "science", buildRound(QUESTIONS, "science"));
  assertEqual(nextQuestion(g), false);
  assertEqual(g.current, 0);
});
test("10문항을 모두 맞히면 끝나고 10점", () => {
  const g = createGame("practice", "science", buildRound(QUESTIONS, "science"));
  for (let i = 0; i < 10; i++) {
    answerCurrent(g, g.items[g.current].correctIndex);
    if (i < 9) assertEqual(nextQuestion(g), true);
  }
  assertEqual(isFinished(g), true);
  assertEqual(totalScore(g.results), 10);
});
```

- [ ] **Step 2: 실행해서 실패를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: 새 테스트들이 `FAIL ... is not defined`

- [ ] **Step 3: Produces에 적은 함수들을 `script.js` 순수 로직 부분에 구현한다**

- [ ] **Step 4: 실행해서 통과를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=16 failed=0`

- [ ] **Step 5: Commit**

```bash
git add script.js tests/tests.js
git commit -m "feat: 판 만들기, 섞기, 채점 로직 추가"
```

### Task 3: 1단계 화면 (시작 → 퀴즈 → 결과)

**Files:**
- Create: `index.html`, `style.css`
- Modify: `script.js` (화면 코드 부분)

**Interfaces:**
- Consumes: Task 1의 `validateQuestions`, Task 2의 모든 로직 함수
- Produces: 아래 요소 id와 화면 함수. 2단계와 3단계는 여기에 요소를 덧붙인다.

```
#app
  #screen-start   #category-list(button[data-category]) #unranked-note #data-error
  #screen-quiz    #quiz-progress #quiz-score #quiz-mode #quiz-question #choice-list(button×4)
                  #feedback(#feedback-verdict #feedback-explanation a#feedback-source) #btn-next #btn-home
  #screen-result  #result-score #result-meta #result-unranked #result-list #btn-again #btn-result-home
  #screen-board   (3단계에서 채움)

showScreen(id)     // 해당 section만 보이게
initApp()          // 데이터 검사 → 오류면 #data-error에 "문항 데이터 오류"와 id 목록, 카테고리 버튼 숨김
startGame(modeId, categoryId)
renderQuestion()   // 진행 "3 / 10", 현재 점수 formatScore, 보기 버튼 4개
renderFeedback(result)
renderResult()
```

- [ ] **Step 1: `index.html`을 만든다**
  - 위 구조로 만들고 `<html lang="ko">`, viewport meta를 넣는다.
  - 스크립트 순서는 `questions.js` → `script.js`.
  - 요소는 처음부터 다 있고, `hidden` 속성으로 보이거나 숨긴다.

- [ ] **Step 2: `style.css`를 만든다**
  - 색은 `:root` 변수로 정의한다.
  - 보기 버튼은 세로로 쌓는다. 모바일 360px에서 가로 스크롤이 없어야 한다.
  - 정답 보기에는 `.is-correct`(초록 + "✓"), 고른 오답에는 `.is-wrong`(빨강 + "✗")을 쓴다. 기호는 `::before`로 붙인다.
  - 잠긴 보기는 `:disabled`로 표시한다.

- [ ] **Step 3: 화면 코드를 구현한다**
  - **보기 클릭:** `answerCurrent`를 부르고, 결과가 `null`이면 무시한다. 결과가 있으면 다음을 한다.
    - 모든 보기를 `disabled` 처리한다.
    - 정답 보기에 `.is-correct`, 고른 오답에 `.is-wrong`을 붙인다.
    - `#feedback-verdict`에 "정답!" 또는 "오답 — 정답은 {보기}"를 쓴다.
    - 해설을 보여 주고, 출처 링크는 `target="_blank" rel="noopener"`로 연다.
    - `#btn-next`를 보여 준다. 마지막 문항이면 버튼 글자가 "결과 보기"다.
  - **`#btn-home`:** `confirm("처음으로 돌아갈까요? 이번 판은 기록되지 않아요.")`에서 확인을 누르면 시작 화면으로 간다.
  - **결과 화면:**
    - `#result-score`에 "7.5 / 10" 형식으로 점수를 쓴다.
    - `#result-meta`에 카테고리 이름과 모드 이름을 쓴다.
    - `#result-list`에 문항마다 문제 앞 30자와 "맞음" 또는 "틀림"을 쓴다.
    - `#result-unranked`는 연습 모드일 때만 보인다.
  - **`#unranked-note`:** 1단계에서는 항상 보인다.
  - **`#btn-again`:** 같은 카테고리로 `startGame`을 다시 부른다.

- [ ] **Step 4: 로직 테스트가 깨지지 않았는지 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=16 failed=0`

- [ ] **Step 5: 아래 "1단계 브라우저 확인 항목"을 직접 확인하고 모두 통과시킨다**

- [ ] **Step 6: Commit**

```bash
git add index.html style.css script.js
git commit -m "feat: 1단계 연습 모드 화면(시작·퀴즈·결과)"
```

### 1단계 브라우저 확인 항목

탐색기에서 `index.html`을 더블클릭해 Edge 또는 Chrome으로 연다. 주소창이 `file:///`로 시작하는지 확인한다.

1. 시작 화면에 카테고리 버튼 4개와 "순위표에 기록되지 않음"이 보인다.
2. "한국사"를 누르면 퀴즈 화면이 나오고 위에 `1 / 10`, 점수 `0`, 모드 "연습"이 보인다.
3. 정답을 누르면:
   - 그 보기가 초록 + ✓로 표시된다.
   - "정답!", 한 줄 해설, "출처: …" 링크가 나온다.
   - 점수가 `1`이 된다.
4. 다음 문항에서 일부러 오답을 누르면:
   - 고른 보기는 빨강 + ✗, 정답 보기는 초록 + ✓로 표시된다.
   - "오답 — 정답은 ○○"가 나온다.
   - 점수는 그대로다.
5. 답을 고른 뒤 다른 보기를 눌러도 아무 변화가 없다.
6. 출처 링크를 누르면 새 탭에서 열린다.
7. 10번째 문항에서 버튼이 "결과 보기"가 되고, 누르면:
   - 결과 화면에 "맞힌 수 / 10"이 나온다.
   - 문항별 맞음·틀림 목록이 나온다.
   - "순위표에 기록되지 않음"이 보인다.
8. [다시 하기]를 누르면 같은 카테고리가 다른 문항 순서와 다른 보기 순서로 시작된다. 두세 번 해 본다.
9. 퀴즈 도중 [처음으로]를 누르면 확인 창이 뜬다.
   - 취소를 누르면 그대로 있다.
   - 확인을 누르면 시작 화면으로 돌아간다.
10. 나머지 카테고리 3개도 각각 10문항이 나오는지 확인한다.
11. F12 → 기기 툴바(Ctrl+Shift+M) → 폭을 360으로 맞춘다. 모든 화면에서 가로 스크롤이 생기지 않는다.
12. (데이터 검사) `questions.js`의 첫 문항 보기 하나를 지우고 새로고침한다.
    - "문항 데이터 오류"와 `korean-history-01`이 보이면 통과다.
    - 확인한 뒤 원래대로 되돌린다.

### 1단계 마무리

- [ ] 위 12개 항목을 모두 통과했다고 사용자가 확인한다.
- [ ] 사용자가 승인하면 `git push -u origin main`을 한다. 승인 없이 push하지 않는다.

---

## 2단계: 스피드 모드, 힌트 모드, 틀린 문제 다시 풀기

### 만들 것

- 시작 화면의 모드 선택(연습·스피드·힌트)과 모드별 규칙 한 줄
- 스피드 모드: 문항당 15초 타이머. 해설이 나오면 멈추고, 0초가 되면 오답이다.
- 힌트 모드: 문항당 한 번, 오답 2개를 지운다. 힌트를 쓰고 맞히면 0.5점이다.
- 연습 모드의 틀린 문제 다시 풀기. 반복할 수 있고, 점수는 따로 보여 준다.

### 완료 기준

- `bash tests/run.sh` 결과가 `failed=0`이다.
- PRD 7장 2단계 체크리스트를 모두 만족한다.
- 1단계 브라우저 확인 항목도 여전히 통과한다. 연습 모드를 골라서 확인한다.

### Task 4: 모드 설정과 모드 선택 화면

**Files:**
- Modify: `script.js`, `index.html`, `style.css`
- Test: `tests/tests.js`

**Interfaces:**
- Consumes: `MODES`, `createGame`
- Produces:
  - `MODES`를 아래와 같이 확장한다.
    - `speed: { name: "스피드", timeLimit: 15, hint: false, ranked: true }`
    - `hint: { name: "힌트", timeLimit: null, hint: true, ranked: true }`
  - `shouldRecord(game) -> boolean`: `MODES[game.mode].ranked && !game.isRetry`
  - `#mode-list`: `input[type=radio][name=mode]` 3개. 기본값은 `practice`다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
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
```

- [ ] **Step 2: 실행해서 실패를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: 새 테스트 2개가 FAIL

- [ ] **Step 3: `MODES`와 `shouldRecord`, 모드 선택 UI를 구현한다**
  - 모드별 규칙 한 줄은 아래 문구를 그대로 쓴다.
    - 연습: "시간 제한·힌트 없음 · 맞히면 1점 · 순위표에 기록되지 않음"
    - 스피드: "문항마다 15초 · 시간이 지나면 오답 · 맞히면 1점"
    - 힌트: "문항마다 힌트 1번(오답 2개 지움) · 힌트 쓰고 맞히면 0.5점"
  - `#unranked-note`는 연습 모드를 골랐을 때만 보인다.
  - 카테고리 버튼을 누르면 선택된 모드로 `startGame`을 부른다.
  - `#quiz-mode`와 결과 화면 모드명은 `MODES[mode].name`을 쓴다.

- [ ] **Step 4: 실행해서 통과를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=18 failed=0`

- [ ] **Step 5: Commit**

```bash
git add script.js index.html style.css tests/tests.js
git commit -m "feat: 모드 설정과 모드 선택 화면"
```

### Task 5: 스피드 모드 타이머

**Files:**
- Modify: `script.js`, `index.html`, `style.css`
- Test: `tests/tests.js`

**Interfaces:**
- Consumes: `answerCurrent`, `createGame`
- Produces:
  - `remainingSeconds(deadline, now) -> number`: `Math.max(0, Math.ceil((deadline - now) / 1000))`
  - `timeoutCurrent(game) -> Result | null`: 이미 답했으면 `null`. 아니면 `{correct: false, timedOut: true, chosenIndex: null}`을 기록하고 `answered = true`로 바꾼다.
  - 화면 요소 `#quiz-timer`(남은 초)와 `#quiz-timer-bar`(막대). 스피드 모드에서만 보인다.
  - 화면 함수 `startTimer()`, `stopTimer()`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
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
```

- [ ] **Step 2: 실행해서 실패를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: 새 테스트 4개가 FAIL

- [ ] **Step 3: `remainingSeconds`, `timeoutCurrent`, 타이머 화면을 구현한다**
  - **`startTimer`:** `deadline = Date.now() + 15000`으로 정하고 `setInterval(200ms)`로 매번 다음을 한다.
    - `#quiz-timer`에 남은 초를 표시한다.
    - 막대 폭을 `(deadline - Date.now()) / 15000` 비율로 맞춘다.
    - 0초가 되면 `timeoutCurrent`를 부르고, 결과가 있으면 피드백에 "시간 초과 — 정답은 {보기}"를 보여 준다.
  - **`stopTimer`를 부르는 곳:**
    - 답을 고를 때
    - 시간이 초과됐을 때
    - [처음으로]에서 확인을 눌렀을 때
    - 결과 화면으로 갈 때
  - [처음으로]의 확인 창이 떠 있는 동안 타이머를 멈추지 않는다. `deadline` 기준이므로 시간은 계속 흐른다.
  - **문항 시작:** `renderQuestion`에서 스피드 모드면 `startTimer`를 부른다. 그래서 [다음] 뒤에 다시 15초부터 센다.
  - **결과 목록:** 시간 초과 문항은 "시간 초과"로 표시한다.

- [ ] **Step 4: 실행해서 통과를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=22 failed=0`

- [ ] **Step 5: Commit**

```bash
git add script.js index.html style.css tests/tests.js
git commit -m "feat: 스피드 모드 15초 타이머"
```

### Task 6: 힌트 모드

**Files:**
- Modify: `script.js`, `index.html`, `style.css`
- Test: `tests/tests.js`

**Interfaces:**
- Consumes: `answerCurrent`, `createGame`, `MODES`
- Produces:
  - `useHint(game, rng = Math.random) -> number[] | null`: 지운 보기 인덱스 2개를 돌려준다. 아래 경우에는 `null`이다.
    - 모드에 힌트가 없을 때
    - 이 문항에서 이미 힌트를 썼을 때
    - 이미 답했을 때
  - `useHint`는 `game.hintRemoved`에 지운 인덱스를 저장한다.
  - `answerCurrent`를 변경한다.
    - 지운 인덱스를 고르면 `null`을 반환한다.
    - `usedHint = hintRemoved.length > 0`을 기록한다.
  - 화면 요소 `#btn-hint`. 힌트 모드에서만 보인다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
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
```

- [ ] **Step 2: 실행해서 실패를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: 새 테스트 5개가 FAIL

- [ ] **Step 3: `useHint`, `answerCurrent` 변경, 힌트 버튼 화면을 구현한다**
  - 지운 보기에는 `disabled`와 `.is-removed` 클래스를 붙인다. `.is-removed`는 흐린 글자와 취소선이고, 버튼 자리는 그대로 둔다.
  - `#btn-hint`는 힌트를 쓴 뒤나 답한 뒤에 `disabled`가 된다.
  - 결과 목록에서 힌트를 쓴 문항에 "(힌트)"를 붙인다.
  - 퀴즈 화면 점수는 `formatScore`로 표시한다. 예: `3.5`

- [ ] **Step 4: 실행해서 통과를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=27 failed=0`

- [ ] **Step 5: Commit**

```bash
git add script.js index.html style.css tests/tests.js
git commit -m "feat: 힌트 모드(오답 2개 지우기, 0.5점)"
```

### Task 7: 틀린 문제 다시 풀기 (연습 모드)

**Files:**
- Modify: `script.js`, `index.html`, `style.css`
- Test: `tests/tests.js`

**Interfaces:**
- Consumes: `toItem`, `shuffle`, `createGame`, `shouldRecord`
- Produces:
  - `wrongQuestionIds(game) -> string[]`: `correct === false`인 결과의 `questionId` 목록이다. 시간 초과도 포함한다.
  - `buildRetryRound(questions, ids, rng = Math.random) -> Item[]`: 해당 id 문항만 고르고, 문항 순서와 보기 순서를 새로 섞는다.
  - `retrySummary(game) -> { correct: number, total: number }`
  - 화면 상태 `app.originalGame`: 처음 판이다. 다시 풀기를 반복해도 바뀌지 않는다.
  - 화면 요소 `#quiz-retry-badge`("다시 풀기"), `#btn-retry-wrong`, `#result-retry-score`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
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
```

- [ ] **Step 2: 실행해서 실패를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: 새 테스트가 FAIL

- [ ] **Step 3: 함수들과 다시 풀기 흐름을 구현한다**
  - **`#btn-retry-wrong`:** 아래 조건을 모두 만족할 때만 보인다.
    - 연습 모드다.
    - 방금 끝난 판(처음 판 또는 다시 풀기 판)에 틀린 문항이 있다.
  - **다시 풀기 판의 퀴즈 화면:**
    - `#quiz-retry-badge`를 보여 준다.
    - 진행은 `n / 틀린 수`로 센다.
  - **다시 풀기 판이 끝나면:**
    - 결과 화면 위쪽에 `app.originalGame`의 점수를 그대로 둔다.
    - `#result-retry-score`에 "다시 풀기 {맞힌 수} / {문항 수}"를 쓴다.
    - 또 틀린 문항이 있으면 [틀린 문제 다시 풀기]가 다시 나온다.
    - 모두 맞혔으면 "모두 맞혔어요!"를 쓰고 버튼을 숨긴다.
  - **[다시 하기]:** 새 처음 판을 시작하고 `app.originalGame`을 새 판으로 바꾼다.

- [ ] **Step 4: 실행해서 통과를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=28 failed=0`

- [ ] **Step 5: 아래 "2단계 브라우저 확인 항목"을 직접 확인하고 모두 통과시킨다**

- [ ] **Step 6: Commit**

```bash
git add script.js index.html style.css tests/tests.js
git commit -m "feat: 연습 모드 틀린 문제 다시 풀기"
```

### 2단계 브라우저 확인 항목

`index.html`을 새로고침한 뒤 확인한다.

**모드 선택**
1. 시작 화면에 모드 3개와 규칙 한 줄이 보인다. 기본값은 연습이다.
2. 연습을 고르면 "순위표에 기록되지 않음"이 보인다. 스피드나 힌트를 고르면 사라진다.

**스피드 모드**
3. 스피드 + 아무 카테고리로 시작하면 15초부터 1초씩 줄어들고, 막대도 줄어든다.
4. 5초쯤 남기고 답을 고르면 타이머가 멈춘다. 해설을 10초 넘게 읽어도 아무 일이 없다.
5. [다음]을 누르면 다음 문항이 15초부터 다시 시작된다.
6. 아무것도 누르지 않고 기다리면:
   - 0초에 "시간 초과 — 정답은 ○○"와 해설이 나온다.
   - 보기가 잠기고 점수는 그대로다.
7. 타이머가 도는 중에 다른 탭으로 5초 갔다가 돌아오면 약 5초가 줄어 있다.
8. 결과 목록에 시간 초과 문항이 "시간 초과"로 표시된다. 결과 화면에는 "순위표에 기록되지 않음"이 없다.
9. 퀴즈 도중 [처음으로] → 확인을 누른 뒤 10초 기다린다. 시작 화면에서 아무 일도 일어나지 않는다(타이머 정리 확인).

**힌트 모드**
10. 힌트 모드로 시작하면 [힌트] 버튼이 보이고, 타이머는 없다.
11. [힌트]를 누르면:
    - 보기 2개가 흐려지고 취소선이 그어진다.
    - 지워진 보기 2개 중에 정답은 없다.
    - 버튼 자리는 그대로다.
    - [힌트]가 비활성화된다.
12. 지워진 보기를 눌러도 반응이 없다.
13. 힌트를 쓰고 맞히면 점수가 0.5 오른다. 힌트 없이 맞히면 1 오르고, 틀리면 그대로다.
14. 다음 문항에서 [힌트]가 다시 활성화된다.
15. 결과 점수가 `7.5 / 10`처럼 소수로 맞게 나오고, 목록에 "(힌트)" 표시가 있다.

**틀린 문제 다시 풀기**
16. 연습 모드에서 일부러 3문항을 틀리고 끝내면 결과 화면에 [틀린 문제 다시 풀기]가 보인다.
17. 누르면:
    - "다시 풀기" 표시와 함께 `1 / 3`부터 시작한다.
    - 그 3문항만 나오고 보기 순서는 바뀌어 있다.
18. 1문항을 또 틀리고 끝내면:
    - 결과 위쪽 처음 점수는 `7 / 10` 그대로다.
    - 아래에 "다시 풀기 2 / 3"이 나온다.
    - [틀린 문제 다시 풀기]가 다시 보인다.
19. 다시 풀어 모두 맞히면 "모두 맞혔어요!"가 나오고 버튼이 사라진다.
20. 스피드나 힌트 모드 결과 화면에는 [틀린 문제 다시 풀기]가 없다.
21. 360px 폭에서 타이머 막대와 힌트 버튼이 화면 밖으로 나가지 않는다.

### 2단계 마무리

- [ ] 2단계 21개 항목과 1단계 항목을 연습 모드로 모두 통과했다고 사용자가 확인한다.
- [ ] 사용자가 승인하면 `git push`를 한다.

---

## 3단계: 점수 저장과 순위표 (localStorage)

### 만들 것

- 스피드·힌트 결과의 자동 저장. 모드 × 카테고리로 순위표 8개, 각각 상위 10개를 남긴다.
- 결과 화면의 "순위표 n위", "순위표 10위 밖", "기록을 저장할 수 없음"
- 순위표 화면: 모드 탭과 카테고리 탭, 기록이 없을 때 안내
- localStorage를 쓸 수 없거나 깨져 있어도 퀴즈가 동작해야 한다.

### 완료 기준

- `bash tests/run.sh` 결과가 `failed=0`이다.
- PRD 7장 3단계 체크리스트를 모두 만족한다.
- 1·2단계 브라우저 확인 항목도 여전히 통과한다.

### Task 8: 순위표 저장 로직

**Files:**
- Modify: `script.js`
- Test: `tests/tests.js`

**Interfaces:**
- Consumes: 없음 (순수 로직)
- Produces:
  - `STORAGE_KEY = "commonsense-quiz.leaderboard.v1"`
  - `boardKey(modeId, categoryId) -> string`: 예 `"speed:science"`
  - `insertRecord(list, record) -> { list: Record[], rank: number | null }`
    - 점수 내림차순으로 넣는다. 같은 점수면 기존 기록 뒤에 넣는다.
    - 상위 10개만 남긴다.
    - `rank`는 1부터 센다. 잘려 나갔으면 `null`이다.
  - `loadBoards(storage) -> { ok: boolean, boards: object }`
    - `storage`가 `null`이거나 `getItem`이 예외를 던지면 `ok: false`.
    - JSON이 깨졌거나 객체가 아니면 `{ ok: true, boards: {} }`.
  - `saveRecord(storage, modeId, categoryId, record) -> { ok: boolean, rank: number | null }`
    - `setItem`이 예외를 던지면 `ok: false`.
  - `getStorage() -> Storage | null`: `try { return window.localStorage } catch { return null }`

- [ ] **Step 1: 실패하는 테스트를 쓴다** (가짜 저장소 사용)

```js
const memStorage = (init = {}) => ({ data: { ...init },
  getItem(k) { return k in this.data ? this.data[k] : null; },
  setItem(k, v) { this.data[k] = String(v); } });
const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
const rec = (score, t = 0) => ({ score, playedAt: new Date(t).toISOString() });

test("빈 순위표에 넣으면 1위", () => {
  assertEqual(insertRecord([], rec(7)).rank, 1);
});
test("동점이면 먼저 세운 기록이 위", () => {
  const { list, rank } = insertRecord([rec(8, 1)], rec(8, 2));
  assertEqual(rank, 2);
  assertEqual(list[0].playedAt, rec(8, 1).playedAt);
});
test("11번째로 밀리면 rank null, 목록은 10개", () => {
  const full = Array.from({ length: 10 }, (_, i) => rec(10, i));
  const r = insertRecord(full, rec(5));
  assertEqual(r.rank, null);
  assertEqual(r.list.length, 10);
});
test("높은 점수는 맨 위, 꼴찌가 빠진다", () => {
  const full = Array.from({ length: 10 }, (_, i) => rec(5, i));
  const r = insertRecord(full, rec(9.5));
  assertEqual(r.rank, 1);
  assertEqual(r.list.length, 10);
});
test("저장 후 다시 읽을 수 있다", () => {
  const s = memStorage();
  assertEqual(saveRecord(s, "speed", "science", rec(9)).rank, 1);
  const { ok, boards } = loadBoards(s);
  assertEqual(ok, true);
  assertEqual(boards[boardKey("speed", "science")][0].score, 9);
});
test("깨진 JSON은 빈 순위표", () => {
  const r = loadBoards(memStorage({ [STORAGE_KEY]: "{" }));
  assertEqual(r.ok, true);
  assertEqual(Object.keys(r.boards).length, 0);
});
test("저장소를 못 쓰면 ok:false, 예외 없음", () => {
  assertEqual(loadBoards(throwing).ok, false);
  assertEqual(saveRecord(throwing, "hint", "science", rec(3)).ok, false);
  assertEqual(loadBoards(null).ok, false);
});
```

- [ ] **Step 2: 실행해서 실패를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: 새 테스트 7개가 FAIL

- [ ] **Step 3: Produces에 적은 함수들을 구현한다**

- [ ] **Step 4: 실행해서 통과를 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=35 failed=0`

- [ ] **Step 5: Commit**

```bash
git add script.js tests/tests.js
git commit -m "feat: 순위표 저장 로직(localStorage, 상위 10개)"
```

### Task 9: 결과 저장과 순위표 화면

**Files:**
- Modify: `script.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `shouldRecord`, `saveRecord`, `loadBoards`, `getStorage`, `boardKey`, `formatScore`, `CATEGORIES`, `MODES`
- Produces:
  - 화면 요소
    - 결과 화면: `#result-rank`
    - 시작 화면: `#btn-board`
    - 순위표 화면: `#board-mode-tabs`(스피드, 힌트), `#board-category-tabs`(4개), `#board-list`, `#board-message`, `#btn-board-home`
  - 화면 함수 `renderBoard(modeId, categoryId)`

- [ ] **Step 1: 결과 저장을 구현한다**
  - 결과 화면으로 갈 때 `shouldRecord(game)`이 참이면 다음 값으로 `saveRecord`를 부른다.
    - `getStorage()`
    - `{ score: totalScore(...), playedAt: new Date().toISOString() }`
  - `#result-rank`에는 결과에 따라 아래 문구를 쓴다.
    - `ok`이고 `rank`가 있음: "순위표 {rank}위"
    - `ok`이고 `rank`가 `null`: "순위표 10위 밖"
    - `ok`가 아님: "기록을 저장할 수 없음"
  - 연습 모드와 다시 풀기 판에서는 `#result-rank`를 숨긴다.

- [ ] **Step 2: 순위표 화면을 구현한다**
  - 시작 화면 [순위표 보기]를 누르면 `renderBoard("speed", 첫 카테고리)`를 부른다.
  - 탭을 누르면 해당 모드와 카테고리로 다시 그린다. 선택된 탭에 `aria-selected="true"`를 붙인다.
  - `#board-list`의 각 줄은 `순위. 점수(formatScore) · YYYY-MM-DD HH:mm`이다. 시간은 브라우저 지역 시간으로 표시한다.
  - 기록이 없으면 `#board-message`에 "아직 기록이 없어요"를 쓴다.
  - `loadBoards(...).ok`가 거짓이면 "기록을 저장할 수 없음"을 쓴다.
  - `#btn-board-home`을 누르면 시작 화면으로 간다.

- [ ] **Step 3: 로직 테스트가 깨지지 않았는지 확인한다**
  - Run: `bash tests/run.sh`
  - Expected: `SUMMARY passed=35 failed=0`

- [ ] **Step 4: 아래 "3단계 브라우저 확인 항목"을 직접 확인하고 모두 통과시킨다**

- [ ] **Step 5: Commit**

```bash
git add script.js index.html style.css
git commit -m "feat: 결과 자동 저장과 순위표 화면"
```

### 3단계 브라우저 확인 항목

`index.html`을 새로고침한 뒤 확인한다.

1. 스피드 + 과학을 한 판 끝내면 결과 화면에 "순위표 1위"가 보인다.
2. 같은 조건으로 한 판 더 하면:
   - 점수가 더 높으면 "순위표 1위", 낮으면 "순위표 2위"가 나온다.
   - 같은 점수면 "순위표 2위"가 나온다(먼저 세운 기록이 위).
3. 시작 화면 → [순위표 보기] → 스피드 / 과학 탭에 두 기록이 점수 순으로 보인다. 날짜와 시간도 맞다.
4. 힌트 + 과학을 한 판 하면 힌트 / 과학 탭에만 기록이 생긴다. 스피드 / 과학 탭은 그대로다.
5. 기록이 없는 탭(예: 힌트 / 한국사)에는 "아직 기록이 없어요"가 보인다.
6. 연습 모드로 한 판 끝내면 결과에 순위 문구가 없고, 어느 탭에도 기록이 생기지 않는다.
7. 연습 모드에서 틀린 문제 다시 풀기를 끝내도 기록이 생기지 않는다.
8. 브라우저를 완전히 닫았다 다시 `index.html`을 열어도 순위표 기록이 남아 있다.
9. 10위 밖 확인(선택):
   - F12 → 콘솔에 아래를 붙여 넣고 새로고침한다.

     ```js
     localStorage.setItem("commonsense-quiz.leaderboard.v1", JSON.stringify({"speed:science": Array.from({length:10}, () => ({score:10, playedAt:new Date().toISOString()}))}))
     ```

   - 스피드 + 과학을 한 판 하면(10점 미만) "순위표 10위 밖"이 나오고, 순위표에는 10개만 있다.
10. 깨진 데이터 확인:
    - 콘솔에서 `localStorage.setItem("commonsense-quiz.leaderboard.v1", "{")`를 실행하고 새로고침한다.
    - 퀴즈가 정상 동작하고, 순위표는 "아직 기록이 없어요"다.
11. 정리: 콘솔에서 `localStorage.removeItem("commonsense-quiz.leaderboard.v1")`을 실행하면 순위표가 비워진다.
12. 360px 폭에서 순위표 탭 6개가 화면 밖으로 넘치지 않는다. 줄바꿈은 괜찮다.

> 저장소 차단 상황("기록을 저장할 수 없음")은 브라우저 설정마다 재현 방법이 달라서, Task 8의 자동 테스트(`throwing` 저장소)로 확인한다.

### 3단계 마무리

- [ ] 3단계 12개 항목과 1·2단계 항목을 모두 통과했다고 사용자가 확인한다.
- [ ] 사용자가 승인하면 `git push`를 한다.
