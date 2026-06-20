import type { Theme } from './Theme.js'
import { basePath, clientVersion } from '../../utils/embedded.js'

// Cache-bust the atlas JSON by client version. `public/` assets aren't
// content-hashed by Vite, so the URL is stable across releases and the embedded
// mod serves it without Cache-Control — browsers then cache it heuristically and
// keep stale frames after a spritesheet update (only the image inside carries a
// ?v= hash). Tying the JSON URL to the release version forces a fresh fetch.
const atlasVersion = clientVersion()
const atlasQuery = atlasVersion ? `?v=${encodeURIComponent(atlasVersion)}` : ''

export const defaultSpriteTheme: Theme = {
  id: 'default',
  name: 'Default',
  atlasUrl: `${basePath()}/themes/default/sprite-0.json${atlasQuery}`,
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
  deposit: {
    tileScale: 1.2,
  },
  mineral: {
    tileScale: 2.6,
  },
  tower: {
    ringFrame: 'tower/ring',
    bodyFrame: 'tower/body',
    tileScale: 2.5,
    fill: { x: -39, yMin: -25, width: 78, heightMax: 58, rx: 12, ry: 12 },
  },
}
