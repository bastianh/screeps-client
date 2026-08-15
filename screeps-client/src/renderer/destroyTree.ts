import { Container, Graphics } from 'pixi.js'

/**
 * Graphics drawn on a `GraphicsContext` that outlives them — the shared invader skull, the
 * terrain shape cache. Their context belongs to whoever built it and is still in use by
 * other instances, so tearing the graphic down must leave it alone.
 */
const sharedContext = new WeakSet<Graphics>()

/** Register a Graphics built on a context it does not own. See {@link destroyTree}. */
export function markSharedContext<T extends Graphics>(graphics: T): T {
  sharedContext.add(graphics)
  return graphics
}

/**
 * Tear down a display subtree, freeing each Graphics' own `GraphicsContext`.
 *
 * `container.destroy({ children: true })` looks like it does this and doesn't. PixiJS frees
 * a Graphics' own context only for the bare `destroy()` and for `{ context: true }` — the
 * object form without that flag drops the reference and leaves the context registered with
 * the renderer, holding its instruction list and its tessellated vertex/index buffers until
 * the 60-second resource GC gets to it. A room's worth of object visuals is thousands of
 * contexts, so switching rooms faster than that grows without bound; the memory only comes
 * back when the renderer itself is destroyed, i.e. when the room view unmounts.
 *
 * `{ context: true }` alone is not the fix either: it would also free the contexts that are
 * deliberately shared, blanking every other user of them. Hence the walk, and the
 * {@link markSharedContext} opt-out for the shapes that are borrowed rather than owned.
 *
 * Filters go the same way, for the same reason: every filter in the room view is built for
 * the node it hangs on (a rampart glow, a swamp wash, a wall shadow) and none is shared.
 *
 * Textures are never touched — visuals draw from shared atlases, cached badges and the
 * shared glow, all of which outlive any one object.
 */
export function destroyTree(node: Container): void {
  if (node.destroyed) return
  for (const child of node.removeChildren()) destroyTree(child)
  const filters = node.filters
  if (filters) {
    node.filters = null
    for (const filter of filters) filter.destroy()
  }
  if (node instanceof Graphics) {
    // `undefined` is the one form that leaves a borrowed context alone: PixiJS only frees
    // the context it created itself on that path, and a borrowed one was never owned.
    node.destroy(sharedContext.has(node) ? undefined : { context: true })
    return
  }
  node.destroy()
}
