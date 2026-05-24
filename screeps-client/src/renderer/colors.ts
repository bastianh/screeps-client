// ── Backgrounds ────────────────────────────────────────────────────────────
export const BG_DEEP    = 0x0d1117  // wall tiles, creep body center
export const BG_DARK    = 0x161b22  // creep inner ring, extension bg
export const BG_MEDIUM  = 0x1c2128  // creep ring: empty body-part slots
export const BG_SURFACE = 0x34343B  // terrain plain

// ── Terrain ────────────────────────────────────────────────────────────────
export const TERRAIN_PLAIN  = BG_SURFACE
export const TERRAIN_WALL   = BG_DEEP            // void background (outside-room areas)
export const TERRAIN_SWAMP  = 0x334933           // legacy export, no longer used for in-room rendering
export const TERRAIN_ROAD   = 0x6B6969           // also used for room exits
export const TERRAIN_BORDER = 0x30363d

// In-room terrain fill + outer border (border drawn with stroke alignment=0 / outside)
export const TERRAIN_WALL_FILL    = 0x181818
export const TERRAIN_WALL_BORDER  = 0x000000
export const TERRAIN_WALL_NOISE   = 0x282828  // lighter grey for noise overlay on walls
export const TERRAIN_SWAMP_FILL   = 0x282D1A
export const TERRAIN_SWAMP_BORDER = 0x26271F
export const TERRAIN_SWAMP_GLOW   = 0x2A4A20  // saturated green for atmospheric blur

// ── Body parts ─────────────────────────────────────────────────────────────
export const BP_TOUGH         = 0x4c4c4c
export const BP_MOVE          = 0xa9b7c6
export const BP_WORK          = 0xffe56d
export const BP_CARRY         = 0x777777
export const BP_ATTACK        = 0xf93842
export const BP_RANGED_ATTACK = 0x5d80b2
export const BP_HEAL          = 0x65fd62
export const BP_CLAIM         = 0xb99cfb
export const BODY_PART_COLORS: Record<string, number> = {
  tough:         BP_TOUGH,
  move:          BP_MOVE,
  work:          BP_WORK,
  carry:         BP_CARRY,
  attack:        BP_ATTACK,
  ranged_attack: BP_RANGED_ATTACK,
  heal:          BP_HEAL,
  claim:         BP_CLAIM,
}

// ── Structures & objects ───────────────────────────────────────────────────
export const OBJ_BLUE   = 0x58a6ff  // spawn, rampart, controller
export const OBJ_CYAN   = 0x79c0ff  // extension, observer, mineral
export const OBJ_GREEN  = 0x3fb950  // tower
export const OBJ_GREY   = 0x8b949e  // container, extractor, factory
export const OBJ_GOLD   = 0xd29922  // storage, terminal, source, deposit
export const OBJ_PURPLE = 0xa371f7  // link, portal
export const OBJ_PINK   = 0xf778ba  // lab
export const OBJ_RED    = 0xf85149  // nuker, invaderCore
export const OBJ_ORANGE = 0xf0883e  // creep fallback, powerSpawn, powerBank
export const OBJ_WALL   = 0x21262d
export const OBJ_ROAD   = TERRAIN_ROAD
export const OBJ_DEFAULT = 0xc9d1d9  // unknown type fallback

// Unified foreign-owner indicator color: replaces ST_OUTLINE on foreign structures,
// and is used for the creep ring/label of foreign creeps. Matches CS_FOREIGN.
export const OBJ_FOREIGN = 0xBB6E6E

// ── Flag colors (Screeps canonical) ───────────────────────────────────────
export const FLAG_COLORS: number[] = [
  0xffffff, // 0 white (fallback/default)
  0xff0000, // 1 red
  0x800080, // 2 purple
  0x0000ff, // 3 blue
  0x00ffff, // 4 cyan
  0x008000, // 5 green
  0xffff00, // 6 yellow
  0xffa500, // 7 orange
  0xa52a2a, // 8 brown
  0x808080, // 9 grey
  0xffffff, // 10 white
]

export const OBJECT_COLORS: Record<string, number> = {
  creep:       OBJ_ORANGE,
  spawn:       OBJ_BLUE,
  extension:   OBJ_CYAN,
  tower:       OBJ_GREEN,
  container:   OBJ_GREY,
  storage:     OBJ_GOLD,
  link:        OBJ_PURPLE,
  rampart:     OBJ_BLUE,
  road:        OBJ_ROAD,
  wall:        OBJ_WALL,
  extractor:   OBJ_GREY,
  lab:         OBJ_PINK,
  terminal:    OBJ_GOLD,
  observer:    OBJ_CYAN,
  powerSpawn:  OBJ_ORANGE,
  nuker:       OBJ_RED,
  factory:     OBJ_GREY,
  invaderCore: OBJ_RED,
  source:      OBJ_GOLD,
  mineral:     OBJ_CYAN,
  deposit:     OBJ_GOLD,
  controller:  OBJ_BLUE,
  powerBank:   OBJ_ORANGE,
  portal:      OBJ_PURPLE,
}

// ── Resources ──────────────────────────────────────────────────────────────
export const ENERGY_FILL = 0xFFE87B  // extension fill, source, dropped energy, harvest beam (same as ST_ENERGY)

// ── Animations ─────────────────────────────────────────────────────────────
export const ANIM_HARVEST = ENERGY_FILL
export const ANIM_UPGRADE = OBJ_CYAN
export const ANIM_BUILD   = ENERGY_FILL

// ── Construction sites ────────────────────────────────────────────────────
// Base (used for the static pie fill); the ring pulses between *_DARK and *_LIGHT.
export const CS_OWN          = 0x8FBB93  // own construction site (muted green)
export const CS_OWN_DARK     = 0x6E8F72
export const CS_OWN_LIGHT    = 0xB8E3BC
export const CS_FOREIGN      = 0xBB6E6E  // foreign construction site (muted red)
export const CS_FOREIGN_DARK = 0x955858
export const CS_FOREIGN_LIGHT = 0xE0A0A0

// ── Creep rendering ────────────────────────────────────────────────────────
export const CREEP_RING_DARK = BG_MEDIUM
export const CREEP_NOTCH     = 0xd0d0d0

// ── Screeps canonical structure palette ────────────────────────────────────
export const ST_DARK           = 0x181818  // structure dark background
export const ST_GRAY           = 0x555555  // structure gray fill
export const ST_LIGHT          = 0xAAAAAA  // structure light elements
export const ST_OUTLINE        = 0x8FBB93  // structure green outline
export const ST_ENERGY         = 0xFFE87B  // energy (structure displays)
export const ST_POWER          = 0xF53547  // power red
export const ST_RAMPART        = 0x434C43  // rampart fill
export const ST_RAMPART_STROKE = 0x5D735F  // rampart border
