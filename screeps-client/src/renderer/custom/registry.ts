/**
 * Holds the renderer metadata a private server published through
 * `/api/version` → `serverData.renderer`, for the room renderer to consult while
 * building objects.
 *
 * Plain module state rather than a store: the renderer runs outside the reactive
 * graph, and `customRendererRevision()` is what lets the layer notice a late
 * arrival (the metadata lands with the version fetch, typically after the first
 * room has already rendered).
 */
import type { RendererObjectMetadata, ServerRendererConfig } from 'screeps-connectivity'
import { setCustomResources } from './resources.js'

let metadata: Record<string, RendererObjectMetadata> = {}
let revision = 0

export function setCustomRendererConfig(config: ServerRendererConfig | undefined, serverBaseUrl: string): void {
  metadata = config?.metadata ?? {}
  setCustomResources(config?.resources, serverBaseUrl)
  revision += 1
}

export function customObjectMetadata(type: string): RendererObjectMetadata | undefined {
  return metadata[type]
}

export function hasCustomObjectMetadata(): boolean {
  return Object.keys(metadata).length > 0
}

/** Bumped on every config change, so callers can rebuild what they already drew. */
export function customRendererRevision(): number {
  return revision
}
