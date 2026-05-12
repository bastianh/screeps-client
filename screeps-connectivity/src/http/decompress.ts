async function decompress(data: string, format: 'gzip' | 'deflate'): Promise<unknown> {
  const b64 = data.slice(3) // strip 'gz:' prefix
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const ds = new DecompressionStream(format)
  const writer = ds.writable.getWriter()
  await writer.write(binary)
  await writer.close()
  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
  } catch (e) {
    reader.cancel()
    throw e
  }
  let totalLength = 0
  for (const chunk of chunks) totalLength += chunk.length
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder().decode(result))
}

export function decompressGzip(data: string): Promise<unknown> {
  return decompress(data, 'gzip')
}

export function decompressZlib(data: string): Promise<unknown> {
  return decompress(data, 'deflate')
}
