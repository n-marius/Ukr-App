# Vorlage: Neue Lesetexte erzeugen

Alles ab der Linie unten in einen neuen Chat kopieren und im Abschnitt **Auftrag** Thema, ggf. Stufe, Anzahl und eigenen Text eintragen. Die erzeugten `.txt`-Dateien anschließend entweder in einer Claude-Code-Sitzung anhängen mit dem Satz „Bitte diese Texte in die App aufnehmen“, oder direkt in `content/_inbox/` im Repo hochladen (siehe `content/_inbox/README.md`).

Hinweis für Claude Code: Das Feld `titleDe` (deutscher Kurztitel) ist neu und muss von der App unterstützt werden. `tags` enthält immer genau einen Eintrag.

---

Du erstellst ukrainische Lesetexte für eine Lern-App (Muttersprache der Lernenden: Deutsch).

## Auftrag

- Thema (Tag-Kategorie): Grundlagen
- Stufe: 
  (Fehlt die Angabe, legst du die Stufe **vor** dem Schreiben fest und hältst ihre Grenzen strikt ein; nachträglich wird nichts umgestuft.)
- Anzahl Texte: 1
- Eigener Text (optional, sonst schreibst du ihn selbst):

## Ausgabe

- Jeder Text wird als **eigene Datei** ausgegeben: `.txt` mit reinem JSON-Inhalt (kein Codeblock, kein Begleittext in der Datei).
- Dateiname: `<Stufe>_<Tag>_<titleDe mit Bindestrichen>.txt`, z. B. `A1_Grundlagen_Hallo-ich-bin-Oksana.txt`.
- Vor der Ausgabe das JSON technisch prüfen (Parsen, Wortzahl, Pflichtfelder).
- Im Chat nur knappe Angaben: Stufe, deutscher Titel, Wortzahl, ggf. Unsicherheiten (z. B. bei Betonung).

## Format

```json
{
  "id": "NEU",
  "level": "A1",
  "tags": ["Grundlagen"],
  "titleDe": "Hallo, ich bin Oksana",
  "title": "Привіт, я Оксана!",
  "paragraphs": [
    [
      { "t": "Привіт", "a": "Приві́т", "l": "привіт", "g": "hallo", "pos": "Interj" },
      { "p": "!" },
      { "t": "Як", "a": "Як", "u": "u1" },
      { "t": "справи", "a": "спра́ви", "u": "u1" },
      { "p": "?" },
      { "t": "Я", "a": "Я", "l": "я", "g": "ich", "pos": "Pron", "m": { "pers": "1", "num": "Sg", "case": "Nom" } },
      { "t": "студентка", "a": "студе́нтка", "l": "студентка", "g": "Studentin", "pos": "Subst", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
      { "p": "." }
    ]
  ],
  "units": {
    "u1": { "g": "Wie geht's?", "pos": "Wendung", "note": "Begrüßungsformel" }
  },
  "questions": [
    {
      "q": [
        { "t": "Хто", "l": "хто", "g": "wer", "pos": "Pron", "m": { "case": "Nom" } },
        { "t": "Оксана", "l": "Оксана", "g": "Oksana", "pos": "Subst", "m": { "gen": "f", "num": "Sg", "case": "Nom" } },
        { "p": "?" }
      ],
      "o": ["студентка", "лікар", "вчителька", "інженер"],
      "a": 0
    }
  ]
}
```

## Technische Regeln

**Allgemein**
- `id` bleibt `"NEU"` (die App vergibt die Nummer).
- `level`: eine von A1, A2, B1, B2, C1, C2. Ist keine Stufe vorgegeben, wählst du sie selbst.
- `tags`: genau **ein** deutscher Begriff = die vorgegebene Themenkategorie. Bisherige Kategorien: Grundlagen, Restaurant, Hotel, Gesundheit, Supermarkt, Reisen, Verkehr, Freizeit. Neue Kategorien nur, wenn im Auftrag vorgegeben.
- `titleDe`: kurzer deutscher Titel (2–5 Wörter), der den konkreten Inhalt benennt.
- `title`: ukrainischer Titel als normaler Text (nicht in Tokens zerlegt).
- Den konkreten Inhalt innerhalb der Kategorie wählst du frei.
- `paragraphs`: Liste von Absätzen; jeder Absatz ist eine Liste von Tokens in Lesereihenfolge.

**Tokens im Text und in den Fragen**
- Jedes Wort ist ein eigenes Token. Satzzeichen sind eigene Tokens `{ "p": "." }`. Leerzeichen zwischen Wörtern nicht eintragen.
- Gedankenstrich als `{ "p": " — " }`, Komma als `{ "p": "," }`, Doppelpunkt als `{ "p": ":" }`.
- Apostroph im Wort als ASCII `'` (z. B. `сім'я`).
- `t`: Wort genau wie im Text.
- `a`: Wort mit Betonungszeichen (U+0301 direkt nach dem betonten Vokal). Einsilbige Wörter ohne Zeichen. Nur im Text, in den Fragen weglassen.
- `l`: Grundform (Lemma).
- `g`: deutsche Bedeutung in diesem Zusammenhang, kurz.
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

**Mehrwort-Einheiten**
- Alle beteiligten Tokens bekommen dieselbe Kennung `"u": "u1"` (u2, u3 …) statt `l`, `g`, `pos`, `m`. `t` und `a` bleiben.
- Die Angaben stehen einmal in `units`: `g`, `pos` (meist „Wendung“), optional `note`.
- Jede Kennung in `units` muss im Text vorkommen und umgekehrt. Ohne Wendungen: `"units": {}`.

**Fragen**
- Genau 5 Fragen auf Ukrainisch zum Inhalt, als Tokens (ohne `a`). Die Fragen halten sich an die Grammatikgrenzen der Stufe.
- Je genau 4 Antwortmöglichkeiten `o` als normaler Text; genau eine richtig, die anderen plausibel, aber eindeutig falsch.
- Die Fragen prüfen **sinnerfassendes Lesen**: Zuordnung (wer tut was), Gründe, Zusammenhänge über mehrere Sätze, einfache Schlüsse (z. B. Samstag → freier Tag). Richtige Antworten möglichst umschreiben statt wörtlich aus dem Text übernehmen (Synonym, Pronomen, andere Satzform).
- Nicht zu leicht: Eine Frage darf nicht allein durch Wiedererkennen eines Wortes lösbar sein; Ablenker sollten Wörter aus dem Text enthalten, aber falsch kombinieren (z. B. falsche Person, vertauschte Zahlen).
- Nicht zu schwer: Fragen und Antworten halten die Grammatik- und Wortschatzgrenzen der Stufe ein und sind kürzer und einfacher als die Textsätze; das Verstehen der Frage selbst darf keine Hürde sein.
- `a`: Position der richtigen Antwort (0–3), über die Fragen hinweg variieren.

## Sprachliche Regeln

**Sprache**
- Ausschließlich korrektes, standardsprachliches Ukrainisch. Keine Russismen, kein Surschyk, keine russischen Lehnformen (z. B. nicht „кушать“, „ладно“, „канєшно“, „получається“ im Sinne von „es klappt“).
- Betonungen sorgfältig prüfen; bei Unsicherheit im Chat darauf hinweisen.

**Länge (alle Stufen gleich)**
- Richtwert: eine A5-Buchseite mit eher großer Schrift = **ca. 200 Wörter (180–220)**. Gezählt werden nur Wort-Tokens, keine Satzzeichen.

**Stufen** (jede Stufe umfasst alles aus den vorherigen)
- **A1:** Nur Präsens, kein Imperativ. Nur Nominativ und Akkusativ (auch nach Präpositionen, z. B. „в парк“, „на роботу“). Verben und Personalpronomen 1.–3. Person Singular, kein Plural (Pluralformen von Substantiven und Adjektiven im Nominativ/Akkusativ sind zulässig). Infinitive sind erlaubt (z. B. nach хотіти, любити, треба). Adjektive, Possessiv- und Fragepronomen nur in Nominativ/Akkusativ. Zahlen 0–99; Zahl + Substantiv nur, wenn das Substantiv im Nominativ/Akkusativ bleibt (Endziffer 1–4 außer 11–14, z. B. „сорок дві гривні“), sonst Zahl ohne Substantiv (z. B. „номер сім“). Nur absolut grundlegender Wortschatz, einfache Hauptsätze, keine Idiome; übliche Formeln wie „Як справи?“ sind zulässig.
- **A2:** Alle sieben Fälle in einfacher Verwendung (Substantive, Adjektive, Pronomen). Verben in 1.–3. Person Singular und Plural. Verbaspekte (ipf/pf) in einfachen Paaren. Grundlagen von Präteritum und Futur. Imperativ. Einfache Konditionalsätze mit „якщо“ (Realis). Verkleinerungssuffixe (-ик, -ок, -к(а) usw.). Zahlen bis 9 999 inkl. Rektion. Kurze Nebensätze mit що, коли, бо. Kein Komparativ/Superlativ, keine Partizipien.
- **B1:** Komparativ und Superlativ. Alle Tempora und Aspekte sicher. Konjunktiv/Irrealis mit „би“. Nebensätze mit який, щоб, хоча, тому що; indirekte Rede. Ordnungszahlen und Datumsangaben. Zusammenhängende Erzählung, Alltags- und einfacher Sachwortschatz, gängige Redewendungen in geringer Zahl.
- **B2:** Aktiv- und Passivpartizipien, Adverbialpartizipien, unpersönliche Passivformen auf -но/-то. Komplexe Satzgefüge, abstraktere Themen (Gesellschaft, Arbeit, Kultur). Verbreitete Idiome und feste Wendungen.
- **C1:** Anspruchsvolle Sach- und Meinungstexte, differenzierter und fachsprachlicher Wortschatz, stilistische Register (formell/umgangssprachlich), idiomatische Wendungen, komplexe Syntax.
- **C2:** Authentische Texte ohne Vereinfachung (literarisch, publizistisch, fachlich); seltene Lexik, Stilmittel, ggf. markierte Archaismen oder Regionalismen.

## Kontrolle vor der Ausgabe
- Jedes Wort ein Token, jedes Satzzeichen ein `p`-Token?
- Jedes Wort-Token hat `l`, `g`, `pos` oder ein `u`?
- Betonung, Lemma, Bedeutung, Fall im Kontext korrekt?
- Grammatikgrenzen der Stufe in Text **und** Fragen eingehalten (A1: kein Imperativ, kein Plural bei Verben/Pronomen, nur Nom/Akk)?
- Wortzahl 180–220?
- Genau ein Tag, `titleDe` vorhanden?
- Genau 5 Fragen mit je 4 Antworten und korrektem `a`?
- Gültiges JSON?
