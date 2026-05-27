import type { Theme } from './Theme.js'

export const defaultSpriteTheme: Theme = {
  id: 'default',
  name: 'Default',
  atlasUrl: '/themes/default/test.json',
  sprites: {
    storage: {
      layers: [
        { frame: 'storage/shell', tint: 'owner' },
        { frame: 'storage/fill' },
      ],
      tileScale: 1.75,
    },
  },
}
