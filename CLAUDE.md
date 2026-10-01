# Arbeitsregeln für dieses Repo

- Maßgeblich ist `SPEC.md`. Neue Vorgaben des Nutzers dort nachtragen.
- Kein Build-Schritt, keine Frameworks, keine externen Libraries. Nur Vanilla HTML/CSS/JS (ES-Module).
- Design: minimalistisch, hochwertig, neutrale Farben ohne Gelb-/Farbstich, Hell- und Dunkelmodus. Farben/Radien/Schatten nur über die Variablen in `styles.css`. Zahlen in der Sans-Schrift (Literata-„1“ ist mehrdeutig).
- Nach jeder Änderung an App-Dateien `APP_VERSION` in `sw.js` erhöhen, sonst erhalten installierte Geräte kein Update. Neue Dateien in `SHELL_FILES` aufnehmen.
- Neue Texte (meist als JSON aus `docs/TEXT-VORLAGE.md`, mit `"id": "NEU"`): nächste freie ID der Stufe vergeben (`a1-0003` …), als `content/<Stufe>/<id>.json` speichern, inhaltlich prüfen (Betonung, Lemma, Bedeutung, Fall), dann `node tools/build-index.mjs` und `node tools/validate.mjs` (muss grün sein). `index.json` nie von Hand bearbeiten.
- Neue Chats (aus `docs/CHAT-VORLAGE.md`): gleiches Vorgehen unter `content/chat/<Stufe>/<id>.json`, zusätzlich prüfen, dass jeder Knoten erreichbar ist und jede Antwortgruppe genau 3× `ok:true`/1× `ok:false` hat, dann `node tools/build-chat-index.mjs` und `node tools/validate-chats.mjs`.
- Neue Vokabeln (aus `docs/VOKABEL-VORLAGE.md`, JSON-Liste ohne IDs): `node tools/add-vocab.mjs` (ohne Argumente: verarbeitet die Inbox, vergibt `v0001` …, meldet Doppelte, schreibt `content/vokabeln/liste-NNNN.json`, baut den Index), inhaltlich stichprobenartig prüfen (Betonung, Bedeutung, Genus, Formen), dann `node tools/validate-vocab.mjs` (muss grün sein). `content/vokabeln/index.json` nie von Hand bearbeiten. Wird der INHALT eines bestehenden Worts geändert, `korrigiert` (ISO-Zeitstempel) setzen, sonst überdeckt eine ältere In-App-Korrektur (`vEdits`) die neue Fassung. Vokabel-Regeln: SPEC.md Abschnitt 12.
- `content/_inbox/`: Dateien, die der Nutzer dort über GitHub hochlädt, zu Beginn der Sitzung verarbeiten (siehe README dort) – einsortieren, validieren, aus der Inbox löschen.
- Vor dem Merge die App lokal im Browser durchspielen (Playwright, iPhone- und Laptop-Breite).
- Ablauf: Feature-Branch → Pull Request → vom Assistenten selbst mergen (Squash). Der Nutzer hat automatisches Mergen ausdrücklich freigegeben. `main` wird per GitHub Pages ausgeliefert.
- Der Nutzer ist kein Programmierer: Anleitungen Schritt für Schritt, ohne Fachkürzel.
- App-Icon ändern: immer neue Dateinamen vergeben (`icons/icon-*-v2.png` → `-v3` …) und `index.html`, `manifest.webmanifest`, `sw.js` anpassen – sonst zeigt iOS weiter das alte Symbol (SPEC.md).
