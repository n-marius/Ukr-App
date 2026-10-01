# Vorlage: Neue Vokabeln erzeugen

Alles ab der Linie unten in einen neuen Chat kopieren und im Abschnitt **Auftrag** Thema/Wortliste eintragen. Die erzeugte `.txt`-Datei anschließend in `content/_inbox/` im Repo hochladen (siehe `content/_inbox/README.md`) oder in einer Claude-Code-Sitzung anhängen mit dem Satz „Bitte diese Vokabeln in die App aufnehmen“.

Hinweis für Claude Code: `node tools/add-vocab.mjs` (ohne Argumente: verarbeitet die Inbox) prüft, vergibt IDs, erkennt Doppelte und baut den Index; danach `node tools/validate-vocab.mjs`. Falschantworten, Priorität und Kategorien gibt es bewusst nicht.

---

Du erstellst Vokabeln Ukrainisch–Deutsch für eine Lern-App (Muttersprache der Lernenden: Deutsch).

## Auftrag

- Wörter bzw. Thema/Anzahl: 
- Eigene Wortliste (optional, sonst wählst du die Wörter selbst):

## Ausgabe

- Eine **Datei**: `.txt` mit reinem JSON-Inhalt – eine Liste (`[ … ]`) von Vokabel-Objekten, kein Codeblock, kein Begleittext.
- Dateiname: `vokabeln_<Thema-oder-Datum>.txt`.
- Vor der Ausgabe das JSON technisch prüfen (Parsen, Pflichtfelder, Betonungszeichen).
- Im Chat nur knappe Angaben: Anzahl, Unsicherheiten (z. B. bei Betonung oder Bedeutung).

## Format

```json
[
  {
    "uk": "дім",
    "a": "дім",
    "de": "Haus",
    "alt": ["Heim"],
    "pos": "Subst",
    "gen": "m",
    "forms": "Gen. Sg. до́му · Nom. Pl. доми́",
    "zusatz": "auch: Zuhause"
  },
  {
    "uk": "читати",
    "a": "чита́ти",
    "de": "lesen",
    "pos": "Verb",
    "asp": "ipf",
    "forms": "я чита́ю, ти чита́єш · pf. прочита́ти"
  },
  {
    "uk": "коса",
    "a": "коса́",
    "de": "Zopf",
    "pos": "Subst",
    "gen": "f",
    "zusatz": "Haar"
  }
]
```

| Feld | Bedeutung | Pflicht |
|---|---|---|
| `uk` | ukrainisches Wort (Grundform), **ohne** Betonungszeichen | ja |
| `a` | dieselbe Form **mit** Betonungszeichen (U+0301 hinter dem betonten Vokal); bei einsilbigen Wörtern gleich `uk` | ja |
| `de` | deutsche Hauptbedeutung, wird in der App als Frage bzw. Antwort gezeigt: Substantive ohne Artikel, Verben im Infinitiv (reflexiv: „sich waschen“) | ja |
| `pos` | `Subst`, `Verb`, `Adj`, `Adv`, `Pron`, `Num`, `Präp`, `Konj`, `Part`, `Interj`, `Wendung` | ja |
| `alt` | Liste weiterer deutscher Entsprechungen (Synonyme). Sie werden unter der Antwort gezeigt und sorgen dafür, dass bei Frage-Antwort kein zweites, ebenfalls richtiges Wort als Falschantwort auftaucht | optional |
| `gen` | `m`, `f`, `n` oder `pl` (nur Plural) – nur bei Substantiven (dort dringend empfohlen) | optional |
| `asp` | `ipf` (unvollendet) oder `pf` (vollendet) – nur bei Verben (dringend empfohlen) | optional |
| `forms` | Beugung als kurzer Text, z. B. Genitiv/Plural bei Substantiven, 1./2. Person bei Verben (mit Betonung), Aspektpartner, Steigerung/weibl. Form bei Adjektiven | optional |
| `zusatz` | freier Hinweis: andere Schreibweise, Konkretisierung bei Wörtern mit mehreren Bedeutungen, Register u. Ä. | optional |

## Regeln

- **Keine** `id`, **keine** Falschantworten, **keine** Priorität, **keine** Kategorie/Stufe: Die ID vergibt `tools/add-vocab.mjs`; die Falschantworten zieht die App selbst aus Wörtern gleicher Wortart.
- Ein Eintrag = eine Bedeutung. Hat ein Wort mehrere, klar verschiedene Bedeutungen (Homonyme wie „коса“: Zopf / Sense), entstehen mehrere Einträge mit gleichem `uk`; dann muss jeder Eintrag ein **`zusatz`** tragen, der die Bedeutung eingrenzt (er wird schon an der Frage gezeigt, wenn der Fragetext mehrfach vorkommt). Verschiedene Betonung bei gleicher Schreibung (замок/замо́к) ebenso.
- Gleiche deutsche Bedeutung bei verschiedenen ukrainischen Wörtern (дім/будинок = „Haus“): im jeweils anderen Eintrag in `alt` aufführen oder `zusatz` zur Unterscheidung setzen.
- `forms` und `zusatz` kurz halten (eine Zeile, möglichst < 80 Zeichen). Betonungszeichen auch in `forms`.
- Keine Anführungszeichen-Sonderformen im JSON (nur `"`), Kyrillisch in UTF-8.
