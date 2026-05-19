/**
 * Links unlinked projects to vendors by matching name keywords.
 * Run once to fix projects that have no vendorref.
 *
 * Usage:
 *   node scripts/link-unlinked-projects.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DeviceCodeCredential } from '@azure/identity'

const root    = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.local')

if (!existsSync(envPath)) { console.error('❌  .env.local not found'); process.exit(1) }

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const DV_URL    = env.VITE_DATAVERSE_URL?.replace(/\/$/, '')
const TENANT_ID = env.VITE_MSAL_TENANT_ID
const CLIENT_ID = env.VITE_MSAL_CLIENT_ID
const P         = env.VITE_DV_TABLE_PREFIX ?? 'pdplr_'

if (!DV_URL || !TENANT_ID || !CLIENT_ID) {
  console.error('❌  Missing VITE_DATAVERSE_URL / VITE_MSAL_TENANT_ID / VITE_MSAL_CLIENT_ID in .env.local')
  process.exit(1)
}

const API = `${DV_URL}/api/data/v9.2`

const credential = new DeviceCodeCredential({
  tenantId: TENANT_ID,
  clientId: CLIENT_ID,
  userPromptCallback: info => console.log('\n' + info.message + '\n'),
})

async function tok() {
  const r = await credential.getToken(`${DV_URL}/.default`)
  return r.token
}

async function api(method, path, body) {
  const token = await tok()
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok && res.status !== 204) {
    const txt = await res.text()
    throw new Error(`${method} ${path} → ${res.status}: ${txt}`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function main() {
  const vendorTable    = `${P}vendors`
  const vendorIdField  = `${P}vendorid`
  const vendorNameField= `${P}tradename`
  const projectTable   = `${P}projects`
  const projectIdField = `${P}projectid`
  const projectNameField = `${P}name`
  const vendorRefField = `${P}vendorref`

  console.log('\n🔍  Fetching vendors and projects…')
  const [vendorData, projectData] = await Promise.all([
    api('GET', `${vendorTable}?$select=${vendorIdField},${vendorNameField}&$orderby=${vendorNameField} asc`),
    api('GET', `${projectTable}?$select=${projectIdField},${projectNameField},${vendorRefField}&$orderby=createdon asc`),
  ])

  const vendors  = vendorData?.value  ?? []
  const projects = projectData?.value ?? []

  const unlinked = projects.filter(p => !p[vendorRefField])
  console.log(`\n📋  Vendors: ${vendors.map(v => `${v[vendorNameField]} (${v[vendorIdField]})`).join(' | ')}`)
  console.log(`📋  Unlinked projects: ${unlinked.length}`)

  if (unlinked.length === 0) {
    console.log('✅  No unlinked projects — nothing to do.')
    return
  }

  // Auto-match: score each project against each vendor by word overlap
  function score(projectName, vendorName) {
    const pWords = projectName.toLowerCase().split(/\W+/)
    const vWords = vendorName.toLowerCase().split(/\W+/)
    return pWords.filter(w => w.length > 2 && vWords.some(vw => vw.includes(w) || w.includes(vw))).length
  }

  let linked = 0
  for (const p of unlinked) {
    const name = p[projectNameField] ?? ''
    const scored = vendors.map(v => ({ v, s: score(name, v[vendorNameField]) })).sort((a, b) => b.s - a.s)
    const best = scored[0]

    if (best.s === 0) {
      console.log(`\n⚠️   "${name}" — no keyword match found. Skipping.`)
      continue
    }

    const vendorName = best.v[vendorNameField]
    const vendorId   = best.v[vendorIdField]
    await api('PATCH', `${projectTable}(${p[projectIdField]})`, { [vendorRefField]: vendorId })
    console.log(`\n  ✓ "${name}" → ${vendorName}`)
    linked++
  }

  console.log(`\n✅  Done. ${linked} project(s) linked.`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
