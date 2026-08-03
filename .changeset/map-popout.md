---
"screeps-client": minor
---

The world map can now pop out into a separate browser window or tab, with a
collapsible sidebar carrying the overlay controls and room info boxes. The
popout replaces the inline map — only one map exists at a time: opening the
map in the main window closes the popout and vice versa. Selecting a room
twice on the popped-out map navigates the main window's room view, and
navigating the room view moves the popout's highlighted room in return.
Popout hosts now answer every ping with a heartbeat, so a popout no longer
reports the main window as unreachable while that window sits in a throttled
background tab.
