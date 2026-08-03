import { Show, type JSX } from 'solid-js'
import { goToProfile } from '~/stores/routeStore.js'
import { isPopoutWindow } from '~/popout/protocol.js'

// NPC owners (Invader, Source Keeper) have no public profile and are never sent
// in the room `users` map; guard by name too in case a map-stats payload carries
// one through.
const NPC_USERNAMES = new Set(['Invader', 'Source Keeper'])

// A clickable player username that opens the public profile page, mirroring the
// vanilla client where every username links to `/profile/<name>`. Pass the
// *resolved* username: an NPC name renders as inert text, and when the username is
// absent the `fallback` (e.g. a raw id or "—") renders instead — so raw ids and
// NPC names never become dead links.
export function UserLink(props: {
  username: string | null | undefined
  fallback?: JSX.Element
  // Resting text colour, restored on mouse-leave; defaults to inheriting.
  color?: string
  // Extra styles merged onto the link (e.g. flex layout for badge + name).
  style?: JSX.CSSProperties
  // Overrides the rendered content (e.g. badge + name); defaults to the name.
  children?: JSX.Element
}) {
  // Popout windows have no routes — goToProfile would corrupt the popout URL.
  const linkable = () => !isPopoutWindow && !!props.username && !NPC_USERNAMES.has(props.username)
  return (
    <Show when={linkable()} fallback={<>{props.username ?? props.fallback}</>}>
      <span
        title="View user profile"
        onClick={(e) => {
          e.stopPropagation()
          goToProfile(props.username!)
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#58a6ff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = props.color ?? 'inherit')}
        style={{ color: props.color ?? 'inherit', cursor: 'pointer', ...props.style }}
      >
        {props.children ?? props.username}
      </span>
    </Show>
  )
}
