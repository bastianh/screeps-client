import type { HttpClient } from '../HttpClient.js'

export interface AuthStrategy {
  authenticate(http: HttpClient): Promise<string>
  /** False means the token is static and must never be replaced by server-issued tokens. Default: true. */
  readonly supportsTokenRefresh?: boolean
}
