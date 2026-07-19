// Shared lookup tables and key-value grid styles for the selection panel.

// Mirror the palette from ObjectLayer so colors match
export const OBJECT_COLORS: Record<string, string> = {
  creep:       '#f0883e',
  spawn:       '#58a6ff',
  extension:   '#79c0ff',
  tower:       '#3fb950',
  container:   '#8b949e',
  storage:     '#d29922',
  link:        '#a371f7',
  rampart:     '#58a6ff',
  road:        '#484f58',
  wall:        '#21262d',
  extractor:   '#8b949e',
  lab:         '#f778ba',
  terminal:    '#d29922',
  observer:    '#79c0ff',
  powerSpawn:  '#f0883e',
  nuker:       '#f85149',
  factory:     '#8b949e',
  invaderCore: '#f85149',
  source:      '#d29922',
  mineral:     '#79c0ff',
  deposit:     '#d29922',
  controller:  '#58a6ff',
  powerBank:   '#f0883e',
  portal:      '#a371f7',
  keeperLair:  '#f85149',
  energy:      '#d29922',
}

export const TYPE_LABELS: Record<string, string> = {
  creep:       'Creep',
  spawn:       'Spawn',
  extension:   'Extension',
  tower:       'Tower',
  container:   'Container',
  storage:     'Storage',
  link:        'Link',
  rampart:     'Rampart',
  road:        'Road',
  wall:        'Wall',
  extractor:   'Extractor',
  lab:         'Lab',
  terminal:    'Terminal',
  observer:    'Observer',
  powerSpawn:  'Power Spawn',
  nuker:       'Nuker',
  factory:     'Factory',
  invaderCore: 'Invader Core',
  source:      'Source',
  mineral:     'Mineral',
  deposit:     'Deposit',
  controller:  'Controller',
  powerBank:   'Power Bank',
  portal:      'Portal',
  keeperLair:  'Keeper Lair',
  energy:      'Energy',
  flag:        'Flag',
}

/** Fields we want to surface as key-value rows (exclude noisy / structural ones) */
export const SKIP_FIELDS = new Set(['x', 'y', 'type', 'id', 'name', 'user', '_id', 'room', 'hitsMax', 'energyCapacity', 'body', 'storeCapacity', 'storeCapacityResource', 'invaderHarvested', 'ticksToRegeneration'])
export const NUMERIC_FIELDS = new Set(['hits', 'energy', 'energyCapacity', 'store', 'progress', 'progressTotal', 'nextDecayTime', 'ticksToRegeneration', 'nextRegenerationTime'])

export const FIELD_LABELS: Record<string, string> = {
  hits:                 'Hits',
  energy:               'Energy',
  progress:             'Progress',
  progressTotal:        'Progress total',
  ticksToLive:          'Ticks to live',
  ticksToDecay:         'Ticks to decay',
  nextDecayTime:        'Decays in',
  nextRegenerationTime: 'Regens in',
  fatigue:              'Fatigue',
  cooldown:             'Cooldown',
  mineralType:          'Mineral type',
  mineralAmount:        'Mineral amount',
  density:              'Density',
  notifyWhenAttacked:   'Notify when attacked',
  isPublic:             'Public',
  structureType:        'Structure type',
  level:                'Level',
  power:                'Power',
  powerCapacity:        'Power capacity',
  depositType:          'Deposit type',
  lastCooldown:         'Last cooldown',
  resourceType:         'Resource type',
  amount:               'Amount',
  decay:                'Decay in',
  mode:                 'Mode',
  actionLog:            'Action log',
  store:                'Store',
}

export function camelToLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
}

export function formatValue(value: unknown): string | null {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return null
}

export const kvCell = (muted = false): Record<string, string> => ({
  padding: '3px 8px',
  background: '#0d1117',
  color: muted ? '#8b949e' : '#c9d1d9',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
})

export const kvGrid: Record<string, string> = {
  display: 'grid',
  'grid-template-columns': '1fr 1fr',
  gap: '1px',
  background: '#21262d',
  'font-size': '10px',
}
