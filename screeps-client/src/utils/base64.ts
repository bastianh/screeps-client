// Base64 helpers for binary code modules (the server carries WASM payloads as
// base64 strings inside the JSON module map).

// Chunked so large modules don't blow the argument limit of String.fromCharCode.
const CHUNK = 0x8000

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Decoded byte size of a base64 string, without decoding it. */
export function base64ByteSize(b64: string): number {
  if (!b64) return 0
  let padding = 0
  if (b64.endsWith('==')) padding = 2
  else if (b64.endsWith('=')) padding = 1
  return (b64.length / 4) * 3 - padding
}

/** Human-readable size, e.g. `348 B`, `12.4 KB`, `1.2 MB`. */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
