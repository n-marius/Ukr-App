// Frage-Antwort: verzweigtes Gespräch. Jeder Knoten zeigt eine Nachricht der App
// und (außer am Ende) vier vorformulierte Antworten; die unpassende Antwort blockiert,
// bis eine passende gewählt wird. Wörter sind überall antippbar wie im Lesetext.
import { renderTokenStream, togglePopover, closePopover } from "./tokens.js";

const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;

export function renderChat(container, chat) {
  container.innerHTML = "";
  showNode(chat.start);

  function showNode(nodeId) {
    const node = chat.nodes[nodeId];
    appendBubble(node.bot, "bot");
    if (!node.answers) {
      appendEnd();
      return;
    }
    appendAnswers(node.answers);
  }

  function appendBubble(tokens, role) {
    const bubble = document.createElement("div");
    bubble.className = `bubble bubble-${role}`;
    const p = document.createElement("p");
    p.lang = "uk";
    renderTokenStream(p, tokens, (span, tok) => togglePopover(span, tok));
    bubble.appendChild(p);
    container.appendChild(bubble);
    scrollTo(bubble);
  }

  function appendAnswers(answers) {
    const wrap = document.createElement("div");
    wrap.className = "answer-list";

    answers.forEach((a) => {
      const row = document.createElement("div");
      row.className = "answer-row";

      const p = document.createElement("p");
      p.className = "answer-row-text";
      p.lang = "uk";
      renderTokenStream(p, a.t, (span, tok) => togglePopover(span, tok));

      const send = document.createElement("button");
      send.className = "answer-send";
      send.type = "button";
      send.setAttribute("aria-label", "Antwort senden");
      send.innerHTML = SEND_ICON;
      send.addEventListener("click", () => choose(a, row));

      row.append(p, send);
      wrap.appendChild(row);
    });

    container.appendChild(wrap);
    scrollTo(wrap);

    function choose(a, row) {
      if (wrap.classList.contains("is-done")) return;
      if (!a.ok) {
        row.classList.add("is-wrong");
        return;
      }
      wrap.classList.add("is-done");
      row.classList.add("is-correct");
      setTimeout(() => {
        closePopover();
        wrap.remove();
        appendBubble(a.t, "user");
        setTimeout(() => showNode(a.next), 200);
      }, 500);
    }
  }

  function appendEnd() {
    const el = document.createElement("p");
    el.className = "chat-end";
    el.textContent = "Gespräch beendet";
    container.appendChild(el);
    scrollTo(el);
  }

  function scrollTo(el) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "end" }));
  }
}
