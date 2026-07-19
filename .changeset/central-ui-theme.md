---
"screeps-client": patch
---

Centralize the HTML UI's GitHub-dark palette in `components/theme.ts`. The market and power section themes now re-export the shared tokens (unifying the near-duplicate raised-panel tone `#1c2129`/`#1c2128` on one value) and keep only their own accents; the market's `fmtAmount`/`fmtPrice` number formatters move to `utils/formatNumber.ts` next to `formatLargeNumber`. `MeterBar` consumes the shared tokens instead of hardcoded hex.
