#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const changesetDir = new URL('../.changeset/', import.meta.url)
const companionFile = new URL('../.changeset/screeps-client-mod-consumers.md', import.meta.url)
const rootDir = fileURLToPath(new URL('..', import.meta.url))
const modPackages = ['screepsmod-client-new', 'xxscreeps-mod-client']

const listChangesetFiles = () =>
  readdirSync(changesetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()

const parseChangeset = (source) => {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return null

  const releases = {}
  for (const line of match[1].split('\n')) {
    const release = line.match(/^"([^"]+)":\s*(major|minor|patch)$/)
    if (release) releases[release[1]] = release[2]
  }

  return {
    releases,
    body: match[2],
  }
}

const readChangeset = (fileName) => {
  const filePath = join(fileURLToPath(changesetDir), fileName)
  return parseChangeset(readFileSync(filePath, 'utf8'))
}

const hasAllModPackages = (changeset) =>
  changeset != null && modPackages.every((packageName) => packageName in changeset.releases)

const writeCompanionChangeset = () => {
  const body = [
    'Update the required `screeps-client` version for both mod packages after the next client release.',
    'Adjust this summary if the release notes should say something more specific.',
    '',
  ].join('\n')

  const frontmatter = modPackages.map((packageName) => `"${packageName}": patch`).join('\n')
  writeFileSync(companionFile, `---\n${frontmatter}\n---\n\n${body}`)
}

const filesBefore = new Set(listChangesetFiles())
const result = spawnSync('pnpm', ['exec', 'changeset'], {
  cwd: rootDir,
  stdio: 'inherit',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const filesAfter = listChangesetFiles()
const newFiles = filesAfter.filter((fileName) => !filesBefore.has(fileName))
const newChangesets = newFiles
  .map((fileName) => ({ fileName, changeset: readChangeset(fileName) }))
  .filter(({ changeset }) => changeset != null)

const createdClientChangeset = newChangesets.some(
  ({ changeset }) => changeset != null && 'screeps-client' in changeset.releases,
)
const newChangesetAlreadyCoversMods = newChangesets.some(({ changeset }) => hasAllModPackages(changeset))

if (!createdClientChangeset || newChangesetAlreadyCoversMods) {
  process.exit(0)
}

const existingChangesetsCoverMods = filesAfter
  .filter((fileName) => fileName !== 'screeps-client-mod-consumers.md')
  .some((fileName) => hasAllModPackages(readChangeset(fileName)))

if (existingChangesetsCoverMods) {
  process.exit(0)
}

writeCompanionChangeset()
process.stdout.write('Created .changeset/screeps-client-mod-consumers.md for mod package dependency updates.\n')
