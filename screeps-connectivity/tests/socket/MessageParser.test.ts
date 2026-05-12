import { describe, it, expect } from 'vitest'
import { parseMessage } from '../../src/socket/MessageParser.js'

describe('parseMessage', () => {
  it('parses auth ok with token', async () => {
    expect(await parseMessage('auth ok abc123')).toEqual({
      kind: 'server',
      command: { type: 'auth', status: 'ok', token: 'abc123' },
    })
  })

  it('parses auth failed', async () => {
    expect(await parseMessage('auth failed')).toEqual({
      kind: 'server',
      command: { type: 'auth', status: 'failed', token: undefined },
    })
  })

  it('parses time command', async () => {
    expect(await parseMessage('time 99999')).toEqual({
      kind: 'server',
      command: { type: 'time', time: 99999 },
    })
  })

  it('parses protocol command', async () => {
    expect(await parseMessage('protocol 13')).toEqual({
      kind: 'server',
      command: { type: 'protocol', protocol: 13 },
    })
  })

  it('parses package command', async () => {
    expect(await parseMessage('package 42')).toEqual({
      kind: 'server',
      command: { type: 'package', package: 42 },
    })
  })

  it('parses JSON array channel message', async () => {
    const raw = JSON.stringify(['user:uid123/cpu', { cpu: 30, memory: 1024 }])
    expect(await parseMessage(raw)).toEqual({
      kind: 'channel',
      message: { channel: 'user:uid123/cpu', data: { cpu: 30, memory: 1024 } },
    })
  })

  it('accepts MessageEvent (browser WS format)', async () => {
    const event = { data: 'time 500' } as MessageEvent
    expect(await parseMessage(event)).toEqual({
      kind: 'server',
      command: { type: 'time', time: 500 },
    })
  })
})
