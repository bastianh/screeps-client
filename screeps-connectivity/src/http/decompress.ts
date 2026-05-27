async function decompress(data: string, format: 'gzip' | 'deflate'): Promise<unknown> {
  const b64 = data.slice(3) // strip 'gz:' or 'zlib:' prefix
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const decompressed = new Blob([binary]).stream().pipeThrough(new DecompressionStream(format))
  const text = await new Response(decompressed).text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function decompressGzip(data: string): Promise<unknown> {
  return decompress(data, 'gzip')
}

export function decompressZlib(data: string): Promise<unknown> {
  return decompress(data, 'deflate')
}
