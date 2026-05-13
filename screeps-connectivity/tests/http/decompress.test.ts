import { describe, it, expect } from 'vitest'
import { createGzip, createDeflate } from 'node:zlib'
import { promisify } from 'node:util'
import { pipeline } from 'node:stream'
import { Readable } from 'node:stream'
import { decompressGzip, decompressZlib } from '../../src/http/decompress.js'

const pipelineAsync = promisify(pipeline)

async function gzipEncode(json: unknown): Promise<string> {
  const input = Buffer.from(JSON.stringify(json))
  const chunks: Buffer[] = []
  const gz = createGzip()
  await pipelineAsync(Readable.from(input), gz, async function*(source) {
    for await (const chunk of source) {
      chunks.push(chunk as Buffer)
      yield chunk
    }
  })
  return 'gz:' + Buffer.concat(chunks).toString('base64')
}

async function zlibEncode(json: unknown): Promise<string> {
  const input = Buffer.from(JSON.stringify(json))
  const chunks: Buffer[] = []
  const def = createDeflate()
  await pipelineAsync(Readable.from(input), def, async function*(source) {
    for await (const chunk of source) {
      chunks.push(chunk as Buffer)
      yield chunk
    }
  })
  return 'gz:' + Buffer.concat(chunks).toString('base64')
}

describe('decompressGzip', () => {
  it('decompresses a gzip-encoded gz: string', async () => {
    const payload = { message: 'hello', value: 42 }
    const encoded = await gzipEncode(payload)
    const result = await decompressGzip(encoded)
    expect(result).toEqual(payload)
  })
})

describe('decompressZlib', () => {
  it('decompresses a zlib-encoded gz: string', async () => {
    const payload = [{ channel: 'user:x/cpu', data: { cpu: 10 } }]
    const encoded = await zlibEncode(payload)
    const result = await decompressZlib(encoded)
    expect(result).toEqual(payload)
  })
})
