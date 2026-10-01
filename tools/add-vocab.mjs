#!/usr/bin/env node
// Nimmt Vokabeldateien (.txt/.json mit einer JSON-Liste, Format: docs/VOKABEL-VORLAGE.md) auf:
// prüft, vergibt fortlaufende IDs (v0001 …), erkennt Doppelte, legt content/vokabeln/liste-NNNN.json an,
// baut den Index neu. Ohne Argumente: alle passenden Dateien in content/_inbox/ (werden danach gelöscht).
// Aufruf: node tools/add-vocab.mjs [Datei …] [--keep]
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateWord, dupKey, formatId } from "./vocab-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "content", "vokabeln");
const inbox = path.join(root, "content", "_inbox");
const args = process.argv.slice(2);
const keep = args.includes("--keep");
let files = args.filter((a) => !a.startsWith("--"));
const fromInbox = files.length === 0;
if (fromInbox) files = readdirSync(inbox).filter((f) => /\.(txt|json)$/i.test(f)).map((f) => path.join(inbox, f));

function parse(file) {
  const raw = readFileSync(file, "utf8").replace(/^﻿/, "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : data.vokabeln;
}

const existing = [];
for (const name of readdirSync(dir).filter((f) => /^liste-\d+\.json$/.test(f))) existing.push(...JSON.parse(readFileSync(path.join(dir, name), "utf8")));
const known = new Set(existing.map(dupKey));
let nextId = existing.reduce((m, w) => Math.max(m, Number(w.id.slice(1))), 0) + 1;
let nextList = readdirSync(dir).filter((f) => /^liste-\d+\.json$/.test(f)).length + 1;

let failed = false;
for (const file of files) {
  const label = path.basename(file);
  let list;
  try { list = parse(file); } catch (e) { console.log(`${label}: übersprungen (keine Vokabelliste: ${e.message})`); continue; }
  if (!Array.isArray(list) || !list.every((w) => w && typeof w === "object" && "uk" in w)) { console.log(`${label}: übersprungen (keine Vokabelliste)`); continue; }

  const errs = [];
  const warns = [];
  const accepted = [];
  let skipped = 0;
  list.forEach((raw, i) => {
    const { id, ...w } = raw; // vorhandene IDs ignorieren, werden neu vergeben
    const r = validateWord(w, `${label} #${i + 1} (${w.uk ?? "?"})`);
    errs.push(...r.errors);
    warns.push(...r.warnings);
    if (r.errors.length) return;
    const k = dupKey(w);
    if (known.has(k)) { skipped++; console.log(`  Doppelt, übersprungen: ${w.uk} = ${w.de} (${w.pos})`); return; }
    known.add(k);
    accepted.push(w);
  });
  warns.forEach((m) => console.warn(`  Hinweis: ${m}`));
  if (errs.length) { failed = true; errs.forEach((m) => console.error(`  Fehler: ${m}`)); console.error(`${label}: NICHT aufgenommen (${errs.length} Fehler)`); continue; }
  if (accepted.length === 0) { console.log(`${label}: nichts Neues (${skipped} Doppelte)`); if (fromInbox && !keep) unlinkSync(file); continue; }

  const out = accepted.map((w) => ({ id: formatId(nextId++), ...w }));
  const name = `liste-${String(nextList++).padStart(4, "0")}.json`;
  writeFileSync(path.join(dir, name), `[\n${out.map((w) => `  ${JSON.stringify(w)}`).join(",\n")}\n]\n`);
  console.log(`${label}: ${out.length} Vokabel(n) → content/vokabeln/${name} (${out[0].id}–${out.at(-1).id})${skipped ? `, ${skipped} Doppelte übersprungen` : ""}`);
  if (fromInbox && !keep) unlinkSync(file);
}

execFileSync("node", [path.join(root, "tools", "build-vocab-index.mjs")], { stdio: "inherit" });
if (failed) process.exit(1);
