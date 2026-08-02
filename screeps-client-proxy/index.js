#!/usr/bin/env node
'use strict'

// Standalone proxy for the new screeps-client. Serves the standalone web build
// locally and forwards /api + /socket (incl. WebSocket) to a Screeps backend,
// so the browser build can talk to official or private servers without hitting
// CORS. The backend is embedded in the request path — `/(https://screeps.com)/api/…`
// — exactly like the screeps-steamless-client, so a single running instance can
// serve any number of servers. The login screen picks the backend; the client's
// connectivity layer prepends the `/(backend)/` prefix (see utils/proxy.ts).

const path = require('node:path')
const fs = require('node:fs')
const express = require('express')
const httpProxy = require('http-proxy')
const { ArgumentParser } = require('argparse')
const pkg = require('./package.json')

// ── CLI ──────────────────────────────────────────────────────────────────────

const argv = (() => {
  const parser = new ArgumentParser({ description: pkg.description })
  parser.add_argument('--port', { type: 'int', help: 'Port to listen on (default 8080)' })
  parser.add_argument('--host', { type: 'str', help: 'Host to bind (default localhost)' })
  parser.add_argument('--backend', { type: 'str', help: 'Pin a single backend, dropping the /(backend)/ URL requirement' })
  parser.add_argument('--internal_backend', { type: 'str', help: 'Actual proxy target, when it differs from the browser-facing backend URL' })
  parser.add_argument('--dist', { type: 'str', help: 'Path to the screeps-client standalone build (default: resolved from the screeps-client package)' })
  return parser.parse_args()
})()

const port = argv.port ?? 8080
const host = argv.host ?? 'localhost'
const pinnedBackend = argv.backend ? argv.backend.replace(/\/+$/, '') : null

// Only http(s) backends may be proxied. The target host is user-chosen by design
// (this is a proxy, bound to localhost by default), but rejecting other schemes
// stops a crafted `/(file:///…)/` path from turning the proxy into an
// arbitrary-scheme client.
function isWebUrl(value) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

if (pinnedBackend && !isWebUrl(pinnedBackend)) {
  console.error(`--backend must be an http(s) URL, got: ${argv.backend}`)
  process.exit(1)
}

// ── locate the standalone client build ────────────────────────────────────────

const distDir = argv.dist
  ? path.resolve(argv.dist)
  : path.join(path.dirname(require.resolve('screeps-client/package.json')), 'dist', 'standalone')

const indexFile = path.join(distDir, 'index.html')

if (!fs.existsSync(indexFile)) {
  console.error(`Could not find the client build at ${distDir}`)
  console.error('Build it first: pnpm --filter screeps-client build   (or pass --dist <path>)')
  process.exit(1)
}

// ── caching ────────────────────────────────────────────────────────────────────

// Vite content-hashes everything under the assets dir (_client/), so those URLs
// change whenever their content does and can be cached forever. Everything else
// (index.html, themes/, other public/ assets) keeps a stable URL across releases
// and must be revalidated so updated files aren't served stale from the cache.
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
const REVALIDATE_CACHE = 'no-cache'

function isHashedAsset(filePath) {
  return filePath.includes(`${path.sep}_client${path.sep}`)
}

function setStaticCacheHeaders(res, filePath) {
  res.setHeader('Cache-Control', isHashedAsset(filePath) ? IMMUTABLE_CACHE : REVALIDATE_CACHE)
}

// ── index.html injection ───────────────────────────────────────────────────────

// Signals proxy mode to the client and, when a backend is pinned, tells it which
// one so the login screen can target it directly. Mirrors the mod's
// window.__SCREEPS_CLIENT_EMBEDDED__ convention.
function renderInjectedIndex() {
  const metadata = JSON.stringify({
    kind: 'screeps-proxy',
    packageName: pkg.name,
    version: pkg.version,
    backend: pinnedBackend ?? undefined,
  }).replace(/</g, '\\u003c')
  const script = `<script>window.__SCREEPS_CLIENT_PROXY__=${metadata}</script>`
  const html = fs.readFileSync(indexFile, 'utf8')
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : script + html
}

function sendInjectedIndex(res) {
  res.setHeader('Cache-Control', REVALIDATE_CACHE)
  res.type('html').send(renderInjectedIndex())
}

// ── backend extraction ─────────────────────────────────────────────────────────

// Parse the `/(backend)/endpoint` form (or use the pinned backend, treating the
// whole URL as the endpoint). Returns null for asset/SPA paths.
function extract(url) {
  if (pinnedBackend) {
    return { backend: pinnedBackend, endpoint: url }
  }
  const groups = /^\/\((?<backend>[^)]+)\)(?<endpoint>\/.*)$/.exec(url)?.groups
  if (groups) {
    const backend = groups.backend.replace(/\/+$/, '')
    // Reject non-http(s) targets; the request then falls through to the SPA/404
    // instead of being proxied to an arbitrary scheme.
    if (!isWebUrl(backend)) return null
    return { backend, endpoint: groups.endpoint }
  }
  return null
}

// The client only ever requests these backend paths through the proxy
// (HttpClient → /api + /room-history, SocketClient → /socket, plus /assets for
// server-hosted assets). Anything else arriving in wrapped form is a browser
// navigation — e.g. a pasted steamless-client-style URL like
// `/(https://screeps.com)/` — and must reach the SPA, not the backend's
// website. The client's own build assets live under `_client/`, so claiming
// `/assets` here doesn't shadow them.
const PROXY_ENDPOINTS = /^\/(api|socket|room-history|assets)(\/|\?|$)/

// ── proxy ────────────────────────────────────────────────────────────────────

const proxy = httpProxy.createProxyServer({ changeOrigin: true })
proxy.on('error', (err, _req, res) => {
  console.error('[proxy]', err.message)
  if (res && 'writeHead' in res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Bad gateway')
  }
})

// ── express app ────────────────────────────────────────────────────────────────

const app = express()

// Serve the SPA index for the root and its history routes.
app.get(['/', '/index.html'], (_req, res) => sendInjectedIndex(res))

// Static assets (hashed → immutable, everything else → revalidate). No SPA
// fallthrough here; index: false so `/` is handled above with injection.
app.use(express.static(distDir, { fallthrough: true, index: false, setHeaders: setStaticCacheHeaders }))

// Proxy every `/(backend)/…` request (API, room-history, socket handshake) to the
// selected backend. Anything without a backend prefix falls through to the SPA.
app.use((req, res, next) => {
  const info = extract(req.url)
  if (!info) return next()

  if (!PROXY_ENDPOINTS.test(info.endpoint)) {
    // Pinned mode wraps every path, so a non-API path is a normal SPA route
    // (deep link, asset miss) — fall through to the SPA handler unchanged.
    if (pinnedBackend) return next()
    // Explicit `/(backend)/…` page URL: redirect to the unwrapped path so the
    // client loads (the login screen picks the backend). Guard against `//…`
    // becoming a protocol-relative open redirect.
    if (req.method === 'GET') {
      return res.redirect(info.endpoint.startsWith('//') ? '/' : info.endpoint)
    }
    return next()
  }

  // OAuth (Steam/Discord/…) does an OpenID round-trip; append returnUrl so the
  // provider redirects back to the correct backend after auth.
  if (info.endpoint.startsWith('/api/auth')) {
    const sep = info.endpoint.includes('?') ? '&' : '?'
    req.url = `${info.endpoint}${sep}returnUrl=${encodeURIComponent(info.backend)}`
  } else {
    req.url = info.endpoint
  }

  proxy.web(req, res, { target: argv.internal_backend ?? info.backend })
})

// SPA fallback: any other GET (deep link into the client) serves the injected
// index. `/(backend)/…` paths were already handled above, so they're never
// shadowed.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  sendInjectedIndex(res)
})

const server = app.listen(port, host, () => {
  console.log(`🌎 screeps-client-proxy listening — http://${host}:${port}/`)
  if (pinnedBackend) console.log(`   backend pinned to ${pinnedBackend}`)
})
server.on('error', (err) => console.error('[server]', err.message))

// Proxy WebSocket upgrades (the game socket) to the same backend.
server.on('upgrade', (req, socket, head) => {
  const info = extract(req.url ?? '')
  if (info && PROXY_ENDPOINTS.test(info.endpoint) && req.headers.upgrade?.toLowerCase() === 'websocket') {
    req.url = info.endpoint
    proxy.ws(req, socket, head, { target: argv.internal_backend ?? info.backend })
    socket.on('error', (err) => console.error('[ws]', err.message))
  } else {
    socket.end()
  }
})
