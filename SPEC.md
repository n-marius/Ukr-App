# Ukrainisch-Lese-App – Spezifikation v1

## 1. Rahmen
- PWA, gehostet auf GitHub Pages, Deploy durch Push auf `main`. Die leere Datei `.nojekyll` schaltet die Jekyll-Verarbeitung von GitHub Pages ab (reine statische Auslieferung, schnellerer und robusterer Build).
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
/js/tokens.js       Token-Darstellung, Overlay (für Text, Fragen und Chat)
/js/quiz.js         Kontrolle
/js/chat.js         Frage-Antwort: verzweigtes Gespräch
/js/stats.js        Statistik, Diagramme
/js/store.js        lokale Daten (IndexedDB), Export/Import
/js/sync.js         Gist-Sync
/js/vapp.js         Vokabelfunktion: Screens, Lernablauf, Meldungen
/js/vocab.js        Vokabellogik: Karten, Falschantworten, Warteschlange, Automatik
/js/vcards.js       Anzeige Karteikarte / Frage-Antwort der Vokabeln
/js/vstore.js       Daten der Vokabeln (IndexedDB)
/js/prio.js         Prio-Symbol
/content/index.json
/content/A1/a1-0001.json …
/content/chat/index.json
/content/chat/A1/a1-0001.json …
/content/vokabeln/   Vokabellisten liste-NNNN.json (Quelle) und index.json (erzeugt)
/content/_inbox/    Eingang für neue Texte/Chats/Vokabeln (siehe README dort)
/fonts/             Literata, Inter (woff2, OFL)
/tools/validate.mjs Prüfskript für Texte (Node)
/tools/validate-chats.mjs Prüfskript für Chats (Node)
/tools/add-vocab.mjs, build-vocab-index.mjs, validate-vocab.mjs, vocab-lib.mjs  Import, Index und Prüfung der Vokabeln
/docs/VOKABEL-VORLAGE.md Vorlage/Format für neue Vokabeln
/tools/build-index.mjs erzeugt content/index.json aus den Textdateien
/tools/build-chat-index.mjs erzeugt content/chat/index.json aus den Chat-Dateien
/docs/TEXT-VORLAGE.md Vorlage zum Erzeugen neuer Texte in einem normalen Chat
/docs/CHAT-VORLAGE.md Vorlage zum Erzeugen neuer Frage-Antwort-Chats
/SPEC.md
```

### 2.1 Neue Inhalte einpflegen
- Texte/Chats entstehen über `docs/TEXT-VORLAGE.md` bzw. `docs/CHAT-VORLAGE.md` in einem separaten, normalen Chat (nicht Claude Code) und werden als `.txt`-Dateien mit reinem JSON-Inhalt ausgegeben.
- Diese Dateien gelangen entweder als Anhang in eine Claude-Code-Sitzung oder – bei größerer Menge – über `content/_inbox/` (direkter Upload im Repo über GitHub, siehe README dort).
- Claude Code vergibt die nächste freie ID je Stufe, legt die Datei unter `content/<Stufe>/` bzw. `content/chat/<Stufe>/` ab, prüft Inhalt und Grammatik stichprobenartig, baut die Indizes neu (`build-index.mjs` / `build-chat-index.mjs`) und validiert (`validate.mjs` / `validate-chats.mjs`).

## 3. Content-Format (Funktion „Text“)

### 3.1 `content/index.json`
```json
{
  "version": 3,
  "texts": [
    { "id": "a1-0001", "level": "A1", "tags": ["Grundlagen"], "titleDe": "Hallo, ich bin Oksana", "title": "Привіт, я Оксана!", "file": "A1/a1-0001.json" }
  ]
}
```
- Die Datei wird nicht von Hand gepflegt, sondern mit `node tools/build-index.mjs` aus den Textdateien erzeugt. Das Skript speichert eine Prüfsumme (`contentHash`) und erhöht `version` automatisch bei jeder Content-Änderung (Cache-Invalidierung).
- `tags` enthält genau einen deutschen Themenbegriff.
- `titleDe` ist ein kurzer deutscher Titel des konkreten Inhalts (2–5 Wörter), `title` der ukrainische Titel.
- `level` ∈ A1, A2, B1, B2, C1, C2.

### 3.2 Textdatei
```json
{
  "id": "a1-0001",
  "level": "A1",
  "tags": ["Grundlagen"],
  "titleDe": "Hallo, ich bin Oksana",
  "title": "Привіт, я Оксана!",
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
- **`m`-Schlüssel:** `gen` (m/f/n), `num` (Sg/Pl), `case` (Nom/Gen/Dat/Akk/Inst/Lok/Vok), `asp` (ipf/pf), `tense` (Präs/Prät/Fut), `pers` (1/2/3), `mood` (Ind/Imp/Konj), `inf` (true), `deg` (Pos/Komp/Sup). Das Overlay zeigt `pos` plus alle gesetzten `m`-Werte als Kurzform (z. B. „Verb · ipf · Prät · f · Sg“).
- **Mehrwort-Einheiten:** Alle Tokens mit gleichem `u` werden beim Antippen gemeinsam markiert und zählen als ein Klick. Sie dürfen nicht zusammenhängend sein (z. B. trennbare Konstruktionen).
- **Fragen:** genau 5 pro Text, je 4 Optionen, `a` = Index der richtigen Antwort (0–3). Die Fragetokens sind anklickbar wie Texttokens. Die App mischt die Reihenfolge der Optionen.

### 3.3 Validierung (`tools/validate.mjs`)
Das Skript prüft vor jedem Commit:
- Pflichtfelder sind gesetzt, inkl. `titleDe` und genau einem Eintrag in `tags`.
- Jede `u`-ID existiert in `units` und umgekehrt.
- Es gibt 5 Fragen mit je 4 Optionen, und `a` liegt im Bereich 0–3.
- Die IDs in `index.json` und den Dateien stimmen überein, es gibt keine Duplikate.
- `version` wurde erhöht, sobald sich `content/` (außer `content/chat` und `content/_inbox`) gegenüber dem letzten Commit geändert hat.

## 4. Verhalten Funktion 1 (Text)
- **Start:** Die erste Seite zeigt nur die Funktionswahl (Text, Chat, Vokabeln; nicht verfügbare Funktionen sind ausgegraut). Die Funktion „Chat“ hieß früher „Frage-Antwort“ (Abschnitt 5). Nach „Text“ folgt die Stufenwahl (A1–C2; Stufen ohne Texte sind sichtbar, aber ausgegraut), dann die Themen-Chips. Dort erscheinen nur verfügbare Themen, jeweils mit der Anzahl der Texte. Der Schalter „Offen / Bereits bearbeitet“ wechselt die Auswahl auf bearbeitete Texte. Die App wählt innerhalb des Themas den nächsten Text nach ID.
- **Lesen:** Ein Tipp auf ein Wort blendet darüber ein Overlay ein mit Betonungsform, Bedeutung, Wortart und Morphologie-Kurzform (z. B. „Subst · f · Sg · Nom“). Das Overlay hat unten eine geschwungene Spitze (wie die Mitte von „{“), die auf das Wort zeigt. Es ist immer nur ein Overlay offen: Ein erneuter Tipp auf das Wort, ein Tipp auf ein anderes Wort oder irgendwo sonst hin schließt es. Nachgeschlagene Wörter bleiben dezent unterstrichen.
- **Timer:** Er startet beim Anzeigen des Textes und stoppt bei „Kontrolle“. Er pausiert, solange die App im Hintergrund ist (`visibilitychange`).
- **Kein Abbruch:** Lesen und Kontrolle können nicht abgebrochen werden. Möglich ist nur das Pausieren des Lesens: Der Text wird ausgeblendet, der Timer steht. Wechselt die App in den Hintergrund, pausiert sie automatisch.
- **Klickzählung:** Gezählt wird die Anzahl *unterschiedlicher* Wörter bzw. Einheiten, die mindestens einmal geöffnet wurden. Erneutes Öffnen desselben Wortes zählt nicht. Klicks in den Fragen zählen separat und fließen nicht in die Statistik ein.
- **Kontrolle:** Alle 5 Fragen stehen auf einer Seite, jeweils die Frage und darunter die 4 Antworten im 2×2-Raster (A–D). Die erste Auswahl zählt: Die richtige Antwort wird grün, eine falsch gewählte rot markiert (Rand kräftiger als Hintergrund). Die Auswertung ist erst möglich, wenn alle Fragen beantwortet sind. Sie zeigt x/5, Lesezeit, Tempo (Wörter pro Minute), Pace (Sekunden pro 100 Wörter) und die Zahl nachgeschlagener Wörter.
- **Wiederholungen:** Erneute Bearbeitungen werden durchgeführt und angezeigt, aber nicht in die Statistik geschrieben.

## 5. Content-Format und Verhalten Funktion 2 (Chat, früher „Frage-Antwort“)

Ein simuliertes Gespräch: Die App schreibt eine kurze Nachricht (1–3 Sätze), die Lernperson wählt aus vier vorformulierten Antworten. Es gibt keinen bearbeitet/unbearbeitet-Status und keine Statistik – reine Lernfunktion.

### 5.1 `content/chat/index.json`
Gleicher Aufbau wie `content/index.json` (siehe 3.1), mit Schlüssel `chats` statt `texts`, erzeugt durch `node tools/build-chat-index.mjs`.

### 5.2 Chat-Datei
```json
{
  "id": "a1-0001",
  "level": "A1",
  "tags": ["Restaurant"],
  "titleDe": "Kaffee bestellen",
  "title": "У кафе",
  "start": "n1",
  "nodes": {
    "n1": {
      "bot": [ /* Tokens wie im Lesetext, 1–3 Sätze */ ],
      "answers": [
        { "t": [ /* Tokens der Antwort */ ], "ok": true, "next": "n2" },
        { "t": [ /* … */ ], "ok": false }
      ]
    }
  },
  "units": {}
}
```
- `nodes` ist ein Baum: jeder Knoten hat `bot` (Nachricht der App) und, außer am Ende, genau **vier** `answers`.
- Von den vier Antworten sind drei inhaltlich passend (`ok: true`, mit `next` zum Folgeknoten) und eine unpassend (`ok: false`, ohne `next`). Mehrere Antworten dürfen auf denselben `next` zeigen (Zusammenführung von Ästen).
- Ein Knoten ohne `answers` ist ein Gesprächsende.
- Tokens in `bot` und `answers[].t` folgen demselben Format wie Lesetext-Tokens (3.2), inkl. Mehrwort-Einheiten über das gemeinsame `units`-Objekt.
- Ausführliche Autorenregeln (Verzweigung, Knotenzahl, Grammatikgrenzen je Stufe): `docs/CHAT-VORLAGE.md`.

### 5.3 Validierung (`tools/validate-chats.mjs`)
Prüft: `start` existiert in `nodes`; jeder `next` zeigt auf einen existierenden Knoten; jeder Knoten ist vom Start aus erreichbar; jeder Nicht-Endknoten hat genau 4 Antworten mit genau einer `ok: false`; Token-Pflichtfelder wie bei Texten; `version` wurde bei Content-Änderung erhöht.

### 5.4 Verhalten
- **Start:** Stufenwahl (wie bei Text, ausgegraute Stufen ohne Chats) → Themen-Chips (ohne offen/bearbeitet-Unterscheidung) → Liste der einzelnen Chats dieses Themas nach Titel, mit kleinem Zähler daneben, wie oft der Chat gestartet wurde.
- **Gespräch:** Die Bot-Nachricht erscheint links als Sprechblase. Darunter stehen die vier Antworten, jede mit antippbaren, tokenisierten Wörtern (Overlay wie im Lesetext) und einem eigenen Pfeil-Button zum Senden. Ein Wort antippen öffnet nur das Overlay, ein Tipp auf den Pfeil sendet die jeweilige Antwort.
- Die unpassende Antwort wird beim Senden rot markiert; das Gespräch bleibt im selben Knoten, bis eine passende Antwort gesendet wird.
- Eine passende Antwort erscheint rechts als eigene Sprechblase, danach folgt die nächste Bot-Nachricht mit neuen Antworten.
- **Ende:** Erreicht das Gespräch einen Knoten ohne Antworten, endet es dort („Gespräch beendet“). Ein Tipp oben auf „Verlassen“ beendet das Gespräch jederzeit. Die Position wird nicht gespeichert – ein Gespräch beginnt immer von vorne.
- Der Startzähler wird beim Öffnen eines Chats erhöht (lokal, IndexedDB), unabhängig davon, ob das Gespräch beendet wird.

## 6. Statistik (nur Funktion 1)
- Getrennt nach Stufe, mit drei kleinen Liniendiagrammen: Zeit, Klicks, korrekte Antworten.
- X-Achse: bearbeitete Texte in Reihenfolge. Sie hat eine feste Breite und wird mit zunehmender Anzahl gestaucht.
- Zeit wird zusätzlich als Sekunden pro 100 Wörter geführt, damit unterschiedlich lange Texte vergleichbar bleiben.

## 7. Datenmodell (lokal, IndexedDB)
```json
{ "id": "uuid", "textId": "a1-0001", "level": "A1", "ts": "2026-09-26T10:00:00Z",
  "sec": 312, "words": 180, "clicks": 14, "correct": 4, "device": "iphone" }
```
- Nur Erstbearbeitungen (Funktion 1) werden gespeichert.
- „Bearbeitet“ ergibt sich aus dem Vorhandensein eines Datensatzes.
- Die Liste ist append-only. Einzige Ausnahme ist „Statistik zurücksetzen“ (Einstellungen, mit Ja/Nein-Rückfrage): Es setzt `resetAt` auf den aktuellen Zeitpunkt; alle Datensätze mit `ts <= resetAt` werden verworfen.
- Export/Import als JSON unter Einstellungen.
- Chat-Startzähler (Funktion 2) werden separat und nur lokal gespeichert (kein Sync, keine Statistik).

## 8. Sync
- Ziel ist ein privates (secret) GitHub-Gist mit der Datei `stats.json`, die `{ "v": 1, "resetAt": null, "attempts": [...] }` enthält.
- Auth über einen GitHub-Token mit Scope `gist`. Er wird einmal pro Gerät in den Einstellungen eingegeben und lokal gespeichert, ebenso die Gist-ID.
- **Ablauf:** Beim Start, nach jeder abgeschlossenen Kontrolle und bei der Rückkehr online:
  1. Gist laden.
  2. `resetAt` = späterer Wert aus lokal und Gist; ältere Datensätze verwerfen. Vereinigungsmenge nach `id` bilden.
  3. Lokal speichern.
  4. Zurückschreiben, falls etwas neu ist.
- Konflikte sind ausgeschlossen, weil die Liste append-only ist und ein Zurücksetzen über `resetAt` auf alle Geräte wirkt.
- Offline wird lokal weitergearbeitet und später synchronisiert. Der Sync-Status (letzter Sync, Fehler) wird in den Einstellungen angezeigt.

## 9. Service Worker
- App-Shell wird cache-first ausgeliefert.
- `content/index.json` und `content/chat/index.json` werden network-first geladen, mit Cache als Fallback. Alle darin gelisteten Texte/Chats werden vorab gecacht.
- Der Cache-Name enthält die App-Version (`APP_VERSION` in `sw.js`); sie wird bei jeder Änderung an App-Dateien erhöht. Nach einem Update erscheint ein dezenter Hinweis „Neue Version – neu laden“.
- Texte und Chats liegen in einem eigenen Cache und werden neu geladen, sobald sich die jeweilige `version` ändert.

## 10. Ausgegraute Elemente (sichtbar, deaktiviert)
- Stufen ohne Texte bzw. ohne Chats in der jeweiligen Stufenwahl.
- Alle weiteren Knöpfe, deren Funktion beschrieben, aber noch nicht umgesetzt ist.

## 11. Offen (separat zu klären)
- Themenliste (wächst mit neuen Texten/Chats; bisherige Kategorien siehe `docs/TEXT-VORLAGE.md`).

## 12. Vokabeln

Eine Person, kein Nutzerwechsel. Übernommen aus der Lernapp (Leitner-Stufen, Automatik, Prio, Zurück, Melden), angepasst auf Wortschatz.

### 12.1 Vokabelformat
`content/vokabeln/liste-NNNN.json` (Liste von Wörtern, IDs `v0001` …, vergeben von `tools/add-vocab.mjs`); `content/vokabeln/index.json` (erzeugt, enthält alle Wörter, `version` wächst bei Änderung). Felder und Autorenregeln: `docs/VOKABEL-VORLAGE.md`: `uk`, `a` (mit Betonung), `de`, `pos` (Pflicht); `alt`, `gen`, `asp`, `forms`, `zusatz`, `korrigiert` optional. Keine Prio, keine Kategorien, keine Falschantworten. Prüfung: `tools/validate-vocab.mjs` (Pflichtfelder, unbekannte Felder, Betonung nur auf Vokalen und konsistent zu `uk`, Doppelte, Version erhöht).

### 12.2 Karten und Fortschritt
Jedes Wort ergibt zwei Karten: DE → UKR und UKR → DE (Schlüssel `<id>:de-uk` / `<id>:uk-de`). Stufe (1–5), Prio und „zuletzt bearbeitet“ werden je Karte, also je Richtung, geführt und gelten für Karteikarten und Frage-Antwort gemeinsam. Stufenlogik wie Lernapp (richtig +1, falsch → 1, blauer Knopf → 4 – dabei wandert auch die Gegenrichtung in Stufe 4, sofern sie darunter steht; diese Karte unterliegt keiner 24-Stunden-Sperre in der Automatik (Feld `noRest` an der Stufe) –, nur bei erster Bearbeitung der Karte; in Frage-Antwort nur nach richtiger Antwort).

### 12.3 Ablauf
Start → „Vokabeln“ → Karteikarten / Frage-Antwort (Frage-Antwort ab 4 Vokabeln) → Auswahlseite: Schalter DE → UKR / UKR → DE / Gemischt (Wahl wird lokal gemerkt; „Gemischt“ nimmt beide Richtungen jedes Wortes in einen Pool: Stufenwahl, Warteschlange und Automatik arbeiten mit allen Karten beider Richtungen, die Richtung wechselt von Karte zu Karte, dasselbe Wort kommt in der Automatik nicht zweimal direkt hintereinander; Stufe, Prio und Rückschau gelten weiter je Karte), darunter drei Prio-Filter-Symbole in Kartengröße (24 px; mindestens eine aktiv; nur für diesen Lauf) mit Kartenzahl, darunter Manuell (→ Stufenwahl) / Automatisch. Auf der Seite Karteikarten/Frage-Antwort erscheint, sobald Meldungen offen sind, die Zeile „Gemeldete Vokabeln prüfen“ (12.6). Im Lauf: „Zurück“-Rückschau, Flagge, Tageszähler („x heute bearbeitet“, alle Modi und beide Richtungen) wie in der Lernapp.

**Stufenbalken (Karteikarten und Frage-Antwort):** Zwischen Richtungsschalter und Prio-Symbolen, so breit wie der Schalter, ein Balken im Stil der iOS-Speicheranzeige (Graustufen, hell = Stufe 1 bis dunkel = Stufe 5, Reihenfolge 1→5 von links): Anteil der Karten der aktuellen Auswahl (Richtung + Prio-Filter) je Stufe. In jeder Fläche steht klein die Kartenzahl, sofern sie hineinpasst; leere Stufen entfallen, ohne Karten bleibt ein leerer Balken. Im Balken zwei dünne senkrechte Linien (ragen leicht über den Balken hinaus): die eine innerhalb der Stufe-1-Fläche an der Stelle, bis zu der (von links) die noch nie bearbeiteten Karten reichen; die andere an der Stelle, die sich von rechts gezählt aus dem Anteil der Karten ergibt, die schon einmal Stufe 5 erreicht haben (`best`). Eine Linie entfällt, wenn ihr Wert 0 ist oder alle Karten umfasst.

**„Neu“ beim Schreiben:** Die Kachel „Schreiben“ (und darin „Vokabeln“) trägt oben rechts den Hinweis „Neu“, solange es freigeschaltete Wörter gibt, die beim letzten Öffnen von „Schreiben“ noch nicht freigeschaltet waren (Einstellung `vocabWriteSeen`; im Gist unter `vocab.writeSeen` als Vereinigungsmenge aller Geräte synchronisiert – einmal irgendwo gesehen gilt überall als gesehen). Öffnen von „Schreiben“ setzt den Hinweis zurück.

### 12.4 Anzeige
- **Karteikarte:** oben die Frage (DE-Wort bzw. ukrainisches Wort mit Betonung), Prio-Symbol oben rechts, im Automatikmodus „Stufe n“. Antippen deckt die Antwort auf; darunter stehen die Zusatzinfos: Marken für Wortart/Genus/Aspekt, „Auch“ (`alt`), „Formen“ (`forms`), „Hinweis“ (`zusatz`) – abgesetzt durch eine feine Linie wie die Erklärung der Lernapp.
- **Frage-Antwort:** Frage, vier Antworten untereinander (A–D), „Auflösen“/„Weiter“; die Zusatzinfos klappen aus der richtigen Antwort aus.
- **Doppeldeutige Wörter:** Kommt der Fragetext (in der gewählten Richtung) bei mehreren Wörtern vor (z. B. „Schloss“, „коса“), zeigt schon die Frage den `zusatz` als Hinweis; sonst erscheint er erst bei der Antwort.

### 12.5 Falschantworten (nur per Skript, `js/vocab.js` `pickDistractors`)
Bei jeder Frage werden drei Wörter aus dem Bestand gezogen, bevorzugt gleiche Wortart und – bei Substantiven/Verben – gleiches Genus bzw. gleicher Aspekt, sonst nur gleiche Wortart, zuletzt beliebig. Ausgeschlossen sind Wörter mit demselben ukrainischen Wort (Homonym) oder einer gemeinsamen deutschen Bedeutung (`de`/`alt`, verglichen ohne Betonung, Groß-/Kleinschreibung, Artikel, „sich“, Klammern), und die vier Antwortfelder sind untereinander verschieden. Gemeldete oder gelöschte Wörter kommen nicht vor.

### 12.6 Automatik, Prio, Melden
- **Automatik:** Gewichte wie Lernapp (Stufe, Zeit, Nie-gesehen-Bonus, Prio; 24-h-Sperre); **Ausnahme:** Karten mit Prio hoch in Stufe 1 ignorieren die 24-h-Sperre. Eine gezogene, unbeantwortete Karte bleibt gemerkt (`vocabAutoPending_<art>_<richtung>`).
- **Prio:** Grundwert immer normal (nicht in der Wortliste). Antippen des Symbols wechselt hoch → normal → niedrig. Automatisch: Erste Bearbeitung einer Karte per blauem Knopf → diese Karte niedrig, die Gegenrichtung ebenfalls, sofern sie noch keinen Prio-Eintrag hat. Drei Fehler in Folge bei derselben Karte (genau beim dritten) → diese Karte und die Gegenrichtung hoch.
- **Melden:** Flagge im Lauf (Ukrainisch / Deutsch / Zusatzinfo + Text). Das Wort ist in beiden Richtungen ausgeblendet, bis die Meldung unter „Gemeldete Vokabeln prüfen“ erledigt ist: Bearbeiten (Korrektur `vEdits`), „Doch korrekt“ (wieder freigeben), Löschen, Überspringen; Export der offenen Meldungen als Textdatei.

### 12.7 Datenmodell und Sync
IndexedDB (Version 3): `vLevels` `{key,stufe,ts,best,noRest?}`, `vPrios` `{key,prio,ts}`, `vEvents` `{id,ts,cardId,correct,mode}`, `vFlags` `{id,wordId,field,note,ts,status}`, `vEdits` `{wordId,ts,deleted,…Felder}`. Im Gist `stats.json` zusätzliches Feld `vocab` `{resetAt, levelsResetAt, levels, prios, events, flags, edits, writeSeen}`; Zusammenführung: je Schlüssel gewinnt der spätere Zeitstempel, Ereignisse nach `id`. Alles läuft über `vstore.applyOverridesAndFilter` (Korrekturen, Löschungen, Meldungen); dort gehören künftige Änderungen hin. Einstellungen: „Alle Vokabeln auf Stufe 1 zurücksetzen“ (Prios bleiben) und „Vokabel-Statistik löschen“, beide über Zeitgrenze (`vocabLevelsResetAt`/`vocabResetAt`).

### 12.8 Statistik
Statistik → Reiter „Vokabeln“: Diagramm „Karten pro Tag“ (UTC-Tage vom ersten Ereignis bis heute, Ø der letzten 14 Tage).

### 12.9 Schreiben
Vokabeln → „Schreiben“ → „Vokabeln“ (aktiv) bzw. „Sätze“ (ausgegraut, noch ohne Funktion). „Vokabeln“ läuft wie Frage-Antwort (Prio-Filter, manuell/automatisch, Stufen, Zurück, Melden, Auflösen/Weiter; ohne blauen Knopf), aber nur DE → UKR und mit eigenem Lernstand: Kartenschlüssel `<id>:write`, Stufe und Prio unabhängig von Karteikarten/Frage-Antwort (keine Kopplung an eine Gegenrichtung). Die automatischen Prio-Regeln gelten für die Schreibkarte selbst. Ereignisse zählen in die Vokabelstatistik (`mode: "write"`).
- **Freischaltung:** Ein Wort erscheint im Schreiben erst, wenn eine seiner beiden Karten (DE → UKR oder UKR → DE, Karteikarten/Frage-Antwort teilen sich die Stufe) mindestens einmal Stufe 5 erreicht hat. Dafür trägt jeder Stufeneintrag `best` (höchste je erreichte Stufe; Einträge ohne `best` zählen mit ihrer aktuellen Stufe). Stufen-Reset löscht auch `best`, die Freischaltungen beginnen dann neu. Die Kachel zeigt „x Vokabeln freigeschaltet“, ohne Freischaltung ist sie gesperrt.
- **Lösungsbereich:** Unter der Frage leere Kästchen je Buchstabe (Wortlücke bei mehreren Wörtern; Satzzeichen, Apostroph, Bindestrich schon ausgefüllt). Die Buchstaben erscheinen mit Betonungszeichen (aus `a`).
- **Tastatur:** Dauerhaft darunter eine ukrainische Tastatur im iPhone-Layout (й ц у к е н г ш щ з х / ф і в а п р о л д ж є / Umschalt, я ч с м и т ь б ю, Löschen – Umschalt/Löschen nur Optik). Antippbar sind nur die Tasten der im Wort noch benötigten Buchstaben (bei mehrfachem Vorkommen so lange, bis alle gesetzt sind) und 3–6 falsche (bevorzugt verwechselbare, nie eine Taste eines Buchstabens aus dem Wort); alle übrigen sind blass und gesperrt. Die і-Taste zeigt „ї“, die г-Taste „ґ“, sobald das nächste noch offene Vorkommen dieser Taste im Wort das verlangt. Am Laptop kann auch auf einer ukrainischen Tastatur getippt werden.
- **Bewertung:** Richtiger Buchstabe → Kästchen grün. Erster Fehler → der richtige Buchstabe erscheint gelb, die falsche Taste blinkt kurz rot. Zweiter Fehler (oder „Auflösen“) → Rest rot, Runde falsch. Mit einem Fehler bestanden (zählt als richtig). Im Schreiben gibt es **keinen blauen Knopf** (damit auch keine automatische Prio „niedrig“). **Fehlerfrei geschriebene Wörter** (kein Gelb/Rot) springen 0,5 s nach dem letzten Buchstaben automatisch zum nächsten Wort (`WRITE_AUTO_NEXT_MS` in `js/vapp.js` plus 250 ms Rundenende in `js/vcards.js`). Sonst bleibt die Runde mit Zusatzinfos stehen, bis „Weiter“ getippt wird. Nach Rundenende erscheint die Zusatzinfo-Box zwischen Lösung und (dann gesperrter) Tastatur.

### 12.10 App-Icon
Blau (Verlauf) mit goldenem „Ї“ (Literata) und kurzem Goldstrich, erzeugt aus `tools/icon/icon-vorlage.html` per Browser-Screenshot (512, 192, 180 px; maskable mit kleinerem Zeichen).

**Icon-Dateinamen:** Wird das App-Icon geändert, bekommen die Dateien einen neuen Namen (`icons/icon-*-v2.png`, beim nächsten Mal `-v3` …) und alle Verweise (`index.html`, `manifest.webmanifest`, `sw.js`) werden angepasst. iOS merkt sich Home-Bildschirm-Symbole nach Adresse; bei gleichem Dateinamen erscheint sonst weiter das alte Symbol.
