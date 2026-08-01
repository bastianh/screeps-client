---
'screeps-client': minor
---

Give the console command line a persistent history and TypeScript autocompletion.

The command history now survives a reload. It is stored per server — commands referencing a private
server's creeps are meaningless on MMO — capped at 200 entries, and no longer records a command
twice in a row. Failed commands are kept as well, since a rejected command is exactly the one worth
recalling and fixing.

Typing `.` opens a completion list drawn from the same in-browser TypeScript service the code editor
uses, so `Game`, `Memory`, the room-object API and every game constant complete from
`@types/screeps`. `Ctrl+Space` requests completions anywhere. The arrow keys drive the list while it
is open and walk the history otherwise; `Escape` closes the list, or clears the input when there is
no list.

The TypeScript worker is only loaded once completions are actually requested, so a session that
never uses them does not pay for it.
