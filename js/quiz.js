// Kontrolle: alle Fragen auf einer Seite, je vier gemischte Antworten im 2×2-Raster.
// Die erste Auswahl zählt; Klicks auf Fragewörter werden separat gezählt.
import { renderTokenStream, togglePopover } from "./tokens.js";

const KEYS = ["A", "B", "C", "D"];

export function renderQuiz(container, text, { onProgress } = {}) {
  let answered = 0;
  let correct = 0;
  let questionClicks = 0;

  text.questions.forEach((q, qi) => {
    const block = document.createElement("section");
    block.className = "q";

    const num = document.createElement("p");
    num.className = "q-num";
    num.textContent = `Frage ${qi + 1}`;

    const prompt = document.createElement("p");
    prompt.className = "q-text";
    prompt.lang = "uk";
    renderTokenStream(prompt, q.q, (span, tok) => {
      questionClicks++;
      togglePopover(span, tok);
    });

    const grid = document.createElement("div");
    grid.className = "answers";
    const buttons = shuffle([0, 1, 2, 3]).map((optIndex, pos) => {
      const btn = document.createElement("button");
      btn.className = "answer";
      btn.type = "button";
      btn.dataset.opt = String(optIndex);
      btn.innerHTML = `<span class="answer-key">${KEYS[pos]}</span><span lang="uk"></span>`;
      btn.lastElementChild.textContent = q.o[optIndex];
      btn.addEventListener("click", () => choose(optIndex));
      grid.appendChild(btn);
      return btn;
    });

    function choose(optIndex) {
      if (block.classList.contains("is-done")) return;
      block.classList.add("is-done");
      const isCorrect = optIndex === q.a;
      if (isCorrect) correct++;
      answered++;
      for (const b of buttons) {
        const opt = Number(b.dataset.opt);
        if (opt === q.a) b.classList.add("is-correct");
        else if (opt === optIndex) b.classList.add("is-wrong");
        b.disabled = true;
      }
      onProgress?.(answered, text.questions.length);
    }

    block.append(num, prompt, grid);
    container.appendChild(block);
  });

  return {
    result: () => ({ correct, answered, questionClicks }),
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
