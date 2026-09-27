# Vorlage: Neuen Lesetext erzeugen

Alles ab der Linie unten in einen neuen, normalen Chat kopieren. Vorher im Abschnitt **Auftrag** Stufe, Thema und ggf. einen eigenen Text eintragen. Das Ergebnis (eine JSON-Datei) anschließend in einer Claude-Code-Sitzung mit dem Satz „Bitte diesen Text in die App aufnehmen“ einfügen oder als Datei anhängen.

---

Du erstellst einen ukrainischen Lesetext für eine Lern-App (Muttersprache der Lernenden: Deutsch). Gib **ausschließlich** eine JSON-Datei in einem einzigen Codeblock aus, ohne Erklärungen davor oder danach.

## Auftrag

- Stufe: A1
- Thema (deutsch, 1–2 Wörter): Familie
- Eigener Text (optional, sonst schreibst du ihn selbst):

## Format

```json
{
  "id": "NEU",
  "level": "A1",
  "tags": ["Familie"],
  "title": "Моя сім'я",
  "paragraphs": [
    [
      { "t": "Моя", "a": "Моя́", "l": "мій", "g": "meine", "pos": "Pron", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
      { "t": "мама", "a": "ма́ма", "l": "мама", "g": "Mama", "pos": "Subst", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
      { "t": "робить", "a": "ро́бить", "l": "робити", "g": "macht", "pos": "Verb", "m": { "asp": "ipf", "tense": "Präs", "pers": "3", "num": "Sg" } },
      { "t": "домашнє", "a": "дома́шнє", "u": "u1" },
      { "t": "завдання", "a": "завда́ння", "u": "u1" },
      { "p": "." }
    ]
  ],
  "units": {
    "u1": { "g": "Hausaufgabe", "pos": "Wendung", "note": "feste Wendung" }
  },
  "questions": [
    {
      "q": [
        { "t": "Що", "l": "що", "g": "was", "pos": "Pron", "m": { "case": "Akk" } },
        { "t": "робить", "l": "робити", "g": "macht", "pos": "Verb", "m": { "asp": "ipf", "tense": "Präs", "pers": "3", "num": "Sg" } },
        { "t": "мама", "l": "мама", "g": "die Mama", "pos": "Subst", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
        { "p": "?" }
      ],
      "o": ["домашнє завдання", "обід", "покупки", "прибирання"],
      "a": 0
    }
  ]
}
```

## Regeln

**Allgemein**
- `id` bleibt `"NEU"` (die App vergibt die Nummer).
- `level` ist eine von: A1, A2, B1, B2, C1, C2.
- `tags`: ein oder zwei deutsche Themenbegriffe.
- `title`: ukrainischer Titel als normaler Text (nicht in Tokens zerlegt).
- `paragraphs`: Liste von Absätzen; jeder Absatz ist eine Liste von Tokens in Lesereihenfolge.

**Tokens im Text und in den Fragen**
- Jedes Wort ist ein eigenes Token. Satzzeichen sind eigene Tokens `{ "p": "." }`. Leerzeichen zwischen Wörtern **nicht** eintragen, die setzt die App.
- Gedankenstrich als `{ "p": " — " }` (mit Leerzeichen davor und danach), Komma als `{ "p": "," }`.
- `t`: Wort genau wie im Text.
- `a`: Wort mit Betonungszeichen (Zeichen U+0301 direkt nach dem betonten Vokal, z. B. `ма́ма`). Bei einsilbigen Wörtern ohne Zeichen. Nur im Text nötig, in den Fragen weglassen.
- `l`: Grundform (Lemma).
- `g`: deutsche Bedeutung **in diesem Zusammenhang**, kurz (z. B. „leben (sie)“, „als Arzt“).
- `pos`: genau eines von Subst, Verb, Adj, Adv, Pron, Num, Präp, Konj, Part, Interj, Wendung.
- `m`: Morphologie, nur zutreffende Schlüssel:
  - `gen`: m, f, n
  - `num`: Sg, Pl
  - `case`: Nom, Gen, Dat, Akk, Inst, Lok, Vok
  - `asp`: ipf, pf
  - `tense`: Präs, Prät, Fut
  - `pers`: "1", "2", "3"
  - `mood`: Ind, Imp, Konj
  - `inf`: true (bei Infinitiv)
  - `deg`: Pos, Komp, Sup
- Präpositionen, Konjunktionen, Partikeln und Adverbien haben meist kein `m`.

**Mehrwort-Einheiten** (feste Wendungen, zusammengesetzte Ausdrücke)
- Alle beteiligten Tokens bekommen dieselbe Kennung `"u": "u1"` (u2, u3 … für weitere) statt `l`, `g`, `pos`, `m`. `t` und `a` bleiben.
- Die Angaben stehen einmal in `units`: `g` (Bedeutung), `pos` (meist „Wendung“), optional `note`.
- Jede Kennung in `units` muss im Text vorkommen und umgekehrt. Ohne Wendungen: `"units": {}`.

**Fragen**
- Genau 5 Fragen auf Ukrainisch zum Inhalt des Textes, als Tokens wie im Text (ohne `a`).
- Je genau 4 Antwortmöglichkeiten `o` als normaler ukrainischer Text; nur eine ist richtig, die anderen plausibel, aber eindeutig falsch.
- `a` ist die Position der richtigen Antwort (0–3). Die App mischt die Reihenfolge ohnehin.

**Sprachniveau (vorläufig)**
- A1: 50–120 Wörter, Präsens, einfache Hauptsätze, Grundwortschatz.
- A2: 100–180 Wörter, zusätzlich Präteritum und Futur, einfache Nebensätze.
- B1: 150–250 Wörter, zusammenhängende Erzählung, gängige Nebensätze.
- B2: 200–350 Wörter, abstraktere Themen, Partizipien und Adverbialpartizipien.
- C1: 300–450 Wörter, anspruchsvolle Sachtexte, idiomatische Wendungen.
- C2: 350–600 Wörter, literarische oder fachliche Texte ohne Vereinfachung.

**Kontrolle vor der Ausgabe**
- Ist jedes Wort ein Token und jedes Satzzeichen ein `p`-Token?
- Hat jedes Wort-Token entweder `l`, `g`, `pos` oder ein `u`?
- Stimmen Betonung, Grundform, Bedeutung und Fall im Kontext?
- Genau 5 Fragen mit je 4 Antworten und korrektem `a`?
- Gültiges JSON (doppelte Anführungszeichen, keine Kommentare, kein Komma nach dem letzten Element)?
