import type { HttpClient } from '../HttpClient.js'

export interface ExperimentalEndpoints {
  pvp(interval?: number): Promise<unknown>
  nukes(): Promise<unknown>
}

export function createExperimentalEndpoints(http: HttpClient): ExperimentalEndpoints {
  return {
    pvp: (interval = 100) => http.request('GET', '/api/experimental/pvp', { interval }),
    nukes: () => http.request('GET', '/api/experimental/nukes'),
  }
}
