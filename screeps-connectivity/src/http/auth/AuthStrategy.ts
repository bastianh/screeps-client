import type { HttpClient } from '../HttpClient.js'

export interface AuthStrategy {
  authenticate(http: HttpClient): Promise<string>
}
