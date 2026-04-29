import { supabase, toTicket, toAttachment } from '../lib/supabase'
import type { Ticket, TicketState, RequestType, DataDeclaration } from '../data/types'
import { cacheUsers } from '../lib/userCache'

const ATTACHMENT_BUCKET = 'ticket-attachments'
const SIGNED_URL_TTL = 3600

// ── Fetch ─────────────────────────────────────────────────

export async function fetchTickets(filters?: {
  state?: TicketState[]
  requesterId?: string
  projectId?: string
  vendorId?: string
}): Promise<Ticket[]> {
  if (!supabase) throw new Error('Supabase not configured')

  let q = supabase.from('tickets').select('*')

  if (filters?.state?.length) q = q.in('state', filters.state)
  if (filters?.requesterId)   q = q.eq('requester_id', filters.requesterId)
  if (filters?.projectId)     q = q.eq('project_id', filters.projectId)
  if (filters?.vendorId)      q = q.eq('vendor_id', filters.vendorId)

  const { data: tickets, error } = await q.order('created_at', { ascending: false })
  if (error) throw error

  const ticketIds = tickets.map((t) => t.id)

  // Fetch slots, threads, and attachments in parallel
  const [{ data: slots }, { data: thread }, { data: attRows }] = await Promise.all([
    supabase.from('review_slots').select('*').in('ticket_id', ticketIds),
    supabase.from('return_thread_entries').select('*').in('ticket_id', ticketIds).order('created_at'),
    supabase.from('attachments').select('*').in('ticket_id', ticketIds).order('uploaded_at'),
  ])

  // Batch signed URLs for all attachments
  const paths = (attRows ?? []).map((r) => r.storage_path as string)
  const signedUrls = paths.length
    ? await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
    : { data: [] }

  const urlMap = new Map(
    (signedUrls.data ?? []).map((u) => [u.path, u.signedUrl])
  )

  // Populate user cache for requester + thread participant display
  const userIds = [...new Set([
    ...tickets.map((t) => t.requester_id as string),
    ...(thread ?? []).map((e) => e.by_user_id as string),
  ])]
  if (userIds.length) {
    const { data: userRows } = await supabase
      .from('users').select('id, full_name, initials, avatar_color').in('id', userIds)
    if (userRows) {
      cacheUsers(userRows.map((u) => ({
        id: u.id as string,
        fullName: u.full_name as string,
        initials: u.initials as string,
        avatarColor: u.avatar_color as string,
      })))
    }
  }

  return tickets.map((t) => {
    const tAtts = (attRows ?? [])
      .filter((r) => r.ticket_id === t.id)
      .map((r) => toAttachment(r, urlMap.get(r.storage_path) ?? undefined))
    return toTicket(
      t,
      (slots ?? []).filter((s) => s.ticket_id === t.id),
      (thread ?? []).filter((e) => e.ticket_id === t.id),
      tAtts,
    )
  })
}

export async function fetchTicketById(id: string): Promise<Ticket | null> {
  if (!supabase) throw new Error('Supabase not configured')

  const [{ data: ticket }, { data: slots }, { data: thread }, { data: attRows }] = await Promise.all([
    supabase.from('tickets').select('*').eq('id', id).single(),
    supabase.from('review_slots').select('*').eq('ticket_id', id),
    supabase.from('return_thread_entries').select('*').eq('ticket_id', id).order('created_at'),
    supabase.from('attachments').select('*').eq('ticket_id', id).order('uploaded_at'),
  ])

  if (!ticket) return null

  const paths = (attRows ?? []).map((r) => r.storage_path as string)
  const signedUrls = paths.length
    ? await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
    : { data: [] }

  const urlMap = new Map((signedUrls.data ?? []).map((u) => [u.path, u.signedUrl]))
  const attachments = (attRows ?? []).map((r) => toAttachment(r, urlMap.get(r.storage_path) ?? undefined))

  // Populate user cache
  const userIds = [...new Set([
    ticket.requester_id as string,
    ...(thread ?? []).map((e) => e.by_user_id as string),
  ])]
  const { data: userRows } = await supabase
    .from('users').select('id, full_name, initials, avatar_color').in('id', userIds)
  if (userRows) {
    cacheUsers(userRows.map((u) => ({
      id: u.id as string,
      fullName: u.full_name as string,
      initials: u.initials as string,
      avatarColor: u.avatar_color as string,
    })))
  }

  return toTicket(ticket, slots ?? [], thread ?? [], attachments)
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

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const id = await supabase.rpc('next_ticket_id') as unknown as { data: string }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      id: id.data,
      type: input.type,
      state: 'draft',
      title: input.title,
      description: input.description,
      requester_id: user.id,
      vendor_id: input.vendorId ?? null,
      project_id: input.projectId ?? null,
      tags: input.tags ?? [],
      payload: input.payload,
      data_declaration: input.dataDeclaration,
      sla_ack_hours: 24,
      sla_decision_hours: 72,
    })
    .select()
    .single()

  if (error) throw error
  return toTicket(ticket, [], [])
}

export async function submitTicket(id: string): Promise<Ticket> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update({ state: 'submitted' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // Create initial review slots
  await supabase.from('review_slots').insert([
    { ticket_id: id, role: 'data_management', verdict: 'pending' },
  ])

  return toTicket(ticket, [], [])
}

export async function transitionTicket(
  id: string,
  newState: TicketState,
  reason?: string,
): Promise<Ticket> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update({ state: newState })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // Spawn parallel review slots when entering legal/security review
  if (newState === 'in_legal_review') {
    await supabase.from('review_slots').upsert([
      { ticket_id: id, role: 'legal', verdict: 'pending' },
    ], { onConflict: 'ticket_id,role' })
  }
  if (newState === 'in_security_review') {
    await supabase.from('review_slots').upsert([
      { ticket_id: id, role: 'security', verdict: 'pending' },
    ], { onConflict: 'ticket_id,role' })
  }

  void reason // will be written to audit log by Edge Function

  const [{ data: slots }, { data: thread }] = await Promise.all([
    supabase.from('review_slots').select('*').eq('ticket_id', id),
    supabase.from('return_thread_entries').select('*').eq('ticket_id', id).order('created_at'),
  ])

  return toTicket(ticket, slots ?? [], thread ?? [])
}

export async function saveReviewDecision(
  ticketId: string,
  role: 'data_management' | 'legal' | 'security',
  verdict: 'approve' | 'return' | 'reject' | 'escalate',
  notes?: string,
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await supabase.from('review_slots').upsert({
    ticket_id: ticketId,
    role,
    reviewer_id: user.id,
    verdict,
    notes: notes ?? null,
    decided_at: new Date().toISOString(),
  }, { onConflict: 'ticket_id,role' })
}

export async function addReturnComment(
  ticketId: string,
  message: string,
  attachmentIds?: string[],
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  await supabase.from('return_thread_entries').insert({
    ticket_id: ticketId,
    by_user_id: user.id,
    by_role: profile?.role ?? 'requester',
    message,
    attachment_ids: attachmentIds ?? [],
  })
}

// ── Realtime subscription ─────────────────────────────────

export function subscribeToTicket(
  ticketId: string,
  onUpdate: (ticket: Ticket) => void,
) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`ticket:${ticketId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tickets',
      filter: `id=eq.${ticketId}`,
    }, async () => {
      const ticket = await fetchTicketById(ticketId)
      if (ticket) onUpdate(ticket)
    })
    .subscribe()

  return () => { void supabase!.removeChannel(channel) }
}
