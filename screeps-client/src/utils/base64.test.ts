import { describe, it, expect } from 'vitest'
import { bytesToBase64, base64ToBytes, base64ByteSize, formatByteSize } from './base64.js'

describe('base64', () => {
  it('round-trips bytes through encode -> decode', () => {
    const bytes = new Uint8Array([0, 0x61, 0x73, 0x6d, 255, 128, 1])
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })

  it('encodes the wasm magic header', () => {
    expect(bytesToBase64(new Uint8Array([0x00, 0x61, 0x73, 0x6d]))).toBe('AGFzbQ==')
  })

  it('handles payloads larger than one fromCharCode chunk', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 5)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })

  it('computes decoded size without decoding', () => {
    expect(base64ByteSize('')).toBe(0)
    expect(base64ByteSize('AGFzbQ==')).toBe(4)
    expect(base64ByteSize('AAAA')).toBe(3)
  })

  it('formats byte sizes', () => {
    expect(formatByteSize(348)).toBe('348 B')
    expect(formatByteSize(12 * 1024 + 512)).toBe('12.5 KB')
    expect(formatByteSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})
