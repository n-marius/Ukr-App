#!/usr/bin/env node
// Erzeugt content/index.json aus allen Textdateien unter content/<Stufe>/.
// Ändert sich ein Text (Prüfsumme), wird "version" automatisch erhöht.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const indexPath = path.join(contentDir, "index.json");
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const hash = createHash("sha256");
const texts = [];

for (const level of LEVELS) {
  const dir = path.join(contentDir, level);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const file = `${level}/${name}`;
    const raw = readFileSync(path.join(dir, name), "utf8");
    const text = JSON.parse(raw);
    hash.update(file).update("\0").update(raw).update("\0");
    texts.push({ id: text.id, level: text.level, tags: text.tags, titleDe: text.titleDe, title: text.title, file });
  }
}
texts.sort((a, b) => a.id.localeCompare(b.id));

const contentHash = hash.digest("hex").slice(0, 16);
const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { version: 0 };
const version = previous.contentHash === contentHash ? previous.version : (previous.version ?? 0) + 1;

const lines = texts.map((t) => `    ${JSON.stringify(t).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/^\{/, "{ ").replace(/\}$/, " }")}`);
const out = `{\n  "version": ${version},\n  "contentHash": "${contentHash}",\n  "texts": [\n${lines.join(",\n")}\n  ]\n}\n`;
writeFileSync(indexPath, out);
console.log(`index.json: ${texts.length} Text(e), version ${version}${version !== previous.version ? " (erhöht)" : ""}`);
