/**
 * PDPL Reviewer — Create first Dataverse user
 *
 * Signs in via device code, fetches your profile from Microsoft Graph,
 * and creates (or updates) the matching pdplr_user row in Dataverse.
 *
 * Usage:
 *   node scripts/create-user.mjs [role]
 *
 * role defaults to "admin". Valid values:
 *   admin | data_management | legal | security | requester | external_recipient
 *
 * Examples:
 *   node scripts/create-user.mjs
 *   node scripts/create-user.mjs requester
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DeviceCodeCredential } from '@azure/identity'

// ── Config ────────────────────────────────────────────────────────────────────

const root    = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.local')

if (!existsSync(envPath)) {
  console.error('❌  .env.local not found.')
  process.exit(1)
}

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
  console.error('❌  Missing VITE_DATAVERSE_URL, VITE_MSAL_TENANT_ID, or VITE_MSAL_CLIENT_ID')
  process.exit(1)
}

const VALID_ROLES = ['admin', 'data_management', 'legal', 'security', 'requester', 'external_recipient']
const role = process.argv[2] ?? 'admin'
if (!VALID_ROLES.includes(role)) {
  console.error(`❌  Invalid role "${role}". Choose from: ${VALID_ROLES.join(', ')}`)
  process.exit(1)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const credential = new DeviceCodeCredential({
  tenantId: TENANT_ID,
  clientId: CLIENT_ID,
  userPromptCallback: info => console.log('\n' + info.message + '\n'),
})

async function getToken(scope) {
  const r = await credential.getToken(scope)
  return r.token
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('')
}

function avatarColor(name) {
  const colors = ['#3B82F6','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444','#06B6D4']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('PDPL Reviewer — Create User')
console.log('============================')
console.log(`Environment : ${DV_URL}`)
console.log(`Role        : ${role}`)
console.log('\nSign in with the Microsoft account you want to register.\n')

// Step 1: Get Microsoft Graph profile
const graphToken = await getToken('https://graph.microsoft.com/User.Read')
const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department', {
  headers: { 'Authorization': `Bearer ${graphToken}` },
})
if (!meRes.ok) {
  console.error('❌  Failed to fetch profile from Microsoft Graph:', await meRes.text())
  process.exit(1)
}
const me = await meRes.json()

const entraId   = me.id
const fullName  = me.displayName ?? 'Unknown'
const email     = me.mail ?? me.userPrincipalName ?? ''
const jobTitle  = me.jobTitle ?? ''
const dept      = me.department ?? ''

console.log(`\nProfile found:`)
console.log(`  Name  : ${fullName}`)
console.log(`  Email : ${email}`)
console.log(`  ID    : ${entraId}`)

// Step 2: Check if user already exists in Dataverse
const dvToken = await getToken(`${DV_URL}/.default`)
const checkRes = await fetch(
  `${DV_URL}/api/data/v9.2/${P}users?$filter=${P}entraobjectid eq '${entraId}'&$top=1&$select=${P}userid`,
  { headers: { 'Authorization': `Bearer ${dvToken}`, 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' } },
)
const checkData = await checkRes.json().catch(() => ({ value: [] }))

if (checkData.value?.length > 0) {
  const existingId = checkData.value[0][`${P}userid`]
  console.log(`\n⏭  User already exists (${existingId}) — updating role to "${role}"...`)

  const dvToken2 = await getToken(`${DV_URL}/.default`)
  await fetch(`${DV_URL}/api/data/v9.2/${P}users(${existingId})`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dvToken2}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
    body: JSON.stringify({ [`${P}role`]: role }),
  })
  console.log('✅  Role updated.')
  process.exit(0)
}

// Step 3: Create the user record
const dvToken3 = await getToken(`${DV_URL}/.default`)
const createRes = await fetch(`${DV_URL}/api/data/v9.2/${P}users`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${dvToken3}`,
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    'Prefer': 'return=representation',
  },
  body: JSON.stringify({
    [`${P}entraobjectid`]: entraId,
    [`${P}fullname`]:      fullName,
    [`${P}email`]:         email,
    [`${P}role`]:          role,
    [`${P}jobtitle`]:      jobTitle,
    [`${P}department`]:    dept,
    [`${P}initials`]:      initials(fullName),
    [`${P}avatarcolor`]:   avatarColor(fullName),
  }),
})

if (!createRes.ok) {
  const err = await createRes.text().catch(() => '')
  console.error('❌  Failed to create user record:', err.slice(0, 400))
  process.exit(1)
}

const created = await createRes.json().catch(() => ({}))
console.log(`\n✅  User created!`)
console.log(`   Dataverse ID : ${created[`${P}userid`] ?? '(see Dataverse)'}`)
console.log(`   Name         : ${fullName}`)
console.log(`   Role         : ${role}`)
console.log('\nYou can now sign in to the app at http://localhost:5173\n')
