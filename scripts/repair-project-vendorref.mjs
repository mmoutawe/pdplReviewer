/**
 * Reassigns orphaned projects (those whose pdplr_vendorref no longer exists)
 * to the correct vendor. Run after deleting duplicate vendors.
 *
 * Usage:
 *   node scripts/repair-project-vendorref.mjs "<vendor trade name>"
 *
 * Example:
 *   node scripts/repair-project-vendorref.mjs "PeopleCore"
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

const vendorName = process.argv[2]
if (!vendorName) { console.error('Usage: node scripts/repair-project-vendorref.mjs "<vendor trade name>"'); process.exit(1) }

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
  const vendorTable   = `${P}vendors`
  const vendorIdField = `${P}vendorid`
  const vendorNameField = `${P}tradename`
  const projectTable  = `${P}projects`
  const projectIdField = `${P}projectid`

  // 1. Find the canonical vendor
  console.log(`\n🔍  Looking up vendor "${vendorName}"…`)
  const encoded = encodeURIComponent(`contains(${vendorNameField},'${vendorName}')`)
  const vData = await api('GET', `${vendorTable}?$filter=${encoded}&$select=${vendorIdField},${vendorNameField},createdon&$orderby=createdon asc`)
  const vendors = vData?.value ?? []

  if (vendors.length === 0) {
    console.log('❌  No vendor found with that name.')
    process.exit(1)
  }
  if (vendors.length > 1) {
    console.log(`⚠️   Found ${vendors.length} vendors — will use the oldest one.`)
    vendors.forEach((v, i) => console.log(`  [${i + 1}] ${v[vendorNameField]} (id: ${v[vendorIdField]}, created: ${v['createdon']})`))
  }

  const canonicalVendor = vendors[0]
  const canonicalId = canonicalVendor[vendorIdField]
  console.log(`\n✅  Canonical vendor: ${canonicalVendor[vendorNameField]} (${canonicalId})`)

  // 2. Fetch all projects
  console.log(`\n🔍  Fetching all projects…`)
  const pData = await api('GET', `${projectTable}?$select=${projectIdField},${P}name,${P}vendorref`)
  const projects = pData?.value ?? []
  console.log(`    Found ${projects.length} project(s) total.`)

  // 3. Find all valid vendor IDs currently in Dataverse
  console.log(`\n🔍  Fetching all vendor IDs…`)
  const allVendorsData = await api('GET', `${vendorTable}?$select=${vendorIdField}`)
  const validVendorIds = new Set((allVendorsData?.value ?? []).map(v => v[vendorIdField]))
  console.log(`    ${validVendorIds.size} valid vendor(s) in Dataverse.`)

  // 4. Find orphaned projects (vendorref points to a deleted vendor or is empty)
  const orphaned = projects.filter(p => {
    const ref = p[`${P}vendorref`]
    return ref && !validVendorIds.has(ref)
  })

  const unlinked = projects.filter(p => !p[`${P}vendorref`])

  console.log(`\n📋  Orphaned projects (broken vendorref): ${orphaned.length}`)
  orphaned.forEach(p => console.log(`  - ${p[`${P}name`]} (${p[projectIdField]}) → vendorref was: ${p[`${P}vendorref`]}`))

  console.log(`\n📋  Unlinked projects (no vendorref): ${unlinked.length}`)
  unlinked.forEach(p => console.log(`  - ${p[`${P}name`]} (${p[projectIdField]})`))

  if (orphaned.length === 0) {
    console.log('\n✅  No orphaned projects found. Nothing to repair.')
    return
  }

  console.log(`\n🔧  Reassigning ${orphaned.length} orphaned project(s) → ${canonicalVendor[vendorNameField]} (${canonicalId})…`)
  for (const p of orphaned) {
    await api('PATCH', `${projectTable}(${p[projectIdField]})`, { [`${P}vendorref`]: canonicalId })
    console.log(`  ✓ Repaired: ${p[`${P}name`]} (${p[projectIdField]})`)
  }

  console.log('\n✅  Done. Orphaned projects now point to the canonical vendor.')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
