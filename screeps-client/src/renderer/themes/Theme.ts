export interface SpriteLayer {
  frame: string
  tint?: 'owner' | 'neutral'  // 'owner' = green/red by ownership; absent or 'neutral' = no tint
}

export interface SpriteSpec {
  layers: SpriteLayer[]
  tileScale: number  // 1.0 = one tile; >1.0 = overhang (future)
  zIndex?: number   // added to the type's base zIndex tier
}

export interface ControllerSpec {
  backgroundFrame: string
  segmentFrame: string
  tileScale: number
  zIndex?: number
}

export interface FlagSpec {
  mainFrame: string
  secondFrame: string
  tileScale: number
  zIndex?: number
}

export interface TombstoneSpec {
  shellFrame: string
  crossFrame: string
  tileScale: number
  zIndex?: number
}

// Deposits render two stacked layers per commodity type, by convention:
// `deposit/<depositType>/shape` and `deposit/<depositType>/fill`
// (depositType ∈ biomass | metal | mist | silicon).
export interface DepositSpec {
  tileScale: number
  zIndex?: number
}

// Minerals render a single sprite per type, by convention: `mineral/<type>`
// (type ∈ H | O | U | L | K | Z | X).
export interface MineralSpec {
  tileScale: number
  zIndex?: number
}

// Towers render layered atlas sprites: a static `ring` (tinted by ownership) and
// a rotating `body` (the cannon). The energy fill is NOT an atlas frame — it's a
// procedural rounded rect scaled by energy/capacity (see `fill`). All layers must
// be authored on a common canvas (same TexturePacker sourceSize) so anchoring at
// the center overlays them; `fill` coords are in that same atlas-pixel space,
// relative to the tower center, and are scaled to screen by the body's render scale.
export interface TowerFillGeometry {
  x: number          // left edge in atlas px (relative to center)
  yMin: number       // top edge at full fill in atlas px
  width: number
  heightMax: number  // fill height at energy === capacity
  rx: number         // corner radius x
  ry: number         // corner radius y
}

export interface TowerSpec {
  ringFrame: string  // tinted by ownership
  bodyFrame: string  // rotating cannon
  tileScale: number
  zIndex?: number
  fill: TowerFillGeometry
}

export interface Theme {
  id: string
  name: string
  atlasUrl: string
  sprites: Partial<Record<string, SpriteSpec>>
  controller?: ControllerSpec
  flag?: FlagSpec
  tombstone?: TombstoneSpec
  deposit?: DepositSpec
  mineral?: MineralSpec
  tower?: TowerSpec
}
