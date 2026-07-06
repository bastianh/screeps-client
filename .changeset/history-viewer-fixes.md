---
"screeps-connectivity": patch
"screeps-client": patch
---

History viewer fixes and a couple of supporting connectivity additions:

- Render terrain when reloading directly into history mode. Terrain loading was gated behind the room-subscription effect, which is skipped in history mode, so a fresh reload into a `#tick=` URL showed no terrain. Terrain/decoration loading now runs independently of history mode.
- Open the history view at the start of the previous, fully-written chunk instead of the current tick (whose chunk isn't flushed yet), avoiding an immediate 404 + fallback round-trip.
- Suppress the red failure toast when a history chunk is missing (404). `roomHistory` requests are now `silent`, and the viewer shows an in-room "No data available for this tick" hint instead, prompting the user to pick another tick from the timeline.
- During playback, skip to the start of the next chunk when the current chunk is missing, instead of re-fetching the same non-existent file on every tick.
- Expose `serverData.historyKeepTicks` (non-official field from the xxscreeps history mod) on the version types, used to size the history timeline's replayable range (falls back to a default window when absent).
- HTTP errors thrown by `HttpClient` now carry a `status` property so callers can distinguish a 404 from other failures.
- Dev-only: proxy `/room-history` to `VITE_PROXY_TARGET` in the Vite dev server.
