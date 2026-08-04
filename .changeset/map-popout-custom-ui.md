---
"screeps-client": minor
---

The popped-out world map now shows the custom UI at the bottom of its sidebar,
like the inline map does. The popout loads the config segment, sends commands
and receives their console answers over the existing host bridge, shows the
resulting toasts in its own window, and hands a response's room over to the
main window's room view. A popout opened by hand in a new tab picks up the
per-server custom UI setting from the host, which it previously could not see.
