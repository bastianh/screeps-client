// Market section theme: the central GitHub-dark tokens plus market accents.
// (PANEL_ALT historically was #1c2129 — one digit off the shared raised-panel
// tone; unified on the central value.)
import { GREEN_FG, PANEL_RAISED, RED } from '~/components/theme.js'

export { BG, PANEL, BORDER, TEXT, MUTED, ACCENT } from '~/components/theme.js'
export { fmtAmount, fmtPrice } from '~/utils/formatNumber.js'

export const PANEL_ALT = PANEL_RAISED
export const POS = GREEN_FG // sell side / positive credit change
export const NEG = RED      // buy side / negative credit change
