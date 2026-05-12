import type { AuthStrategy } from './AuthStrategy.js'
import type { HttpClient } from '../HttpClient.js'

export class PasswordAuth implements AuthStrategy {
  private readonly email: string
  private readonly password: string

  constructor(opts: { email: string; password: string }) {
    this.email = opts.email
    this.password = opts.password
  }

  async authenticate(http: HttpClient): Promise<string> {
    const res = await http.auth.signin(this.email, this.password)
    return res.token
  }
}
