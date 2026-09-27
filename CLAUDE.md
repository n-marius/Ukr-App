# Arbeitsregeln für dieses Repo

- Maßgeblich ist `SPEC.md`. Neue Vorgaben des Nutzers dort nachtragen.
- Kein Build-Schritt, keine Frameworks, keine externen Libraries. Nur Vanilla HTML/CSS/JS (ES-Module).
- Design: ausschließlich hell, minimalistisch, hochwertig. Farben/Radien/Schatten nur über die Variablen in `styles.css`.
- Nach jeder Änderung an App-Dateien `APP_VERSION` in `sw.js` erhöhen, sonst erhalten installierte Geräte kein Update. Neue Dateien in `SHELL_FILES` aufnehmen.
- Nach jeder Änderung unter `content/` `version` in `content/index.json` erhöhen und `node tools/validate.mjs` ausführen (muss grün sein).
- Vor dem Merge die App lokal im Browser durchspielen (Playwright, iPhone- und Laptop-Breite).
- Ablauf: Feature-Branch → Pull Request → vom Assistenten selbst mergen (Squash). Der Nutzer hat automatisches Mergen ausdrücklich freigegeben. `main` wird per GitHub Pages ausgeliefert.
- Der Nutzer ist kein Programmierer: Anleitungen Schritt für Schritt, ohne Fachkürzel.
