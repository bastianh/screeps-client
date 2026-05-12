import { decompressZlib } from '../http/decompress.js'

export type ServerCommand =
  | { type: 'auth'; status: 'ok' | 'failed'; token: string | undefined }
  | { type: 'time'; time: number }
  | { type: 'protocol'; protocol: number }
  | { type: 'package'; package: number }

export interface ChannelMessage {
  channel: string
  data: unknown
}

export type ParsedMessage =
  | { kind: 'server'; command: ServerCommand }
  | { kind: 'channel'; message: ChannelMessage }

export async function parseMessage(raw: string | MessageEvent): Promise<ParsedMessage> {
  let msg = typeof raw === 'string' ? raw : (raw.data as string)

  if (msg.startsWith('gz:')) {
    msg = JSON.stringify(await decompressZlib(msg))
  }

  if (msg.startsWith('[')) {
    const [channel, data] = JSON.parse(msg) as [string, unknown]
    return { kind: 'channel', message: { channel, data } }
  }

  const [cmd, ...rest] = msg.split(' ')

  switch (cmd) {
    case 'auth':
      return { kind: 'server', command: { type: 'auth', status: rest[0] as 'ok' | 'failed', token: rest[1] } }
    case 'time':
      return { kind: 'server', command: { type: 'time', time: parseInt(rest[0], 10) } }
    case 'protocol':
      return { kind: 'server', command: { type: 'protocol', protocol: parseInt(rest[0], 10) } }
    case 'package':
      return { kind: 'server', command: { type: 'package', package: parseInt(rest[0], 10) } }
    default:
      throw new Error(`Unknown server command: ${cmd}`)
  }
}
