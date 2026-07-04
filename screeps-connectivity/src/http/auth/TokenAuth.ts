import type { AuthStrategy } from './AuthStrategy.js'
import type { HttpClient } from '../HttpClient.js'

export class TokenAuth implements AuthStrategy {
  readonly supportsTokenRefresh: boolean
  private readonly token: string

  /**
   * @param opts.supportsTokenRefresh Set true when the token is a rotating,
   *   TTL-limited session token (e.g. obtained from a screepsmod-auth steam/password
   *   exchange) so the client adopts the server-issued `X-Token` and the session
   *   stays alive. Leave false (default) for a durable personal API token, which
   *   must never be replaced by a server-issued token.
   */
  constructor(opts: { token: string; supportsTokenRefresh?: boolean }) {
    this.token = opts.token
    this.supportsTokenRefresh = opts.supportsTokenRefresh ?? false
  }

  async authenticate(_http: HttpClient): Promise<string> {
    return this.token
  }
}
