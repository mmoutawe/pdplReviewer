import type {
  User, Ticket, AuditEvent, Notification, Policy, Vendor, Project,
  Attachment, ReviewSlot, ReturnThreadEntry,
} from '../data/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env as Record<string, string | undefined>

export const dvOrgUrl = env.VITE_DATAVERSE_URL  // e.g. https://org.crm.dynamics.com
export const isDataverseConfigured = !!dvOrgUrl

const API = `${dvOrgUrl}/api/data/v9.2`

// Publisher prefix — must match your Dataverse solution publisher (default: pdplr_)
const PFX = env.VITE_DV_TABLE_PREFIX ?? 'pdplr_'

// Convenience: prefix a column logical name
const c = (name: string) => `${PFX}${name}`

// ── Token provider (set by auth.ts after MSAL init) ────────

let _getToken: (() => Promise<string>) | null = null

export function initDataverseTokenProvider(fn: () => Promise<string>): void {
  _getToken = fn
}

async function getToken(): Promise<string> {
  if (!_getToken) throw new Error('Dataverse token provider not initialized')
  return _getToken()
}

// ── Entity set names (OData plural) ───────────────────────

export const T = {
  users:             c('users'),
  tickets:           c('tickets'),
  reviewSlots:       c('reviewslots'),
  threadEntries:     c('threadentries'),
  attachments:       c('attachments'),
  auditEvents:       c('auditevents'),
  notifications:     c('notifications'),
  policies:          c('policies'),
  vendors:           c('vendors'),
  projects:          c('projects'),
  projectDocuments:  c('projectdocuments'),
  reviewerTemplates: c('reviewertemplates'),
  appSettings:       c('appsettings'),
  externalLinks:     c('externallinks'),
  notifPreferences:  c('notifpreferences'),
}

// ── Core fetch wrapper ─────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
  const tok = await getToken()
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Authorization': `Bearer ${tok}`,
      ...(opts?.headers ?? {}),
    },
  })
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Dataverse ${res.status}: ${body}`)
  }
  return res
}

// ── CRUD helpers ───────────────────────────────────────────

export async function dvList<T>(entitySet: string, query?: string): Promise<T[]> {
  const res = await apiFetch(`/${entitySet}${query ? `?${query}` : ''}`)
  const data = await res.json() as { value: T[] }
  return data.value
}

export async function dvGet<T>(entitySet: string, id: string, query?: string): Promise<T | null> {
  try {
    const res = await apiFetch(`/${entitySet}(${id})${query ? `?${query}` : ''}`)
    return await res.json() as T
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) return null
    throw e
  }
}

// Returns the new record including its generated PK
export async function dvCreate<T>(entitySet: string, body: Record<string, unknown>): Promise<T> {
  const res = await apiFetch(`/${entitySet}`, {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  })
  return await res.json() as T
}

export async function dvUpdate(entitySet: string, id: string, body: Record<string, unknown>): Promise<void> {
  await apiFetch(`/${entitySet}(${id})`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function dvDelete(entitySet: string, id: string): Promise<void> {
  await apiFetch(`/${entitySet}(${id})`, { method: 'DELETE' })
}

// Upsert via alternate key string, e.g. "pdplr_ticketnumber='PDPL-2026-0042'"
export async function dvUpsert(entitySet: string, altKey: string, body: Record<string, unknown>): Promise<void> {
  await apiFetch(`/${entitySet}(${altKey})`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

// ── File column operations ─────────────────────────────────

export async function dvUploadFile(
  entitySet: string,
  id: string,
  column: string,
  file: File,
): Promise<void> {
  const tok = await getToken()
  const buf = await file.arrayBuffer()
  const res = await fetch(`${API}/${entitySet}(${id})/${column}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-ms-file-name': encodeURIComponent(file.name),
      'Authorization': `Bearer ${tok}`,
    },
    body: buf,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Dataverse file upload ${res.status}: ${body}`)
  }
}

// Fetches file content and returns a temporary object URL (valid for the page session)
export async function dvGetFileBlobUrl(
  entitySet: string,
  id: string,
  column: string,
): Promise<string> {
  const tok = await getToken()
  const res = await fetch(`${API}/${entitySet}(${id})/${column}/$value`, {
    headers: { 'Authorization': `Bearer ${tok}` },
  })
  if (!res.ok) throw new Error(`Dataverse file download ${res.status}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function dvDownloadFile(
  entitySet: string,
  id: string,
  column: string,
  filename: string,
): Promise<void> {
  const url = await dvGetFileBlobUrl(entitySet, id, column)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Polling helper (replaces Supabase realtime) ────────────

export function startPolling(fn: () => Promise<void>, intervalMs = 15_000): () => void {
  void fn()
  const id = setInterval(() => void fn(), intervalMs)
  return () => clearInterval(id)
}

// ── Raw Dataverse row types (all columns prefixed with PFX) ─
// Column logical name = PFX + name (e.g. pdplr_fullname)
// System columns (createdon, modifiedon) have no prefix.

type DvRow = Record<string, unknown>

// ── Transformer helpers ────────────────────────────────────

function str(r: DvRow, name: string): string {
  return (r[c(name)] as string) ?? ''
}
function nullable(r: DvRow, name: string): string | undefined {
  const v = r[c(name)]
  return v != null ? String(v) : undefined
}
function bool(r: DvRow, name: string): boolean {
  return !!(r[c(name)])
}
function num(r: DvRow, name: string): number {
  return Number(r[c(name)] ?? 0)
}
function json<T>(r: DvRow, name: string, fallback: T): T {
  const v = r[c(name)]
  if (!v) return fallback
  try { return JSON.parse(v as string) as T } catch { return fallback }
}
function arr(r: DvRow, name: string): string[] {
  const v = r[c(name)] as string | undefined
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []
}
function pk(r: DvRow, name: string): string {
  return (r[c(name)] as string) ?? ''
}
function sysDt(r: DvRow, name: string): string {
  return (r[name] as string) ?? new Date().toISOString()
}

// ── Row → TypeScript transformers ─────────────────────────

export function toUser(r: DvRow): User {
  return {
    id:          pk(r, 'userid'),
    fullName:    str(r, 'fullname'),
    email:       str(r, 'email'),
    role:        str(r, 'role') as User['role'],
    department:  str(r, 'department'),
    jobTitle:    str(r, 'jobtitle'),
    initials:    str(r, 'initials'),
    avatarColor: str(r, 'avatarcolor'),
  }
}

export function toReviewSlot(r: DvRow): ReviewSlot {
  return {
    role:                  str(r, 'role') as ReviewSlot['role'],
    reviewerId:            nullable(r, 'reviewerid') ?? null,
    verdict:               str(r, 'verdict') as ReviewSlot['verdict'],
    decidedAt:             nullable(r, 'decidedat'),
    notes:                 nullable(r, 'notes'),
    aiCopilotGenerationId: nullable(r, 'aicopilotgenerationid'),
  }
}

export function toReturnThreadEntry(r: DvRow): ReturnThreadEntry {
  return {
    id:           pk(r, 'threadentryid'),
    by:           str(r, 'byuserid'),
    byRole:       str(r, 'byrole') as ReturnThreadEntry['byRole'],
    message:      str(r, 'message'),
    createdAt:    sysDt(r, 'createdon'),
    attachmentIds: arr(r, 'attachmentids'),
    aiScore:       json(r, 'aiscore', undefined),
    resolvedAt:    nullable(r, 'resolvedat'),
    resolvedBy:    nullable(r, 'resolvedby'),
  }
}

export function toTicket(
  r: DvRow,
  slots: DvRow[],
  thread: DvRow[],
  attachments: Attachment[] = [],
): Ticket {
  return {
    id:           str(r, 'ticketnumber'),
    type:         str(r, 'type') as Ticket['type'],
    state:        str(r, 'state') as Ticket['state'],
    title:        str(r, 'title'),
    description:  str(r, 'description'),
    requesterId:  str(r, 'requesterid'),
    vendorId:     nullable(r, 'vendorid'),
    projectId:    nullable(r, 'projectid'),
    externalRecipientEmail: nullable(r, 'externalrecipientemail'),
    tags:         arr(r, 'tags'),
    payload:      json(r, 'payload', {} as Ticket['payload']),
    dataDeclaration: json(r, 'datadeclaration', {} as Ticket['dataDeclaration']),
    sla: {
      ackHours:       num(r, 'slaackhours'),
      decisionHours:  num(r, 'sladecisionhours'),
      startedAt:      str(r, 'slastartedat') || sysDt(r, 'createdon'),
      ackBy:          nullable(r, 'slaackby'),
      ackedAt:        nullable(r, 'slaackedat'),
      decisionDueAt:  str(r, 'sladecisiondueat') || new Date(Date.now() + 72 * 3600000).toISOString(),
      breached:       bool(r, 'slabreached'),
    },
    reviews:      slots.map(toReviewSlot),
    returnThread: thread.map(toReturnThreadEntry),
    attachments,
    preAssessmentGenerationId: nullable(r, 'preassessmentgenerationid'),
    parentTicketId:            nullable(r, 'parentticketid'),
    submittedAt:               nullable(r, 'submittedat'),
    decidedAt:                 nullable(r, 'decidedat'),
    createdAt:                 sysDt(r, 'createdon'),
    updatedAt:                 sysDt(r, 'modifiedon'),
  }
}

export function toNotification(r: DvRow): Notification {
  return {
    id:          pk(r, 'notificationid'),
    userId:      str(r, 'userid'),
    ts:          str(r, 'ts') || sysDt(r, 'createdon'),
    read:        bool(r, 'read'),
    category:    str(r, 'category') as Notification['category'],
    title:       str(r, 'title'),
    body:        str(r, 'body'),
    link:        nullable(r, 'link'),
    actionLabel: nullable(r, 'actionlabel'),
    ticketId:    nullable(r, 'ticketid'),
  }
}

export function toPolicy(r: DvRow): Policy {
  return {
    id:              pk(r, 'policyid'),
    code:            str(r, 'code'),
    title:           str(r, 'title'),
    category:        str(r, 'category') as Policy['category'],
    version:         str(r, 'version'),
    effectiveDate:   str(r, 'effectivedate'),
    ownerDept:       str(r, 'ownerdept'),
    status:          str(r, 'status') as Policy['status'],
    summary:         str(r, 'summary'),
    body:            str(r, 'body'),
    embeddingsBuilt: bool(r, 'embeddingsbuilt'),
    citationCount:   num(r, 'citationcount'),
  }
}

export function toVendor(r: DvRow): Vendor {
  return {
    id:             pk(r, 'vendorid'),
    legalName:      str(r, 'legalname'),
    tradeName:      str(r, 'tradename'),
    jurisdiction:   str(r, 'jurisdiction'),
    riskScore:      num(r, 'riskscore'),
    riskTier:       str(r, 'risktier') as Vendor['riskTier'],
    status:         str(r, 'status') as Vendor['status'],
    category:       str(r, 'category'),
    primaryContact: str(r, 'primarycontact'),
    certifications: arr(r, 'certifications'),
    hasDPA:         bool(r, 'hasdpa'),
    lastReviewedAt: str(r, 'lastreviewedat') || new Date().toISOString(),
    ticketIds:      [],
    notes:          str(r, 'notes'),
  }
}

export function toProject(r: DvRow): Project {
  return {
    id:                 pk(r, 'projectid'),
    code:               str(r, 'code'),
    name:               str(r, 'name'),
    businessUnit:       str(r, 'businessunit'),
    ownerId:            str(r, 'ownerid'),
    status:             str(r, 'status') as Project['status'],
    dataInventoryCount: num(r, 'datainventorycount'),
    ticketIds:          [],
    description:        str(r, 'description'),
    startedAt:          str(r, 'startedat'),
  }
}

export function toAuditEvent(r: DvRow): AuditEvent {
  return {
    id:            pk(r, 'auditeventid'),
    ts:            str(r, 'ts') || sysDt(r, 'createdon'),
    actorId:       str(r, 'actorid'),
    actorRole:     str(r, 'actorrole') as AuditEvent['actorRole'],
    action:        str(r, 'action'),
    targetType:    str(r, 'targettype') as AuditEvent['targetType'],
    targetId:      str(r, 'targetid'),
    before:        json(r, 'beforesnapshot', undefined),
    after:         json(r, 'aftersnapshot', undefined),
    ipHash:        nullable(r, 'iphash'),
    sessionId:     nullable(r, 'sessionid'),
    reason:        nullable(r, 'reason'),
    immutableHash: str(r, 'immutablehash'),
    prevHash:      nullable(r, 'prevhash'),
  }
}

export function toAttachment(r: DvRow, blobUrl?: string): Attachment {
  return {
    id:               pk(r, 'attachmentid'),
    ticketId:         str(r, 'ticketid'),
    filename:         str(r, 'filename'),
    sizeBytes:        num(r, 'sizebytes'),
    contentType:      str(r, 'contenttype'),
    uploadedBy:       str(r, 'uploadedby'),
    uploadedAt:       str(r, 'uploadedat') || sysDt(r, 'createdon'),
    storageBucket:    'dataverse',
    storagePath:      str(r, 'storagepath'),
    signedUrl:        blobUrl,
    scanStatus:       str(r, 'scanstatus') as Attachment['scanStatus'],
    classification:   str(r, 'classification') as Attachment['classification'],
    category:         str(r, 'category') as Attachment['category'],
    extractedSummary: nullable(r, 'extractedsummary'),
  }
}
