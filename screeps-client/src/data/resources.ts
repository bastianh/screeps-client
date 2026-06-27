import { RESOURCE_COLORS, DEPOSIT_COLORS, ST_RESOURCE_OTHER, ST_ENERGY } from '~/renderer/colors.js'

// Display names for every market-tradeable resource type, keyed by the canonical
// Screeps RESOURCE_* code. Order matches the in-game market resource list (the
// subscription token first, then base minerals, compounds, boosts, ops, raw
// deposits, factory products, and the four commodity chains).
export const RESOURCE_NAMES: Record<string, string> = {
  token: 'subscription token',
  energy: 'energy',
  power: 'power',
  H: 'hydrogen',
  O: 'oxygen',
  U: 'utrium',
  L: 'lemergium',
  K: 'keanium',
  Z: 'zynthium',
  X: 'catalyst',
  OH: 'hydroxide',
  ZK: 'zynthium keanite',
  UL: 'utrium lemergite',
  G: 'ghodium',
  UH: 'utrium hydride',
  UO: 'utrium oxide',
  KH: 'keanium hydride',
  KO: 'keanium oxide',
  LH: 'lemergium hydride',
  LO: 'lemergium oxide',
  ZH: 'zynthium hydride',
  ZO: 'zynthium oxide',
  GH: 'ghodium hydride',
  GO: 'ghodium oxide',
  UH2O: 'utrium acid',
  UHO2: 'utrium alkalide',
  KH2O: 'keanium acid',
  KHO2: 'keanium alkalide',
  LH2O: 'lemergium acid',
  LHO2: 'lemergium alkalide',
  ZH2O: 'zynthium acid',
  ZHO2: 'zynthium alkalide',
  GH2O: 'ghodium acid',
  GHO2: 'ghodium alkalide',
  XUH2O: 'catalyzed utrium acid',
  XUHO2: 'catalyzed utrium alkalide',
  XKH2O: 'catalyzed keanium acid',
  XKHO2: 'catalyzed keanium alkalide',
  XLH2O: 'catalyzed lemergium acid',
  XLHO2: 'catalyzed lemergium alkalide',
  XZH2O: 'catalyzed zynthium acid',
  XZHO2: 'catalyzed zynthium alkalide',
  XGH2O: 'catalyzed ghodium acid',
  XGHO2: 'catalyzed ghodium alkalide',
  ops: 'ops',
  silicon: 'silicon',
  metal: 'metal',
  biomass: 'biomass',
  mist: 'mist',
  utrium_bar: 'utrium bar',
  lemergium_bar: 'lemergium bar',
  zynthium_bar: 'zynthium bar',
  keanium_bar: 'keanium bar',
  ghodium_melt: 'ghodium melt',
  oxidant: 'oxidant',
  reductant: 'reductant',
  purifier: 'purifier',
  battery: 'battery',
  composite: 'composite',
  crystal: 'crystal',
  liquid: 'liquid',
  wire: 'wire',
  switch: 'switch',
  transistor: 'transistor',
  microchip: 'microchip',
  circuit: 'circuit',
  device: 'device',
  cell: 'cell',
  phlegm: 'phlegm',
  tissue: 'tissue',
  muscle: 'muscle',
  organoid: 'organoid',
  organism: 'organism',
  alloy: 'alloy',
  tube: 'tube',
  fixtures: 'fixtures',
  frame: 'frame',
  hydraulics: 'hydraulics',
  machine: 'machine',
  condensate: 'condensate',
  concentrate: 'concentrate',
  extract: 'extract',
  spirit: 'spirit',
  emanation: 'emanation',
  essence: 'essence',
}

// Ordered list of resource codes shown on the market all-orders index.
export const MARKET_RESOURCES: string[] = Object.keys(RESOURCE_NAMES)

export function resourceDisplayName(code: string): string {
  return RESOURCE_NAMES[code] ?? code
}

// Manufactured commodity chains, each rooted at a raw deposit type. Members
// inherit the deposit's hue so a production line reads as one family, consistent
// with the in-room deposit discs.
const COMMODITY_CHAINS: Record<string, string[]> = {
  metal: ['wire', 'switch', 'transistor', 'microchip', 'circuit', 'device'],
  biomass: ['cell', 'phlegm', 'tissue', 'muscle', 'organoid', 'organism'],
  silicon: ['alloy', 'tube', 'fixtures', 'frame', 'hydraulics', 'machine'],
  mist: ['condensate', 'concentrate', 'extract', 'spirit', 'emanation', 'essence'],
}

// Compressed-mineral bars and energy-condensate factory products, tinted by their
// source mineral (or energy) so a bar reads like the mineral it came from.
const PRODUCT_BASE: Record<string, string> = {
  utrium_bar: 'U',
  lemergium_bar: 'L',
  zynthium_bar: 'Z',
  keanium_bar: 'K',
  ghodium_melt: 'G',
  oxidant: 'O',
  reductant: 'H',
  purifier: 'X',
  battery: 'energy',
}

// Distinct hues for the non-mineral specials. ops is the power-creep operator
// resource; token is the premium CPU-subscription item.
const SPECIAL_COLORS: Record<string, number> = {
  ops: 0xd9843b,
  token: 0xf2c94c,
}

// Flat resourceType -> swatch colour, computed once at module load.
const SWATCH_COLORS: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  for (const deposit in COMMODITY_CHAINS)
    for (const code of COMMODITY_CHAINS[deposit]) map[code] = DEPOSIT_COLORS[deposit]
  for (const code in PRODUCT_BASE) {
    const base = PRODUCT_BASE[code]
    map[code] = base === 'energy' ? ST_ENERGY : RESOURCE_COLORS[base]
  }
  return { ...map, ...SPECIAL_COLORS }
})()

// Swatch colour for any tradeable resource, falling back through: base minerals
// and energy/power, raw deposits, commodities/products/specials, then mineral
// compounds and boosts tinted by their lead mineral (catalyst prefix stripped).
export function resourceColor(code: string): number {
  if (RESOURCE_COLORS[code] != null) return RESOURCE_COLORS[code]
  if (DEPOSIT_COLORS[code] != null) return DEPOSIT_COLORS[code]
  if (SWATCH_COLORS[code] != null) return SWATCH_COLORS[code]
  const base = code.startsWith('X') ? code.slice(1) : code
  const lead = base[0]
  if (RESOURCE_COLORS[lead] != null) return RESOURCE_COLORS[lead]
  return ST_RESOURCE_OTHER
}
