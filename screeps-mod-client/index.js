'use strict'

const path = require('node:path')
const fs = require('node:fs')
const express = require('express')
const pkg = require('./package.json')

function readBool(envName, modValue, fallback) {
  const env = process.env[envName]
  if (env !== undefined) {
    const v = env.toLowerCase()
    return v === '1' || v === 'true' || v === 'yes'
  }
  if (modValue !== undefined) return Boolean(modValue)
  return fallback
}

function readString(envName, modValue, fallback) {
  return process.env[envName] ?? modValue ?? fallback
}

function renderInjectedIndex(indexFile) {
  const metadata = JSON.stringify({
    kind: 'screeps-mod',
    packageName: pkg.name,
    version: pkg.version,
  }).replace(/</g, '\\u003c')
  const script = `<script>window.__SCREEPS_CLIENT_EMBEDDED__=${metadata}</script>`
  const html = fs.readFileSync(indexFile, 'utf8')
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : script + html
}

module.exports = function (config) {
  if (!config.backend) return

  const modCfg = (config.common && config.common.modConfig && config.common.modConfig.client) || {}

  let mountPath = readString('SCREEPS_MOD_CLIENT_MOUNT_PATH', modCfg.mountPath, '/client')
  if (!mountPath.startsWith('/')) mountPath = '/' + mountPath
  mountPath = mountPath.replace(/\/+$/, '') || '/'

  const rootRedirect = readBool('SCREEPS_MOD_CLIENT_ROOT_REDIRECT', modCfg.rootRedirect, true)
  const clientPkgPath = require.resolve('screeps-client/package.json')
  const distDir = path.join(path.dirname(clientPkgPath), 'dist', 'embedded')

  const indexFile = path.join(distDir, 'index.html')
  let injectedIndex

  function sendInjectedIndex(res) {
    injectedIndex ??= renderInjectedIndex(indexFile)
    res.type('html').send(injectedIndex)
  }

  config.backend.on('expressPreConfig', (app) => {
    const indexRoutes = mountPath === '/' ? ['/', '/index.html'] : [mountPath, mountPath + '/', mountPath + '/index.html']

    app.get(indexRoutes, (_req, res) => {
      sendInjectedIndex(res)
    })

    app.use(mountPath, express.static(distDir, { fallthrough: true, index: false }))

    // SPA fallback: serve index.html for unmatched GET requests under mountPath
    app.use(mountPath, (req, res, next) => {
      if (req.method !== 'GET') return next()
      sendInjectedIndex(res)
    })

    if (rootRedirect && mountPath !== '/') {
      const alreadyRegistered = app._router?.stack?.some(
        layer => layer.route?.path === '/' && layer.route?.methods?.get
      )
      if (alreadyRegistered) {
        console.warn(`[screeps-mod-client] WARNING: GET / is already registered by another mod — redirect to ${mountPath}/ will not take effect. Move screeps-mod-client before other mods in mods.json to ensure priority.`)
      }
      app.get('/', (_req, res) => {
        res.redirect(302, mountPath + '/')
      })
    }
  })

  console.log(`[screeps-mod-client] serving client at ${mountPath}/ (rootRedirect=${rootRedirect})`)
}
