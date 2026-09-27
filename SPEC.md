# Ukrainisch-Lese-App – Spezifikation v1

## 1. Rahmen
- PWA, gehostet auf GitHub Pages, Deploy durch Push auf `main`.
- Kein Build-Schritt: Vanilla HTML/CSS/JS (ES-Module), keine Frameworks, keine externen Libraries. Diagramme als eigenes SVG.
- Vollständig offline nach erstem Laden (Service Worker). Netz nur für Updates und Sync.
- Zielgeräte: iPhone (Safari, Home-Bildschirm) und Laptop (Browser).
- UI: minimalistisch, modern, edel. Neutrale Farben ohne Farbstich, Hell- und Dunkelmodus nach Systemeinstellung. Serifenschrift (Literata) für ukrainischen Text und Titel, Sans-Serif (Systemschrift, Fallback Inter) für Oberfläche und Zahlen; Schriften liegen lokal unter `/fonts/`. Große Tippflächen.

## 2. Repo-Struktur
```
/index.html
/styles.css
/manifest.webmanifest
/sw.js
/icons/
/js/app.js          Routing, Screens
/js/reader.js       Textanzeige, Timer, Pause, Klickzählung
/js/tokens.js       Token-Darstellung, Overlay (für Text und Fragen)
/js/quiz.js         Kontrolle
/js/stats.js        Statistik, Diagramme
/js/store.js        lokale Daten (IndexedDB), Export/Import
/js/sync.js         Gist-Sync
/content/index.json
/content/A1/a1-0001.json …
/fonts/             Literata, Inter (woff2, OFL)
/tools/validate.mjs Prüfskript für Content (Node)
/tools/build-index.mjs erzeugt content/index.json aus den Textdateien
/docs/TEXT-VORLAGE.md Vorlage zum Erzeugen neuer Texte in einem normalen Chat
/SPEC.md
```

## 3. Content-Format

### 3.1 `content/index.json`
```json
{
  "version": 3,
  "texts": [
    { "id": "a1-0001", "level": "A1", "tags": ["Familie"], "title": "Моя сім'я", "file": "A1/a1-0001.json" }
  ]
}
```
- Die Datei wird nicht von Hand gepflegt, sondern mit `node tools/build-index.mjs` aus den Textdateien erzeugt. Das Skript speichert eine Prüfsumme (`contentHash`) und erhöht `version` automatisch bei jeder Content-Änderung (Cache-Invalidierung).
- `tags` sind deutsche Themenbegriffe.
- `level` ∈ A1, A2, B1, B2, C1, C2.

### 3.2 Textdatei
```json
{
  "id": "a1-0001",
  "level": "A1",
  "tags": ["Familie"],
  "title": "Моя сім'я",
  "paragraphs": [
    [
      { "t": "Моя", "a": "Мо́я", "l": "мій", "g": "meine", "pos": "Pron", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
      { "t": "мама", "a": "ма́ма", "l": "мама", "g": "Mama", "pos": "Subst", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
      { "p": " " },
      { "t": "в", "u": "u1" },
      { "t": "тому", "u": "u1" },
      { "t": "числі", "u": "u1" },
      { "p": "." }
    ]
  ],
  "units": {
    "u1": { "g": "einschließlich", "pos": "Wendung", "note": "feste Wendung" }
  },
  "questions": [
    {
      "q": [ { "t": "Хто", "l": "хто", "g": "wer", "pos": "Pron", "m": { "case": "Nom" } } ],
      "o": ["Die Mutter", "Der Vater", "Die Schwester", "Der Großvater"],
      "a": 0
    }
  ]
}
```

**Token-Felder**
| Feld | Bedeutung | Pflicht |
|---|---|---|
| `t` | Wortform wie im Text | ja (Wort) |
| `a` | Form mit Betonungszeichen | optional, wird im Overlay gezeigt |
| `l` | Lemma | ja, außer bei `u` |
| `g` | deutsche Bedeutung im Kontext | ja, außer bei `u` |
| `pos` | Subst, Verb, Adj, Adv, Pron, Num, Präp, Konj, Part, Interj, Wendung | ja, außer bei `u` |
| `m` | Morphologie (s. u.) | soweit einschlägig |
| `u` | ID einer Mehrwort-Einheit; Angaben dann in `units` | optional |
| `p` | Satzzeichen oder Leerraum, nicht anklickbar | – |

- Leerzeichen zwischen Wörtern setzt die App automatisch; `p` nur für Satzzeichen und Sonderfälle.
- **`m`-Schlüssel:** `gen` (m/f/n), `num` (Sg/Pl), `case` (Nom/Gen/Dat/Akk/Inst/Lok/Vok), `asp` (ipf/pf), `tense` (Präs/Prät/Fut), `pers` (1/2/3), `mood` (Ind/Imp/Konj), `inf` (true), `deg` (Pos/Komp/Sup).
- **Mehrwort-Einheiten:** Alle Tokens mit gleichem `u` werden gemeinsam markiert und zählen als ein Klick. Sie dürfen nicht zusammenhängend sein (z. B. trennbare Konstruktionen).
- **Fragen:** genau 5 pro Text, je 4 Optionen, `a` = Index der richtigen Antwort (0–3). Die Fragetokens sind anklickbar wie Texttokens. Die App mischt die Reihenfolge der Optionen.

### 3.3 Validierung (`tools/validate.mjs`)
Das Skript prüft vor jedem Commit:
- Pflichtfelder sind gesetzt.
- Jede `u`-ID existiert in `units` und umgekehrt.
- Es gibt 5 Fragen mit je 4 Optionen, und `a` liegt im Bereich 0–3.
- Die IDs in `index.json` und den Dateien stimmen überein, es gibt keine Duplikate.
- `version` wurde erhöht.

## 4. Verhalten Funktion 1 (Text)
- **Start:** Die erste Seite zeigt nur die Funktionswahl (Text, Frage-Antwort). Nach „Text“ folgt die Stufenwahl (A1–C2; Stufen ohne Texte sind sichtbar, aber ausgegraut), dann die Themen-Chips. Dort erscheinen nur verfügbare Themen, jeweils mit der Anzahl der Texte. Der Schalter „Offen / Bereits bearbeitet“ wechselt die Auswahl auf bearbeitete Texte. Die App wählt innerhalb des Themas den nächsten Text nach ID.
- **Lesen:** Ein Tipp auf ein Wort blendet darüber ein Overlay ein mit Betonungsform, Bedeutung, Wortart und Morphologie-Kurzform (z. B. „Subst · f · Sg · Nom“). Das Overlay hat unten eine geschwungene Spitze (wie die Mitte von „{“), die auf das Wort zeigt. Es ist immer nur ein Overlay offen: Ein erneuter Tipp auf das Wort, ein Tipp auf ein anderes Wort oder irgendwo sonst hin schließt es. Nachgeschlagene Wörter bleiben dezent unterstrichen.
- **Timer:** Er startet beim Anzeigen des Textes und stoppt bei „Kontrolle“. Er pausiert, solange die App im Hintergrund ist (`visibilitychange`).
- **Kein Abbruch:** Lesen und Kontrolle können nicht abgebrochen werden. Möglich ist nur das Pausieren des Lesens: Der Text wird ausgeblendet, der Timer steht. Wechselt die App in den Hintergrund, pausiert sie automatisch.
- **Klickzählung:** Gezählt wird die Anzahl *unterschiedlicher* Wörter bzw. Einheiten, die mindestens einmal geöffnet wurden. Erneutes Öffnen desselben Wortes zählt nicht. Klicks in den Fragen zählen separat und fließen nicht in die Statistik ein.
- **Kontrolle:** Alle 5 Fragen stehen auf einer Seite, jeweils die Frage und darunter die 4 Antworten im 2×2-Raster (A–D). Die erste Auswahl zählt: Die richtige Antwort wird grün, eine falsch gewählte rot markiert (Rand kräftiger als Hintergrund). Die Auswertung ist erst möglich, wenn alle Fragen beantwortet sind. Sie zeigt x/5, Lesezeit, Tempo (Wörter pro Minute), Pace (Sekunden pro 100 Wörter) und die Zahl nachgeschlagener Wörter.
- **Wiederholungen:** Erneute Bearbeitungen werden durchgeführt und angezeigt, aber nicht in die Statistik geschrieben.

## 5. Statistik
- Getrennt nach Stufe, mit drei kleinen Liniendiagrammen: Zeit, Klicks, korrekte Antworten.
- X-Achse: bearbeitete Texte in Reihenfolge. Sie hat eine feste Breite und wird mit zunehmender Anzahl gestaucht.
- Zeit wird zusätzlich als Sekunden pro 100 Wörter geführt, damit unterschiedlich lange Texte vergleichbar bleiben.

## 6. Datenmodell (lokal, IndexedDB)
```json
{ "id": "uuid", "textId": "a1-0001", "level": "A1", "ts": "2026-09-26T10:00:00Z",
  "sec": 312, "words": 180, "clicks": 14, "correct": 4, "device": "iphone" }
```
- Nur Erstbearbeitungen werden gespeichert.
- „Bearbeitet“ ergibt sich aus dem Vorhandensein eines Datensatzes.
- Die Liste ist append-only. Einzige Ausnahme ist „Statistik zurücksetzen“ (Einstellungen, mit Ja/Nein-Rückfrage): Es setzt `resetAt` auf den aktuellen Zeitpunkt; alle Datensätze mit `ts <= resetAt` werden verworfen.
- Export/Import als JSON unter Einstellungen.

## 7. Sync
- Ziel ist ein privates (secret) GitHub-Gist mit der Datei `stats.json`, die `{ "v": 1, "resetAt": null, "attempts": [...] }` enthält.
- Auth über einen GitHub-Token mit Scope `gist`. Er wird einmal pro Gerät in den Einstellungen eingegeben und lokal gespeichert, ebenso die Gist-ID.
- **Ablauf:** Beim Start, nach jeder abgeschlossenen Kontrolle und bei der Rückkehr online:
  1. Gist laden.
  2. `resetAt` = späterer Wert aus lokal und Gist; ältere Datensätze verwerfen. Vereinigungsmenge nach `id` bilden.
  3. Lokal speichern.
  4. Zurückschreiben, falls etwas neu ist.
- Konflikte sind ausgeschlossen, weil die Liste append-only ist und ein Zurücksetzen über `resetAt` auf alle Geräte wirkt.
- Offline wird lokal weitergearbeitet und später synchronisiert. Der Sync-Status (letzter Sync, Fehler) wird in den Einstellungen angezeigt.

## 8. Service Worker
- App-Shell wird cache-first ausgeliefert.
- `content/index.json` wird network-first geladen, mit Cache als Fallback. Alle darin gelisteten Texte werden vorab gecacht.
- Der Cache-Name enthält die App-Version (`APP_VERSION` in `sw.js`); sie wird bei jeder Änderung an App-Dateien erhöht. Nach einem Update erscheint ein dezenter Hinweis „Neue Version – neu laden“.
- Texte liegen in einem eigenen Cache und werden neu geladen, sobald sich `version` in `index.json` ändert.

## 9. Ausgegraute Elemente (sichtbar, deaktiviert)
- Funktion 2 „Frage-Antwort“ auf der Startseite.
- Stufen ohne Texte in der Stufenwahl.
- Alle weiteren Knöpfe, deren Funktion beschrieben, aber noch nicht umgesetzt ist.

## 10. Offen (separat zu klären)
- Generierungsregeln je Stufe (Grammatik, Wortschatz, Textlänge).
- Themenliste.
- Funktion 2.
