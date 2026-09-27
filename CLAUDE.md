# Arbeitsregeln für dieses Repo

- Maßgeblich ist `SPEC.md`. Neue Vorgaben des Nutzers dort nachtragen.
- Kein Build-Schritt, keine Frameworks, keine externen Libraries. Nur Vanilla HTML/CSS/JS (ES-Module).
- Design: minimalistisch, hochwertig, neutrale Farben ohne Gelb-/Farbstich, Hell- und Dunkelmodus. Farben/Radien/Schatten nur über die Variablen in `styles.css`. Zahlen in der Sans-Schrift (Literata-„1“ ist mehrdeutig).
- Nach jeder Änderung an App-Dateien `APP_VERSION` in `sw.js` erhöhen, sonst erhalten installierte Geräte kein Update. Neue Dateien in `SHELL_FILES` aufnehmen.
- Neue Texte (meist als JSON aus `docs/TEXT-VORLAGE.md`, mit `"id": "NEU"`): nächste freie ID der Stufe vergeben (`a1-0003` …), als `content/<Stufe>/<id>.json` speichern, inhaltlich prüfen (Betonung, Lemma, Bedeutung, Fall), dann `node tools/build-index.mjs` und `node tools/validate.mjs` (muss grün sein). `index.json` nie von Hand bearbeiten.
- Vor dem Merge die App lokal im Browser durchspielen (Playwright, iPhone- und Laptop-Breite).
- Ablauf: Feature-Branch → Pull Request → vom Assistenten selbst mergen (Squash). Der Nutzer hat automatisches Mergen ausdrücklich freigegeben. `main` wird per GitHub Pages ausgeliefert.
- Der Nutzer ist kein Programmierer: Anleitungen Schritt für Schritt, ohne Fachkürzel.
