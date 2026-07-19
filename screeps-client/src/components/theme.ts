// Central GitHub-dark palette for the app's HTML UI (panels, pages, chrome).
// Section themes (market/theme.ts, power/theme.ts) re-export these tokens and
// add their own accents; new components should import from here instead of
// hardcoding hex values. The PixiJS room/map renderer keeps its own palette in
// renderer/colors.ts.
export const BG = '#0d1117'            // page background
export const PANEL = '#161b22'         // panel / card background
export const PANEL_RAISED = '#1c2128'  // raised panel (hover rows, nested cards)
export const BTN = '#21262d'           // button fill / progress track
export const BORDER = '#30363d'        // hairline borders
export const TEXT = '#c9d1d9'          // primary text
export const MUTED = '#8b949e'         // secondary text
export const DIM = '#484f58'           // tertiary text / disabled
export const ACCENT = '#58a6ff'        // links, focus, progress
export const GREEN = '#238636'         // primary action buttons
export const GREEN_FG = '#3fb950'      // positive values / healthy
export const AMBER = '#e3b341'         // warnings / mid health
export const RED = '#f85149'           // errors / negative values / critical
