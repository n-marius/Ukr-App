#!/usr/bin/env node
// Erzeugt content/vokabeln/index.json aus allen Listen content/vokabeln/liste-*.json.
// Ändert sich der Bestand (Prüfsumme), wird "version" automatisch erhöht.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "vokabeln");
const indexPath = path.join(dir, "index.json");

const hash = createHash("sha256");
const words = [];
for (const name of readdirSync(dir).filter((f) => /^liste-\d+\.json$/.test(f)).sort()) {
  const raw = readFileSync(path.join(dir, name), "utf8");
  hash.update(name).update("\0").update(raw).update("\0");
  words.push(...JSON.parse(raw));
}
words.sort((a, b) => a.id.localeCompare(b.id));

const contentHash = hash.digest("hex").slice(0, 16);
const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { version: 0 };
const version = previous.contentHash === contentHash ? previous.version : (previous.version ?? 0) + 1;

const out = `{\n  "version": ${version},\n  "contentHash": "${contentHash}",\n  "words": [\n${words.map((w) => `    ${JSON.stringify(w)}`).join(",\n")}\n  ]\n}\n`;
writeFileSync(indexPath, out);
console.log(`vokabeln/index.json: ${words.length} Vokabel(n), version ${version}${version !== previous.version ? " (erhöht)" : ""}`);
