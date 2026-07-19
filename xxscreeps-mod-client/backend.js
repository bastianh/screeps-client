import path from 'node:path'
import { createRequire } from 'node:module'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { hooks } from 'xxscreeps/backend/index.js'
import { config } from 'xxscreeps/config/index.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')
const clientPkgPath = require.resolve('screeps-client/package.json')
const distDir = path.join(path.dirname(clientPkgPath), 'dist', 'xxscreeps-mod')
const indexFile = path.join(distDir, 'index.html')

const CONTENT_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
}

// Vite content-hashes everything under the assets dir (_client/), so those URLs
// change whenever their content does and can be cached forever. Everything else
// (index.html, themes/, other public/ assets) keeps a stable URL across releases
// and must be revalidated so updated files (e.g. the sprite atlas) aren't served
// stale from the browser cache.
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
const REVALIDATE_CACHE = 'no-cache'

function cacheControlFor(filePath) {
  return filePath.includes(`${path.sep}_client${path.sep}`) ? IMMUTABLE_CACHE : REVALIDATE_CACHE
}

function readBool(envName, fallback) {
  const env = process.env[envName]
  if (env === undefined) return fallback
  const v = env.toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function normalizeMount(input) {
  let p = input ?? '/'
  if (!p.startsWith('/')) p = '/' + p
  p = p.replace(/\/+$/, '')
  return p === '' ? '/' : p
}

const mountPath = normalizeMount(process.env.SCREEPS_MOD_CLIENT_MOUNT_PATH ?? '/')
const rootRedirect = readBool('SCREEPS_MOD_CLIENT_ROOT_REDIRECT', mountPath !== '/')

// Top-level client SPA routes. A path that isn't a real file in dist/ but matches
// one of these is a client-side deep link (or a reload of one) and gets the SPA
// shell; every other path is handed to xxscreeps, so its API/website routes are
// never shadowed and genuinely-unknown paths get a real 404 instead of the shell.
// Mirrors the route table in screeps-client/src/stores/routeStore.ts +
// utils/gameRoutes.ts — keep in sync when the client gains a new top-level route.
const SPA_ROUTES = ['/user', '/profile', '/messages', '/market', '/room-overview', '/map', '/room']

function isSpaRoute(relPath) {
  return SPA_ROUTES.some(prefix => relPath === prefix || relPath.startsWith(prefix + '/'))
}

function resolveFile(relPath) {
  const rel = relPath.replace(/^\/+/, '')
  const target = rel === '' ? indexFile : path.join(distDir, rel)
  const normalized = path.normalize(target)
  if (!normalized.startsWith(distDir)) return null
  if (!existsSync(normalized)) return null
  const stat = statSync(normalized)
  if (!stat.isFile()) return null
  return { filePath: normalized, stat }
}

function sendFile(ctx, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase()
  ctx.type = CONTENT_TYPES[ext] ?? 'application/octet-stream'
  ctx.lastModified = stat.mtime
  ctx.set('Cache-Control', cacheControlFor(filePath))
  ctx.set('Content-Length', String(stat.size))
  ctx.body = createReadStream(filePath)
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// The client fetches `/api/version` on load (pre-login and again post-connect) to
// configure itself: welcome text, shards, history settings, and the auth/feature
// gates. Since the server already has this on hand when it renders index.html, we
// prefetch it once in-process and inline it as `window.__SCREEPS_BOOTSTRAP__`, so
// the embedded client is configured from the first frame with zero round-trips.
// Cached like the client's own 5-min version cache; failures just omit the global
// and the client falls back to its normal fetch.
const VERSION_TTL_MS = 5 * 60_000
let versionCache = null

async function bootstrapVersion(ctx) {
  const now = Date.now()
  if (versionCache && now < versionCache.expires) return versionCache.data
  try {
    const origin = `${ctx.protocol}://${ctx.host}`
    const res = await fetch(`${origin}/api/version`)
    if (!res.ok) return null
    const data = await res.json()
    versionCache = { data, expires: now + VERSION_TTL_MS }
    return data
  } catch (err) {
    console.error('[xxscreeps-mod-client] failed to prefetch /api/version for bootstrap:', err)
    return null
  }
}

function renderInjectedIndex(filePath, version) {
  const mountDisplay = mountPath === '/' ? '/' : mountPath + '/'
  const baseTag = `<base href="${mountDisplay}">`
  const metadata = jsonForScript({
    kind: 'xxscreeps-mod',
    packageName: pkg.name,
    version: pkg.version,
  })
  const bootstrap = version ? `;window.__SCREEPS_BOOTSTRAP__=${jsonForScript(version)}` : ''
  const script = `<script>window.__SCREEPS_CLIENT_EMBEDDED__=${metadata}${bootstrap}</script>`
  let html = readFileSync(filePath, 'utf8')
  // Inject base tag first so relative asset URLs resolve from the mount root,
  // not from the current SPA route (e.g. /room/E11N2).
  html = html.includes('<head>') ? html.replace('<head>', `<head>${baseTag}`) : baseTag + html
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : html + script
}

async function sendInjectedIndex(ctx) {
  const version = await bootstrapVersion(ctx)
  ctx.type = 'text/html'
  ctx.set('Cache-Control', REVALIDATE_CACHE)
  ctx.body = renderInjectedIndex(indexFile, version)
}

// Advertise the server's guest/registration/Steam settings at `/api/version` so
// screeps-client can gate the corresponding login UI without extra requests.
// See `.screepsrc.yaml`'s `backend.allowGuestAccess`, `backend.allowEmailRegistration`,
// and `backend.steamApiKey`.
hooks.register('version', serverData => {
  const backend = config.backend ?? {}
  serverData.features.push({
    name: 'xxscreeps-mod-client',
    version: 1,
    allowGuestAccess: backend.allowGuestAccess ?? true,
    allowEmailRegistration: backend.allowEmailRegistration ?? false,
    steamLogin: Boolean(backend.steamApiKey),
  })
})

hooks.register('middleware', koa => {
  if (!existsSync(indexFile)) {
    console.error(`[xxscreeps-mod-client] client bundle not found at ${indexFile}. Run "pnpm --filter screeps-client build:embedded:xxscreeps" first.`)
    return
  }

  const mountDisplay = mountPath === '/' ? '/' : mountPath + '/'
  console.log(`[xxscreeps-mod-client] serving client at ${mountDisplay} (rootRedirect=${rootRedirect})`)

  koa.use(async (ctx, next) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next()

    if (ctx.path === '/' && rootRedirect && mountPath !== '/') {
      ctx.redirect(mountPath + '/')
      return
    }

    let relPath
    if (mountPath === '/') {
      relPath = ctx.path
    } else if (ctx.path === mountPath || ctx.path === mountPath + '/') {
      relPath = '/'
    } else if (ctx.path.startsWith(mountPath + '/')) {
      relPath = ctx.path.slice(mountPath.length)
    } else {
      return next()
    }

    if (relPath === '/' || relPath === '/index.html') {
      await sendInjectedIndex(ctx)
      return
    }

    // Serve a real file from dist if it exists.
    const found = resolveFile(relPath)
    if (found) {
      sendFile(ctx, found.filePath, found.stat)
      return
    }

    // Not a real file: claim only the client's own SPA routes (deep links and
    // reloads) with the index shell, and leave every other path to xxscreeps.
    if (isSpaRoute(relPath)) {
      await sendInjectedIndex(ctx)
      return
    }

    return next()
  })
})
