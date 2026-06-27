import { resourceColor, resourceDisplayName } from '~/data/resources.js'

// A small colour disc standing in for a resource, using the same palette as the
// in-room mineral/deposit discs so a resource reads consistently everywhere. The
// disc carries a faint rim so near-white resources (oxygen, ghodium) stay visible
// on the dark background.
export function ResourceSwatch(props: { resourceType: string; size?: number }) {
  const size = () => props.size ?? 18
  const hex = () => `#${resourceColor(props.resourceType).toString(16).padStart(6, '0')}`
  return (
    <span
      title={resourceDisplayName(props.resourceType)}
      style={{
        display: 'inline-block',
        width: `${size()}px`,
        height: `${size()}px`,
        'border-radius': '50%',
        background: hex(),
        border: '1px solid rgba(255, 255, 255, 0.25)',
        'vertical-align': 'middle',
        flex: 'none',
      }}
    />
  )
}
