/**
 * Deletes duplicate projects per vendor. For each vendor, finds projects with
 * the same name, keeps the oldest, deletes the rest.
 * Also lists unlinked projects (no vendorref) so you can handle them manually.
 *
 * Usage:
 *   node scripts/delete-duplicate-projects.mjs
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

  // 1. Fetch all vendors
  console.log('\n🔍  Fetching vendors…')
  const vendorData = await api('GET', `${vendorTable}?$select=${vendorIdField},${vendorNameField}&$orderby=${vendorNameField} asc`)
  const vendors = vendorData?.value ?? []
  console.log(`    Found ${vendors.length} vendor(s).`)

  // 2. Fetch all projects
  console.log('🔍  Fetching all projects…')
  const projectData = await api('GET', `${projectTable}?$select=${projectIdField},${projectNameField},${vendorRefField},createdon&$orderby=createdon asc`)
  const projects = projectData?.value ?? []
  console.log(`    Found ${projects.length} project(s) total.\n`)

  // 3. Report unlinked projects
  const unlinked = projects.filter(p => !p[vendorRefField])
  if (unlinked.length > 0) {
    console.log(`⚠️   Unlinked projects (no vendor): ${unlinked.length}`)
    unlinked.forEach(p => console.log(`  - "${p[projectNameField]}" (${p[projectIdField]})`))
    console.log()
  }

  // 4. For each vendor, find and delete duplicate project names
  let totalDeleted = 0

  for (const vendor of vendors) {
    const vid = vendor[vendorIdField]
    const vname = vendor[vendorNameField]
    const vProjects = projects.filter(p => p[vendorRefField] === vid)

    // Group by name
    const byName = {}
    for (const p of vProjects) {
      const key = (p[projectNameField] ?? '').trim().toLowerCase()
      if (!byName[key]) byName[key] = []
      byName[key].push(p)
    }

    const dupeGroups = Object.entries(byName).filter(([, group]) => group.length > 1)
    if (dupeGroups.length === 0) {
      console.log(`✅  ${vname} — no duplicates (${vProjects.length} project(s))`)
      continue
    }

    console.log(`🗑️   ${vname} — ${dupeGroups.length} duplicate group(s):`)
    for (const [name, group] of dupeGroups) {
      const keep = group[0]  // oldest (sorted by createdon asc)
      const toDelete = group.slice(1)
      console.log(`  Name: "${group[0][projectNameField]}"  Keep: ${keep[projectIdField]} (${keep['createdon']})`)
      for (const p of toDelete) {
        await api('DELETE', `${projectTable}(${p[projectIdField]})`)
        console.log(`    ✓ Deleted (${p[projectIdField]}, created: ${p['createdon']})`)
        totalDeleted++
      }
    }
  }

  console.log(`\n✅  Done. ${totalDeleted} duplicate project(s) removed.`)
  if (unlinked.length > 0) {
    console.log(`⚠️   ${unlinked.length} unlinked project(s) remain — assign them to a vendor manually in the app.`)
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
