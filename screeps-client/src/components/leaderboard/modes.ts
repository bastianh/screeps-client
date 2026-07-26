import type { LeaderboardMode } from '~/stores/routeStore.js'

// Per-table copy and accent, shared by the Leaderboard page and the rank tiles
// on the Overview/Profile pages so both name the same thing the same way.
// Wording follows the official client's lobby pages; the accents match the two
// score colours already used for the profile rank tiles (control = gold,
// power = red) rather than the generic status palette.
export interface LeaderboardModeInfo {
  mode: LeaderboardMode
  /** Page/tab title, e.g. "Expansion". */
  label: string
  /** What the score column counts, e.g. "Control points". */
  scoreLabel: string
  accent: string
  description: string
}

export const LEADERBOARD_MODES: readonly LeaderboardModeInfo[] = [
  {
    mode: 'world',
    label: 'Expansion',
    scoreLabel: 'Control points',
    accent: '#d9b54a',
    description: 'Players ranked by expansion over the month. You earn rating points for upgrading any of your controllers.',
  },
  {
    mode: 'power',
    label: 'Power',
    scoreLabel: 'Power points',
    accent: '#C54444',
    description: 'Players ranked by power gained over the month. You earn rating points for processing power in your power spawns.',
  },
]

export function modeInfo(mode: LeaderboardMode): LeaderboardModeInfo {
  return LEADERBOARD_MODES.find((m) => m.mode === mode) ?? LEADERBOARD_MODES[0]
}

// Season ids are 'YYYY-MM'. Servers label them ("July 2026") in /seasons, but
// private servers often return no seasons at all — then we derive the label.
export function seasonLabel(id: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(id)
  if (!m) return id
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
