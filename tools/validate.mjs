#!/usr/bin/env node
// Validiert content/index.json und alle referenzierten Textdateien gegen SPEC.md Abschnitt 3.3.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");

let errors = [];

function fail(msg) {
  errors.push(msg);
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

const indexPath = path.join(contentDir, "index.json");
if (!existsSync(indexPath)) {
  console.error("content/index.json fehlt");
  process.exit(1);
}
const index = readJson(indexPath);

if (typeof index.version !== "number") {
  fail("index.json: 'version' fehlt oder ist keine Zahl");
}

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const seenIds = new Set();

for (const entry of index.texts ?? []) {
  const ref = `index.json[${entry.id ?? "?"}]`;
  if (!entry.id) fail(`${ref}: 'id' fehlt`);
  if (!levels.includes(entry.level)) fail(`${ref}: ungültiges level '${entry.level}'`);
  if (!entry.title) fail(`${ref}: 'title' fehlt`);
  if (!entry.titleDe) fail(`${ref}: 'titleDe' fehlt`);
  if (!entry.file) fail(`${ref}: 'file' fehlt`);
  if (!Array.isArray(entry.tags) || entry.tags.length !== 1) fail(`${ref}: 'tags' muss genau einen Eintrag haben`);
  if (seenIds.has(entry.id)) fail(`${ref}: Duplikat-ID in index.json`);
  seenIds.add(entry.id);

  const filePath = path.join(contentDir, entry.file ?? "");
  if (!entry.file || !existsSync(filePath)) {
    fail(`${ref}: Datei '${entry.file}' nicht gefunden`);
    continue;
  }

  const text = readJson(filePath);
  const tref = `${entry.file}`;

  if (text.id !== entry.id) {
    fail(`${tref}: id '${text.id}' stimmt nicht mit index.json ('${entry.id}') überein`);
  }
  if (text.level !== entry.level) {
    fail(`${tref}: level '${text.level}' stimmt nicht mit index.json ('${entry.level}') überein`);
  }
  if (!text.title) fail(`${tref}: 'title' fehlt`);
  if (!text.titleDe) fail(`${tref}: 'titleDe' fehlt`);
  if (!Array.isArray(text.paragraphs) || text.paragraphs.length === 0) {
    fail(`${tref}: 'paragraphs' fehlt oder leer`);
  }

  const units = text.units ?? {};
  const usedUnitIds = new Set();

  for (const [pi, paragraph] of (text.paragraphs ?? []).entries()) {
    for (const [ti, token] of paragraph.entries()) {
      const tokref = `${tref} paragraphs[${pi}][${ti}]`;
      if ("p" in token) continue; // Satzzeichen/Leerraum, keine Pflichtfelder
      if (!("t" in token)) fail(`${tokref}: weder 't' noch 'p' gesetzt`);
      if ("u" in token) {
        usedUnitIds.add(token.u);
        if (!(token.u in units)) fail(`${tokref}: Unit-ID '${token.u}' existiert nicht in 'units'`);
        continue;
      }
      if (!token.l) fail(`${tokref}: 'l' fehlt`);
      if (!token.g) fail(`${tokref}: 'g' fehlt`);
      if (!token.pos) fail(`${tokref}: 'pos' fehlt`);
    }
  }

  for (const unitId of Object.keys(units)) {
    if (!usedUnitIds.has(unitId)) fail(`${tref}: Unit '${unitId}' wird in 'units' definiert, aber nirgends referenziert`);
  }

  const checkToken = (token, where) => {
    if ("p" in token) return;
    if (!token.t) fail(`${where}: 't' fehlt`);
    if (token.u) return;
    if (!token.l) fail(`${where}: 'l' fehlt`);
    if (!token.g) fail(`${where}: 'g' fehlt`);
    if (!token.pos) fail(`${where}: 'pos' fehlt`);
  };

  const questions = text.questions ?? [];
  if (questions.length !== 5) {
    fail(`${tref}: es müssen genau 5 Fragen vorhanden sein, gefunden: ${questions.length}`);
  }
  for (const [qi, q] of questions.entries()) {
    const qref = `${tref} questions[${qi}]`;
    if (!Array.isArray(q.q) || q.q.length === 0) fail(`${qref}: 'q' fehlt oder leer`);
    else q.q.forEach((tok, ti) => checkToken(tok, `${qref}.q[${ti}]`));
    if (!Array.isArray(q.o) || q.o.length !== 4) fail(`${qref}: es müssen genau 4 Optionen vorhanden sein`);
    if (typeof q.a !== "number" || q.a < 0 || q.a > 3) fail(`${qref}: 'a' muss zwischen 0 und 3 liegen`);
  }
}

// Version muss steigen, sobald sich content/ gegenüber dem letzten Commit geändert hat.
try {
  const git = (cmd) => execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString();
  const changed = git("git status --porcelain -- content ':!content/chat' ':!content/_inbox' ':!content/vokabeln'").trim() !== "";
  if (changed) {
    const previous = JSON.parse(git("git show HEAD:content/index.json")).version;
    if (!(index.version > previous)) {
      fail(`index.json: Inhalte geändert, aber 'version' nicht erhöht (bisher ${previous}, jetzt ${index.version})`);
    }
  }
} catch {
  // kein Git oder noch kein Commit mit content/index.json: Prüfung entfällt
}

if (errors.length > 0) {
  console.error(`Validierung fehlgeschlagen (${errors.length} Fehler):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`Validierung ok: ${index.texts.length} Text(e) geprüft.`);
