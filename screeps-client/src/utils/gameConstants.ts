// Per-RCL structure allowance (vanilla CONTROLLER_STRUCTURES). Level 0 entries are
// significant: a type capped at 0 there is only ever active in a room whose controller
// is owned and at least level 1 — see computeDisabledIds().
export const CONTROLLER_STRUCTURES: Record<string, Record<number, number>> = {
  spawn: { 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3 },
  extension: { 0: 0, 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
  link: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6 },
  road: { 0: 2500, 1: 2500, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  constructedWall: { 0: 0, 1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  rampart: { 0: 0, 1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  storage: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
  tower: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6 },
  observer: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
  powerSpawn: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
  extractor: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
  terminal: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
  lab: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10 },
  container: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5 },
  nuker: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
  factory: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1 },
}

export const CONTROLLER_LEVEL_TOTAL: Record<number, number> = {
  1: 200,
  2: 45_000,
  3: 135_000,
  4: 405_000,
  5: 1_215_000,
  6: 3_645_000,
  7: 10_935_000,
}

export const CONTROLLER_DOWNGRADE: Record<number, number> = {
  1: 20000,
  2: 10000,
  3: 20000,
  4: 40000,
  5: 80000,
  6: 120000,
  7: 150000,
  8: 200000,
}

export const EXTENSION_ENERGY_CAPACITY: Record<number, number> = {
  0: 50,
  1: 50,
  2: 50,
  3: 50,
  4: 50,
  5: 50,
  6: 50,
  7: 100,
  8: 200,
}
