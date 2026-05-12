import type { HttpClient } from '../HttpClient.js'
import type { ApiAuthSigninResponse, ApiAuthMeResponse, ApiAuthQueryTokenResponse } from '../../types/api.js'

export interface AuthEndpoints {
  signin(email: string, password: string): Promise<ApiAuthSigninResponse>
  me(): Promise<ApiAuthMeResponse>
  queryToken(token: string): Promise<ApiAuthQueryTokenResponse>
}

export function createAuthEndpoints(http: HttpClient): AuthEndpoints {
  return {
    signin: (email, password) => http.request('POST', '/api/auth/signin', { email, password }),
    me: () => http.request('GET', '/api/auth/me'),
    queryToken: (token) => http.request('GET', '/api/auth/query-token', { token }),
  }
}
