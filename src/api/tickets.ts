import {
  dvList, dvGet, dvCreate, dvUpdate, dvDelete, dvUpsert,
  T, toTicket, toAttachment, startPolling,
} from '../lib/dataverse'
import type { Ticket, TicketState, RequestType, DataDeclaration } from '../data/types'
import { cacheUsers } from '../lib/userCache'
import { getDataverseToken } from './auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env as Record<string, string | undefined>

type DvRow = Record<string, unknown>

// ── Helpers ───────────────────────────────────────────────

/** Enrich all attachments with blob URLs */
async function hydrateAttachments(attRows: DvRow[]): Promise<import('../data/types').Attachment[]> {
  return Promise.all(
    attRows.map(async (r) => {
      const id = r['pdplr_attachmentid'] as string
      if (!id) return toAttachment(r)
      try {
        const tok = await getDataverseToken()
        const res = await fetch(
          `${env.VITE_DATAVERSE_URL}/api/data/v9.2/${T.attachments}(${id})/pdplr_filecontent/$value`,
          { headers: { Authorization: `Bearer ${tok}` } },
        )
        const blobUrl = res.ok ? URL.createObjectURL(await res.blob()) : undefined
        return toAttachment(r, blobUrl)
      } catch {
        return toAttachment(r)
      }
    }),
  )
}

async function loadRelated(ticketIds: string[]): Promise<{
  slots: DvRow[]
  thread: DvRow[]
  attRows: DvRow[]
}> {
  if (!ticketIds.length) return { slots: [], thread: [], attRows: [] }

  const idList = ticketIds.map((id) => `pdplr_ticketid eq '${id}'`).join(' or ')
  const [slots, thread, attRows] = await Promise.all([
    dvList<DvRow>(T.reviewSlots,    `$filter=${idList}`),
    dvList<DvRow>(T.threadEntries,  `$filter=${idList}&$orderby=createdon asc`),
    dvList<DvRow>(T.attachments,    `$filter=${idList}&$orderby=pdplr_uploadedat asc`),
  ])
  return { slots, thread, attRows }
}

async function populateUserCache(tickets: DvRow[], thread: DvRow[]) {
  const userIds = [...new Set([
    ...tickets.map((t) => t['pdplr_requesterid'] as string),
    ...thread.map((e) => e['pdplr_byuserid'] as string),
  ])].filter(Boolean)

  if (!userIds.length) return

  const filter = userIds.map((id) => `pdplr_userid eq '${id}'`).join(' or ')
  const rows = await dvList<DvRow>(T.users, `$filter=${filter}&$select=pdplr_userid,pdplr_fullname,pdplr_initials,pdplr_avatarcolor`)
  cacheUsers(rows.map((u) => ({
    id:          u['pdplr_userid'] as string,
    fullName:    u['pdplr_fullname'] as string,
    initials:    u['pdplr_initials'] as string,
    avatarColor: u['pdplr_avatarcolor'] as string,
  })))
}

// ── Fetch ─────────────────────────────────────────────────

export async function fetchTickets(filters?: {
  state?: TicketState[]
  requesterId?: string
  projectId?: string
  vendorId?: string
}): Promise<Ticket[]> {
  const parts: string[] = []
  if (filters?.state?.length)
    parts.push(`(${filters.state.map((s) => `pdplr_state eq '${s}'`).join(' or ')})`)
  if (filters?.requesterId) parts.push(`pdplr_requesterid eq '${filters.requesterId}'`)
  if (filters?.projectId)   parts.push(`pdplr_projectid eq '${filters.projectId}'`)
  if (filters?.vendorId)    parts.push(`pdplr_vendorid eq '${filters.vendorId}'`)

  const query = `$orderby=createdon desc${parts.length ? `&$filter=${parts.join(' and ')}` : ''}`
  const tickets = await dvList<DvRow>(T.tickets, query)

  const ticketDbIds = tickets.map((t) => t['pdplr_ticketid'] as string).filter(Boolean)
  const { slots, thread, attRows } = await loadRelated(ticketDbIds)
  await populateUserCache(tickets, thread)
  const attachments = await hydrateAttachments(attRows)

  return tickets.map((t) => {
    const tId = t['pdplr_ticketid'] as string
    return toTicket(
      t,
      slots.filter((s) => s['pdplr_ticketid'] === tId),
      thread.filter((e) => e['pdplr_ticketid'] === tId),
      attachments.filter((a) => a.ticketId === tId),
    )
  })
}

export async function fetchTicketById(id: string): Promise<Ticket | null> {
  // `id` is the human-readable ticket number (e.g. PDPL-2026-0042)
  const rows = await dvList<DvRow>(T.tickets, `$filter=pdplr_ticketnumber eq '${id}'&$top=1`)
  if (!rows.length) return null
  const ticket = rows[0]
  const tId = ticket['pdplr_ticketid'] as string

  const [slots, thread, attRows] = await Promise.all([
    dvList<DvRow>(T.reviewSlots,   `$filter=pdplr_ticketid eq '${tId}'`),
    dvList<DvRow>(T.threadEntries, `$filter=pdplr_ticketid eq '${tId}'&$orderby=createdon asc`),
    dvList<DvRow>(T.attachments,   `$filter=pdplr_ticketid eq '${tId}'&$orderby=pdplr_uploadedat asc`),
  ])

  await populateUserCache([ticket], thread)
  const attachments = await hydrateAttachments(attRows)
  return toTicket(ticket, slots, thread, attachments)
}

// ── Create / Update ───────────────────────────────────────

export interface CreateTicketInput {
  type: RequestType
  title: string
  description: string
  payload: Record<string, unknown>
  dataDeclaration: DataDeclaration
  vendorId?: string
  projectId?: string
  tags?: string[]
}

/** Generates a ticket number in the format PDPL-YYYY-NNNN */
async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await dvList<DvRow>(T.tickets, `$filter=pdplr_ticketnumber eq 'PDPL-${year}' and pdplr_ticketnumber ne null&$select=pdplr_ticketnumber&$top=1000`)
  const next = String(count.length + 1).padStart(4, '0')
  return `PDPL-${year}-${next}`
}

export async function createTicket(input: CreateTicketInput, requesterId: string): Promise<Ticket> {
  const ticketNumber = await nextTicketNumber()
  const now = new Date().toISOString()

  const row = await dvCreate<DvRow>(T.tickets, {
    pdplr_ticketnumber:       ticketNumber,
    pdplr_type:               input.type,
    pdplr_state:              'draft',
    pdplr_title:              input.title,
    pdplr_description:        input.description,
    pdplr_requesterid:        requesterId,
    pdplr_vendorid:           input.vendorId ?? null,
    pdplr_projectid:          input.projectId ?? null,
    pdplr_tags:               (input.tags ?? []).join(','),
    pdplr_payload:            JSON.stringify(input.payload),
    pdplr_datadeclaration:    JSON.stringify(input.dataDeclaration),
    pdplr_slaackhours:        24,
    pdplr_sladecisionhours:   72,
    pdplr_slastartedat:       now,
    pdplr_sladecisiondueat:   new Date(Date.now() + 72 * 3600000).toISOString(),
    pdplr_slabreached:        false,
  })

  return toTicket(row, [], [])
}

export async function submitTicket(id: string): Promise<Ticket> {
  const rows = await dvList<DvRow>(T.tickets, `$filter=pdplr_ticketnumber eq '${id}'&$top=1`)
  if (!rows.length) throw new Error('Ticket not found')
  const tId = rows[0]['pdplr_ticketid'] as string

  await dvUpdate(T.tickets, tId, {
    pdplr_state:       'submitted',
    pdplr_submittedat: new Date().toISOString(),
  })

  await dvCreate<DvRow>(T.reviewSlots, {
    pdplr_ticketid: tId,
    pdplr_role:     'data_management',
    pdplr_verdict:  'pending',
  })

  return (await fetchTicketById(id))!
}

export async function transitionTicket(
  id: string,
  newState: TicketState,
  _reason?: string,
): Promise<Ticket> {
  const rows = await dvList<DvRow>(T.tickets, `$filter=pdplr_ticketnumber eq '${id}'&$top=1`)
  if (!rows.length) throw new Error('Ticket not found')
  const tId = rows[0]['pdplr_ticketid'] as string

  await dvUpdate(T.tickets, tId, { pdplr_state: newState })

  if (newState === 'in_legal_review') {
    await dvUpsert(
      T.reviewSlots,
      `pdplr_ticketid='${tId}',pdplr_role='legal'`,
      { pdplr_ticketid: tId, pdplr_role: 'legal', pdplr_verdict: 'pending' },
    )
  }
  if (newState === 'in_security_review') {
    await dvUpsert(
      T.reviewSlots,
      `pdplr_ticketid='${tId}',pdplr_role='security'`,
      { pdplr_ticketid: tId, pdplr_role: 'security', pdplr_verdict: 'pending' },
    )
  }

  return (await fetchTicketById(id))!
}

export async function saveReviewDecision(
  ticketId: string,
  role: 'data_management' | 'legal' | 'security',
  verdict: 'approve' | 'return' | 'reject' | 'escalate',
  notes?: string,
  reviewerId?: string,
): Promise<void> {
  const ticketRows = await dvList<DvRow>(T.tickets, `$filter=pdplr_ticketnumber eq '${ticketId}'&$top=1`)
  if (!ticketRows.length) throw new Error('Ticket not found')
  const tId = ticketRows[0]['pdplr_ticketid'] as string

  await dvUpsert(
    T.reviewSlots,
    `pdplr_ticketid='${tId}',pdplr_role='${role}'`,
    {
      pdplr_ticketid:  tId,
      pdplr_role:      role,
      pdplr_reviewerid: reviewerId ?? null,
      pdplr_verdict:   verdict,
      pdplr_notes:     notes ?? null,
      pdplr_decidedat: new Date().toISOString(),
    },
  )
}

export async function addReturnComment(
  ticketId: string,
  message: string,
  attachmentIds?: string[],
  userId?: string,
  userRole?: string,
): Promise<void> {
  const ticketRows = await dvList<DvRow>(T.tickets, `$filter=pdplr_ticketnumber eq '${ticketId}'&$top=1`)
  if (!ticketRows.length) throw new Error('Ticket not found')
  const tId = ticketRows[0]['pdplr_ticketid'] as string

  await dvCreate<DvRow>(T.threadEntries, {
    pdplr_ticketid:     tId,
    pdplr_byuserid:     userId ?? '',
    pdplr_byrole:       userRole ?? 'requester',
    pdplr_message:      message,
    pdplr_attachmentids: (attachmentIds ?? []).join(','),
  })
}

// ── Polling subscriptions (replace Supabase realtime) ─────

export function subscribeToTicket(
  ticketId: string,
  onUpdate: (ticket: Ticket) => void,
): () => void {
  return startPolling(async () => {
    const ticket = await fetchTicketById(ticketId)
    if (ticket) onUpdate(ticket)
  }, 15_000)
}

export function subscribeToTickets(
  onUpdate: (ticket: Ticket) => void,
): () => void {
  let knownUpdatedAt: Record<string, string> = {}

  return startPolling(async () => {
    const tickets = await fetchTickets()
    for (const t of tickets) {
      if (knownUpdatedAt[t.id] !== t.updatedAt) {
        knownUpdatedAt[t.id] = t.updatedAt
        onUpdate(t)
      }
    }
  }, 20_000)
}

export async function deleteTicket(id: string): Promise<void> {
  const rows = await dvList<DvRow>(T.tickets, `$filter=pdplr_ticketnumber eq '${id}'&$top=1`)
  if (!rows.length) return
  await dvDelete(T.tickets, rows[0]['pdplr_ticketid'] as string)
}

// Re-export dvGet for convenience
export { dvGet }
