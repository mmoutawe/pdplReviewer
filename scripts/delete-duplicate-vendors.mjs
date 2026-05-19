/**
 * Deletes duplicate vendors whose trade name contains a given search string.
 * Keeps the oldest record (earliest createdon), deletes the rest.
 *
 * Usage:
 *   node scripts/delete-duplicate-vendors.mjs "PeopleCore"
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

const searchTerm = process.argv[2]
if (!searchTerm) { console.error('Usage: node scripts/delete-duplicate-vendors.mjs "<search term>"'); process.exit(1) }

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
  const table   = `${P}vendors`
  const idField = `${P}vendorid`
  const nameField = `${P}tradename`

  console.log(`\n🔍  Searching for vendors matching "${searchTerm}"…`)

  const encoded = encodeURIComponent(`contains(${nameField},'${searchTerm}')`)
  const data = await api('GET', `${table}?$filter=${encoded}&$select=${idField},${nameField},createdon&$orderby=createdon asc`)
  const rows = data?.value ?? []

  if (rows.length === 0) {
    console.log('✅  No matching vendors found.')
    return
  }

  console.log(`\nFound ${rows.length} vendor(s):`)
  rows.forEach((r, i) => {
    const marker = i === 0 ? ' ← KEEP' : ' ← DELETE'
    console.log(`  [${i + 1}] ${r[nameField]}  (id: ${r[idField]}, created: ${r['createdon']})${marker}`)
  })

  if (rows.length === 1) {
    console.log('\n✅  Only one record — nothing to delete.')
    return
  }

  const toDelete = rows.slice(1)
  console.log(`\n🗑️   Deleting ${toDelete.length} duplicate(s)…`)

  for (const r of toDelete) {
    const id = r[idField]
    await api('DELETE', `${table}(${id})`)
    console.log(`  ✓ Deleted ${r[nameField]} (${id})`)
  }

  console.log('\n✅  Done. One record kept, duplicates removed.')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
