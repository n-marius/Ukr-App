#!/usr/bin/env node
// Validiert content/chat/index.json und alle referenzierten Chat-Dateien gegen docs/CHAT-VORLAGE.md.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chatDir = path.join(root, "content", "chat");
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];

let errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const indexPath = path.join(chatDir, "index.json");
if (!existsSync(indexPath)) {
  console.error("content/chat/index.json fehlt");
  process.exit(1);
}
const index = readJson(indexPath);

if (typeof index.version !== "number") fail("chat/index.json: 'version' fehlt oder ist keine Zahl");

const seenIds = new Set();

for (const entry of index.chats ?? []) {
  const ref = `chat/index.json[${entry.id ?? "?"}]`;
  if (!entry.id) fail(`${ref}: 'id' fehlt`);
  if (!levels.includes(entry.level)) fail(`${ref}: ungültiges level '${entry.level}'`);
  if (!entry.title) fail(`${ref}: 'title' fehlt`);
  if (!entry.titleDe) fail(`${ref}: 'titleDe' fehlt`);
  if (!entry.file) fail(`${ref}: 'file' fehlt`);
  if (!Array.isArray(entry.tags) || entry.tags.length !== 1) fail(`${ref}: 'tags' muss genau einen Eintrag haben`);
  if (seenIds.has(entry.id)) fail(`${ref}: Duplikat-ID`);
  seenIds.add(entry.id);

  const filePath = path.join(chatDir, entry.file ?? "");
  if (!entry.file || !existsSync(filePath)) {
    fail(`${ref}: Datei '${entry.file}' nicht gefunden`);
    continue;
  }

  const chat = readJson(filePath);
  const cref = `chat/${entry.file}`;

  if (chat.id !== entry.id) fail(`${cref}: id '${chat.id}' stimmt nicht mit chat/index.json ('${entry.id}') überein`);
  if (chat.level !== entry.level) fail(`${cref}: level stimmt nicht mit chat/index.json überein`);
  if (!chat.title) fail(`${cref}: 'title' fehlt`);
  if (!chat.titleDe) fail(`${cref}: 'titleDe' fehlt`);
  if (!chat.start) fail(`${cref}: 'start' fehlt`);

  const nodes = chat.nodes ?? {};
  const nodeIds = Object.keys(nodes);
  if (nodeIds.length === 0) {
    fail(`${cref}: 'nodes' ist leer`);
    continue;
  }
  if (chat.start && !(chat.start in nodes)) fail(`${cref}: 'start' ('${chat.start}') ist kein Knoten in 'nodes'`);

  const units = chat.units ?? {};
  const usedUnitIds = new Set();

  const checkToken = (token, where) => {
    if ("p" in token) return;
    if (!token.t) fail(`${where}: 't' fehlt`);
    if (token.u) {
      usedUnitIds.add(token.u);
      if (!(token.u in units)) fail(`${where}: Unit-ID '${token.u}' existiert nicht in 'units'`);
      return;
    }
    if (!token.l) fail(`${where}: 'l' fehlt`);
    if (!token.g) fail(`${where}: 'g' fehlt`);
    if (!token.pos) fail(`${where}: 'pos' fehlt`);
  };

  const reachable = new Set([chat.start]);
  let endCount = 0;

  for (const [nodeId, node] of Object.entries(nodes)) {
    const nref = `${cref} nodes.${nodeId}`;
    if (!Array.isArray(node.bot) || node.bot.length === 0) {
      fail(`${nref}: 'bot' fehlt oder leer`);
    } else {
      node.bot.forEach((tok, i) => checkToken(tok, `${nref}.bot[${i}]`));
    }

    if (node.answers === undefined) {
      endCount++;
      continue;
    }
    if (!Array.isArray(node.answers) || node.answers.length !== 4) {
      fail(`${nref}: 'answers' muss genau 4 Einträge haben`);
      continue;
    }
    const okCount = node.answers.filter((a) => a.ok === true).length;
    const badCount = node.answers.filter((a) => a.ok === false).length;
    if (okCount !== 3 || badCount !== 1) {
      fail(`${nref}: es müssen genau 3 richtige ('ok': true) und 1 falsche ('ok': false) Antwort sein`);
    }
    node.answers.forEach((a, ai) => {
      const aref = `${nref}.answers[${ai}]`;
      if (!Array.isArray(a.t) || a.t.length === 0) fail(`${aref}: 't' fehlt oder leer`);
      else a.t.forEach((tok, i) => checkToken(tok, `${aref}.t[${i}]`));
      if (a.ok === true) {
        if (!a.next) fail(`${aref}: 'next' fehlt bei richtiger Antwort`);
        else if (!(a.next in nodes)) fail(`${aref}: 'next' ('${a.next}') ist kein Knoten in 'nodes'`);
        else reachable.add(a.next);
      } else if (a.ok === false) {
        if (a.next) fail(`${aref}: falsche Antwort darf kein 'next' haben`);
      } else {
        fail(`${aref}: 'ok' muss true oder false sein`);
      }
    });
  }

  if (endCount === 0) fail(`${cref}: kein Endknoten (Knoten ohne 'answers') vorhanden`);
  for (const nodeId of nodeIds) {
    if (!reachable.has(nodeId)) fail(`${cref}: Knoten '${nodeId}' ist vom Start aus nicht erreichbar`);
  }
  for (const unitId of Object.keys(units)) {
    if (!usedUnitIds.has(unitId)) fail(`${cref}: Unit '${unitId}' wird definiert, aber nirgends referenziert`);
  }
}

// Version muss steigen, sobald sich content/chat gegenüber dem letzten Commit geändert hat.
try {
  const git = (cmd) => execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString();
  const changed = git("git status --porcelain -- content/chat").trim() !== "";
  if (changed) {
    const previous = JSON.parse(git("git show HEAD:content/chat/index.json")).version;
    if (!(index.version > previous)) {
      fail(`chat/index.json: Inhalte geändert, aber 'version' nicht erhöht (bisher ${previous}, jetzt ${index.version})`);
    }
  }
} catch {
  // kein Git, noch kein Commit mit chat/index.json, oder Datei existierte vorher nicht: Prüfung entfällt
}

if (errors.length > 0) {
  console.error(`Chat-Validierung fehlgeschlagen (${errors.length} Fehler):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`Chat-Validierung ok: ${(index.chats ?? []).length} Chat(s) geprüft.`);
