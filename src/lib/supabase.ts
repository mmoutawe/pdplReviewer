import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  User, Ticket, AuditEvent, Notification, Policy, Vendor, Project,
  Attachment, ReviewSlot, ReturnThreadEntry,
} from '../data/types'

// ── Raw DB row types (snake_case) ─────────────────────────

export interface DbUser {
  id: string; full_name: string; email: string; role: string
  department: string; job_title: string; initials: string; avatar_color: string
  created_at: string; updated_at: string
}

export interface DbTicket {
  id: string; type: string; state: string; title: string; description: string
  requester_id: string; vendor_id: string | null; project_id: string | null
  external_recipient_email: string | null; tags: string[]
  payload: Record<string, unknown>; data_declaration: Record<string, unknown>
  sla_ack_hours: number; sla_decision_hours: number; sla_started_at: string | null
  sla_ack_by: string | null; sla_acked_at: string | null
  sla_decision_due_at: string | null; sla_breached: boolean
  pre_assessment_generation_id: string | null; parent_ticket_id: string | null
  submitted_at: string | null; decided_at: string | null
  created_at: string; updated_at: string
}

export interface DbReviewSlot {
  id: string; ticket_id: string; role: string; reviewer_id: string | null
  verdict: string; decided_at: string | null; notes: string | null
  ai_copilot_generation_id: string | null; created_at: string
}

export interface DbReturnThreadEntry {
  id: string; ticket_id: string; by_user_id: string; by_role: string
  message: string; attachment_ids: string[]; ai_score: { score: number; reasoning: string } | null
  resolved_at: string | null; resolved_by: string | null; created_at: string
}

export interface DbAttachment {
  id: string; ticket_id: string; filename: string; size_bytes: number
  content_type: string; uploaded_by: string; uploaded_at: string
  storage_bucket: string; storage_path: string; signed_url_expiry: string | null
  scan_status: string; classification: string; category: string
  extracted_summary: string | null
}

export interface DbAuditEvent {
  id: string; ts: string; actor_id: string; actor_role: string; action: string
  target_type: string; target_id: string
  before_snapshot: Record<string, unknown> | null
  after_snapshot: Record<string, unknown> | null
  ip_hash: string | null; session_id: string | null; reason: string | null
  immutable_hash: string; prev_hash: string | null
}

export interface DbNotification {
  id: string; user_id: string; ts: string; read: boolean; category: string
  title: string; body: string; link: string | null
  action_label: string | null; ticket_id: string | null
}

export interface DbPolicy {
  id: string; code: string; title: string; category: string; version: string
  effective_date: string; owner_dept: string; status: string; summary: string
  body: string; embeddings_built: boolean; citation_count: number
  created_at: string; updated_at: string
}

export interface DbVendor {
  id: string; legal_name: string; trade_name: string; jurisdiction: string
  risk_score: number; risk_tier: string; status: string; category: string
  primary_contact: string; certifications: string[]; has_dpa: boolean
  last_reviewed_at: string | null; notes: string; created_at: string; updated_at: string
}

export interface DbProject {
  id: string; code: string; name: string; business_unit: string
  owner_id: string | null; status: string; data_inventory_count: number
  description: string; started_at: string; created_at: string; updated_at: string
}

// ── Client singleton ──────────────────────────────────────

// Vite injects VITE_* env vars via import.meta.env at build time
declare const __VITE_SUPABASE_URL__: string | undefined
declare const __VITE_SUPABASE_ANON_KEY__: string | undefined

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env as Record<string, string | undefined>
const supabaseUrl = env?.VITE_SUPABASE_URL
const supabaseKey = env?.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any> | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null

// ── Row → TypeScript transformers ─────────────────────────

export function toUser(r: DbUser): User {
  return {
    id: r.id, fullName: r.full_name, email: r.email,
    role: r.role as User['role'], department: r.department,
    jobTitle: r.job_title, initials: r.initials, avatarColor: r.avatar_color,
  }
}

export function toTicket(r: DbTicket, slots: DbReviewSlot[], thread: DbReturnThreadEntry[]): Ticket {
  return {
    id: r.id,
    type: r.type as Ticket['type'],
    state: r.state as Ticket['state'],
    title: r.title,
    description: r.description,
    requesterId: r.requester_id,
    vendorId: r.vendor_id ?? undefined,
    projectId: r.project_id ?? undefined,
    externalRecipientEmail: r.external_recipient_email ?? undefined,
    tags: r.tags,
    payload: r.payload as unknown as Ticket['payload'],
    dataDeclaration: r.data_declaration as unknown as Ticket['dataDeclaration'],
    sla: {
      ackHours: r.sla_ack_hours,
      decisionHours: r.sla_decision_hours,
      startedAt: r.sla_started_at ?? r.created_at,
      ackBy: r.sla_ack_by ?? undefined,
      ackedAt: r.sla_acked_at ?? undefined,
      decisionDueAt: r.sla_decision_due_at ?? new Date(Date.now() + 72 * 3600000).toISOString(),
      breached: r.sla_breached,
    },
    reviews: slots.map(toReviewSlot),
    returnThread: thread.map(toReturnThreadEntry),
    attachments: [],
    preAssessmentGenerationId: r.pre_assessment_generation_id ?? undefined,
    parentTicketId: r.parent_ticket_id ?? undefined,
    submittedAt: r.submitted_at ?? undefined,
    decidedAt: r.decided_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function toReviewSlot(r: DbReviewSlot): ReviewSlot {
  return {
    role: r.role as ReviewSlot['role'],
    reviewerId: r.reviewer_id,
    verdict: r.verdict as ReviewSlot['verdict'],
    decidedAt: r.decided_at ?? undefined,
    notes: r.notes ?? undefined,
    aiCopilotGenerationId: r.ai_copilot_generation_id ?? undefined,
  }
}

export function toReturnThreadEntry(r: DbReturnThreadEntry): ReturnThreadEntry {
  return {
    id: r.id,
    by: r.by_user_id,
    byRole: r.by_role as ReturnThreadEntry['byRole'],
    message: r.message,
    createdAt: r.created_at,
    attachmentIds: r.attachment_ids,
    aiScore: r.ai_score ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    resolvedBy: r.resolved_by ?? undefined,
  }
}

export function toNotification(r: DbNotification): Notification {
  return {
    id: r.id, userId: r.user_id, ts: r.ts, read: r.read,
    category: r.category as Notification['category'],
    title: r.title, body: r.body,
    link: r.link ?? undefined,
    actionLabel: r.action_label ?? undefined,
    ticketId: r.ticket_id ?? undefined,
  }
}

export function toPolicy(r: DbPolicy): Policy {
  return {
    id: r.id, code: r.code, title: r.title,
    category: r.category as Policy['category'],
    version: r.version, effectiveDate: r.effective_date,
    ownerDept: r.owner_dept, status: r.status as Policy['status'],
    summary: r.summary, body: r.body,
    embeddingsBuilt: r.embeddings_built, citationCount: r.citation_count,
  }
}

export function toVendor(r: DbVendor): Vendor {
  return {
    id: r.id, legalName: r.legal_name, tradeName: r.trade_name,
    jurisdiction: r.jurisdiction, riskScore: r.risk_score,
    riskTier: r.risk_tier as Vendor['riskTier'],
    status: r.status as Vendor['status'],
    category: r.category, primaryContact: r.primary_contact,
    certifications: r.certifications, hasDPA: r.has_dpa,
    lastReviewedAt: r.last_reviewed_at ?? new Date().toISOString(),
    ticketIds: [],
    notes: r.notes,
  }
}

export function toProject(r: DbProject): Project {
  return {
    id: r.id, code: r.code, name: r.name, businessUnit: r.business_unit,
    ownerId: r.owner_id ?? '',
    status: r.status as Project['status'],
    dataInventoryCount: r.data_inventory_count,
    ticketIds: [],
    description: r.description, startedAt: r.started_at,
  }
}

export function toAuditEvent(r: DbAuditEvent): AuditEvent {
  return {
    id: r.id, ts: r.ts,
    actorId: r.actor_id, actorRole: r.actor_role as AuditEvent['actorRole'],
    action: r.action,
    targetType: r.target_type as AuditEvent['targetType'],
    targetId: r.target_id,
    before: r.before_snapshot ?? undefined,
    after: r.after_snapshot ?? undefined,
    ipHash: r.ip_hash ?? undefined,
    sessionId: r.session_id ?? undefined,
    reason: r.reason ?? undefined,
    immutableHash: r.immutable_hash,
    prevHash: r.prev_hash ?? undefined,
  }
}

export function toAttachment(r: DbAttachment): Attachment {
  return {
    id: r.id, ticketId: r.ticket_id, filename: r.filename,
    sizeBytes: r.size_bytes, contentType: r.content_type,
    uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at,
    storageBucket: r.storage_bucket,
    signedUrlExpiry: r.signed_url_expiry ?? undefined,
    scanStatus: r.scan_status as Attachment['scanStatus'],
    classification: r.classification as Attachment['classification'],
    category: r.category as Attachment['category'],
    extractedSummary: r.extracted_summary ?? undefined,
  }
}
