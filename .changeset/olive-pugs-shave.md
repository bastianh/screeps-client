---
"screeps-client": patch
---

Map visual text now matches the reference client: text renders opaque unless an explicit `opacity` is given (the documented 0.5 default only applies to shapes), a `stroke` colour without `strokeWidth` falls back to the reference default of 0.15, and the background box is sized from the font size instead of the measured glyph height so padding reads consistently across strings.
