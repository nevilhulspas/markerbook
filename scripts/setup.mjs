#!/usr/bin/env node
// One-command local setup: checks the tools, starts the local Supabase stack
// (schema + biomarker catalogue), and writes .env.local.
//
//   npm run setup                                   # asks what it needs
//   npm run setup -- --anthropic-key=sk-ant-... --admin-email=you@example.com --yes
//
// Options:
//   --anthropic-key=KEY   Anthropic API key for the AI features
//   --admin-email=EMAIL   this address becomes admin when it signs up
//   --yes                 never ask; use options and defaults (for scripts and AI assistants)
//   --no-start            do not start Supabase (it is already running)
//
// The Anthropic key is never taken from the environment on purpose: tools
// such as Claude Code can have their own key there, and it must not end up in
// this app.

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}
const interactive = process.stdin.isTTY && !flag('yes')

const green = (s) => `\x1b[32m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`
const ok = (msg) => console.log(`${green('✓')} ${msg}`)
const warn = (msg) => console.log(`${yellow('!')} ${msg}`)
const fail = (msg, hint) => {
  console.error(`${red('✗')} ${msg}`)
  if (hint) console.error(`  ${hint}`)
  process.exit(1)
}

function has(cmd, cmdArgs = ['--version']) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8' })
  return r.status === 0 ? (r.stdout || r.stderr).trim().split('\n')[0] : null
}

async function ask(question, fallback = '') {
  if (!interactive) return fallback
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(question)).trim()
  rl.close()
  return answer || fallback
}

console.log(bold('\nMarkerbook setup\n'))

// 1. Tools ---------------------------------------------------------------------
const [major] = process.versions.node.split('.').map(Number)
if (major < 22) fail(`Node ${process.versions.node} is too old.`, 'Install Node 22 or newer (see .nvmrc).')
ok(`Node ${process.versions.node}`)

if (!has('docker', ['info'])) {
  fail('Docker is not running.', 'Start Docker Desktop (or another Docker engine) and run this again.')
}
ok('Docker is running')

const supabaseVersion = has('supabase')
if (!supabaseVersion) {
  fail(
    'The Supabase CLI is not installed.',
    'Install it: brew install supabase/tap/supabase  (other systems: https://supabase.com/docs/guides/cli)'
  )
}
ok(`Supabase CLI ${supabaseVersion}`)

if (!existsSync('node_modules')) {
  console.log('  Installing packages (npm ci)…')
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { stdio: 'inherit' })
}
ok('Packages installed')

// 2. Local database ----------------------------------------------------------
/** Run a command, show its output live, and also return it. */
function runTee(cmd, cmdArgs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { stdio: ['inherit', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (d) => { output += d; process.stdout.write(d) })
    child.stderr.on('data', (d) => { output += d; process.stderr.write(d) })
    child.on('close', (status) => resolve({ status, output }))
  })
}

/**
 * Docker on some machines has used up its default network ranges, and
 * `supabase start` then cannot create its network. Make (or reuse) one with an
 * explicit range instead.
 */
function ensureOwnNetwork(name) {
  if (spawnSync('docker', ['network', 'inspect', name]).status === 0) return true
  for (let i = 7; i < 40; i++) {
    const r = spawnSync('docker', ['network', 'create', '--subnet', `10.231.${i}.0/24`, name])
    if (r.status === 0) return true
  }
  return false
}

if (!flag('no-start')) {
  console.log('  Starting Supabase (the first time downloads the images; this can take a few minutes)…')
  let start = await runTee('supabase', ['start'])
  if (start.status !== 0 && /address pools have been fully subnetted/.test(start.output)) {
    const net = 'markerbook-net'
    warn(`Docker has no free network range; retrying on its own network "${net}".`)
    if (!ensureOwnNetwork(net)) fail('Could not create a Docker network.', 'Remove unused networks: docker network prune')
    start = await runTee('supabase', ['start', '--network-id', net])
    if (start.status === 0) warn(`Next time, start the database with: supabase start --network-id ${net}`)
  }
  if (start.status !== 0) {
    fail(
      'supabase start failed.',
      'Read the error above. A port in use? Stop the other project with `supabase stop --project-id <name>`.'
    )
  }
}
const statusRaw = spawnSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' })
if (statusRaw.status !== 0) fail('Supabase is not running.', 'Run `supabase start` and look at the error.')
let status
try {
  const text = statusRaw.stdout
  status = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
} catch {
  fail('Could not read `supabase status -o json`.')
}
const supabaseUrl = status.API_URL
const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY
const secretKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY
if (!supabaseUrl || !publishableKey || !secretKey) fail('Supabase status has no URL or keys.')
ok(`Local database at ${supabaseUrl} (schema and biomarker catalogue loaded)`)

// 3. .env.local ----------------------------------------------------------------
const envPath = '.env.local'
const template = readFileSync('.env.example', 'utf8')
const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : template
const values = Object.fromEntries(
  current
    .split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)

const existingUrl = values.NEXT_PUBLIC_SUPABASE_URL
if (existingUrl && !/127\.0\.0\.1|localhost/.test(existingUrl) && !flag('yes')) {
  const answer = await ask(`.env.local points to ${existingUrl}. Replace it with the local database? [y/N] `, 'n')
  if (!/^y/i.test(answer)) fail('Kept your .env.local unchanged.', 'Run with --yes to replace it.')
}

values.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl
values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey
values.SUPABASE_SECRET_KEY = secretKey
values.NEXT_PUBLIC_SITE_URL ||= 'http://localhost:3000'

const keyOption = option('anthropic-key')
if (keyOption) values.ANTHROPIC_API_KEY = keyOption
if (!values.ANTHROPIC_API_KEY) {
  values.ANTHROPIC_API_KEY = await ask(
    'Anthropic API key (https://console.anthropic.com → API keys; leave empty to add later): '
  )
}

const adminOption = option('admin-email')
if (adminOption) values.ADMIN_EMAIL = adminOption
if (!values.ADMIN_EMAIL) {
  values.ADMIN_EMAIL = await ask('Your e-mail address (this account becomes admin when you sign up): ')
}

// Write in the order of .env.example, keeping its comments; extra keys at the end.
const written = new Set()
const out = template.split('\n').map((line) => {
  const m = line.match(/^([A-Z0-9_]+)=/)
  if (!m) return line
  written.add(m[1])
  return `${m[1]}=${values[m[1]] ?? ''}`
})
for (const [k, v] of Object.entries(values)) if (!written.has(k)) out.push(`${k}=${v}`)
writeFileSync(envPath, out.join('\n'))
ok('Wrote .env.local')

if (!values.ANTHROPIC_API_KEY) warn('No Anthropic key yet: the app runs, but AI import and chat do not. Add ANTHROPIC_API_KEY to .env.local.')
if (!values.ADMIN_EMAIL) warn('No ADMIN_EMAIL: make yourself admin later with `npm run make-admin -- you@example.com`.')

// 4. Next steps ----------------------------------------------------------------
console.log(`
${bold('Ready.')} Next:

  1. ${bold('npm run dev')}
  2. Open ${bold('http://localhost:3000/register')} and sign up${values.ADMIN_EMAIL ? ` with ${bold(values.ADMIN_EMAIL)}` : ''}.
  3. Optional demo data for your account: ${bold(`npm run demo${values.ADMIN_EMAIL ? '' : ' -- --email you@example.com'}`)}

Database admin (Supabase Studio): ${status.STUDIO_URL ?? 'http://127.0.0.1:54323'}
Stop the database when you are done: supabase stop
`)
