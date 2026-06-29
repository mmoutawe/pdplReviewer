import { apiGet, apiPost, apiPatch, apiDelete, startPolling } from '../lib/api'
import type { Ticket, TicketState, RequestType, DataDeclaration } from '../data/types'

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

export async function fetchTickets(filters?: {
  state?: TicketState[]
  requesterId?: string
  projectId?: string
  vendorId?: string
}): Promise<Ticket[]> {
  const params = new URLSearchParams()
  if (filters?.state?.length)    params.set('state', filters.state.join(','))
  if (filters?.requesterId)      params.set('requesterId', filters.requesterId)
  if (filters?.projectId)        params.set('projectId', filters.projectId)
  if (filters?.vendorId)         params.set('vendorId', filters.vendorId)
  const qs = params.toString()
  return apiGet<Ticket[]>(`/tickets${qs ? `?${qs}` : ''}`)
}

export async function fetchTicketById(id: string): Promise<Ticket | null> {
  try {
    return await apiGet<Ticket>(`/tickets/${encodeURIComponent(id)}`)
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) return null
    throw e
  }
}

export async function createTicket(input: CreateTicketInput, requesterId: string): Promise<Ticket> {
  return apiPost<Ticket>('/tickets', { ...input, requesterId })
}

export async function submitTicket(id: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${encodeURIComponent(id)}/submit`)
}

export async function transitionTicket(id: string, newState: TicketState, _reason?: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${encodeURIComponent(id)}/transition`, { newState })
}

export async function saveReviewDecision(
  ticketId: string,
  role: 'data_management' | 'legal' | 'security',
  verdict: 'approve' | 'return' | 'reject' | 'escalate',
  notes?: string,
  reviewerId?: string,
): Promise<void> {
  await apiPost(`/tickets/${encodeURIComponent(ticketId)}/review`, { role, verdict, notes, reviewerId })
}

export async function addReturnComment(
  ticketId: string,
  message: string,
  attachmentIds?: string[],
  userId?: string,
  userRole?: string,
): Promise<void> {
  await apiPost(`/tickets/${encodeURIComponent(ticketId)}/thread`, {
    message, attachmentIds, userId, userRole,
  })
}

export async function updateTicket(
  id: string,
  patch: Partial<Pick<Ticket, 'title' | 'description' | 'payload' | 'dataDeclaration' | 'tags'>> & {
    preAssessmentGenerationId?: string
  },
): Promise<Ticket> {
  return apiPatch<Ticket>(`/tickets/${encodeURIComponent(id)}`, patch)
}

export async function deleteTicket(id: string): Promise<void> {
  await apiDelete(`/tickets/${encodeURIComponent(id)}`)
}

export function subscribeToTicket(ticketId: string, onUpdate: (t: Ticket) => void): () => void {
  return startPolling(async () => {
    const t = await fetchTicketById(ticketId)
    if (t) onUpdate(t)
  }, 15_000)
}

export function subscribeToTickets(onUpdate: (t: Ticket) => void): () => void {
  let known: Record<string, string> = {}
  return startPolling(async () => {
    const tickets = await fetchTickets()
    for (const t of tickets) {
      if (known[t.id] !== t.updatedAt) {
        known[t.id] = t.updatedAt
        onUpdate(t)
      }
    }
  }, 20_000)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dvGet(..._args: any[]): Promise<any> { return null }
