#!/usr/bin/env node
// Prüft content/vokabeln/index.json und alle Listen (SPEC.md Abschnitt 12).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateWord, dupKey, POS } from "./vocab-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "content", "vokabeln");
const errors = [];
const warnings = [];

const indexPath = path.join(dir, "index.json");
if (!existsSync(indexPath)) { console.error("content/vokabeln/index.json fehlt (node tools/build-vocab-index.mjs)"); process.exit(1); }
const index = JSON.parse(readFileSync(indexPath, "utf8"));
if (typeof index.version !== "number") errors.push("index.json: 'version' fehlt");

const fromFiles = [];
for (const name of readdirSync(dir).filter((f) => /^liste-\d+\.json$/.test(f)).sort()) {
  const list = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
  if (!Array.isArray(list)) errors.push(`${name}: muss eine Liste sein`);
  else for (const w of list) fromFiles.push({ ...w, _file: name });
}

const ids = new Set();
const dups = new Map();
for (const w of fromFiles) {
  const where = `${w._file} ${w.id ?? "?"}`;
  if (!/^v\d{4,}$/.test(w.id ?? "")) errors.push(`${where}: ungültige id`);
  if (ids.has(w.id)) errors.push(`${where}: doppelte id`);
  ids.add(w.id);
  const { _file, ...word } = w;
  const r = validateWord(word, where);
  errors.push(...r.errors);
  warnings.push(...r.warnings);
  const k = dupKey(word);
  if (dups.has(k)) warnings.push(`${where}: gleicht ${dups.get(k)} (gleiches Wort, gleiche Bedeutung, gleiche Wortart)`);
  else dups.set(k, w.id);
}

// Index und Listen müssen übereinstimmen.
const indexIds = (index.words ?? []).map((w) => w.id);
if (indexIds.length !== fromFiles.length || indexIds.some((id) => !ids.has(id))) errors.push("index.json passt nicht zu den Listen – node tools/build-vocab-index.mjs ausführen");

// Für Frage-Antwort brauchen die Falschantworten genug Wörter gleicher Wortart.
for (const pos of POS) {
  const n = fromFiles.filter((w) => w.pos === pos).length;
  if (n > 0 && n < 4) warnings.push(`Wortart ${pos}: nur ${n} Vokabel(n) – die Falschantworten kommen teils aus anderen Wortarten`);
}

try {
  const git = (cmd) => execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString();
  if (git("git status --porcelain -- content/vokabeln").trim() !== "") {
    const previous = JSON.parse(git("git show HEAD:content/vokabeln/index.json")).version;
    if (!(index.version > previous)) errors.push(`index.json: Inhalte geändert, aber 'version' nicht erhöht (bisher ${previous}, jetzt ${index.version})`);
  }
} catch {
  // kein Git oder noch kein Commit mit diesem Index: Prüfung entfällt
}

for (const w of warnings) console.warn(`Hinweis: ${w}`);
if (errors.length > 0) {
  console.error(`Validierung fehlgeschlagen (${errors.length} Fehler):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Validierung ok: ${fromFiles.length} Vokabel(n) geprüft${warnings.length ? `, ${warnings.length} Hinweis(e)` : ""}.`);
