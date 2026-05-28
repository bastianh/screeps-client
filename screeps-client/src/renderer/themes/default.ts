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
  controller: {
    backgroundFrame: 'controller/background',
    segmentFrame: 'controller/segment',
    tileScale: 2,
  },
  flag: {
    mainFrame: 'flag/main',
    secondFrame: 'flag/second',
    tileScale: 3,
    zIndex: 5,
  },
  tombstone: {
    shellFrame: 'grave/shell',
    crossFrame: 'grave/cross',
    tileScale: 1.0,
    zIndex: 4,
  },
}
