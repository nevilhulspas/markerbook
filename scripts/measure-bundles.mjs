#!/usr/bin/env node
// First-load client JS per app route, read from a finished `next build`.
//
// Next 16 with Turbopack no longer prints route sizes, so this sums the JS
// chunks each route's client-reference manifest lists (page + its layouts)
// plus the root main files. It is an approximation of first-load JS, good for
// comparing two builds of the same app, not an exact transfer size.
//
// Usage:
//   node scripts/measure-bundles.mjs                    # table to stdout
//   node scripts/measure-bundles.mjs --json out.json    # also save raw numbers
//   node scripts/measure-bundles.mjs --compare before.json
//   node scripts/measure-bundles.mjs --next-dir path/to/.next

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import zlib from 'node:zlib'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}

const nextDir = path.resolve(arg('--next-dir') ?? '.next')
const jsonOut = arg('--json')
const compareWith = arg('--compare')

if (!fs.existsSync(path.join(nextDir, 'build-manifest.json'))) {
  console.error(`No build found in ${nextDir}. Run \`npm run build\` first.`)
  process.exit(1)
}

const buildManifest = JSON.parse(fs.readFileSync(path.join(nextDir, 'build-manifest.json'), 'utf8'))
const rootChunks = [...(buildManifest.rootMainFiles ?? []), ...(buildManifest.polyfillFiles ?? [])].filter((f) =>
  f.endsWith('.js'),
)

const sizeCache = new Map()
function chunkSize(file) {
  if (!sizeCache.has(file)) {
    const bytes = fs.readFileSync(path.join(nextDir, file.replace(/^\/?_next\//, '')))
    sizeCache.set(file, { raw: bytes.length, gzip: zlib.gzipSync(bytes).length })
  }
  return sizeCache.get(file)
}

function findManifests(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) findManifests(full, out)
    else if (entry.name === 'page_client-reference-manifest.js') out.push(full)
  }
  return out
}

const routes = {}
for (const file of findManifests(path.join(nextDir, 'server/app'))) {
  const sandbox = {}
  sandbox.globalThis = sandbox
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox)
  for (const [entry, manifest] of Object.entries(sandbox.__RSC_MANIFEST ?? {})) {
    const chunks = new Set(rootChunks)
    for (const list of Object.values(manifest.entryJSFiles ?? {})) {
      for (const chunk of list) if (chunk.endsWith('.js')) chunks.add(chunk)
    }
    let raw = 0
    let gzip = 0
    for (const chunk of chunks) {
      const size = chunkSize(chunk)
      raw += size.raw
      gzip += size.gzip
    }
    const route = entry.replace(/\/page$/, '').replace(/\/\([^)]+\)/g, '') || '/'
    routes[route] = { rawKb: Math.round(raw / 1024), gzipKb: Math.round(gzip / 1024) }
  }
}

const before = compareWith ? JSON.parse(fs.readFileSync(compareWith, 'utf8')).routes : undefined
const rows = Object.entries(routes).sort((a, b) => b[1].gzipKb - a[1].gzipKb)

const delta = (now, then) => (then === undefined ? '' : ` (${now - then >= 0 ? '+' : ''}${now - then})`)
console.log(before ? '| Route | gzip kB (Δ) | raw kB (Δ) |' : '| Route | gzip kB | raw kB |')
console.log('|---|---:|---:|')
for (const [route, size] of rows) {
  const was = before?.[route]
  console.log(
    `| \`${route}\` | ${size.gzipKb}${delta(size.gzipKb, was?.gzipKb)} | ${size.rawKb}${delta(size.rawKb, was?.rawKb)} |`,
  )
}

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ measuredAt: new Date().toISOString(), routes }, null, 2) + '\n')
  console.error(`Saved ${rows.length} routes to ${jsonOut}`)
}
