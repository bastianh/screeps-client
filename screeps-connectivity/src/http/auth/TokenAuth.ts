import type { AuthStrategy } from './AuthStrategy.js'
import type { HttpClient } from '../HttpClient.js'

export class TokenAuth implements AuthStrategy {
  readonly supportsTokenRefresh = false
  private readonly token: string

  constructor(opts: { token: string }) {
    this.token = opts.token
  }

  async authenticate(_http: HttpClient): Promise<string> {
    return this.token
  }
}
