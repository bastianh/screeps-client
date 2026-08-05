import { describe, it, expect } from 'vitest'
import {
  parseServerModules,
  serializeModules,
  tsModuleNames,
  displayName,
  type LogicalModule,
} from './codeModules.js'

describe('parseServerModules', () => {
  it('treats extension-less keys as JS modules', () => {
    const mods = parseServerModules({ main: 'a', utils: 'b' })
    expect(mods).toEqual([
      { name: 'main', lang: 'js', source: 'a' },
      { name: 'utils', lang: 'js', source: 'b' },
    ])
  })

  it('folds a compiled artifact into its .ts source and hides it', () => {
    const mods = parseServerModules({
      main: 'compiled js',
      'main.ts': 'const x: number = 1',
    })
    expect(mods).toEqual([{ name: 'main', lang: 'ts', source: 'const x: number = 1' }])
  })

  it('handles a mixed branch of JS and TS modules', () => {
    const mods = parseServerModules({
      main: 'compiled-main',
      'main.ts': 'ts-main',
      utils: 'plain-js',
    })
    expect(mods).toEqual([
      { name: 'main', lang: 'ts', source: 'ts-main' },
      { name: 'utils', lang: 'js', source: 'plain-js' },
    ])
  })

  it('surfaces a TS source with no compiled sibling', () => {
    const mods = parseServerModules({ 'roles.ts': 'ts-only' })
    expect(mods).toEqual([{ name: 'roles', lang: 'ts', source: 'ts-only' }])
  })

  it('preserves runnable key order with main first', () => {
    const mods = parseServerModules({ main: 'm', a: '1', b: '2' })
    expect(mods.map((m) => m.name)).toEqual(['main', 'a', 'b'])
  })

  it('surfaces a { binary } value as a wasm module', () => {
    const mods = parseServerModules({ main: 'js', algo: { binary: 'AGFzbQ==' } })
    expect(mods).toEqual([
      { name: 'main', lang: 'js', source: 'js' },
      { name: 'algo', lang: 'wasm', source: 'AGFzbQ==' },
    ])
  })

  it('keeps a wasm module in key order alongside TS modules', () => {
    const mods = parseServerModules({
      main: 'compiled',
      'main.ts': 'ts-src',
      algo: { binary: 'AAAA' },
    })
    expect(mods).toEqual([
      { name: 'main', lang: 'ts', source: 'ts-src' },
      { name: 'algo', lang: 'wasm', source: 'AAAA' },
    ])
  })
})

describe('serializeModules', () => {
  it('writes JS modules straight to their key', () => {
    const mods: LogicalModule[] = [{ name: 'main', lang: 'js', source: 'code' }]
    expect(serializeModules(mods, {})).toEqual({ main: 'code' })
  })

  it('writes both compiled JS and .ts source for TS modules', () => {
    const mods: LogicalModule[] = [{ name: 'main', lang: 'ts', source: 'ts src' }]
    expect(serializeModules(mods, { main: 'js out' })).toEqual({
      main: 'js out',
      'main.ts': 'ts src',
    })
  })

  it('throws when a TS module has no compiled output', () => {
    const mods: LogicalModule[] = [{ name: 'main', lang: 'ts', source: 'ts src' }]
    expect(() => serializeModules(mods, {})).toThrow(/missing compiled output/)
  })

  it('round-trips a mixed branch through parse -> serialize', () => {
    const server = {
      main: 'compiled-main',
      'main.ts': 'ts-main',
      utils: 'plain-js',
    }
    const mods = parseServerModules(server)
    // Simulate transpile producing the same compiled output.
    const compiled = { main: 'compiled-main' }
    expect(serializeModules(mods, compiled)).toEqual(server)
  })

  it('drops a deleted module (and its .ts sibling) by omission', () => {
    const server = { main: 'm', 'main.ts': 'ts', utils: 'u' }
    const mods = parseServerModules(server).filter((m) => m.name !== 'utils')
    expect(serializeModules(mods, { main: 'm' })).toEqual({ main: 'm', 'main.ts': 'ts' })
  })

  it('writes wasm modules as { binary } values', () => {
    const mods: LogicalModule[] = [
      { name: 'main', lang: 'js', source: 'code' },
      { name: 'algo', lang: 'wasm', source: 'AGFzbQ==' },
    ]
    expect(serializeModules(mods, {})).toEqual({
      main: 'code',
      algo: { binary: 'AGFzbQ==' },
    })
  })

  it('round-trips a branch containing a wasm module', () => {
    const server = { main: 'm', algo: { binary: 'AAAA' } }
    const mods = parseServerModules(server)
    expect(serializeModules(mods, {})).toEqual(server)
  })
})

describe('helpers', () => {
  it('tsModuleNames lists only TS modules', () => {
    const mods: LogicalModule[] = [
      { name: 'main', lang: 'ts', source: '' },
      { name: 'utils', lang: 'js', source: '' },
      { name: 'roles', lang: 'ts', source: '' },
    ]
    expect(tsModuleNames(mods)).toEqual(['main', 'roles'])
  })

  it('displayName appends the language extension', () => {
    expect(displayName({ name: 'main', lang: 'ts', source: '' })).toBe('main.ts')
    expect(displayName({ name: 'utils', lang: 'js', source: '' })).toBe('utils.js')
  })
})
