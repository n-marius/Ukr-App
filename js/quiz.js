// Kontrolle: 5 Fragen, je 4 gemischte Optionen, sofortiges Feedback, Klicks separat gezählt.
import { renderTokenStream, showTokenOverlay } from "./tokens.js";

export function renderQuiz(container, text, onFinished) {
  container.innerHTML = "";
  let quizClicks = 0;
  let correctCount = 0;
  let qIndex = 0;

  const questions = text.questions.map((q) => {
    const order = shuffle([0, 1, 2, 3]);
    return { ...q, order };
  });

  function renderQuestion() {
    container.innerHTML = "";
    const q = questions[qIndex];
    const wrap = document.createElement("div");
    wrap.className = "quiz-question";

    const prompt = document.createElement("p");
    prompt.className = "quiz-prompt reader-text";
    renderTokenStream(prompt, q.q, (span, tok) => {
      quizClicks++;
      showTokenOverlay(span, tok);
    });
    wrap.appendChild(prompt);

    const counter = document.createElement("p");
    counter.className = "quiz-counter";
    counter.textContent = `Frage ${qIndex + 1} / 5`;
    wrap.appendChild(counter);

    const optsWrap = document.createElement("div");
    optsWrap.className = "quiz-options";
    let answered = false;
    for (const origIdx of q.order) {
      const btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.textContent = q.o[origIdx];
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const isCorrect = origIdx === q.a;
        if (isCorrect) correctCount++;
        btn.classList.add(isCorrect ? "correct" : "wrong");
        if (!isCorrect) {
          const correctBtn = [...optsWrap.children].find(
            (b) => b.textContent === q.o[q.a]
          );
          correctBtn?.classList.add("correct");
        }
        setTimeout(() => {
          qIndex++;
          if (qIndex < questions.length) renderQuestion();
          else onFinished({ correct: correctCount, quizClicks });
        }, 700);
      });
      optsWrap.appendChild(btn);
    }
    wrap.appendChild(optsWrap);
    container.appendChild(wrap);
  }

  renderQuestion();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
