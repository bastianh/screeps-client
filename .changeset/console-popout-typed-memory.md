---
"screeps-client": minor
---

Console, log and memory panes can now pop out into separate browser windows.
Popouts don't open their own server connection: the main window serves them
over a BroadcastChannel RPC bridge and they reattach automatically after a
main-window reload. Memory watches now always load their values typed over
HTTP — the string-coerced WS payload only acts as a change signal — fixing
the display of strings vs numbers, arrays, and keys deleted from Memory.
Array elements are editable: bracket paths (`list[3]`) map to the dot form
the server's path resolution understands.
