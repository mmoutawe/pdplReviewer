/**
 * PDPL Reviewer — Dataverse Setup Script
 *
 * Creates all 15 Dataverse tables, columns, alternate keys, and seeds
 * the required appsettings row.
 *
 * Requirements:
 *   - Node.js 18+
 *   - .env.local with VITE_DATAVERSE_URL, VITE_MSAL_CLIENT_ID, VITE_MSAL_TENANT_ID
 *   - The account you sign in with must have the System Administrator role
 *     in the target Dataverse environment
 *   - The App Registration must have "Allow public client flows" enabled
 *     (Azure Portal → App Registration → Authentication → Advanced settings)
 *
 * Usage:
 *   node scripts/setup-dataverse.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DeviceCodeCredential } from '@azure/identity'

// ── Load .env.local ───────────────────────────────────────────────────────────

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.local')

if (!existsSync(envPath)) {
  console.error('❌  .env.local not found. Copy .env.example → .env.local and fill in your values.')
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
const P         = env.VITE_DV_TABLE_PREFIX ?? 'pdplr_'   // e.g. "pdplr_"

if (!DV_URL)    { console.error('❌  VITE_DATAVERSE_URL is not set in .env.local'); process.exit(1) }
if (!TENANT_ID) { console.error('❌  VITE_MSAL_TENANT_ID is not set in .env.local'); process.exit(1) }
if (!CLIENT_ID) { console.error('❌  VITE_MSAL_CLIENT_ID is not set in .env.local'); process.exit(1) }

const API  = `${DV_URL}/api/data/v9.2`
const META = `${DV_URL}/api/data/v9.2`
const LANG = 1033  // English

// ── Auth ──────────────────────────────────────────────────────────────────────

const credential = new DeviceCodeCredential({
  tenantId: TENANT_ID,
  clientId: CLIENT_ID,
  userPromptCallback: info => console.log('\n' + info.message + '\n'),
})

async function tok() {
  const r = await credential.getToken(`${DV_URL}/.default`)
  return r.token
}

// ── Metadata API helpers ──────────────────────────────────────────────────────

function label(text) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: LANG }],
    UserLocalizedLabel: { '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: LANG },
  }
}

function reqLevel(value = 'None') {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty',
    Value: value, CanBeChanged: true,
    ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings',
  }
}

/** Text (single-line string) attribute */
function strAttr(name, display, maxLen = 100, isPrimaryName = false) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    SchemaName: name, DisplayName: label(display),
    RequiredLevel: reqLevel(isPrimaryName ? 'ApplicationRequired' : 'None'),
    MaxLength: maxLen,
    ...(isPrimaryName ? { IsPrimaryName: true } : {}),
  }
}

/** Multiline text (Memo) attribute */
function memoAttr(name, display, maxLen = 4000) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
    SchemaName: name, DisplayName: label(display),
    RequiredLevel: reqLevel(), MaxLength: maxLen,
  }
}

/** Boolean (Yes/No) attribute */
function boolAttr(name, display, defaultVal = false) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
    SchemaName: name, DisplayName: label(display),
    RequiredLevel: reqLevel(), DefaultValue: defaultVal,
    OptionSet: {
      '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
      TrueOption:  { Value: 1, Label: label('Yes') },
      FalseOption: { Value: 0, Label: label('No') },
    },
  }
}

/** Whole Number attribute */
function intAttr(name, display) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
    SchemaName: name, DisplayName: label(display),
    RequiredLevel: reqLevel(), Format: 'None',
    MinValue: 0, MaxValue: 2147483647,
  }
}

/** Decimal attribute */
function decAttr(name, display) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
    SchemaName: name, DisplayName: label(display),
    RequiredLevel: reqLevel(), MinValue: 0, MaxValue: 100, Precision: 2,
  }
}

/** Date/Time attribute */
function dtAttr(name, display) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
    SchemaName: name, DisplayName: label(display),
    RequiredLevel: reqLevel(), Format: 'DateAndTime',
    DateTimeBehavior: { Value: 'UserLocal' },
  }
}

/** File column (stores binary file content) */
function fileAttr(name, display, maxMB = 128) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.FileAttributeMetadata',
    SchemaName: name, DisplayName: label(display),
    RequiredLevel: reqLevel(), MaxSizeInKB: maxMB * 1024,
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Dataverse API calls ───────────────────────────────────────────────────────

async function metaPost(path, body) {
  const t = await tok()
  const res = await fetch(`${META}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${t}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.status === 204 ? null : res.json().catch(() => null)
}

async function metaGet(path) {
  const t = await tok()
  const res = await fetch(`${META}${path}`, {
    headers: { 'Authorization': `Bearer ${t}`, 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
  })
  return res
}

async function tableExists(logicalName) {
  const res = await metaGet(`/EntityDefinitions(LogicalName='${logicalName}')`)
  return res.ok
}

async function columnExists(entityLogicalName, attrLogicalName) {
  const res = await metaGet(`/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attrLogicalName}')`)
  return res.ok
}

// ── High-level helpers ────────────────────────────────────────────────────────

/**
 * Creates a Dataverse custom table.
 * primaryNameAttr must be a strAttr(..., true) call.
 * entitySetName must match what src/lib/dataverse.ts T object uses.
 */
async function createTable(logicalName, displayName, pluralName, entitySetName, primaryNameAttr) {
  if (await tableExists(logicalName)) {
    console.log(`  ⏭  ${logicalName}`)
    return false
  }
  await metaPost('/EntityDefinitions', {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: logicalName,
    LogicalName: logicalName,
    EntitySetName: entitySetName,
    DisplayName: label(displayName),
    DisplayCollectionName: label(pluralName),
    HasActivities: false,
    HasNotes: false,
    OwnershipType: 'UserOwned',
    Attributes: [primaryNameAttr],
  })
  console.log(`  ✓  ${logicalName}`)
  return true
}

/** Adds a column to an existing table, skipping if it already exists.
 *  Retries up to 3 times on transient 0x80040216 errors (schema throttle). */
async function addCol(entityLogical, attr) {
  const attrLogical = attr.SchemaName.toLowerCase()
  if (await columnExists(entityLogical, attrLogical)) return

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await metaPost(`/EntityDefinitions(LogicalName='${entityLogical}')/Attributes`, attr)
      return
    } catch (err) {
      const msg = String(err)
      if (msg.includes('409') || msg.includes('already exists')) return
      if (attempt < 3 && (msg.includes('0x80040216') || msg.includes('0x80048d19'))) {
        await sleep(attempt * 2000)
        continue
      }
      throw err
    }
  }
}

/** Adds a batch of columns with a short pause between each to avoid schema throttling. */
async function addCols(entityLogical, attrs) {
  for (const attr of attrs) {
    try {
      await addCol(entityLogical, attr)
      await sleep(800)
    } catch (err) {
      console.warn(`    ⚠  ${entityLogical}.${attr.SchemaName}: ${err.message}`)
    }
  }
}

/** Creates an alternate key on a table. */
async function addAltKey(entityLogical, keySchemaName, keyDisplay, keyAttrs) {
  try {
    await metaPost(`/EntityDefinitions(LogicalName='${entityLogical}')/Keys`, {
      SchemaName: keySchemaName,
      DisplayName: label(keyDisplay),
      KeyAttributes: keyAttrs,
    })
    console.log(`  ✓  key: ${keySchemaName}`)
  } catch (err) {
    if (String(err).includes('409') || String(err).includes('already exist')) {
      console.log(`  ⏭  key: ${keySchemaName}`)
    } else {
      console.warn(`  ⚠  key ${keySchemaName}: ${err.message}`)
    }
  }
}

// ── Table definitions ─────────────────────────────────────────────────────────
// Column SchemaName == LogicalName (all-lowercase) so OData column access is
// e.g. r['pdplr_fullname'] which matches what src/lib/dataverse.ts expects.

const n = suffix => `${P}${suffix}`   // e.g. n('fullname') → 'pdplr_fullname'

async function buildTables() {
  console.log('\n── Tables ───────────────────────────────────────────────────')

  // 1. pdplr_user
  await createTable(n('user'), 'User', 'Users', n('users'),
    strAttr(n('fullname'), 'Full Name', 200, true))
  await addCols(n('user'), [
    strAttr(n('entraobjectid'), 'Entra Object ID', 100),
    strAttr(n('email'),         'Email',           200),
    strAttr(n('role'),          'Role',             50),
    strAttr(n('department'),    'Department',       100),
    strAttr(n('jobtitle'),      'Job Title',        100),
    strAttr(n('initials'),      'Initials',          10),
    strAttr(n('avatarcolor'),   'Avatar Color',      20),
  ])

  // 2. pdplr_ticket
  await createTable(n('ticket'), 'Ticket', 'Tickets', n('tickets'),
    strAttr(n('ticketnumber'), 'Ticket Number', 50, true))
  await addCols(n('ticket'), [
    strAttr(n('type'),                    'Request Type',            80),
    strAttr(n('state'),                   'State',                   50),
    strAttr(n('title'),                   'Title',                  200),
    memoAttr(n('description'),            'Description'),
    strAttr(n('requesterid'),             'Requester ID',            50),
    strAttr(n('vendorref'),               'Vendor Ref',              50),
    strAttr(n('projectid'),               'Project ID',              50),
    strAttr(n('externalrecipientemail'),   'External Recipient Email',200),
    memoAttr(n('tags'),                   'Tags',                   500),
    memoAttr(n('payload'),                'Payload',             1048576),
    memoAttr(n('datadeclaration'),        'Data Declaration',    1048576),
    intAttr(n('slaackhours'),             'SLA Ack Hours'),
    intAttr(n('sladecisionhours'),        'SLA Decision Hours'),
    dtAttr(n('slastartedat'),             'SLA Started At'),
    strAttr(n('slaackby'),                'SLA Ack By',               50),
    dtAttr(n('slaackedat'),               'SLA Acked At'),
    dtAttr(n('sladecisiondueat'),         'SLA Decision Due At'),
    boolAttr(n('slabreached'),            'SLA Breached',          false),
    strAttr(n('preassessmentgenerationid'),'Pre-Assessment ID',       50),
    strAttr(n('parentticketid'),          'Parent Ticket ID',         50),
    dtAttr(n('submittedat'),              'Submitted At'),
    dtAttr(n('decidedat'),                'Decided At'),
  ])

  // 3. pdplr_reviewslot
  await createTable(n('reviewslot'), 'Review Slot', 'Review Slots', n('reviewslots'),
    strAttr(n('role'), 'Role', 50, true))
  await addCols(n('reviewslot'), [
    strAttr(n('ticketid'),              'Ticket ID',     50),
    strAttr(n('reviewerid'),            'Reviewer ID',   50),
    strAttr(n('verdict'),               'Verdict',       30),
    memoAttr(n('notes'),                'Notes'),
    dtAttr(n('decidedat'),              'Decided At'),
    strAttr(n('aicopilotgenerationid'), 'AI Copilot Gen ID', 50),
  ])

  // 4. pdplr_threadentry
  await createTable(n('threadentry'), 'Thread Entry', 'Thread Entries', n('threadentries'),
    strAttr(n('byrole'), 'By Role', 50, true))
  await addCols(n('threadentry'), [
    strAttr(n('ticketid'),      'Ticket ID',      50),
    strAttr(n('byuserid'),      'By User ID',     50),
    memoAttr(n('message'),      'Message'),
    memoAttr(n('attachmentids'),'Attachment IDs', 2000),
    memoAttr(n('aiscore'),      'AI Score',       2000),
    dtAttr(n('resolvedat'),     'Resolved At'),
    strAttr(n('resolvedby'),    'Resolved By',    50),
  ])

  // 5. pdplr_attachment
  await createTable(n('attachment'), 'Attachment', 'Attachments', n('attachments'),
    strAttr(n('filename'), 'Filename', 300, true))
  await addCols(n('attachment'), [
    strAttr(n('ticketid'),         'Ticket ID',         50),
    intAttr(n('sizebytes'),        'Size Bytes'),
    strAttr(n('contenttype'),      'Content Type',     100),
    strAttr(n('uploadedby'),       'Uploaded By',       50),
    dtAttr(n('uploadedat'),        'Uploaded At'),
    strAttr(n('storagepath'),      'Storage Path',     500),
    strAttr(n('scanstatus'),       'Scan Status',       30),
    strAttr(n('classification'),   'Classification',    30),
    strAttr(n('category'),         'Category',          30),
    memoAttr(n('extractedsummary'),'Extracted Summary'),
    fileAttr(n('filecontent'),     'File Content',     128),
  ])

  // 6. pdplr_auditevent
  await createTable(n('auditevent'), 'Audit Event', 'Audit Events', n('auditevents'),
    strAttr(n('action'), 'Action', 100, true))
  await addCols(n('auditevent'), [
    dtAttr(n('ts'),              'Timestamp'),
    strAttr(n('actorid'),        'Actor ID',           50),
    strAttr(n('actorrole'),      'Actor Role',         50),
    strAttr(n('targettype'),     'Target Type',        50),
    strAttr(n('targetid'),       'Target ID',          50),
    memoAttr(n('beforesnapshot'),'Before Snapshot', 1048576),
    memoAttr(n('aftersnapshot'), 'After Snapshot',  1048576),
    strAttr(n('iphash'),         'IP Hash',           100),
    strAttr(n('sessionid'),      'Session ID',        100),
    memoAttr(n('reason'),        'Reason'),
    strAttr(n('immutablehash'),  'Immutable Hash',    200),
    strAttr(n('prevhash'),       'Prev Hash',         200),
  ])

  // 7. pdplr_notification
  await createTable(n('notification'), 'Notification', 'Notifications', n('notifications'),
    strAttr(n('title'), 'Title', 200, true))
  await addCols(n('notification'), [
    strAttr(n('userid'),      'User ID',     50),
    strAttr(n('ts'),          'Timestamp',   50),
    boolAttr(n('read'),       'Read',     false),
    strAttr(n('category'),    'Category',    30),
    memoAttr(n('body'),       'Body'),
    strAttr(n('link'),        'Link',       500),
    strAttr(n('actionlabel'), 'Action Label',100),
    strAttr(n('ticketid'),    'Ticket ID',   50),
    strAttr(n('type'),        'Type',        80),
  ])

  // 8. pdplr_policy
  await createTable(n('policy'), 'Policy', 'Policies', n('policies'),
    strAttr(n('title'), 'Title', 200, true))
  await addCols(n('policy'), [
    strAttr(n('code'),           'Code',             50),
    strAttr(n('category'),       'Category',         30),
    strAttr(n('version'),        'Version',          20),
    strAttr(n('effectivedate'),  'Effective Date',   30),
    strAttr(n('ownerdept'),      'Owner Department', 100),
    strAttr(n('status'),         'Status',           20),
    memoAttr(n('summary'),       'Summary'),
    memoAttr(n('body'),          'Body',         1048576),
    boolAttr(n('embeddingsbuilt'),'Embeddings Built', false),
    intAttr(n('citationcount'),  'Citation Count'),
  ])

  // 9. pdplr_vendor
  await createTable(n('vendor'), 'Vendor', 'Vendors', n('vendors'),
    strAttr(n('tradename'), 'Trade Name', 200, true))
  await addCols(n('vendor'), [
    strAttr(n('legalname'),      'Legal Name',      200),
    strAttr(n('jurisdiction'),   'Jurisdiction',    100),
    decAttr(n('riskscore'),      'Risk Score'),
    strAttr(n('risktier'),       'Risk Tier',        20),
    strAttr(n('status'),         'Status',           20),
    strAttr(n('category'),       'Category',        100),
    strAttr(n('primarycontact'), 'Primary Contact', 200),
    memoAttr(n('certifications'),'Certifications',  500),
    boolAttr(n('hasdpa'),        'Has DPA',       false),
    strAttr(n('lastreviewedat'), 'Last Reviewed At', 50),
    memoAttr(n('notes'),         'Notes'),
  ])

  // 10. pdplr_project
  await createTable(n('project'), 'Project', 'Projects', n('projects'),
    strAttr(n('name'), 'Name', 200, true))
  await addCols(n('project'), [
    strAttr(n('code'),               'Code',              50),
    strAttr(n('businessunit'),       'Business Unit',    100),
    strAttr(n('ownerid'),            'Owner ID',          50),
    strAttr(n('vendorref'),          'Vendor Ref',        50),
    strAttr(n('status'),             'Status',            20),
    intAttr(n('datainventorycount'), 'Data Inventory Count'),
    memoAttr(n('description'),       'Description'),
    strAttr(n('startedat'),          'Started At',        50),
  ])

  // 11. pdplr_projectdocument
  await createTable(n('projectdocument'), 'Project Document', 'Project Documents', n('projectdocuments'),
    strAttr(n('title'), 'Title', 200, true))
  await addCols(n('projectdocument'), [
    strAttr(n('projectid'),      'Project ID',       50),
    strAttr(n('vendorref'),      'Vendor Ref',       50),
    strAttr(n('parentdocumentid'),'Parent Doc ID',   50),
    strAttr(n('documenttype'),   'Document Type',    30),
    intAttr(n('version'),        'Version'),
    strAttr(n('status'),         'Status',           20),
    strAttr(n('filepath'),       'File Path',       500),
    strAttr(n('filetype'),       'File Type',       100),
    intAttr(n('filesize'),       'File Size'),
    memoAttr(n('description'),   'Description'),
    memoAttr(n('tags'),          'Tags',            500),
    strAttr(n('effectivedate'),  'Effective Date',   30),
    strAttr(n('expirydate'),     'Expiry Date',      30),
    strAttr(n('uploadedby'),     'Uploaded By',      50),
    fileAttr(n('filecontent'),   'File Content',    128),
  ])

  // 12. pdplr_reviewertemplate
  await createTable(n('reviewertemplate'), 'Reviewer Template', 'Reviewer Templates', n('reviewertemplates'),
    strAttr(n('title'), 'Title', 200, true))
  await addCols(n('reviewertemplate'), [
    memoAttr(n('description'), 'Description'),
    strAttr(n('category'),     'Category',    30),
    strAttr(n('filepath'),     'File Path',  500),
    strAttr(n('filetype'),     'File Type',   20),
    boolAttr(n('isactive'),    'Is Active', true),
    strAttr(n('uploadedby'),   'Uploaded By', 50),
    fileAttr(n('filecontent'), 'File Content',128),
  ])

  // 13. pdplr_appsettings
  await createTable(n('appsettings'), 'App Settings', 'App Settings', n('appsettingses'),
    strAttr(n('name'), 'Name', 100, true))
  await addCols(n('appsettings'), [
    boolAttr(n('requiredocumentvalidation'), 'Require Document Validation', false),
    memoAttr(n('workflowconfig'), 'Workflow Config', 4000),
  ])

  // 14. pdplr_externallink
  await createTable(n('externallink'), 'External Link', 'External Links', n('externallinks'),
    strAttr(n('label'), 'Label', 200, true))
  await addCols(n('externallink'), [
    strAttr(n('token'),          'Token',           200),
    dtAttr(n('expiresat'),       'Expires At'),
    boolAttr(n('revoked'),       'Revoked',       false),
    strAttr(n('recipientemail'), 'Recipient Email', 200),
    strAttr(n('recipientname'),  'Recipient Name',  200),
    strAttr(n('status'),         'Status',           30),
    dtAttr(n('approvedat'),      'Approved At'),
  ])

  // 15. pdplr_notifpreference
  await createTable(n('notifpreference'), 'Notification Preference', 'Notification Preferences', n('notifpreferences'),
    strAttr(n('type'), 'Notification Type', 80, true))
  await addCols(n('notifpreference'), [
    strAttr(n('userid'),  'User ID',       50),
    boolAttr(n('inapp'),  'In-App Enabled', true),
  ])
}

// ── Alternate keys ────────────────────────────────────────────────────────────

async function buildKeys() {
  console.log('\n── Alternate keys ───────────────────────────────────────────')
  await addAltKey(n('user'),           n('user_entraid_key'),          'Entra Object ID',    [n('entraobjectid')])
  await addAltKey(n('ticket'),         n('ticket_number_key'),         'Ticket Number',      [n('ticketnumber')])
  await addAltKey(n('reviewslot'),     n('reviewslot_ticket_role_key'),'Ticket + Role',      [n('ticketid'), n('role')])
  await addAltKey(n('notifpreference'),n('notifpref_user_type_key'),   'User + Type',        [n('userid'),   n('type')])
}

// ── Seed data ─────────────────────────────────────────────────────────────────

async function seedAppSettings() {
  console.log('\n── Seed data ────────────────────────────────────────────────')
  const t = await tok()
  const res = await fetch(`${API}/${n('appsettingses')}?$top=1&$select=${n('appsettingsid')}`, {
    headers: { 'Authorization': `Bearer ${t}`, 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
  })
  const data = await res.json().catch(() => ({ value: [] }))

  if (data.value?.length > 0) {
    console.log(`  ⏭  appsettings row already exists`)
    return
  }

  const t2 = await tok()
  const r = await fetch(`${API}/${n('appsettingses')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${t2}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ [n('name')]: 'Default', [n('requiredocumentvalidation')]: false }),
  })
  if (r.ok) {
    console.log(`  ✓  appsettings row created`)
  } else {
    const err = await r.text().catch(() => '')
    console.warn(`  ⚠  appsettings seed failed: ${err.slice(0, 200)}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('PDPL Reviewer — Dataverse Setup')
console.log('=================================')
console.log(`Environment : ${DV_URL}`)
console.log(`Prefix      : ${P}`)
console.log('\nSign in with an account that has the System Administrator role.')
console.log('(A browser code prompt will appear below)\n')

try {
  await buildTables()
  await buildKeys()
  await seedAppSettings()

  console.log('\n✅  Setup complete!')
  console.log('   All tables, columns, and alternate keys are ready.')
  console.log('   Start the app: npm run dev\n')
} catch (err) {
  console.error('\n❌  Setup failed:', err.message)
  if (err.message.includes('401')) {
    console.error('    Hint: Make sure "Allow public client flows" is enabled in your App Registration')
    console.error('    (Azure Portal → App Registrations → Authentication → Advanced settings)')
  }
  process.exit(1)
}
