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

// Paths that should never be handled by the client mod, even when mounted at '/'.
// Can be overridden via SCREEPS_MOD_CLIENT_EXCLUDE (comma-separated prefixes).
// Note: /assets/ is reserved by the game server; the client bundle uses /_client/ instead.
const DEFAULT_EXCLUDES = ['/api/', '/socket', '/backend/', '/auth/', '/assets/', '/map/']
const excludePrefixes = process.env.SCREEPS_MOD_CLIENT_EXCLUDE
  ? process.env.SCREEPS_MOD_CLIENT_EXCLUDE.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_EXCLUDES

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

function renderInjectedIndex(filePath) {
  const mountDisplay = mountPath === '/' ? '/' : mountPath + '/'
  const baseTag = `<base href="${mountDisplay}">`
  const metadata = JSON.stringify({
    kind: 'xxscreeps-mod',
    packageName: pkg.name,
    version: pkg.version,
  }).replace(/</g, '\\u003c')
  const script = `<script>window.__SCREEPS_CLIENT_EMBEDDED__=${metadata}</script>`
  let html = readFileSync(filePath, 'utf8')
  // Inject base tag first so relative asset URLs resolve from the mount root,
  // not from the current SPA route (e.g. /room/E11N2).
  html = html.includes('<head>') ? html.replace('<head>', `<head>${baseTag}`) : baseTag + html
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : html + script
}

function sendInjectedIndex(ctx) {
  ctx.type = 'text/html'
  ctx.set('Cache-Control', REVALIDATE_CACHE)
  ctx.body = renderInjectedIndex(indexFile)
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
  if (mountPath === '/') {
    console.log(`[xxscreeps-mod-client] excluded prefixes: ${excludePrefixes.join(', ')}`)
  }

  koa.use(async (ctx, next) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next()

    if (ctx.path === '/' && rootRedirect && mountPath !== '/') {
      ctx.redirect(mountPath + '/')
      return
    }

    let relPath
    if (mountPath === '/') {
      // When mounted at root, skip paths that belong to the game server.
      if (excludePrefixes.some(p => ctx.path.startsWith(p))) return next()
      relPath = ctx.path
    } else if (ctx.path === mountPath || ctx.path === mountPath + '/') {
      relPath = '/'
    } else if (ctx.path.startsWith(mountPath + '/')) {
      relPath = ctx.path.slice(mountPath.length)
    } else {
      return next()
    }

    if (relPath === '/' || relPath === '/index.html') {
      sendInjectedIndex(ctx)
      return
    }

    // Serve a real file from dist if it exists.
    const found = resolveFile(relPath)
    if (found) {
      sendFile(ctx, found.filePath, found.stat)
      return
    }

    // Otherwise let xxscreeps handle the request. If it 404s and the path
    // looks like an SPA route (no file extension on the last segment),
    // fall back to index.html so client-side routing can take over.
    await next()
    if (ctx.status !== 404) return
    const last = relPath.split('/').pop() ?? ''
    if (last.includes('.')) return
    ctx.status = 200
    sendInjectedIndex(ctx)
  })
})
