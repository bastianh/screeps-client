import path from 'node:path'
import { createRequire } from 'node:module'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { hooks } from 'xxscreeps/backend/index.js'

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
let injectedIndex

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
  ctx.set('Content-Length', String(stat.size))
  ctx.body = createReadStream(filePath)
}

function renderInjectedIndex(filePath) {
  const metadata = JSON.stringify({
    kind: 'xxscreeps-mod',
    packageName: pkg.name,
    version: pkg.version,
  }).replace(/</g, '\\u003c')
  const script = `<script>window.__SCREEPS_CLIENT_EMBEDDED__=${metadata}</script>`
  const html = readFileSync(filePath, 'utf8')
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : script + html
}

function sendInjectedIndex(ctx) {
  injectedIndex ??= renderInjectedIndex(indexFile)
  ctx.type = 'text/html'
  ctx.body = injectedIndex
}

hooks.register('middleware', koa => {
  if (!existsSync(indexFile)) {
    console.error(`[xxscreeps-mod-client] client bundle not found at ${indexFile}. Run "pnpm --filter screeps-client build:embedded:xxscreeps" first.`)
    return
  }

  console.log(`[xxscreeps-mod-client] serving client at ${mountPath === '/' ? '/' : mountPath + '/'} (rootRedirect=${rootRedirect})`)

  koa.use(async (ctx, next) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next()

    if (mountPath !== '/' && ctx.path === '/' && rootRedirect) {
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
