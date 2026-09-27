# Eingang für neue Texte und Chats

Hierher lädst du fertige `.txt`-Dateien hoch, die eine KI mit `docs/TEXT-VORLAGE.md`
oder `docs/CHAT-VORLAGE.md` erzeugt hat – ganz ohne den Umweg über einen Dateianhang
im Chat mit Claude Code (dort sind nur 5 Dateien pro Nachricht möglich).

## So lädst du Dateien hoch

1. Dieses Repo im Browser öffnen: `https://github.com/n-marius/Ukr-App`
2. In den Ordner `content/_inbox` wechseln.
3. Oben rechts auf **Add file → Upload files** klicken.
4. Eine oder mehrere `.txt`-Dateien hineinziehen.
5. Unten auf **Commit changes** klicken (Branch `main` beibehalten).

Das war's. Beliebig viele Dateien, beliebig oft – kein Limit wie im Chat.

## Wie es weitergeht

In der nächsten Claude-Code-Sitzung reicht der Satz „Bitte den Inbox-Ordner
verarbeiten“ (oder es geschieht automatisch, wenn hier Dateien liegen). Jede Datei
wird geprüft, bekommt eine Nummer, wird nach `content/<Stufe>/` bzw.
`content/chat/<Stufe>/` verschoben, und hier im Eingang wieder gelöscht.

Dieser Ordner sollte also im Normalfall leer sein – Inhalt hier bedeutet „wartet
auf Verarbeitung".
