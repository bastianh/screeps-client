// League of Automated Nations (LOAN) alliance roster.
//
// The feed is a plain JSON object keyed by alliance abbreviation, served with
// `Access-Control-Allow-Origin: *`, so the browser can fetch it directly. It
// describes the official MMO server only — on a private server the member names
// simply won't match anyone and the overlay stays empty.

import { createSignal } from 'solid-js'
import { createLogger } from '~/utils/log.js'
import { LS } from '~/utils/storage.js'

const { log, warn } = createLogger('alliances')

const ALLIANCES_URL = 'https://www.leagueofautomatednations.com/alliances.js'
const LOGO_BASE_URL = 'https://www.leagueofautomatednations.com/img/alliance/'

/** Serve from the local cache without a network round-trip for this long. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

export interface Alliance {
  abbreviation: string
  name: string
  members: string[]
  /** Rendering colour, derived locally — the feed ships `#000000` for every alliance. */
  color: number
  /** Absolute logo URL, or null when the alliance has no logo. */
  logoUrl: string | null
  discordUrl: string | null
}

export type AllianceStatus = 'idle' | 'loading' | 'ready' | 'error'

// Distinct hues that stay legible as a translucent tint over the map's dark terrain.
const PALETTE = [
  0xe6194b, 0x3cb44b, 0xffe119, 0x4363d8, 0xf58231,
  0xb14fe0, 0x46f0f0, 0xf032e6, 0xbcf60c, 0xff9aa2,
  0x2ad4a8, 0xd9b3ff, 0xc9762e, 0xffe9a8, 0xff6f61,
  0xaaffc3, 0xc0c000, 0xffd8b1, 0x6ea8ff, 0xbfc7d1,
]

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Stable colour per alliance: hash the abbreviation to a palette slot, then probe
 * forward while the slot is taken. Same roster in, same colours out — and an
 * alliance keeps its colour as long as nothing hashes into its slot ahead of it.
 */
function pickColor(abbreviation: string, used: Set<number>): number {
  const start = hashString(abbreviation) % PALETTE.length
  for (let i = 0; i < PALETTE.length; i++) {
    const idx = (start + i) % PALETTE.length
    if (!used.has(idx)) {
      used.add(idx)
      return PALETTE[idx]
    }
  }
  return PALETTE[start]
}

interface RawAlliance {
  abbreviation?: unknown
  name?: unknown
  members?: unknown
  logo?: unknown
  discord_url?: unknown
}

function parseAlliances(raw: unknown): Map<string, Alliance> {
  const out = new Map<string, Alliance>()
  if (!raw || typeof raw !== 'object') return out

  // Sorted so palette assignment is independent of the feed's key order.
  // Shape check rather than a key blocklist — "name" is a real alliance abbreviation.
  const entries = Object.entries(raw as Record<string, RawAlliance>)
    .filter(([, v]) => !!v && typeof v === 'object' && Array.isArray((v as RawAlliance).members))
    .sort(([a], [b]) => a.localeCompare(b))

  const used = new Set<number>()
  for (const [key, v] of entries) {
    const abbreviation = typeof v.abbreviation === 'string' && v.abbreviation ? v.abbreviation : key
    out.set(abbreviation, {
      abbreviation,
      name: typeof v.name === 'string' && v.name ? v.name : abbreviation,
      members: (v.members as unknown[]).filter((m): m is string => typeof m === 'string'),
      color: pickColor(abbreviation, used),
      logoUrl: typeof v.logo === 'string' && v.logo ? LOGO_BASE_URL + v.logo : null,
      discordUrl: typeof v.discord_url === 'string' && v.discord_url ? v.discord_url : null,
    })
  }
  return out
}

const [alliances, setAlliances] = createSignal<ReadonlyMap<string, Alliance>>(new Map())
const [allianceMembers, setAllianceMembers] = createSignal<ReadonlyMap<string, Alliance>>(new Map())
const [allianceStatus, setAllianceStatus] = createSignal<AllianceStatus>('idle')

// Owned rooms per alliance inside the current map viewport. Published by MapViewer
// (which owns the viewport and the room stats), read by the legend in MapInfoPanel.
// Keyed by abbreviation; alliances with nothing in view are absent.
const [allianceRoomCounts, setAllianceRoomCounts] =
  createSignal<ReadonlyMap<string, number>>(new Map())

export { alliances, allianceMembers, allianceStatus, allianceRoomCounts, setAllianceRoomCounts }

/** Returns `[allianceCount, memberCount]` so callers can log without reading the signals back. */
function apply(raw: unknown): [number, number] {
  const parsed = parseAlliances(raw)
  const byMember = new Map<string, Alliance>()
  for (const alliance of parsed.values()) {
    // Lower-cased keys: the feed's casing doesn't always match the server's.
    // First alliance wins if a player is somehow listed twice.
    for (const member of alliance.members) {
      const key = member.toLowerCase()
      if (!byMember.has(key)) byMember.set(key, alliance)
    }
  }
  setAlliances(parsed)
  setAllianceMembers(byMember)
  setAllianceStatus('ready')
  return [parsed.size, byMember.size]
}

interface CacheEntry {
  fetchedAt: number
  data: unknown
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LS.alliances)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    return typeof parsed?.fetchedAt === 'number' ? parsed : null
  } catch {
    return null
  }
}

let inflight: Promise<void> | null = null

/**
 * Fetch the roster, at most once per call site burst. Resolves immediately from a
 * fresh local cache; a stale cache is still used as a fallback when the network fails.
 */
export function loadAlliances(force = false): Promise<void> {
  if (inflight) return inflight
  if (!force && allianceStatus() === 'ready') return Promise.resolve()

  const cached = readCache()
  if (cached && !force && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    apply(cached.data)
    return Promise.resolve()
  }

  setAllianceStatus('loading')
  inflight = fetch(ALLIANCES_URL, { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then((data: unknown) => {
      try {
        localStorage.setItem(LS.alliances, JSON.stringify({ fetchedAt: Date.now(), data }))
      } catch {
        // Quota or private mode — the in-memory copy is still fine.
      }
      const [allianceCount, memberCount] = apply(data)
      log(`loaded ${allianceCount} alliances, ${memberCount} members`)
    })
    .catch((err) => {
      if (cached) {
        warn('fetch failed, falling back to cached roster:', err)
        apply(cached.data)
      } else {
        warn('fetch failed:', err)
        setAllianceStatus('error')
      }
    })
    .finally(() => { inflight = null })

  return inflight
}

/** `0xrrggbb` → `#rrggbb`, for CSS swatches next to the PixiJS-tinted rooms. */
export function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Reactive lookup — re-runs when the roster loads. */
export function allianceForUser(username: string | null | undefined): Alliance | null {
  if (!username) return null
  return allianceMembers().get(username.toLowerCase()) ?? null
}
