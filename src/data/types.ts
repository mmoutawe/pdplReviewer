/* PDPL Reviewer — domain types
 * These types model the production data contract. The mock layer below conforms
 * to them so swapping in a real Postgres + RLS backend is a drop-in change.
 */

export type Role =
  | 'requester'
  | 'data_management'
  | 'legal'
  | 'security'
  | 'admin'
  | 'external_recipient'

export type RequestType =
  | 'vendor_onboarding'
  | 'external_document_sharing'
  | 'data_sharing_external'
  | 'internal_data_access'
  | 'cross_border_transfer'

export type TicketState =
  | 'draft'
  | 'submitted'
  | 'in_data_management'
  | 'returned_to_requester'
  | 'in_legal_review'
  | 'in_security_review'
  | 'final_decision'
  | 'approved'
  | 'rejected'
  | 'archived'

export type ReviewVerdict = 'pending' | 'approve' | 'return' | 'reject' | 'escalate'

export interface User {
  id: string
  fullName: string
  email: string
  role: Role
  department: string
  jobTitle: string
  initials: string
  avatarColor: string
}

export interface Citation {
  id: string
  source: 'pdpl' | 'policy' | 'document' | 'evidence'
  ref: string
  excerpt: string
  url?: string
  documentId?: string
  page?: number
}

export interface AIGeneration {
  id: string
  feature:
    | 'request_builder'
    | 'pre_submission_assessment'
    | 'reviewer_copilot'
    | 'document_chat'
    | 'policy_chatbot'
    | 'evaluate_reply'
  modelHint: string
  ticketId?: string
  promptDigest: string
  output: string
  citations: Citation[]
  confidence: number
  flagged: boolean
  createdAt: string
  createdBy: string
  durationMs: number
}

export interface AssessmentFinding {
  id: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  category: string
  title: string
  detail: string
  citations: Citation[]
  remediation?: string
  acknowledged?: boolean
}

export interface PreSubmissionAssessment {
  ticketId: string
  generationId: string
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
  pdplAlignment: 'aligned' | 'gaps' | 'misaligned'
  findings: AssessmentFinding[]
  summary: string
  citations: Citation[]
  confidence: number
  generatedAt: string
}

export interface Attachment {
  id: string
  ticketId: string
  filename: string
  sizeBytes: number
  contentType: string
  uploadedBy: string
  uploadedAt: string
  storageBucket: string
  storagePath: string
  signedUrl?: string              // populated at fetch time, valid ~1 hour
  signedUrlExpiry?: string
  scanStatus: 'pending' | 'clean' | 'flagged'
  classification: 'unclassified' | 'public' | 'internal' | 'confidential' | 'restricted'
  category: 'contract' | 'dpa' | 'soc2' | 'iso27001' | 'evidence' | 'screenshot' | 'other'
  extractedSummary?: string
}

export interface ReturnThreadEntry {
  id: string
  by: string
  byRole: Role
  message: string
  createdAt: string
  attachmentIds?: string[]
  resolvedAt?: string
  resolvedBy?: string
  aiScore?: { score: number; reasoning: string }
}

export interface ReviewSlot {
  role: Extract<Role, 'data_management' | 'legal' | 'security'>
  reviewerId: string | null
  verdict: ReviewVerdict
  decidedAt?: string
  notes?: string
  aiCopilotGenerationId?: string
}

export interface SLA {
  ackHours: number
  decisionHours: number
  startedAt: string
  ackBy?: string
  ackedAt?: string
  decisionDueAt: string
  breached: boolean
}

export interface Ticket {
  id: string                    // PDPL-2026-0042
  type: RequestType
  state: TicketState
  title: string
  description: string
  requesterId: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  decidedAt?: string

  // Type-specific payload (rendered as a structured panel)
  payload: TicketPayload

  // Data declaration questionnaire results
  dataDeclaration: DataDeclaration

  // Linked records
  vendorId?: string
  projectId?: string
  externalRecipientEmail?: string

  reviews: ReviewSlot[]
  sla: SLA
  attachments: Attachment[]
  returnThread: ReturnThreadEntry[]
  preAssessmentGenerationId?: string
  parentTicketId?: string          // For split tickets
  childTicketIds?: string[]
  tags: string[]
}

export type TicketPayload =
  | VendorOnboardingPayload
  | ExternalDocumentSharingPayload
  | DataSharingExternalPayload
  | InternalDataAccessPayload
  | CrossBorderTransferPayload

export interface VendorOnboardingPayload {
  kind: 'vendor_onboarding'
  vendorName: string
  vendorWebsite: string
  servicesProvided: string
  dataProcessingPurpose: string
  contractRef: string
  hasDPA: boolean
  vendorJurisdiction: string
  subprocessors: string[]
  certifications: string[]
}

export interface ExternalDocumentSharingPayload {
  kind: 'external_document_sharing'
  documentTitle: string
  recipientName: string
  recipientOrg: string
  recipientEmail: string
  recipientJurisdiction: string
  purpose: string
  retentionDays: number
  expiryAt: string
}

export interface DataSharingExternalPayload {
  kind: 'data_sharing_external'
  recipientOrg: string
  recipientJurisdiction: string
  legalBasis: 'consent' | 'contract' | 'legitimate_interest' | 'legal_obligation' | 'public_interest'
  datasetName: string
  rowCountEstimate: number
  fieldsShared: string[]
  encryptionAtRest: boolean
  encryptionInTransit: boolean
  recipientUseCase: string
}

export interface InternalDataAccessPayload {
  kind: 'internal_data_access'
  systemName: string
  datasetName: string
  accessLevel: 'read' | 'read_write' | 'admin'
  accessDuration: '7d' | '30d' | '90d' | '180d' | 'permanent'
  businessJustification: string
  managerApproverId: string
  fieldsRequested: string[]
}

export interface CrossBorderTransferPayload {
  kind: 'cross_border_transfer'
  destinationCountry: string
  destinationOrg: string
  transferMechanism:
    | 'sccs'
    | 'binding_corporate_rules'
    | 'adequacy_decision'
    | 'consent'
    | 'public_interest_exemption'
  dataCategories: string[]
  estimatedRecords: number
  encryptionInTransit: boolean
  destinationCertifications: string[]
  hasSaudiResidencyCopy: boolean
}

export interface DataDeclaration {
  containsPII: boolean
  piiCategories: string[]                     // ['name', 'national_id', 'iban', 'phone', ...]
  containsSensitive: boolean                  // health, religion, biometric, etc.
  sensitiveCategories: string[]
  containsFinancial: boolean                  // financial categories per SAMA framework
  financialCategories: string[]
  estimatedSubjectCount: number
  retentionPeriodDays: number
  consentObtained: boolean
  consentMechanism?: string
  affectedDataSubjectGroups: string[]         // ['customers', 'employees', 'prospects']
  crossBorderInvolved: boolean
  encryptionState: 'none' | 'transit' | 'rest' | 'both'
}

export interface AuditEvent {
  id: string
  ts: string
  actorId: string
  actorRole: Role
  action: string                              // 'ticket.state.transition', 'ticket.review.decided', etc.
  targetType: 'ticket' | 'user' | 'policy' | 'attachment' | 'role' | 'system'
  targetId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ipHash?: string
  sessionId?: string
  reason?: string
  immutableHash: string                       // Pseudo merkle-ish hash
  prevHash?: string
}

export interface Notification {
  id: string
  userId: string
  ts: string
  read: boolean
  category: 'ticket' | 'review' | 'mention' | 'system' | 'security'
  title: string
  body: string
  link?: string
  actionLabel?: string
  ticketId?: string
}

export interface Policy {
  id: string
  code: string                                // 'PDPL-Art-3', 'POL-DATA-001'
  title: string
  category: 'pdpl' | 'internal' | 'sama' | 'iso27001' | 'cma'
  version: string
  effectiveDate: string
  ownerDept: string
  status: 'active' | 'draft' | 'retired'
  summary: string
  body: string
  embeddingsBuilt: boolean
  citationCount: number
}

export interface Vendor {
  id: string
  legalName: string
  tradeName: string
  jurisdiction: string
  riskScore: number                           // 0-100
  riskTier: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'pending' | 'sunset' | 'terminated'
  category: string
  primaryContact: string
  certifications: string[]
  hasDPA: boolean
  lastReviewedAt: string
  ticketIds: string[]
  notes: string
}

export interface Project {
  id: string
  code: string                                // 'PRJ-2026-0008'
  name: string
  businessUnit: string
  ownerId: string
  status: 'active' | 'on_hold' | 'closed'
  dataInventoryCount: number
  ticketIds: string[]
  description: string
  startedAt: string
}

// ─── Document Library ─────────────────────────────────────────────────────────

export type ProjectDocumentType = 'dpa' | 'nda' | 'soc2' | 'iso27001' | 'contract' | 'questionnaire' | 'report' | 'other'
export type ProjectDocumentStatus = 'draft' | 'active' | 'superseded' | 'expired'

export const DOCUMENT_TYPE_LABELS: Record<ProjectDocumentType, string> = {
  dpa: 'Data Processing Agreement',
  nda: 'Non-Disclosure Agreement',
  soc2: 'SOC 2 Report',
  iso27001: 'ISO 27001 Certificate',
  contract: 'Contract',
  questionnaire: 'Questionnaire',
  report: 'Assessment Report',
  other: 'Other',
}

export const DOCUMENT_STATUS_LABELS: Record<ProjectDocumentStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  superseded: 'Superseded',
  expired: 'Expired',
}

export interface ProjectDocument {
  id: string
  project_id: string | null
  vendor_id: string | null
  parent_document_id: string | null
  title: string
  document_type: ProjectDocumentType
  version: number
  status: ProjectDocumentStatus
  file_path: string
  file_type: string
  file_size: number
  description: string | null
  tags: string[] | null
  effective_date: string | null
  expiry_date: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

// ─── Templates Library ────────────────────────────────────────────────────────

export type TemplateCategory = 'dpa' | 'nda' | 'letter' | 'assessment' | 'other'

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  dpa: 'Data Processing Agreement',
  nda: 'NDA',
  letter: 'Compliance Letter',
  assessment: 'Assessment / Questionnaire',
  other: 'Other',
}

export interface ReviewerTemplate {
  id: string
  title: string
  description: string | null
  file_path: string
  file_type: string
  category: TemplateCategory
  is_active: boolean
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

// ─── External Links (admin management) ───────────────────────────────────────

export interface AdminExternalLink {
  id: string
  token: string
  label: string
  created_at: string
  expires_at: string | null
  revoked: boolean
  recipient_email: string | null
  recipient_name: string | null
  status: string
  approved_at: string | null
}

// ─── Notification Preferences ─────────────────────────────────────────────────

export type NotificationType =
  | 'ticket_submitted'
  | 'ticket_returned'
  | 'ticket_approved'
  | 'ticket_rejected'
  | 'ticket_escalated_legal'
  | 'ticket_escalated_security'
  | 'reviewer_reply'
  | 'external_invitation'
  | 'external_approval_summary'
  | 'password_change_required'
  | 'account_purged_warning'

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ticket_submitted:          'Ticket submitted',
  ticket_returned:           'Ticket returned for clarification',
  ticket_approved:           'Ticket approved',
  ticket_rejected:           'Ticket rejected',
  ticket_escalated_legal:    'Escalated to Legal',
  ticket_escalated_security: 'Escalated to Security',
  reviewer_reply:            'Reviewer reply',
  external_invitation:       'External invitation issued',
  external_approval_summary: 'External approval summary',
  password_change_required:  'Password change required',
  account_purged_warning:    'Account scheduled for deletion',
}

export const ALL_NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]

// ─── Risk level ───────────────────────────────────────────────────────────────
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// ─── Sub-ticket tracks ────────────────────────────────────────────────────────
export type SubTicketTrack = 'legal' | 'security' | 'requester_clarification'

export interface SubTicketRef {
  track: SubTicketTrack
  ticketId: string
  state: TicketState
}

// ─── PDPL Article reference ───────────────────────────────────────────────────
export interface ArticleRef {
  article: string   // e.g. "Art. 4(1)"
  title: string     // short description
  url?: string
}

export interface ExternalLink {
  token: string
  ticketId: string
  recipientEmail: string
  permissions: ('view_request' | 'view_attachments' | 'approve' | 'reject')[]
  issuedBy: string
  issuedAt: string
  expiresAt: string
  redeemedAt?: string
  redeemedFromIpHash?: string
  status: 'pending' | 'redeemed' | 'expired' | 'revoked'
}
