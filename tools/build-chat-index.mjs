#!/usr/bin/env node
// Erzeugt content/chat/index.json aus allen Chat-Dateien unter content/chat/<Stufe>/.
// Ändert sich ein Chat (Prüfsumme), wird "version" automatisch erhöht.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chatDir = path.join(root, "content", "chat");
const indexPath = path.join(chatDir, "index.json");
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

mkdirSync(chatDir, { recursive: true });

const hash = createHash("sha256");
const chats = [];

for (const level of LEVELS) {
  const dir = path.join(chatDir, level);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const file = `${level}/${name}`;
    const raw = readFileSync(path.join(dir, name), "utf8");
    const chat = JSON.parse(raw);
    hash.update(file).update("\0").update(raw).update("\0");
    chats.push({ id: chat.id, level: chat.level, tags: chat.tags, titleDe: chat.titleDe, title: chat.title, file });
  }
}
chats.sort((a, b) => a.id.localeCompare(b.id));

const contentHash = hash.digest("hex").slice(0, 16);
const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { version: 0 };
const version = previous.contentHash === contentHash ? previous.version : (previous.version ?? 0) + 1;

const lines = chats.map((c) => `    ${JSON.stringify(c).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/^\{/, "{ ").replace(/\}$/, " }")}`);
const out = `{\n  "version": ${version},\n  "contentHash": "${contentHash}",\n  "chats": [\n${lines.join(",\n")}\n  ]\n}\n`;
writeFileSync(indexPath, out);
console.log(`chat/index.json: ${chats.length} Chat(s), version ${version}${version !== previous.version ? " (erhöht)" : ""}`);
