import { describe, it, expect } from 'vitest'
import { colorBrightness, multiply } from '../../src/renderer/hsl'

describe('hsl utils', () => {
  describe('colorBrightness()', () => {
    it('matches the reference renderer for values captured from live decorations', () => {
      expect(colorBrightness(0xf67bff, 0.98)).toBe(0xf573ff)
      expect(colorBrightness(0xe9a7ee, 0.41)).toBe(0x831b8b)
    })

    it('is a no-op at brightness 1', () => {
      expect(colorBrightness(0x1fe265, 1)).toBe(0x1fe265)
    })

    it('scales HSL lightness, not the RGB channels', () => {
      // An RGB multiply would clamp this back to pure red; HSL lightening desaturates.
      expect(colorBrightness(0xff0000, 1.5)).toBe(0xff8080)
    })

    it('handles achromatic colours', () => {
      expect(colorBrightness(0x000000, 2)).toBe(0x000000)
      expect(colorBrightness(0x808080, 0.5)).toBe(0x404040)
    })
  })

  describe('multiply()', () => {
    it('scales channels and clamps', () => {
      expect(multiply(0xff8040, 0.5)).toBe(0x804020)
      expect(multiply(0xff0000, 2)).toBe(0xff0000)
    })
  })
})
