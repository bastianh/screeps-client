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

export interface Theme {
  id: string
  name: string
  atlasUrl: string
  sprites: Partial<Record<string, SpriteSpec>>
  controller?: ControllerSpec
  flag?: FlagSpec
  tombstone?: TombstoneSpec
  deposit?: DepositSpec
}
