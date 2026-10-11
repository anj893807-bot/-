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

// ===== 화면 =====

if (document.getElementById("app")) initApp();
