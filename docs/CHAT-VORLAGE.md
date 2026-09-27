# Vorlage: Neue Chats (Frage-Antwort) erzeugen

Alles ab der Linie unten in einen neuen Chat kopieren und im Abschnitt **Auftrag** Thema, Stufe und ggf. eine Situation eintragen. Die erzeugte `.txt`-Datei anschließend entweder in einer Claude-Code-Sitzung anhängen mit dem Satz „Bitte diesen Chat in die App aufnehmen“, oder direkt in `content/_inbox/` im Repo hochladen (siehe `content/_inbox/README.md`).

Hinweis für Claude Code: Format für den Modus „Frage-Antwort“ (verzweigtes Gespräch), nicht für Lesetexte – dafür gilt `TEXT-VORLAGE.md`.

---

Du erstellst ein simuliertes ukrainisches Gespräch für eine Lern-App (Muttersprache der Lernenden: Deutsch). Die Lernperson tippt keinen freien Text, sondern wählt bei jeder Gesprächsrunde eine von vier vorformulierten Antworten aus.

## Auftrag

- Thema (Tag-Kategorie): Restaurant
- Stufe:
  (Fehlt die Angabe, legst du die Stufe **vor** dem Schreiben fest und hältst ihre Grenzen strikt ein.)
- Situation (optional, sonst wählst du selbst etwas Passendes zur Kategorie):

## Ausgabe

- Eine `.txt`-Datei mit reinem JSON-Inhalt (kein Codeblock, kein Begleittext in der Datei).
- Dateiname: `<Stufe>_<Tag>_<titleDe mit Bindestrichen>.txt`, z. B. `A1_Restaurant_Kaffee-bestellen.txt`.
- Vor der Ausgabe das JSON technisch prüfen (Parsen, Knotenzahl, dass jeder `next` auf einen existierenden Knoten zeigt, dass jeder Knoten vom Start aus erreichbar ist).
- Im Chat nur knappe Angaben: Stufe, deutscher Titel, Anzahl Knoten, ggf. Unsicherheiten.

## Wie das Gespräch funktioniert (wichtig für den Aufbau)

- Das Gespräch ist ein Baum aus **Knoten**. Jeder Knoten hat eine Nachricht der App (`bot`, 1–3 kurze Sätze) und – außer am Ende – genau **vier** Antwortmöglichkeiten.
- Von den vier Antworten sind **drei inhaltlich sinnvoll** (aber unterschiedlich) und **eine ist inhaltlich unsinnig oder unpassend** (nicht grammatisch falsch, sondern thematisch daneben, z. B. eine Antwort, die nicht zur Frage passt). Wählt die Lernperson die unsinnige Antwort, bleibt sie im selben Knoten hängen und muss eine andere wählen.
- Jede der drei sinnvollen Antworten führt zu einem eigenen Folgeknoten (`next`). Verschiedene Antworten **dürfen auf denselben Folgeknoten zeigen** – das reduziert die Zahl der Knoten und ist ausdrücklich erwünscht, sobald sich die Gesprächsstränge inhaltlich wieder treffen lassen.
- Ein Knoten ohne `answers` ist ein **Ende** des Gesprächs.
- Baue jeden Baum mit **10–16 Knoten** und **2–3 Ebenen Verzweigung**, danach die Stränge wieder zusammenführen und nach ein bis zwei weiteren Runden beenden. Das hält die Datei überschaubar, auch wenn viele Chats erzeugt werden sollen.
- Realistischer Gesprächsverlauf: Begrüßung/Situation eröffnen, 2–4 Austausche zum Thema, Abschluss/Verabschiedung.

## Format

```json
{
  "id": "NEU",
  "level": "A1",
  "tags": ["Restaurant"],
  "titleDe": "Kaffee bestellen",
  "title": "Кава на винос",
  "start": "n1",
  "nodes": {
    "n1": {
      "bot": [
        { "t": "Доброго", "a": "До́брого", "l": "добрий", "g": "guten", "pos": "Adj", "m": { "gen": "m", "num": "Sg", "case": "Gen", "deg": "Pos" } },
        { "t": "дня", "a": "дня", "l": "день", "g": "Tag", "pos": "Subst", "m": { "gen": "m", "num": "Sg", "case": "Gen" } },
        { "p": "! " },
        { "t": "Що", "a": "Що", "l": "що", "g": "was", "pos": "Pron", "m": { "case": "Akk" } },
        { "t": "хочеш", "a": "хо́чеш", "l": "хотіти", "g": "willst", "pos": "Verb", "m": { "asp": "ipf", "tense": "Präs", "pers": "2", "num": "Sg" } },
        { "t": "випити", "a": "ви́пити", "l": "випити", "g": "trinken", "pos": "Verb", "m": { "asp": "pf", "inf": true } },
        { "p": "?" }
      ],
      "answers": [
        {
          "t": [
            { "t": "Каву", "a": "Ка́ву", "l": "кава", "g": "Kaffee", "pos": "Subst", "m": { "gen": "f", "num": "Sg", "case": "Akk" } },
            { "p": ", " },
            { "t": "будь", "a": "будь", "u": "u1" },
            { "t": "ласка", "a": "ла́ска", "u": "u1" },
            { "p": "." }
          ],
          "ok": true,
          "next": "n2a"
        },
        {
          "t": [
            { "t": "Чай", "a": "Чай", "l": "чай", "g": "Tee", "pos": "Subst", "m": { "gen": "m", "num": "Sg", "case": "Akk" } },
            { "p": ", " },
            { "t": "будь", "a": "будь", "u": "u1" },
            { "t": "ласка", "a": "ла́ска", "u": "u1" },
            { "p": "." }
          ],
          "ok": true,
          "next": "n2b"
        },
        {
          "t": [
            { "t": "Нічого", "a": "Нічо́го", "l": "ніщо", "g": "nichts", "pos": "Pron", "m": { "case": "Gen" } },
            { "p": ", " },
            { "t": "дякую", "a": "дя́кую", "l": "дякувати", "g": "danke", "pos": "Verb", "m": { "asp": "ipf", "tense": "Präs", "pers": "1", "num": "Sg" } },
            { "p": "." }
          ],
          "ok": true,
          "next": "n2c"
        },
        {
          "t": [
            { "t": "Автобус", "a": "Авто́бус", "l": "автобус", "g": "Bus", "pos": "Subst", "m": { "gen": "m", "num": "Sg", "case": "Nom" } },
            { "t": "запізнюється", "a": "запізню́ється", "l": "запізнюватися", "g": "hat Verspätung", "pos": "Verb", "m": { "asp": "ipf", "tense": "Präs", "pers": "3", "num": "Sg" } },
            { "p": "." }
          ],
          "ok": false
        }
      ]
    },
    "n2a": {
      "bot": [
        { "t": "З", "a": "З", "l": "з", "g": "mit", "pos": "Präp" },
        { "t": "молоком", "a": "молоко́м", "l": "молоко", "g": "Milch", "pos": "Subst", "m": { "gen": "n", "num": "Sg", "case": "Inst" } },
        { "p": "?" }
      ],
      "answers": [
        { "t": [ { "t": "Так", "a": "Так", "l": "так", "g": "ja", "pos": "Part" }, { "p": "." } ], "ok": true, "next": "n3" },
        { "t": [ { "t": "Ні", "a": "Ні", "l": "ні", "g": "nein", "pos": "Part" }, { "p": "." } ], "ok": true, "next": "n3" },
        { "t": [ { "t": "Трохи", "a": "Тро́хи", "l": "трохи", "g": "ein bisschen", "pos": "Adv" }, { "p": "." } ], "ok": true, "next": "n3" },
        { "t": [ { "t": "Завтра", "a": "За́втра", "l": "завтра", "g": "morgen", "pos": "Adv" }, { "p": "." } ], "ok": false }
      ]
    },
    "n2b": { "bot": [ ], "answers": [ ] },
    "n2c": { "bot": [ ], "answers": [ ] },
    "n3": {
      "bot": [
        { "t": "Ось", "a": "Ось", "l": "ось", "g": "hier ist", "pos": "Part" },
        { "t": "ваша", "a": "ва́ша", "l": "ваш", "g": "Ihr", "pos": "Pron", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
        { "t": "кава", "a": "ка́ва", "l": "кава", "g": "Kaffee", "pos": "Subst", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
        { "p": ". " },
        { "t": "Гарного", "a": "Га́рного", "l": "гарний", "g": "schönen", "pos": "Adj", "m": { "gen": "m", "num": "Sg", "case": "Gen", "deg": "Pos" } },
        { "t": "дня", "a": "дня", "l": "день", "g": "Tag", "pos": "Subst", "m": { "gen": "m", "num": "Sg", "case": "Gen" } },
        { "p": "!" }
      ]
    }
  },
  "units": {
    "u1": { "g": "bitte", "pos": "Wendung", "note": "feste Höflichkeitsformel" }
  }
}
```

*(Die Knoten `n2b`/`n2c` sind hier nur als Platzhalter leer gelassen – in der echten Ausgabe vollständig ausformulieren, nicht leer lassen.)*

## Technische Regeln

**Allgemein**
- `id` bleibt `"NEU"`.
- `level`: eine von A1, A2, B1, B2, C1, C2.
- `tags`: genau **ein** deutscher Begriff. Bisherige Kategorien: Grundlagen, Restaurant, Hotel, Gesundheit, Supermarkt, Reisen, Verkehr, Freizeit. Neue Kategorien nur, wenn im Auftrag vorgegeben.
- `titleDe`: kurzer deutscher Titel (2–5 Wörter).
- `title`: ukrainischer Titel als normaler Text (nicht in Tokens zerlegt).
- `start`: die Knoten-ID, bei der das Gespräch beginnt.
- `nodes`: Objekt mit allen Knoten, Schlüssel sind frei wählbare IDs (z. B. `n1`, `n2a`).

**Knoten**
- `bot`: 1–3 kurze Sätze als Tokens (gleiches Format wie bei Lesetexten, siehe unten). Wirkt wie eine Chatnachricht – knapp, keine Aufzählungen.
- `answers`: **genau vier** Einträge, außer bei einem Endknoten (dann `answers` ganz weglassen). Jeder Eintrag:
  - `t`: die Antwort der Lernperson, als Tokens (gleiches Format).
  - `ok`: `true` für die drei passenden Antworten, `false` für die eine unpassende.
  - `next`: nur bei `ok: true` – die ID des Folgeknotens. Bei `ok: false` kein `next`.
- Jede in `next` genannte ID muss ein existierender Schlüssel in `nodes` sein.
- Jeder Knoten außer dem Start muss über mindestens einen `next` erreichbar sein.

**Tokens** (identisch zu Lesetexten)
- Jedes Wort ein eigenes Token, Satzzeichen als `{ "p": "." }` (Leerzeichen nach Satzzeichen bei Bedarf im `p`-Wert selbst, z. B. `{ "p": "! " }`, da nach einer Bot-Nachricht innerhalb eines mehrsätzigen `bot`-Arrays kein automatischer Zeilenumbruch erfolgt).
- `t` Wortform, `a` mit Betonungszeichen (U+0301 nach dem betonten Vokal, einsilbige Wörter ohne), `l` Lemma, `g` deutsche Bedeutung im Kontext, `pos` (Subst, Verb, Adj, Adv, Pron, Num, Präp, Konj, Part, Interj, Wendung), `m` Morphologie (gen, num, case, asp, tense, pers, mood, inf, deg – wie bei Lesetexten).
- Mehrwort-Einheiten wie bei Lesetexten über `"u": "u1"` plus Eintrag in `units` (gilt für das ganze Gespräch, `bot` wie `answers`).
- Apostroph als ASCII `'`.

**Inhaltliche Qualität**
- Die unpassende Antwort ist thematisch daneben, nicht grammatisch fehlerhaft und nicht offensichtlich albern – sie soll kurz zum Nachdenken bringen, aber eindeutig falsch sein.
- Die drei passenden Antworten unterscheiden sich inhaltlich merklich (nicht nur in der Wortwahl), damit unterschiedliche Folgeknoten Sinn ergeben.
- Zusammenführen, sobald es inhaltlich plausibel ist (z. B. nach „ja“/„nein“/„ein bisschen“ geht es unabhängig von der Wahl gleich weiter).
- Am Ende steht ein passender Gesprächsabschluss (Verabschiedung, Dank, kurzes Fazit).

## Sprachliche Regeln

**Sprache**
- Ausschließlich korrektes, standardsprachliches Ukrainisch. Keine Russismen, kein Surschyk.
- Betonungen sorgfältig prüfen; bei Unsicherheit im Chat darauf hinweisen.

**Stufen** (jede Stufe umfasst alles aus den vorherigen)
- **A1:** Nur Präsens, kein Imperativ. Nur Nominativ und Akkusativ (auch nach Präpositionen). Verben/Personalpronomen nur 1.–3. Person Singular. Infinitive erlaubt (z. B. nach хотіти, любити, треба). Adjektive/Possessiv-/Fragepronomen nur Nom/Akk. Zahlen 0–99 mit den üblichen Einschränkungen. Nur grundlegender Wortschatz, einfache Sätze; übliche Höflichkeitsformeln sind zulässig.
- **A2:** Alle sieben Fälle einfach verwendet. Verben auch im Plural. Aspekte in einfachen Paaren. Präteritum/Futur-Grundlagen. Imperativ. Einfache якщо-Sätze. Zahlen bis 9 999.
- **B1:** Komparativ/Superlativ. Alle Tempora/Aspekte sicher. Konjunktiv mit „би“. Nebensätze mit який, щоб, хоча, тому що; indirekte Rede.
- **B2:** Partizipien, Adverbialpartizipien, Passiv auf -но/-то. Komplexere Sätze, abstraktere Themen.
- **C1:** Anspruchsvoller, fachsprachlicher Wortschatz, Register, komplexe Syntax.
- **C2:** Authentisch, ohne Vereinfachung.

## Kontrolle vor der Ausgabe
- Start-ID existiert in `nodes`? Jeder `next` zeigt auf existierende ID? Jeder Knoten außer Start erreichbar?
- Jeder Knoten ohne `answers` ist wirklich ein sinnvolles Ende?
- Jeder Knoten mit `answers` hat genau 4 Einträge, genau einer mit `ok: false` (ohne `next`), drei mit `ok: true` (mit `next`)?
- Jedes Wort-Token hat `l`, `g`, `pos` oder ein `u`? Jede Unit in `units` auch verwendet?
- Grammatikgrenzen der Stufe in `bot` **und** `answers` eingehalten?
- 10–16 Knoten, mindestens eine Zusammenführung, realistischer Gesprächsbogen?
- Genau ein Tag, `titleDe` vorhanden?
- Gültiges JSON?
