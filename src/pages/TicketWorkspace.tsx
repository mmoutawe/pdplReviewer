import { useEffect, useState } from 'react'
import { Sparkles, AlertTriangle, RefreshCw, RotateCcw, Pencil, Send, Search, FileText, CheckCircle, XCircle, GitBranch, CornerUpLeft } from 'lucide-react'
import { useMobile } from '../hooks/useMobile'
import { useParams, useNavigate } from 'react-router-dom'
import { ticketStore, authStore, showToast, updateTicket, refreshTickets, demoAddReturnComment, demoDeleteTicket, lookupVendor, lookupProject } from '../store'
import { useStore } from '../hooks/useStore'
import {
  vendorById, projectById, REQUEST_TYPE_LABELS,
  PRE_ASSESSMENTS,
} from '../data/seed'
import type { Attachment, Role, TicketState, ProjectDocument, ReviewerTemplate } from '../data/types'
import { StatusPill, SLAIndicator, Avatar, RoleBadge, EmptyState, RiskBadge, ArticleRefBadge } from '../components/primitives'
import { EvidenceUploader } from '../components/forms'
import { CitationChip } from '../components/AICoPilotPanel'
import { AuditTimeline } from '../components/AuditTimeline'
import { CommentThread } from '../components/CommentThread'
import { ConfirmDialog, LoadingOverlay } from '../components/overlays'
import { formatDate, formatDateTime } from '../lib/utils'
import { isDataverseConfigured as isSupabaseConfigured, dvDownloadFile, T } from '../lib/dataverse'
import { exportAssessmentPdf } from '../lib/exportAssessmentPdf'
import { getWorkflowSettings } from '../lib/workflowSettings'
import { saveReviewDecision, transitionTicket, addReturnComment, subscribeToTicket, deleteTicket as apiDeleteTicket } from '../api/tickets'
import { fetchDocuments } from '../api/documentLibrary'
import { fetchTemplates } from '../api/templatesLibrary'
import { uploadAttachment } from '../api/attachments'
import { evaluateReply } from '../api/aiEvaluateReply'
import { getCachedUser } from '../lib/userCache'
import { runReviewerAssessment, type ReviewerRequestType } from '../api/aiReviewer'
import { ReviewerAssessmentView, ControllerProcessorRolesCard } from '../components/ReviewerAssessmentView'
import { AIDocumentChat } from '../components/AIDocumentChat'
import { ReviewerAssistPanel } from '../components/ReviewerAssistPanel'
import { AIDocumentGeneratorPanel } from '../components/AIDocumentGeneratorPanel'
import { runChecklistReview, type ChecklistResult } from '../api/aiChecklist'
import { PresubmitAssessmentView } from '../components/PresubmitAssessmentView'

// ─── 8-step wizard constants ──────────────────────────────────────────────────

const WS_STEPS = [
  { key: 0, label: 'Vendor & Project' },
  { key: 1, label: 'Initiation' },
  { key: 2, label: 'Questionnaire' },
  { key: 3, label: 'AI Assessment' },
  { key: 4, label: 'Data Mgmt' },
  { key: 5, label: 'Legal' },
  { key: 6, label: 'Security' },
  { key: 7, label: 'Decision' },
]

function stateToWizardStep(state: TicketState): number {
  switch (state) {
    case 'draft':                  return 1
    case 'submitted':
    case 'in_data_management':     return 4
    case 'returned_to_requester':  return 4
    case 'in_legal_review':        return 5
    case 'in_security_review':     return 6
    case 'final_decision':
    case 'approved':
    case 'rejected':
    case 'archived':               return 7
    default:                       return 3
  }
}

function canViewWizardStep(step: number, role: Role): boolean {
  if (role === 'admin') return true
  if (role === 'requester' || role === 'external_user') return step <= 3 || step === 7
  if (role === 'data_management') return step === 3 || step === 4 || step === 7
  if (role === 'legal') return step === 3 || step === 5 || step === 7
  if (role === 'security') return step === 3 || step === 6 || step === 7
  if (role === 'external_recipient') return step === 3 || step === 7
  return false
}

function getDefaultWizardStep(state: TicketState): number {
  return stateToWizardStep(state)
}

type SplitTrack = 'legal' | 'security'

// Per-ticket reviewer-assessment cache — survives route navigation within the same browser session
const _reviewerDataCache: Record<string, Record<string, unknown>> = {}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TicketWorkspace() {
  const { id } = useParams<{ id: string }>()
  const { tickets } = useStore(ticketStore)
  const { user } = useStore(authStore)
  const navigate = useNavigate()
  const isMobile = useMobile()

  const ticket = tickets.find((t) => t.id === id)

  const [wizardStep, setWizardStep] = useState(() =>
    ticket ? getDefaultWizardStep(ticket.state) : 3
  )
  const [reviewerData, setReviewerData] = useState<Record<string, unknown> | null>(() =>
    ticket?.id ? (_reviewerDataCache[ticket.id] ?? null) : null
  )
  const [reviewerLoading, setReviewerLoading] = useState(false)
  const [reviewerError, setReviewerError] = useState<string | null>(null)
  const [checklistData, setChecklistData] = useState<ChecklistResult | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [_checklistError, setChecklistError] = useState<string | null>(null)
  const [showSplitDialog, setShowSplitDialog] = useState(false)
  const [reviewerAttachments, setReviewerAttachments] = useState<Attachment[]>([])
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewMode, setReviewMode] = useState<'manual' | 'ai'>('manual')
  const [manualChecklist, setManualChecklist] = useState({
    purposeIsClear: false, dataIsNecessary: false, noExcessivePersonalData: false,
    recipientIsAppropriate: false, attachmentsReviewed: false,
  })
  const [anonClaimReviewed, setAnonClaimReviewed] = useState(false)
  const [dmSaving, setDmSaving] = useState(false)
  const [requesterReply, setRequesterReply] = useState('')
  const [requesterReplying, setRequesterReplying] = useState(false)
  const [requesterAttachments, setRequesterAttachments] = useState<Attachment[]>([])
  const [attachTab, setAttachTab] = useState<'upload' | 'library' | 'templates'>('upload')
  const [showAIDocGen, setShowAIDocGen] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [libraryDocs, setLibraryDocs] = useState<ProjectDocument[]>([])
  const [libraryTemplates, setLibraryTemplates] = useState<ReviewerTemplate[]>([])
  const [attachLibraryLoading, setAttachLibraryLoading] = useState(false)
  const [evaluatingEntryId, setEvaluatingEntryId] = useState<string | null>(null)
  // Local AI scores keyed by entry ID — survive ticket polling refreshes
  const [aiScores, setAiScores] = useState<Record<string, { score: number; reasoning: string }>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [threadReplying, setThreadReplying] = useState(false)

  useEffect(() => {
    document.title = ticket ? `${ticket.id} — PDPL Reviewer` : 'Ticket — PDPL Reviewer'
  }, [ticket])

  useEffect(() => {
    if (!isSupabaseConfigured || !id) return
    return subscribeToTicket(id, (updated) => updateTicket(updated.id, updated))
  }, [id])

  // Re-sync wizard step when ticket state changes; fall back to user's review step if default isn't accessible
  useEffect(() => {
    if (!ticket) return
    const def = getDefaultWizardStep(ticket.state)
    if (canViewWizardStep(def, user.role as Role)) {
      setWizardStep(def)
    } else {
      const roleStep: Partial<Record<import('../data/types').Role, number>> = { requester: 3, external_user: 3, legal: 5, security: 6, data_management: 4 }
      setWizardStep(roleStep[user.role as import('../data/types').Role] ?? def)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.state])

  // When switching tickets, restore from cache (keeps results stable across navigation)
  useEffect(() => {
    setReviewerData(ticket?.id ? (_reviewerDataCache[ticket.id] ?? null) : null)
    setReviewerError(null)
  }, [ticket?.id])

  // Auto-trigger AI assessment when DM tab opens
  useEffect(() => {
    if (wizardStep !== 4 || reviewerData || reviewerLoading || !ticket) return
    const attachmentContext = ticket.attachments
      .filter((a) => a.extractedSummary)
      .map((a) => ({ filename: a.filename, category: a.category, classification: a.classification, summary: a.extractedSummary }))
    setReviewerLoading(true)
    setReviewerError(null)
    runReviewerAssessment(ticket.type as ReviewerRequestType, {
      type: ticket.type, title: ticket.title, description: ticket.description,
      payload: ticket.payload, dataDeclaration: ticket.dataDeclaration,
      returnThread: ticket.returnThread, tags: ticket.tags,
      attachments: attachmentContext.length > 0 ? attachmentContext : undefined,
    })
      .then((data) => {
        if (ticket?.id) _reviewerDataCache[ticket.id] = data
        setReviewerData(data)
      })
      .catch((err) => { setReviewerError(err instanceof Error ? err.message : 'Failed to generate reviewer assessment.') })
      .finally(() => { setReviewerLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, ticket?.id])

  if (!ticket) {
    return (
      <EmptyState title="Ticket not found" body={`No ticket with ID "${id}" exists.`} icon={<Search size={26} color="var(--teal-600)" />}
        action={<button className="btn btn-primary" onClick={() => navigate('/requests')}>Back to requests</button>} />
    )
  }

  if (user.role === 'external_user' && ticket.requesterId !== user.id) {
    return (
      <EmptyState title="Access denied" body="You can only view your own requests." icon={<Search size={26} color="var(--teal-600)" />}
        action={<button className="btn btn-primary" onClick={() => navigate('/requests')}>My requests</button>} />
    )
  }

  const requester = getCachedUser(ticket.requesterId)
  const vendor = ticket.vendorId ? (vendorById(ticket.vendorId) ?? lookupVendor(ticket.vendorId)) : null
  const project = ticket.projectId ? (projectById(ticket.projectId) ?? lookupProject(ticket.projectId)) : null
  const [attachments, setAttachments] = useState<Attachment[]>(ticket.attachments)
  const assessment = PRE_ASSESSMENTS.find((a) => a.ticketId === ticket.id)
  // Prefer live AI-generated risk over static seed value
  const effectiveRisk = ((ticket.preAssessmentData?.risk_level as string | undefined) ?? assessment?.overallRisk) as import('../data/types').RiskLevel | undefined
  const auditEvents = (() => {
    const derived: import('../data/types').AuditEvent[] = []
    const mk = (id: string, action: string, actorId: string, actorRole: import('../data/types').Role, ts: string, extra?: Partial<import('../data/types').AuditEvent>) => ({
      id, ts, actorId, actorRole, action, targetType: 'ticket' as const, targetId: ticket.id, immutableHash: id, ...extra,
    })
    if (ticket.createdAt) derived.push(mk(`${ticket.id}-created`, 'ticket.created', ticket.requesterId, 'requester', ticket.createdAt))
    if (ticket.submittedAt) derived.push(mk(`${ticket.id}-submitted`, 'ticket.submitted', ticket.requesterId, 'requester', ticket.submittedAt))
    for (const r of ticket.reviews) {
      if (r.verdict !== 'pending' && r.decidedAt) {
        derived.push(mk(`${ticket.id}-review-${r.role}`, 'review.decided', r.reviewerId ?? ticket.requesterId, r.role, r.decidedAt, { reason: r.notes }))
      }
    }
    for (const entry of ticket.returnThread) {
      derived.push(mk(`${ticket.id}-return-${entry.id}`, 'ticket.returned', entry.by, entry.byRole, entry.createdAt, { reason: entry.message }))
    }
    if (ticket.decidedAt && ['approved', 'rejected'].includes(ticket.state)) {
      derived.push(mk(`${ticket.id}-decided`, ticket.state === 'approved' ? 'ticket.approved' : 'ticket.rejected', ticket.requesterId, 'data_management' as import('../data/types').Role, ticket.decidedAt))
    }
    return derived
  })()

  const hasParallelSecuritySlot = ticket.reviews.some((r) => r.role === 'security' && r.verdict === 'pending')
  const canAnonymize = (ticket.payload as import('../data/types').VendorOnboardingPayload)?.questionnaire?.purposeNecessity?.canAnonymize === 'yes'
  const canReview = (
    (user.role === 'data_management' && ['submitted', 'in_data_management', 'returned_to_requester'].includes(ticket.state)) ||
    (user.role === 'legal' && ticket.state === 'in_legal_review') ||
    (user.role === 'security' && (
      ticket.state === 'in_security_review' ||
      (ticket.state === 'in_legal_review' && hasParallelSecuritySlot) ||
      (ticket.state === 'in_data_management' && hasParallelSecuritySlot)
    ))
  )
  const canViewCurrentStep = canViewWizardStep(wizardStep, user.role as Role)

  async function generateReviewerAI() {
    if (!ticket) return
    setReviewerLoading(true); setReviewerError(null)
    try {
      const attachmentContext = ticket.attachments
        .filter((a) => a.extractedSummary)
        .map((a) => ({ filename: a.filename, category: a.category, classification: a.classification, summary: a.extractedSummary }))
      const data = await runReviewerAssessment(ticket.type as ReviewerRequestType, {
        type: ticket.type, title: ticket.title, description: ticket.description,
        payload: ticket.payload, dataDeclaration: ticket.dataDeclaration,
        returnThread: ticket.returnThread, tags: ticket.tags,
        attachments: attachmentContext.length > 0 ? attachmentContext : undefined,
      })
      if (ticket?.id) _reviewerDataCache[ticket.id] = data
      setReviewerData(data)
    } catch (err) {
      setReviewerError(err instanceof Error ? err.message : 'Failed to generate reviewer assessment.')
    } finally { setReviewerLoading(false) }
  }

  async function generateChecklist() {
    if (!ticket) return
    setChecklistLoading(true); setChecklistError(null)
    try {
      const data = await runChecklistReview({
        type: ticket.type, title: ticket.title, description: ticket.description,
        payload: ticket.payload, dataDeclaration: ticket.dataDeclaration,
        attachments: ticket.attachments.map((a) => ({ filename: a.filename, summary: a.extractedSummary })),
        tags: ticket.tags,
      })
      setChecklistData(data)
    } catch (err) {
      setChecklistError(err instanceof Error ? err.message : 'Failed to run checklist.')
    } finally { setChecklistLoading(false) }
  }

  async function handleDMAction(action: 'approve' | 'return' | 'escalate_legal' | 'escalate_security' | 'reject') {
    if (!ticket) return
    if (action === 'return' && !reviewComment.trim()) { showToast('Please add a return comment.', 'error'); return }
    setDmSaving(true)
    const nextDMState: Record<string, TicketState> = {
      approve: 'approved', return: 'returned_to_requester',
      escalate_legal: 'in_legal_review', escalate_security: 'in_security_review',
      reject: 'rejected',
    }
    const newState = nextDMState[action] as TicketState
    try {
      if (isSupabaseConfigured) {
        const verdict = action === 'return' ? 'return' : action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'escalate'
        await saveReviewDecision(ticket.id, 'data_management', verdict as 'approve' | 'return' | 'escalate', reviewComment || undefined, user.id)
        if (action === 'return' && (reviewComment.trim() || reviewerAttachments.length > 0)) {
          await addReturnComment(ticket.id, reviewComment, reviewerAttachments.map((a) => a.id), user.id, user.role)
          setReviewerAttachments([])
        }
        const updated = await transitionTicket(ticket.id, newState, reviewComment || undefined)
        updateTicket(ticket.id, updated)
      } else {
        const newReviews = [...ticket.reviews]
        if (action === 'escalate_legal' && !newReviews.some((r) => r.role === 'legal')) {
          newReviews.push({ role: 'legal', verdict: 'pending', reviewerId: null })
        }
        if (action === 'escalate_security' && !newReviews.some((r) => r.role === 'security')) {
          newReviews.push({ role: 'security', verdict: 'pending', reviewerId: null })
        }
        updateTicket(ticket.id, { state: newState, reviews: newReviews })
        if (action === 'return' && reviewComment.trim()) {
          demoAddReturnComment(ticket.id, reviewComment, 'data_management', user.fullName)
        }
      }
      showToast('Decision recorded.', 'success')
      navigate('/dashboard')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save decision.', 'error')
    } finally { setDmSaving(false) }
  }

  async function handleRequesterSubmit() {
    if (!ticket) return
    setRequesterReplying(true)
    try {
      const attIds = requesterAttachments.map((a) => a.id)
      if (isSupabaseConfigured) {
        if (requesterReply.trim() || attIds.length) await addReturnComment(ticket.id, requesterReply, attIds, user.id, user.role)
        const updated = await transitionTicket(ticket.id, 'in_data_management', 'Resubmitted after addressing return comments')
        updateTicket(updated.id, updated)
        await refreshTickets()
      } else {
        if (requesterReply.trim()) demoAddReturnComment(ticket.id, requesterReply, 'requester', user.fullName)
        updateTicket(ticket.id, { state: 'in_data_management' })
      }
      setRequesterReply('')
      setRequesterAttachments([])
      showToast('Response submitted. Ticket sent back to reviewer.', 'success')
      navigate('/dashboard')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission failed.', 'error')
    } finally { setRequesterReplying(false) }
  }

  async function handleEvaluateReply(entryId: string) {
    if (!ticket) return
    const entry = ticket.returnThread.find((e) => e.id === entryId)
    if (!entry) return
    const reviewerEntry = ticket.returnThread.find((e) => e.byRole !== 'requester' && ticket.returnThread.indexOf(e) < ticket.returnThread.indexOf(entry))
    setEvaluatingEntryId(entryId)
    try {
      const result = await evaluateReply({
        roleLabel: entry.byRole.replace(/_/g, ' '),
        reviewerComment: reviewerEntry?.message ?? 'General compliance review',
        requesterReply: entry.message,
        ticketContext: `${ticket.title}: ${ticket.description ?? ''}`,
        attachments: ticket.attachments.filter((a) => entry.attachmentIds?.includes(a.id)).map((a) => ({ filename: a.filename, extractedSummary: a.extractedSummary })),
      })
      // Store in local state — survives polling refreshes that would overwrite ticket.returnThread
      setAiScores((prev) => ({ ...prev, [entryId]: { score: result.overall_score, reasoning: result.summary } }))
      showToast('AI evaluation complete.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI evaluation failed.', 'error')
    } finally { setEvaluatingEntryId(null) }
  }

  async function handleDeleteTicket() {
    if (!ticket) return
    setShowDeleteConfirm(false)
    try {
      if (isSupabaseConfigured) await apiDeleteTicket(ticket.id)
      demoDeleteTicket(ticket.id)
      showToast('Ticket deleted.', 'success')
      navigate('/requests')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ConfirmDialog
        open={showDeleteConfirm}
        title={`Delete "${ticket?.title}"?`}
        body="This ticket will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => void handleDeleteTicket()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <LoadingOverlay show={dmSaving} label="Saving decision…" />
      <LoadingOverlay show={requesterReplying} label="Submitting response…" />
      <LoadingOverlay show={threadReplying} label="Submitting reply…" />

      {/* ── Header ── */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface-0)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')} style={{ padding: '2px 6px', fontSize: 12 }}>← Requests</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-500)' }}>{ticket.id}</span>
              <StatusPill state={ticket.state} reviews={ticket.reviews} />
              {['in_legal_review', 'in_security_review', 'in_data_management'].includes(ticket.state) && hasParallelSecuritySlot && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: 'var(--brand-50)', color: 'var(--brand-700)', border: '1px solid var(--brand-100)', whiteSpace: 'nowrap' }}>
                  ⚖️+🔒 Legal &amp; Security Review
                </span>
              )}
              {!['approved', 'rejected', 'archived', 'draft'].includes(ticket.state) && (
                <SLAIndicator dueAt={ticket.sla.decisionDueAt} breached={ticket.sla.breached} />
              )}
              {ticket.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.3, marginBottom: 4 }}>{ticket.title}</h1>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>{REQUEST_TYPE_LABELS[ticket.type]}</span>
              {requester && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Avatar initials={requester.initials} color={requester.avatarColor} size={16} />
                  {requester.fullName}
                </span>
              )}
              {ticket.submittedAt && <span>Submitted {formatDateTime(ticket.submittedAt)}</span>}
              {project && <span>Project: {project.name}</span>}
              {vendor && <span>Vendor: {vendor.tradeName}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {user.role === 'admin' && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }}
                onClick={() => setShowDeleteConfirm(true)}>Delete</button>
            )}
          </div>
        </div>

        {/* 8-step stepper */}
        <div style={{ marginTop: 14 }}>
          <TicketStepper
            steps={WS_STEPS}
            currentStep={stateToWizardStep(ticket.state)}
            activeStep={wizardStep}
            canAccess={(s) => canViewWizardStep(s, user.role as Role)}
            onStepClick={(s) => { if (canViewWizardStep(s, user.role as Role) || s === stateToWizardStep(ticket.state)) setWizardStep(s) }}
          />
        </div>
      </div>

      {/* ── Step content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? 16 : '24px 32px', minHeight: 0 }}>

        {!canViewCurrentStep ? (
          // Requester / external user on step 4 when ticket is returned for clarification
          ticket.state === 'returned_to_requester' && (user.role === 'requester' || user.role === 'external_user') ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-lg)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--r-lg)', background: '#FDE68A', color: 'var(--amber-800)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--amber-800)', marginBottom: 4 }}>Request Returned for Clarification</h2>
                  <p style={{ fontSize: 13, color: 'var(--amber-700)', lineHeight: 1.6 }}>The reviewer has returned your request with comments. Please review and respond.</p>
                </div>
              </div>

              {/* Reviewer feedback thread */}
              {ticket.returnThread.length > 0 && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <AlertTriangle size={16} style={{ color: 'var(--amber-700)', flexShrink: 0 }} />
                    <h3 style={{ fontSize: 14, fontWeight: 600 }}>Reviewer Feedback</h3>
                  </div>
                  <CommentThread
                    entries={ticket.returnThread.map((e) => aiScores[e.id] ? { ...e, aiScore: aiScores[e.id] } : e)}
                    attachments={[...ticket.attachments, ...requesterAttachments]}
                    readOnly
                  />
                </div>
              )}

              {/* Edit shortcut buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-sm" onClick={() => setWizardStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pencil size={13} />
                  Edit Initiation Details
                </button>
                <button className="btn btn-sm" onClick={() => setWizardStep(2)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pencil size={13} />
                  Edit Questionnaire
                </button>
              </div>

              {/* Your response */}
              <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Send size={14} aria-hidden="true" />
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>Your Response</h3>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-600)', display: 'block', marginBottom: 6 }}>Reply</label>
                  <textarea
                    className="input"
                    style={{ width: '100%', minHeight: 110, resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
                    placeholder="Address the reviewer's feedback…"
                    value={requesterReply}
                    onChange={(e) => setRequesterReply(e.target.value)}
                    disabled={requesterReplying}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-600)', display: 'block', marginBottom: 8 }}>Attach Supporting Documents</label>
                  <EvidenceUploader
                    attachments={requesterAttachments}
                    ticketId={ticket.id}
                    onUploaded={(a) => setRequesterAttachments((prev) => [...prev, a])}
                    onRemove={(aid) => setRequesterAttachments((prev) => prev.filter((a) => a.id !== aid))}
                  />
                </div>
                <div>
                  <button
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => void handleRequesterSubmit()}
                    disabled={requesterReplying}
                  >
                    <Send size={14} aria-hidden="true" />
                    {requesterReplying ? 'Submitting…' : 'Submit Response'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--ink-400)', fontSize: 14 }}>This step is not accessible for your role.</p>
            </div>
          )
        ) : <>

        {/* ── Step 0: Vendor & Project ── */}
        {wizardStep === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Vendor &amp; Project</h2>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: '18px 20px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 12 }}>Vendor</h3>
                {vendor ? (
                  <dl style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px', fontSize: 13 }}>
                    <dt style={{ color: 'var(--ink-500)' }}>Trade name</dt><dd style={{ fontWeight: 500 }}>{vendor.tradeName}</dd>
                    <dt style={{ color: 'var(--ink-500)' }}>Legal name</dt><dd>{vendor.legalName}</dd>
                    <dt style={{ color: 'var(--ink-500)' }}>Jurisdiction</dt><dd>{vendor.jurisdiction}</dd>
                    <dt style={{ color: 'var(--ink-500)' }}>Category</dt><dd>{vendor.category}</dd>
                    <dt style={{ color: 'var(--ink-500)' }}>Risk tier</dt>
                    <dd>
                      <span className={`pill pill-no-dot ${vendor.riskTier === 'low' ? 'pill-emerald' : vendor.riskTier === 'medium' ? 'pill-amber' : 'pill-red'}`} style={{ fontSize: 11 }}>
                        {vendor.riskTier}
                      </span>
                    </dd>
                    <dt style={{ color: 'var(--ink-500)' }}>DPA signed</dt><dd>{vendor.hasDPA ? 'Yes' : 'No'}</dd>
                  </dl>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>No vendor linked to this ticket.</p>
                )}
              </div>
              <div className="card" style={{ padding: '18px 20px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 12 }}>Project</h3>
                {project ? (
                  <dl style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px', fontSize: 13 }}>
                    <dt style={{ color: 'var(--ink-500)' }}>Name</dt><dd style={{ fontWeight: 500 }}>{project.name}</dd>
                    <dt style={{ color: 'var(--ink-500)' }}>Code</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{project.code}</dd>
                    <dt style={{ color: 'var(--ink-500)' }}>Business unit</dt><dd>{project.businessUnit}</dd>
                    <dt style={{ color: 'var(--ink-500)' }}>Status</dt>
                    <dd>
                      <span className={`pill pill-no-dot ${project.status === 'active' ? 'pill-emerald' : 'pill-amber'}`} style={{ fontSize: 11 }}>
                        {project.status}
                      </span>
                    </dd>
                  </dl>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>No project linked to this ticket.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Initiation ── */}
        {wizardStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Initiation Details</h2>
            <div className="card" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 12 }}>Request</h3>
              <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px 16px', fontSize: 13 }}>
                <dt style={{ color: 'var(--ink-500)' }}>Title</dt><dd style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{ticket.title}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Type</dt><dd>{REQUEST_TYPE_LABELS[ticket.type]}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Requester</dt>
                <dd style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {requester && <Avatar initials={requester.initials} color={requester.avatarColor} size={18} />}
                  {requester?.fullName ?? ticket.requesterId}
                </dd>
                <dt style={{ color: 'var(--ink-500)' }}>Created</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDateTime(ticket.createdAt)}</dd>
                {ticket.submittedAt && (<><dt style={{ color: 'var(--ink-500)' }}>Submitted</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDateTime(ticket.submittedAt)}</dd></>)}
                <dt style={{ color: 'var(--ink-500)' }}>SLA due</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDateTime(ticket.sla.decisionDueAt)}</dd>
              </dl>
            </div>
            <div className="card" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 10 }}>Description</h3>
              <p style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7 }}>{ticket.description}</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Questionnaire ── */}
        {wizardStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Data Declaration &amp; Questionnaire</h2>
            <div className="card" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 12 }}>Data Declaration</h3>
              <dl style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '220px 1fr', gap: '8px 12px', fontSize: 13 }}>
                <dt style={{ color: 'var(--ink-500)' }}>Contains PII</dt>
                <dd>{ticket.dataDeclaration.containsPII ? `Yes — ${ticket.dataDeclaration.piiCategories.join(', ')}` : 'No'}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Sensitive data</dt>
                <dd>{ticket.dataDeclaration.containsSensitive ? `Yes — ${ticket.dataDeclaration.sensitiveCategories.join(', ') || 'unspecified'}` : 'No'}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Financial data</dt>
                <dd>{ticket.dataDeclaration.containsFinancial ? `Yes — ${ticket.dataDeclaration.financialCategories.join(', ')}` : 'No'}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Est. data subjects</dt>
                <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{ticket.dataDeclaration.estimatedSubjectCount.toLocaleString()}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Retention</dt>
                <dd>{ticket.dataDeclaration.retentionPeriodDays} days</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Encryption</dt>
                <dd style={{ textTransform: 'capitalize' }}>{ticket.dataDeclaration.encryptionState.replace(/_/g, ' ')}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Cross-border transfer</dt>
                <dd>{ticket.dataDeclaration.crossBorderInvolved ? 'Yes' : 'No'}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Consent obtained</dt>
                <dd>{ticket.dataDeclaration.consentObtained ? `Yes — ${ticket.dataDeclaration.consentMechanism ?? 'mechanism unspecified'}` : 'No'}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Affected groups</dt>
                <dd>{ticket.dataDeclaration.affectedDataSubjectGroups.join(', ') || '—'}</dd>
              </dl>
            </div>
            {/* Evidence */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 12 }}>Evidence &amp; Attachments</h3>
              <EvidenceUploader
                attachments={attachments}
                ticketId={ticket.id}
                readOnly={['approved', 'rejected', 'archived'].includes(ticket.state)}
                onUploaded={(a) => setAttachments((prev) => [...prev, a])}
                onRemove={(ai) => setAttachments((prev) => prev.filter((a) => a.id !== ai))}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: AI Assessment ── */}
        {wizardStep === 3 && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Conversation thread — visible to requester and whichever role is currently reviewing */}
              {ticket.returnThread.length > 0 && (
                <section className="card" style={{
                  padding: '18px 20px',
                  ...(ticket.state === 'returned_to_requester' ? { borderColor: '#FDE68A', background: 'var(--amber-50)' } : {}),
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <CornerUpLeft size={18} color={ticket.state === 'returned_to_requester' ? 'var(--amber-700)' : 'var(--ink-500)'} aria-hidden="true" />
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: ticket.state === 'returned_to_requester' ? 'var(--amber-700)' : 'var(--ink-800)' }}>
                      {ticket.state === 'returned_to_requester' ? 'Ticket returned for clarification' : 'Conversation'}
                    </h2>
                  </div>
                  <CommentThread
                    entries={ticket.returnThread.map((e) => aiScores[e.id] ? { ...e, aiScore: aiScores[e.id] } : e)}
                    attachments={ticket.attachments}
                    readOnly={false}
                    onReply={async (msg) => {
                      setThreadReplying(true)
                      try {
                        if (isSupabaseConfigured) {
                          await addReturnComment(ticket.id, msg, undefined, user.id, user.role)
                          await refreshTickets()
                        } else {
                          demoAddReturnComment(ticket.id, msg, user.role as Role, user.fullName)
                        }
                        showToast('Comment added.', 'success')
                        navigate('/dashboard')
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Failed.', 'error')
                      } finally { setThreadReplying(false) }
                    }}
                  />
                  {user.id === ticket.requesterId && ticket.state === 'returned_to_requester' && (
                    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate(`/requests/${ticket.id}/respond`)}>
                      Submit formal response →
                    </button>
                  )}
                </section>
              )}

              {/* Pre-submission AI — hidden for anonymized tickets; anonymization checker is the sole AI gate */}
              {assessment && !canAnonymize && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>AI Pre-Submission Assessment</h2>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => exportAssessmentPdf(ticket.id, assessment, ticket.title)}>↓ Export PDF</button>
                      {effectiveRisk && (
                        <span className={`pill pill-no-dot ${effectiveRisk === 'low' ? 'pill-emerald' : effectiveRisk === 'medium' ? 'pill-amber' : 'pill-red'}`}>
                          {effectiveRisk === 'high' || effectiveRisk === 'critical' ? '⚠ ' : ''}{effectiveRisk.charAt(0).toUpperCase() + effectiveRisk.slice(1)} Risk
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{
                      padding: '14px 18px',
                      background: effectiveRisk === 'low' ? 'var(--emerald-50)' : 'var(--amber-50)',
                      border: `1px solid ${effectiveRisk === 'low' ? '#BBF7D0' : '#FDE68A'}`,
                      borderRadius: 'var(--r-md)',
                    }}>
                      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Executive Summary</h3>
                      <p style={{ fontWeight: 500, fontSize: 13.5, color: 'var(--ink-900)', marginBottom: 6, lineHeight: 1.6 }}>{assessment.summary}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {assessment.citations.map((c) => <CitationChip key={c.id} cite={c} />)}
                      </div>
                    </div>
                    {!canAnonymize && assessment.findings.map((f) => {
                      const sev = f.severity
                      const sevColor = sev === 'critical' || sev === 'high' ? 'var(--red-700)' : sev === 'medium' ? 'var(--amber-700)' : 'var(--ink-400)'
                      return (
                        <div key={f.id} className="card" style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: sevColor, letterSpacing: '0.05em' }}>{sev}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-800)' }}>{f.title}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-400)' }}>{f.category}</span>
                          </div>
                          <p style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7, marginBottom: f.remediation ? 8 : 0 }}>{f.detail}</p>
                          {f.remediation && (
                            <p style={{ fontSize: 12.5, color: 'var(--ink-600)', borderTop: '1px solid var(--line)', paddingTop: 8, fontStyle: 'italic' }}>
                              Recommendation: {f.remediation}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                            {f.citations.map((c) => c.source === 'pdpl'
                              ? <ArticleRefBadge key={c.id} article={c.ref} title={c.excerpt} />
                              : <CitationChip key={c.id} cite={c} />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Anonymization checker — shown prominently when requester declared data can be anonymized */}
              {canAnonymize && <AnonymizationCheckCard ticket={ticket} />}

              {!canAnonymize && !assessment && ticket.preAssessmentData && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>AI Pre-Submission Assessment</h2>
                  </div>
                  <PresubmitAssessmentView data={ticket.preAssessmentData} requestType={ticket.type} />
                </section>
              )}

              {!canAnonymize && !assessment && !ticket.preAssessmentData && (
                <div style={{ padding: '20px', background: 'var(--surface-1)', border: '1px dashed var(--line)', borderRadius: 'var(--r-lg)', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-400)' }}>
                  No pre-submission AI assessment found for this ticket.
                </div>
              )}

              {/* Document chat */}
              <section>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 12 }}>Document AI Chat</h2>
                <AIDocumentChat ticket={ticket} />
              </section>
            </div>

          </div>
        )}

        {/* ── Step 4: Data Management Review ── */}
        {wizardStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Reviewer Copilot — top of Data Management step */}
            {!isMobile && <ReviewerAssistPanel ticket={ticket} userRole={user.role} />}

            {/* Anonymization verification — shown when requester declared data can be anonymized */}
            {(ticket.payload as import('../data/types').VendorOnboardingPayload)?.questionnaire?.purposeNecessity?.canAnonymize === 'yes' && (
              <AnonymizationCheckCard ticket={ticket} />
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Data Management Review</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Validate AI findings and complete the review checklist.</p>
              </div>
              {effectiveRisk && <RiskBadge level={effectiveRisk} compact />}
            </div>

            {/* ── Submission Summary (collapsible) — hidden when data can be anonymized since questionnaire not filled ── */}
            {ticket.submittedAt && !canAnonymize && (
              <div className="card" style={{ padding: 0, borderColor: 'var(--emerald-300)', background: 'rgba(16,185,129,0.04)' }}>
                <button
                  onClick={() => setSummaryOpen((o) => !o)}
                  style={{ width: '100%', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--r-lg)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--emerald-600)', fontWeight: 700, fontSize: 14 }}>✓</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>Submission Summary — v{ticket.reviews.filter((r) => r.verdict !== 'pending').length + 1}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{summaryOpen ? '▲' : '▼'}</span>
                </button>
                {summaryOpen && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 14, fontSize: 13 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 2 }}>Request ID</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{ticket.id}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 2 }}>Submitted</div>
                        <div>{formatDateTime(ticket.submittedAt)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 2 }}>Title</div>
                        <div style={{ fontWeight: 500 }}>{ticket.title}</div>
                      </div>
                      {vendor && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 2 }}>Vendor</div>
                          <div>{vendor.tradeName}</div>
                        </div>
                      )}
                    </div>
                    {ticket.reviews.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 6 }}>Assigned Reviewers</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {ticket.reviews.map((r) => (
                            <span key={r.role} className={`pill pill-no-dot ${r.verdict === 'pending' ? 'pill-slate' : r.verdict === 'approve' ? 'pill-emerald' : 'pill-amber'}`} style={{ fontSize: 11 }}>
                              {r.role.replace(/_/g, ' ')} — {r.verdict}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {auditEvents.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 6 }}>Audit Trail</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                          {[...auditEvents].reverse().map((e) => (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px', background: 'var(--surface-1)', borderRadius: 'var(--r-sm)', fontSize: 12 }}>
                              <span style={{ color: 'var(--ink-400)', flexShrink: 0 }}>🕐</span>
                              <div>
                                <span style={{ fontWeight: 600 }}>{e.action}</span>
                                <span style={{ color: 'var(--ink-400)', marginLeft: 6 }}>— {e.actorId}</span>
                                <div style={{ color: 'var(--ink-400)' }}>{formatDateTime(e.ts)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── AI Deep Assessment (auto-triggered) — hidden when data can be anonymized ── */}
            {!canAnonymize && <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--teal-50)', color: 'var(--teal-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>Reviewer AI Deep Assessment</h3>
                  <p style={{ fontSize: 12, color: 'var(--ink-400)', margin: 0 }}>AI-generated compliance analysis for this ticket</p>
                </div>
                {reviewerData && !reviewerLoading && (
                  <button className="btn btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { if (ticket?.id) delete _reviewerDataCache[ticket.id]; setReviewerData(null); void generateReviewerAI() }}><RefreshCw size={12} /> Regenerate</button>
                )}
              </div>
              {reviewerLoading && (
                <div style={{ padding: '20px 18px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid var(--teal-100)', borderTop: '2.5px solid var(--teal-600)', animation: 'spin 0.9s linear infinite', flexShrink: 0 }} aria-hidden="true" />
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 2px' }}>Analyzing ticket…</p>
                    <p style={{ fontSize: 12.5, color: 'var(--ink-500)', margin: 0 }}>Running deep PDPL compliance review</p>
                  </div>
                </div>
              )}
              {reviewerError && (
                <div style={{ padding: '14px 16px', background: 'var(--red-50)', border: '1px solid #FECACA', borderRadius: 'var(--r-lg)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 'var(--r-md)', background: '#FEE2E2', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={12} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: '#991B1B' }}>{reviewerError}</span>
                  <button className="btn btn-sm" onClick={() => void generateReviewerAI()}>Retry</button>
                </div>
              )}
              {/* ── Attached Documents ── */}
              {ticket.attachments.length > 0 && (
                <div className="card" style={{ padding: '16px 18px' }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📎 Attached Documents ({ticket.attachments.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ticket.attachments.map((att) => (
                      <div key={att.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>📄</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{att.filename}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>Requester{att.sizeBytes ? ` · ${Math.round(att.sizeBytes / 1024)} KB` : ''}</div>
                          </div>
                        </div>
                        <button className="btn btn-sm btn-ghost" style={{ fontSize: 12 }}
                          onClick={() => {
                            if (att.signedUrl) {
                              const a = document.createElement('a')
                              a.href = att.signedUrl; a.download = att.filename
                              document.body.appendChild(a); a.click(); document.body.removeChild(a)
                            } else if (isSupabaseConfigured) {
                              void dvDownloadFile(T.attachments, att.id, 'pdplr_filecontent', att.filename)
                            }
                          }}>↓ Download</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {// eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((() => {
                const aiFindings = (reviewerData?.document_findings as Array<{ title: string; detail: string; severity: string; section?: string; page?: number; excerpt?: string; document?: string }> | undefined) ?? []
                const seedFindings = assessment?.findings ?? []
                const hasFindings = aiFindings.length > 0 || seedFindings.length > 0
                if (!hasFindings) return null
                const allFindings: Array<{ key: string; title: string; detail: string; severity: string; section?: string; page?: number; excerpt?: string; document?: string }> = [
                  ...aiFindings.map((f, i) => ({ key: `ai-${i}`, ...f })),
                  ...seedFindings.map((f) => ({
                    key: f.id, title: f.title, detail: f.detail,
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'fail' : f.severity === 'medium' ? 'warning' : 'pass',
                  })),
                ]
                return (
                  <div className="card" style={{ padding: '16px 18px' }}>
                    <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} color="var(--brand-600)" strokeWidth={2} aria-hidden />
                      Document Analysis — Findings
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {allFindings.map((f, i) => {
                        const hasLocation = f.section || f.page
                        return (
                          <div key={f.key} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                            padding: '10px 0', position: 'relative',
                            borderBottom: i < allFindings.length - 1 ? '1px solid var(--line)' : 'none',
                          }}
                            className={hasLocation ? 'finding-row' : undefined}
                          >
                            <p style={{ flex: 1, fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.55, margin: 0 }}>
                              <span style={{ fontWeight: 600 }}>{f.title}:</span>{' '}{f.detail}
                              {hasLocation && (
                                <span style={{
                                  marginLeft: 6, fontSize: 11, color: 'var(--brand-600)',
                                  fontFamily: 'var(--font-mono)', cursor: 'default',
                                  display: 'inline-block', position: 'relative',
                                }}
                                  title={[f.document && `Doc: ${f.document}`, f.section && `Section: ${f.section}`, f.page && `Page ${f.page}`, f.excerpt && `"${f.excerpt}"`].filter(Boolean).join(' · ')}
                                >
                                  📍 {[f.document, f.section, f.page && `p.${f.page}`].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </p>
                            <span className={`pill pill-no-dot ${f.severity === 'fail' ? 'pill-red' : f.severity === 'warning' ? 'pill-amber' : 'pill-emerald'}`} style={{ fontSize: 10.5, flexShrink: 0 }}>
                              {f.severity === 'fail' ? 'Fail' : f.severity === 'warning' ? 'Warning' : 'Pass'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              })() as any)}

              {/* ── Controller / Processor Roles ── */}
              {reviewerData?.controller_processor_roles && !reviewerLoading && (
                <ControllerProcessorRolesCard data={reviewerData.controller_processor_roles} />
              )}

              {reviewerData && !reviewerLoading && <ReviewerAssessmentView data={reviewerData} requestType={ticket.type} />}
            </section>}

            {/* ── Return Thread ── */}
            {ticket.returnThread.length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Return Thread</h3>
                <CommentThread
                  entries={ticket.returnThread}
                  attachments={[...ticket.attachments, ...reviewerAttachments]}
                  readOnly={!canReview}
                  onEvaluate={canReview || user.role === 'admin' ? handleEvaluateReply : undefined}
                  evaluatingId={evaluatingEntryId ?? undefined}
                  onReply={async (msg) => {
                    setThreadReplying(true)
                    const attIds = reviewerAttachments.map((a) => a.id)
                    try {
                      if (isSupabaseConfigured) {
                        await addReturnComment(ticket.id, msg, attIds, user.id, user.role)
                        setReviewerAttachments([])
                        await refreshTickets()
                      } else {
                        demoAddReturnComment(ticket.id, msg, user.role as Role, user.fullName)
                      }
                      showToast('Reply added.', 'success')
                      navigate('/dashboard')
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Failed.', 'error')
                    } finally { setThreadReplying(false) }
                  }}
                />
              </div>
            )}

            {/* ── Review Checklist ── */}
            {canAnonymize ? (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Anonymization Review</h3>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    id="anon-claim-reviewed"
                    checked={anonClaimReviewed}
                    onChange={() => { if (canReview) setAnonClaimReviewed((v) => !v) }}
                    disabled={!canReview}
                    style={{ width: 15, height: 15, marginTop: 2, accentColor: 'var(--brand-600)', cursor: canReview ? 'pointer' : 'default', flexShrink: 0 }}
                  />
                  <label htmlFor="anon-claim-reviewed" style={{ fontSize: 13.5, color: 'var(--ink-800)', cursor: canReview ? 'pointer' : 'default' }}>
                    Anonymization claim reviewed — I confirm the requester's anonymization claim has been verified against the uploaded document.
                  </label>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 600 }}>Review Checklist</h3>
                  {canReview && (
                    <div style={{ display: 'flex', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 2 }}>
                      <button onClick={() => setReviewMode('manual')} style={{ padding: '4px 12px', borderRadius: 'var(--r-sm)', fontSize: 12, border: 'none', background: reviewMode === 'manual' ? 'var(--surface-0)' : 'transparent', fontWeight: reviewMode === 'manual' ? 600 : 400, cursor: 'pointer', color: 'var(--ink-800)', boxShadow: reviewMode === 'manual' ? 'var(--shadow-sm)' : 'none' }}>
                        Manual
                      </button>
                      <button onClick={() => setReviewMode('ai')} style={{ padding: '4px 12px', borderRadius: 'var(--r-sm)', fontSize: 12, border: 'none', background: reviewMode === 'ai' ? 'var(--surface-0)' : 'transparent', fontWeight: reviewMode === 'ai' ? 600 : 400, cursor: 'pointer', color: 'var(--ink-800)', boxShadow: reviewMode === 'ai' ? 'var(--shadow-sm)' : 'none' }}>
                        ✨ AI Auto-Check
                      </button>
                    </div>
                  )}
                </div>
                {reviewMode === 'ai' && canReview && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', background: 'rgba(99,102,241,0.04)', border: '1px solid var(--brand-200)', borderRadius: 'var(--r-md)', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                      {checklistData
                        ? `AI verdict generated — overall: ${checklistData.items.every((i) => i.verdict !== 'fail') ? 'PASS' : 'FAIL'}`
                        : 'Run an AI assessment of every checklist item against the gathered evidence.'}
                    </div>
                    <button className="btn btn-sm" onClick={() => void generateChecklist()} disabled={checklistLoading} style={{ flexShrink: 0 }}>
                      {checklistLoading ? '…' : checklistData ? '↺ Re-run' : '✨ Run AI Review'}
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {([
                    { field: 'purposeIsClear' as const,          label: 'Purpose of data sharing is clearly stated' },
                    { field: 'dataIsNecessary' as const,         label: 'Data included is necessary for the stated purpose' },
                    { field: 'noExcessivePersonalData' as const, label: 'No excessive personal data beyond requirements' },
                    { field: 'recipientIsAppropriate' as const,  label: 'Recipient is appropriate and verified' },
                    { field: 'attachmentsReviewed' as const,     label: 'All attachments have been reviewed' },
                  ]).map(({ field, label }) => {
                    const aiVerdict = checklistData?.items.find((i) => i.key === field)
                    const showAI = reviewMode === 'ai' && !!aiVerdict
                    const lockedByAIFail = reviewMode === 'ai' && aiVerdict?.verdict === 'fail'
                    return (
                      <div key={field} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={reviewMode === 'manual' ? manualChecklist[field] : (!!aiVerdict && aiVerdict.verdict !== 'fail')}
                          onChange={() => { if (!canReview || lockedByAIFail || reviewMode !== 'manual') return; setManualChecklist((prev) => ({ ...prev, [field]: !prev[field] })) }}
                          disabled={!canReview || lockedByAIFail || (reviewMode === 'ai' && !aiVerdict)}
                          style={{ width: 15, height: 15, marginTop: 2, accentColor: 'var(--brand-600)', cursor: (canReview && !lockedByAIFail && reviewMode === 'manual') ? 'pointer' : 'default', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 13.5, color: 'var(--ink-800)' }}>{label}</label>
                          {showAI && aiVerdict && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, color: aiVerdict.verdict === 'pass' ? 'var(--emerald-600)' : aiVerdict.verdict === 'warn' ? 'var(--amber-600)' : 'var(--red-600)' }}>
                                {aiVerdict.verdict === 'pass' ? '✓' : aiVerdict.verdict === 'warn' ? '⚠' : '✕'}
                              </span>
                              <p style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.5 }}>{aiVerdict.justification}</p>
                            </div>
                          )}
                        </div>
                        {showAI && aiVerdict && (
                          <span className={`pill pill-no-dot ${aiVerdict.verdict === 'pass' ? 'pill-emerald' : aiVerdict.verdict === 'warn' ? 'pill-amber' : 'pill-red'}`} style={{ fontSize: 10.5, flexShrink: 0 }}>
                            {aiVerdict.verdict.toUpperCase()}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {reviewMode === 'ai' && checklistData && canReview && checklistData.items.some((i) => i.verdict === 'fail') && (
                  <p style={{ marginTop: 12, fontSize: 12, color: 'var(--red-600)' }}>AI flagged failing items — switch to Manual to override.</p>
                )}
              </div>
            )}

            {/* ── Attach Documents (reviewer) ── */}
            <section>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Attach Documents</h3>
              {/* Segmented tab bar — centered, all options visible */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--surface-1)', width: '100%', maxWidth: 640 }}>
                  {([
                    { key: 'upload', label: '↑ Upload', icon: null },
                    { key: 'library', label: '📁 Library', icon: null },
                    { key: 'templates', label: '📄 Templates', icon: null },
                  ] as const).map((tab) => (
                    <button key={tab.key}
                      style={{
                        flex: 1, padding: '9px 8px', border: 'none',
                        borderRight: '1px solid var(--line)',
                        background: attachTab === tab.key ? 'var(--surface-0)' : 'transparent',
                        fontWeight: attachTab === tab.key ? 700 : 400,
                        fontSize: 12.5,
                        color: attachTab === tab.key ? 'var(--brand-700)' : 'var(--ink-500)',
                        cursor: 'pointer',
                        boxShadow: attachTab === tab.key ? 'inset 0 -2px 0 var(--brand-600)' : 'none',
                        transition: 'all 0.12s',
                      }}
                      onClick={() => {
                        setAttachTab(tab.key)
                        if (tab.key === 'library' && libraryDocs.length === 0 && isSupabaseConfigured) {
                          setAttachLibraryLoading(true)
                          fetchDocuments().then((d) => setLibraryDocs(d)).finally(() => setAttachLibraryLoading(false))
                        }
                        if (tab.key === 'templates' && libraryTemplates.length === 0 && isSupabaseConfigured) {
                          setAttachLibraryLoading(true)
                          fetchTemplates().then((t) => setLibraryTemplates(t)).finally(() => setAttachLibraryLoading(false))
                        }
                      }}>
                      {tab.label}
                    </button>
                  ))}
                  {(user.role === 'data_management' || user.role === 'admin') && (
                    <button
                      style={{
                        flex: 1, padding: '9px 8px', border: 'none',
                        background: 'transparent',
                        fontWeight: 600, fontSize: 12.5,
                        color: 'var(--brand-700)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}
                      onClick={() => {
                        setShowAIDocGen(true)
                        // Pre-fetch templates for the Fill Template tab if not loaded yet
                        if (isSupabaseConfigured && libraryTemplates.length === 0) {
                          setAttachLibraryLoading(true)
                          fetchTemplates().then((t) => setLibraryTemplates(t)).finally(() => setAttachLibraryLoading(false))
                        }
                      }}>
                      <Sparkles size={12} />✨ AI Generate
                    </button>
                  )}
                </div>
              </div>
              {attachTab === 'upload' && (
                <EvidenceUploader
                  attachments={reviewerAttachments}
                  ticketId={ticket.id}
                  readOnly={!canReview}
                  onUploaded={(a) => setReviewerAttachments((prev) => [...prev, a])}
                  onRemove={(ai) => setReviewerAttachments((prev) => prev.filter((a) => a.id !== ai))}
                />
              )}
              {attachTab === 'library' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attachLibraryLoading && <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>Loading…</p>}
                  {!attachLibraryLoading && libraryDocs.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>No documents in library.</p>
                  )}
                  {libraryDocs.map((doc) => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>{doc.document_type} · {doc.status}</div>
                      </div>
                      <button className="btn btn-sm" disabled={!canReview}
                        onClick={() => {
                          const fakeAtt: Attachment = {
                            id: doc.id, ticketId: ticket.id, filename: doc.file_path.split('/').pop() ?? doc.title,
                            sizeBytes: doc.file_size, contentType: doc.file_type || 'application/octet-stream',
                            uploadedBy: doc.uploaded_by ?? '', uploadedAt: doc.created_at,
                            storageBucket: 'library', storagePath: doc.file_path,
                            scanStatus: 'clean', classification: 'internal', category: 'other',
                          }
                          setReviewerAttachments((prev) => prev.some((a) => a.id === doc.id) ? prev : [...prev, fakeAtt])
                          showToast('Document attached.', 'success')
                        }}>Attach</button>
                    </div>
                  ))}
                </div>
              )}
              {attachTab === 'templates' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attachLibraryLoading && <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>Loading…</p>}
                  {!attachLibraryLoading && libraryTemplates.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>No templates available.</p>
                  )}
                  {libraryTemplates.map((tpl) => (
                    <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{tpl.title}</div>
                        {tpl.description && <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>{tpl.description}</div>}
                      </div>
                      <button className="btn btn-sm" disabled={!canReview}
                        onClick={() => {
                          const fakeAtt: Attachment = {
                            id: tpl.id, ticketId: ticket.id, filename: tpl.file_path.split('/').pop() ?? tpl.title,
                            sizeBytes: 0, contentType: tpl.file_type || 'application/octet-stream',
                            uploadedBy: tpl.uploaded_by ?? '', uploadedAt: tpl.created_at,
                            storageBucket: 'templates', storagePath: tpl.file_path,
                            scanStatus: 'clean', classification: 'internal', category: 'other',
                          }
                          setReviewerAttachments((prev) => prev.some((a) => a.id === tpl.id) ? prev : [...prev, fakeAtt])
                          showToast('Template attached.', 'success')
                        }}>Attach</button>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Document Generator modal */}
              {showAIDocGen && (
                <AIDocumentGeneratorPanel
                  ticket={ticket}
                  vendor={vendor ?? null}
                  project={project ?? null}
                  assessment={assessment}
                  templates={libraryTemplates}
                  onGenerated={(att) => {
                    setReviewerAttachments((prev) => [...prev, att])
                    setAttachTab('upload')
                  }}
                  onClose={() => setShowAIDocGen(false)}
                />
              )}
            </section>

            {/* ── Monitoring banner — DM watching ticket in legal/security review ── */}
            {user.role === 'data_management' && ['in_legal_review', 'in_security_review'].includes(ticket.state) && (
              <div style={{ padding: '12px 16px', background: 'var(--amber-50)', border: '1px solid #FDE68A', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--amber-800)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⏳</span>
                <div>
                  <strong>Monitoring Mode</strong> — This ticket is under <strong>{ticket.state === 'in_legal_review' && hasParallelSecuritySlot ? 'Legal & Security' : ticket.state === 'in_legal_review' ? 'Legal' : 'Security'} Review</strong>.
                  You can view the ticket but cannot take action until {hasParallelSecuritySlot ? 'both reviewers respond' : 'the reviewer responds'}.
                </div>
              </div>
            )}

            {/* ── Review Comments + Action Buttons (DM only) ── */}
            {canReview && user.role === 'data_management' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5 }}>REVIEW COMMENTS</label>
                  <textarea className="textarea" rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Add your review comments..." />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => void handleDMAction('approve')}
                    disabled={dmSaving || !(canAnonymize ? anonClaimReviewed : reviewMode === 'manual' ? Object.values(manualChecklist).every(Boolean) : (checklistData !== null && checklistData.items.every((i) => i.verdict !== 'fail')))}
                  >
                    {dmSaving ? '…' : 'Approve'}
                  </button>
                  <button className="btn" onClick={() => void handleDMAction('return')} disabled={dmSaving}>
                    Return to Requester
                  </button>
                  <button className="btn btn-danger" onClick={() => { setRejectReason(''); setShowRejectDialog(true) }} disabled={dmSaving}>
                    Reject
                  </button>
                  <button className="btn" style={{ color: 'var(--amber-700)', borderColor: 'rgba(217,119,6,0.4)' }} onClick={() => void handleDMAction('escalate_legal')} disabled={dmSaving}>
                    Escalate to Legal
                  </button>
                  <button className="btn" style={{ color: 'var(--amber-700)', borderColor: 'rgba(217,119,6,0.4)' }} onClick={() => void handleDMAction('escalate_security')} disabled={dmSaving}>
                    Escalate to Security
                  </button>
                  <button className="btn" style={{ color: 'var(--brand-700)', borderColor: 'rgba(99,102,241,0.4)' }} onClick={() => setShowSplitDialog(true)} disabled={dmSaving}>
                    <GitBranch size={13} style={{ marginRight: 4 }} /> Split &amp; Route in Parallel
                  </button>
                </div>
              </div>
            )}

            {/* Reject confirmation dialog */}
            {showRejectDialog && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowRejectDialog(false) }}>
                <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--red-700)' }}>Reject Request</h2>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 18, lineHeight: 1.6 }}>
                    This decision is final and will be recorded in the audit log. The requester will be notified.
                  </p>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5 }}>REJECTION REASON *</label>
                    <textarea className="textarea" rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why this request is being rejected…" />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={() => setShowRejectDialog(false)} disabled={dmSaving}>Cancel</button>
                    <button className="btn btn-danger" disabled={dmSaving || !rejectReason.trim()}
                      onClick={async () => {
                        setShowRejectDialog(false)
                        // Override reviewComment temporarily so handleDMAction records the reason
                        setReviewComment(rejectReason)
                        await handleDMAction('reject')
                      }}>
                      {dmSaving ? 'Rejecting…' : 'Confirm rejection'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Step 5: Legal Review ── */}
        {wizardStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>⚖️ Legal Review</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Evaluate legal compliance, cross-border risks, and sensitive data handling.</p>
              </div>
              {effectiveRisk && <RiskBadge level={effectiveRisk} compact />}
            </div>

            {/* Return thread */}
            {ticket.returnThread.length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Return Thread</h3>
                <CommentThread
                  entries={ticket.returnThread}
                  attachments={ticket.attachments}
                  readOnly={!canReview}
                  onReply={async (msg) => {
                    setThreadReplying(true)
                    try {
                      if (isSupabaseConfigured) {
                        await addReturnComment(ticket.id, msg, undefined, user.id, user.role)
                        await refreshTickets()
                      } else {
                        demoAddReturnComment(ticket.id, msg, user.role as Role, user.fullName)
                      }
                      showToast('Reply added.', 'success')
                      navigate('/dashboard')
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Failed.', 'error')
                    } finally { setThreadReplying(false) }
                  }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: '16px 18px', borderColor: '#FDE68A' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Cross-Border Assessment</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.6 }}>
                  {ticket.dataDeclaration.crossBorderInvolved
                    ? 'This request involves cross-border personal data transfer. Verify legal basis and SCCs / BCRs are in place.'
                    : 'No cross-border transfer identified in the data declaration.'}
                </p>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-500)' }}>
                  Cross-border: <strong>{ticket.dataDeclaration.crossBorderInvolved ? 'Yes' : 'No'}</strong>
                </div>
              </div>
              <div className="card" style={{ padding: '16px 18px', borderColor: '#FDE68A' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Sensitivity Assessment</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.6 }}>
                  {ticket.dataDeclaration.containsSensitive
                    ? `Sensitive data detected: ${ticket.dataDeclaration.sensitiveCategories.join(', ')}. Heightened care required.`
                    : 'No sensitive personal data identified in the data declaration.'}
                </p>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-500)' }}>
                  Consent obtained: <strong>{ticket.dataDeclaration.consentObtained ? 'Yes' : 'No'}</strong>
                </div>
              </div>
            </div>

            {/* Reviewer attachments */}
            <section>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Legal Review Documents</h3>
              <EvidenceUploader
                attachments={reviewerAttachments}
                ticketId={ticket.id}
                readOnly={!canReview}
                onUploaded={(a) => setReviewerAttachments((prev) => [...prev, a])}
                onRemove={(ai) => setReviewerAttachments((prev) => prev.filter((a) => a.id !== ai))}
              />
            </section>

            {canReview && user.role === 'legal' && (
              <div style={{ padding: '16px 18px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>Legal Decision</h3>
                <ReviewActions ticket={ticket} role="legal" userName={user.fullName} />
              </div>
            )}
          </div>
        )}

        {/* ── Step 6: Security Review ── */}
        {wizardStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>🔒 Security Review</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Define sharing controls and assess security requirements.</p>
              </div>
              {effectiveRisk && <RiskBadge level={effectiveRisk} compact />}
            </div>

            {/* Return thread */}
            {ticket.returnThread.length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Return Thread</h3>
                <CommentThread
                  entries={ticket.returnThread}
                  attachments={ticket.attachments}
                  readOnly={!canReview}
                  onReply={async (msg) => {
                    setThreadReplying(true)
                    try {
                      if (isSupabaseConfigured) {
                        await addReturnComment(ticket.id, msg, undefined, user.id, user.role)
                        await refreshTickets()
                      } else {
                        demoAddReturnComment(ticket.id, msg, user.role as Role, user.fullName)
                      }
                      showToast('Reply added.', 'success')
                      navigate('/dashboard')
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Failed.', 'error')
                    } finally { setThreadReplying(false) }
                  }}
                />
              </div>
            )}

            <div className="card" style={{ padding: '16px 18px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Security Controls Checklist</h3>
              <SecurityControlsChecklist readOnly={!canReview || user.role !== 'security'} />
            </div>

            <div className="card" style={{ padding: '16px 18px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Current Security Posture</h3>
              <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '8px 12px', fontSize: 13 }}>
                <dt style={{ color: 'var(--ink-500)' }}>Encryption state</dt>
                <dd style={{ textTransform: 'capitalize' }}>{ticket.dataDeclaration.encryptionState.replace(/_/g, ' ')}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Sensitive data</dt>
                <dd>{ticket.dataDeclaration.containsSensitive ? 'Yes — extra controls required' : 'No'}</dd>
                <dt style={{ color: 'var(--ink-500)' }}>Financial data</dt>
                <dd>{ticket.dataDeclaration.containsFinancial ? 'Yes' : 'No'}</dd>
              </dl>
            </div>

            {/* Reviewer attachments */}
            <section>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Security Review Documents</h3>
              <EvidenceUploader
                attachments={reviewerAttachments}
                ticketId={ticket.id}
                readOnly={!canReview}
                onUploaded={(a) => setReviewerAttachments((prev) => [...prev, a])}
                onRemove={(ai) => setReviewerAttachments((prev) => prev.filter((a) => a.id !== ai))}
              />
            </section>

            {canReview && user.role === 'security' && (
              <SecurityReturnAction ticket={ticket} userName={user.fullName} />
            )}
          </div>
        )}

        {/* ── Step 7: Final Decision ── */}
        {wizardStep === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Final Decision &amp; Closure</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Complete ticket summary and audit trail.</p>
              </div>
              <StatusPill state={ticket.state} reviews={ticket.reviews} />
            </div>

            {/* Decision banner */}
            {['approved', 'rejected'].includes(ticket.state) && (
              <div className="card" style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                borderColor: ticket.state === 'approved' ? '#BBF7D0' : '#FECACA',
                background: ticket.state === 'approved' ? 'var(--emerald-50)' : 'var(--red-50)',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 'var(--r-lg)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: ticket.state === 'approved' ? '#BBF7D0' : '#FECACA',
                  color: ticket.state === 'approved' ? 'var(--emerald-700)' : 'var(--red-700)',
                }} aria-hidden>
                  {ticket.state === 'approved'
                    ? <CheckCircle size={20} />
                    : <XCircle size={20} />
                  }
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: ticket.state === 'approved' ? 'var(--emerald-700)' : 'var(--red-700)' }}>
                    {ticket.state === 'approved' ? 'Request Approved' : 'Request Rejected'}
                  </p>
                  {ticket.decidedAt && (
                    <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 2 }}>
                      Decision recorded {formatDateTime(ticket.decidedAt)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Review tracks */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>Review Flow</h3>
              {ticket.reviews.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>No reviews recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {ticket.reviews.map((r, i) => {
                    const reviewer = r.reviewerId ? getCachedUser(r.reviewerId) : null
                    const isApproved = r.verdict === 'approve'
                    const isPending = r.verdict === 'pending'
                    return (
                      <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {i > 0 && <span style={{ color: 'var(--ink-300)', fontSize: 14 }}>→</span>}
                        <div style={{
                          padding: '10px 14px', borderRadius: 'var(--r-md)',
                          border: `1px solid ${isApproved ? '#BBF7D0' : isPending ? 'var(--line)' : '#FECACA'}`,
                          background: isApproved ? 'var(--emerald-50)' : isPending ? 'var(--surface-1)' : 'var(--red-50)',
                          textAlign: 'center', minWidth: 90,
                        }}>
                          <RoleBadge role={r.role} size="sm" />
                          <div style={{ fontSize: 11, marginTop: 4 }}>
                            <span className={`pill pill-no-dot ${r.verdict === 'approve' ? 'pill-emerald' : r.verdict === 'reject' ? 'pill-red' : r.verdict === 'return' ? 'pill-amber' : 'pill-slate'}`}
                              style={{ height: 16, fontSize: 10, padding: '0 5px' }}>
                              {isPending ? 'Pending' : r.verdict}
                            </span>
                          </div>
                          {reviewer && <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 3 }}>{reviewer.fullName}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Review decisions detail */}
            {ticket.reviews.filter((r) => r.verdict !== 'pending').length > 0 && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Review Decisions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ticket.reviews.filter((r) => r.verdict !== 'pending').map((r) => {
                    const reviewer = r.reviewerId ? getCachedUser(r.reviewerId) : null
                    return (
                      <div key={r.role} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: r.notes ? 8 : 0, flexWrap: 'wrap' }}>
                          {reviewer && <Avatar initials={reviewer.initials} color={reviewer.avatarColor} size={26} />}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{reviewer?.fullName ?? 'Reviewer'}</div>
                            <RoleBadge role={r.role} size="sm" />
                          </div>
                          <span className={`pill pill-no-dot ${r.verdict === 'approve' ? 'pill-emerald' : r.verdict === 'reject' ? 'pill-red' : 'pill-amber'}`}>
                            {r.verdict}
                          </span>
                          {r.decidedAt && <span style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{formatDate(r.decidedAt)}</span>}
                        </div>
                        {r.notes && <p style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.6, fontStyle: 'italic' }}>"{r.notes}"</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Risk summary */}
            {effectiveRisk && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Risk Summary</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <RiskBadge level={effectiveRisk} compact />
                  {assessment?.summary && <p style={{ fontSize: 13.5, color: 'var(--ink-600)', lineHeight: 1.6, flex: 1 }}>{assessment.summary}</p>}
                </div>
              </div>
            )}

            {/* Audit trail */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Audit Trail</h3>
              {auditEvents.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>No audit events found for this ticket.</p>
              ) : (
                <AuditTimeline events={auditEvents} />
              )}
            </div>
          </div>
        )}

        </>}

        {/* Split-to-parallel dialog */}
        {showSplitDialog && <SplitRouteDialog ticket={ticket} onClose={() => setShowSplitDialog(false)} />}
      </div>
    </div>
  )
}

// ─── Ticket Stepper ───────────────────────────────────────────────────────────

function TicketStepper({
  steps, currentStep, activeStep, canAccess, onStepClick,
}: {
  steps: { key: number; label: string }[]
  currentStep: number
  activeStep: number
  canAccess: (step: number) => boolean
  onStepClick: (step: number) => void
}) {
  return (
    <nav aria-label="Ticket progress" style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 2 }}>
      {steps.map((step, i) => {
        const accessible = canAccess(step.key)
        const isDone = step.key < currentStep
        const isTicketCurrent = step.key === currentStep
        const isActive = step.key === activeStep
        const isLast = i === steps.length - 1

        // Color logic: state-current step always shows brand color regardless of access
        const circleColor = isDone && accessible
          ? 'var(--teal-600)'
          : isTicketCurrent || isActive
          ? 'var(--teal-600)'
          : 'var(--surface-1)'

        const circleBorder = isDone && accessible
          ? 'var(--teal-600)'
          : isTicketCurrent || isActive
          ? 'var(--teal-600)'
          : 'var(--line)'

        const circleTextColor = (isDone && accessible) || isTicketCurrent || isActive
          ? '#fff'
          : 'var(--ink-300)'

        const labelColor = isActive || isTicketCurrent
          ? 'var(--teal-600)'
          : isDone && accessible
          ? 'var(--teal-600)'
          : accessible
          ? 'var(--ink-500)'
          : 'var(--ink-300)'

        return (
          <span key={step.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            <button
              onClick={() => (accessible || isTicketCurrent) && onStepClick(step.key)}
              disabled={!accessible && !isTicketCurrent}
              title={!accessible && !isTicketCurrent ? 'Not accessible for your role' : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', borderRadius: 'var(--r-full)',
                border: (isActive || isTicketCurrent) ? '2px solid var(--teal-600)' : '2px solid transparent',
                background: (isActive || isTicketCurrent) ? 'var(--teal-50)' : 'none',
                cursor: (accessible || isTicketCurrent) ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                color: labelColor,
                fontWeight: isActive || isTicketCurrent ? 700 : 500,
                fontSize: 12.5,
                opacity: (accessible || isTicketCurrent) ? 1 : 0.5,
                transition: 'all var(--t-fast)',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: circleColor,
                border: `2px solid ${circleBorder}`,
                color: circleTextColor,
              }}>
                {accessible && isDone ? '✓' : step.key}
              </span>
              <span style={{ fontSize: 12 }}>{step.label}</span>
            </button>
            {!isLast && (
              <span aria-hidden style={{
                display: 'inline-block', width: 16, height: 1, flexShrink: 0,
                background: isDone && canAccess(step.key + 1) ? 'var(--teal-500)' : 'var(--line)',
              }} />
            )}
          </span>
        )
      })}
    </nav>
  )
}

// ─── Security Controls Checklist ─────────────────────────────────────────────

function SecurityControlsChecklist({ readOnly }: { readOnly: boolean }) {
  const [controls, setControls] = useState({
    encryption: false, accessRestriction: false, watermarking: false, expiryDate: false, auditTrail: false,
  })
  const items = [
    { key: 'encryption',        label: 'Encryption in transit and at rest' },
    { key: 'accessRestriction', label: 'Access restricted to named recipients only' },
    { key: 'watermarking',      label: 'Document watermarking applied' },
    { key: 'expiryDate',        label: 'Document expiry / auto-revocation enabled' },
    { key: 'auditTrail',        label: 'Recipient access audit trail required' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(({ key, label }) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: readOnly ? 'default' : 'pointer' }}>
          <input
            type="checkbox"
            checked={controls[key as keyof typeof controls]}
            disabled={readOnly}
            onChange={() => !readOnly && setControls((prev) => ({ ...prev, [key]: !prev[key as keyof typeof controls] }))}
            style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13.5, color: readOnly ? 'var(--ink-500)' : 'var(--ink-800)' }}>{label}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Split Route Dialog ───────────────────────────────────────────────────────

function SplitRouteDialog({ ticket, onClose }: { ticket: import('../data/types').Ticket; onClose: () => void }) {
  const navigate = useNavigate()
  const { user } = useStore(authStore)
  const [tracks, setTracks] = useState<Record<SplitTrack, boolean>>({ legal: true, security: true })
  const [notes, setNotes] = useState<Record<SplitTrack, string>>({ legal: '', security: '' })
  const [files, setFiles] = useState<Record<SplitTrack, File | null>>({ legal: null, security: null })
  const [saving, setSaving] = useState(false)
  function toggle(track: SplitTrack) { setTracks((prev) => ({ ...prev, [track]: !prev[track] })) }

  async function confirm() {
    if (!tracks.legal && !tracks.security) return
    setSaving(true)
    try {
      const newReviews = [...ticket.reviews]
      if (tracks.legal && !newReviews.some((r) => r.role === 'legal')) newReviews.push({ role: 'legal', verdict: 'pending', reviewerId: null })
      if (tracks.security && !newReviews.some((r) => r.role === 'security')) newReviews.push({ role: 'security', verdict: 'pending', reviewerId: null })

      if (isSupabaseConfigured) {
        // Add per-team return comments
        const tracksEnabled = (['legal', 'security'] as SplitTrack[]).filter((t) => tracks[t])
        for (const track of tracksEnabled) {
          const msg = notes[track].trim() || `Routed to ${track} review via parallel split.`
          await addReturnComment(ticket.id, msg, [], user.id, user.role)
          if (files[track]) {
            await uploadAttachment(ticket.id, files[track]!, 'evidence', undefined, user.id)
          }
        }
        const tracksEnabledRoles = (['legal', 'security'] as SplitTrack[]).filter((t) => tracks[t])
        const updated = await transitionTicket(ticket.id, 'in_legal_review', 'Parallel split initiated', tracksEnabledRoles)
        updateTicket(ticket.id, { ...updated, reviews: newReviews })
      } else {
        if (tracks.legal && notes.legal.trim()) demoAddReturnComment(ticket.id, `[Legal] ${notes.legal}`, 'data_management', user.fullName)
        if (tracks.security && notes.security.trim()) demoAddReturnComment(ticket.id, `[Security] ${notes.security}`, 'data_management', user.fullName)
        updateTicket(ticket.id, { reviews: newReviews, state: 'in_legal_review' })
      }

      showToast('Ticket routed to parallel review tracks.', 'success')
      onClose()
      navigate('/dashboard')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Routing failed.', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <LoadingOverlay show={saving} label="Routing ticket…" />
      <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Split to parallel review</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 20, lineHeight: 1.6 }}>
          Route this ticket to Legal and/or Security simultaneously. Add a comment and optional document for each team.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {(['legal', 'security'] as SplitTrack[]).map((track) => (
            <div key={track} style={{
              border: `2px solid ${tracks[track] ? 'var(--brand-400)' : 'var(--line)'}`,
              borderRadius: 'var(--r-md)', overflow: 'hidden',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: tracks[track] ? 'var(--brand-50)' : 'var(--surface-1)', cursor: 'pointer' }}>
                <input type="checkbox" checked={tracks[track]} onChange={() => toggle(track)} style={{ width: 16, height: 16, accentColor: 'var(--brand-600)' }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', textTransform: 'capitalize' }}>
                    {track} review
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>
                    {track === 'legal' ? 'Contract, regulatory, and legal compliance' : 'Security controls, encryption, and risk evaluation'}
                  </div>
                </div>
              </label>
              {tracks[track] && (
                <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, textTransform: 'uppercase' }}>
                      Comment for {track} team
                    </label>
                    <textarea className="textarea" rows={2}
                      value={notes[track]}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [track]: e.target.value }))}
                      placeholder={`Instructions or context for the ${track} reviewer…`}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, textTransform: 'uppercase' }}>
                      Attach document (optional)
                    </label>
                    <input type="file" style={{ fontSize: 12 }}
                      onChange={(e) => setFiles((prev) => ({ ...prev, [track]: e.target.files?.[0] ?? null }))}
                    />
                    {files[track] && (
                      <span style={{ fontSize: 11, color: 'var(--teal-700)', marginTop: 4, display: 'block' }}>
                        📎 {files[track]!.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void confirm()} disabled={saving || (!tracks.legal && !tracks.security)}>
            {saving ? 'Routing…' : 'Confirm split'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Security Return Action ───────────────────────────────────────────────────

function SecurityReturnAction({ ticket, userName }: { ticket: import('../data/types').Ticket; userName: string }) {
  const navigate = useNavigate()
  const { user } = useStore(authStore)
  const [notes, setNotes] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  async function confirm() {
    if (!notes.trim()) return
    setSaving(true)
    const hasParallelLegalSlot = ticket.reviews.some((r) => r.role === 'legal' && r.verdict === 'pending')
    const returnState: TicketState = hasParallelLegalSlot ? 'in_legal_review' : 'in_data_management'
    try {
      if (isSupabaseConfigured) {
        await saveReviewDecision(ticket.id, 'security', 'return', notes, user.id)
        if (notes.trim()) await addReturnComment(ticket.id, notes, [], user.id, user.role)
        const updated = await transitionTicket(ticket.id, returnState, notes)
        updateTicket(ticket.id, updated)
      } else {
        updateTicket(ticket.id, { state: returnState })
        if (notes.trim()) demoAddReturnComment(ticket.id, notes, 'security', userName)
      }
      showToast('Returned to Data Management.', 'success')
      navigate('/dashboard')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed.', 'error')
    } finally { setSaving(false); setShowDialog(false) }
  }

  return (
    <>
      <LoadingOverlay show={saving} label="Returning to Data Management…" />
      <div style={{ padding: '16px 18px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>Security Decision</h3>
        <button className="btn" onClick={() => setShowDialog(true)}>↩ Return to Data Management</button>
      </div>
      {showDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDialog(false) }}>
          <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Return to Data Management</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 18, lineHeight: 1.6 }}>
              Provide your security findings so Data Management can proceed.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5 }}>SECURITY NOTES *</label>
              <textarea className="textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Summarise security findings and any required actions…" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowDialog(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={() => void confirm()} disabled={saving || !notes.trim()}>
                {saving ? 'Saving…' : 'Confirm return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Anonymization Check Card ─────────────────────────────────────────────────

function AnonymizationCheckCard({ ticket }: { ticket: import('../data/types').Ticket }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState('')
  const [streamText, setStreamText] = useState('')

  async function runCheck() {
    setStatus('running')
    setStreamText('')
    setResult('')

    const attachmentNames = ticket.attachments.map((a) => a.filename).join(', ') || 'No documents uploaded'
    const context = JSON.stringify({
      title: ticket.title,
      description: ticket.description,
      attachments: ticket.attachments.map((a) => ({ name: a.filename, summary: a.extractedSummary ?? null })),
      canAnonymizeDetails: (ticket.payload as import('../data/types').VendorOnboardingPayload)?.questionnaire?.purposeNecessity?.canAnonymizeDetails ?? '',
    }, null, 2)

    const prompt = `The requester declared that the data in this request CAN be anonymized. Your job is to verify whether the uploaded documents support this claim.

Ticket context:
${context}

Uploaded documents: ${attachmentNames}

Based ONLY on the document summaries and ticket context above, determine:
1. Is there evidence in the uploaded documents that anonymization has been or can be applied?
2. What specific anonymization techniques are mentioned (pseudonymization, k-anonymity, data masking, etc.)?
3. Your verdict: CONFIRMED / NOT CONFIRMED / INCONCLUSIVE — and a brief reason.

Be concise. 3-4 sentences max. If no documents are uploaded, state that verification requires document evidence.`

    try {
      const { streamReviewerAssist } = await import('../api/aiReviewerAssist')
      let full = ''
      for await (const token of streamReviewerAssist('data_management', 'requester', context, [{ role: 'user', content: prompt }])) {
        full += token
        setStreamText(full)
      }
      setResult(full)
      setStatus('done')
    } catch {
      setStatus('error')
    } finally {
      setStreamText('')
    }
  }

  const verdictColor = result.includes('CONFIRMED') && !result.includes('NOT CONFIRMED')
    ? 'var(--emerald-700)'
    : result.includes('NOT CONFIRMED')
    ? 'var(--red-700)'
    : 'var(--amber-700)'

  return (
    <div className="ai-surface" style={{ padding: '14px 16px', borderRadius: 'var(--r-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={14} color="var(--brand-700)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-700)' }}>Anonymization Verification</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 600 }}>
          Requester declared: data can be anonymized
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 12, lineHeight: 1.5 }}>
        AI will analyze uploaded documents to verify whether the anonymization claim is substantiated by evidence.
      </p>
      {status === 'idle' && (
        <button className="btn btn-ai btn-sm" onClick={() => void runCheck()}>
          <Sparkles size={12} style={{ marginRight: 6 }} /> Run Anonymization Check
        </button>
      )}
      {status === 'running' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid var(--brand-100)', borderTop: '2.5px solid var(--brand-600)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--brand-700)' }}>Analyzing documents…</span>
          </div>
          {streamText && (
            <div style={{ fontSize: 13, color: 'var(--ink-500)', whiteSpace: 'pre-wrap', lineHeight: 1.65, padding: '8px 10px', background: 'var(--brand-50)', borderRadius: 'var(--r-md)' }}>
              {streamText}
              <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--brand-700)', verticalAlign: 'text-bottom', marginLeft: 1, animation: 'blink 1s step-end infinite' }} />
            </div>
          )}
        </div>
      )}
      {status === 'done' && result && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-800)', whiteSpace: 'pre-wrap', lineHeight: 1.65, padding: '10px 12px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 'var(--r-md)', marginBottom: 8 }}>
            {result}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: verdictColor }}>
              {result.includes('CONFIRMED') && !result.includes('NOT CONFIRMED') ? '✓ Anonymization Confirmed' : result.includes('NOT CONFIRMED') ? '✗ Not Confirmed' : '⚠ Inconclusive'}
            </span>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => { setStatus('idle'); setResult('') }}>Re-run</button>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div style={{ fontSize: 12.5, color: 'var(--red-700)' }}>AI check failed. <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => void runCheck()}>Retry</button></div>
      )}
    </div>
  )
}

// ─── Review Actions ───────────────────────────────────────────────────────────

function ReviewActions({ ticket, role, userName }: { ticket: import('../data/types').Ticket; role: 'data_management' | 'legal' | 'security'; userName: string }) {
  const navigate = useNavigate()
  const { user } = useStore(authStore)
  const [pending, setPending] = useState<'approve' | 'return' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const hasParallelSecuritySlot = ticket.reviews.some((r) => r.role === 'security' && r.verdict === 'pending')

  function nextState(verdict: 'approve' | 'return' | 'reject'): TicketState {
    if (verdict === 'return') {
      if (role === 'legal') {
        // If security still has a pending parallel review slot, hand off to them
        if (hasParallelSecuritySlot) return 'in_security_review'
        return 'in_data_management'
      }
      if (role === 'security') {
        const hasParallelLegalSlot = ticket.reviews.some((r) => r.role === 'legal' && r.verdict === 'pending')
        return hasParallelLegalSlot ? 'in_legal_review' : 'in_data_management'
      }
      return 'returned_to_requester'
    }
    if (verdict === 'reject') return 'rejected'
    const cfg = getWorkflowSettings()
    if (role === 'data_management') {
      const needsLegal    = cfg.legalForCrossBorder && ticket.dataDeclaration.crossBorderInvolved
      const needsSecurity = cfg.securityForSensitive && ticket.dataDeclaration.containsSensitive
      if (needsLegal) return 'in_legal_review'
      if (needsSecurity) return 'in_security_review'
      return 'approved'
    }
    if (role === 'legal') {
      const needsSecurity = cfg.securityForSensitive && ticket.dataDeclaration.containsSensitive
      return needsSecurity ? 'in_security_review' : 'approved'
    }
    return 'approved'
  }

  async function confirmDecision() {
    if (!pending) return
    if (pending === 'return' && !notes.trim()) return
    setSaving(true)
    try {
      if (isSupabaseConfigured) {
        await saveReviewDecision(ticket.id, role, pending, notes || undefined, user.id)
        if (pending === 'return' && notes.trim()) {
          await addReturnComment(ticket.id, notes, [], user.id, user.role)
        }
        const updated = await transitionTicket(ticket.id, nextState(pending), notes || undefined)
        updateTicket(ticket.id, updated)
      } else {
        updateTicket(ticket.id, { state: nextState(pending) })
        if (pending === 'return' && notes.trim()) demoAddReturnComment(ticket.id, notes, role, userName)
      }
      showToast(`Decision recorded: ${pending}`, 'success')
      navigate('/dashboard')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save decision.', 'error')
    } finally { setSaving(false); setPending(null); setNotes('') }
  }

  return (
    <>
      <LoadingOverlay show={saving} label="Saving decision…" />
      <button className="btn" onClick={() => { setPending('return'); setNotes('') }}>
        {role === 'legal' || role === 'security' ? '↩ Return to Data Management' : 'Return to requester'}
      </button>

      {pending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setPending(null) }}>
          <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              {pending === 'approve' ? 'Confirm approval' : pending === 'return' ? (role === 'legal' || role === 'security' ? 'Return to Data Management' : 'Return to requester') : 'Reject request'}
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 18, lineHeight: 1.6 }}>
              {pending === 'approve'
                ? `Approving will advance the ticket to ${nextState('approve').replace(/_/g, ' ')}.`
                : pending === 'return'
                ? (role === 'legal' || role === 'security' ? 'Provide your findings so Data Management can complete the review.' : 'Provide clear instructions so the requester knows what to address.')
                : 'This decision is final and will be recorded in the audit log.'}
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5 }}>
                {pending === 'return' ? 'RETURN INSTRUCTIONS *' : 'NOTES (OPTIONAL)'}
              </label>
              <textarea className="textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={pending === 'return' ? 'Explain what needs to be corrected…' : 'Add any notes for the audit record…'} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { setPending(null); setNotes('') }} disabled={saving}>Cancel</button>
              <button
                className={`btn ${pending === 'approve' ? 'btn-primary' : pending === 'return' ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => void confirmDecision()}
                disabled={saving || (pending === 'return' && !notes.trim())}>
                {saving ? 'Saving…' : pending === 'approve' ? 'Confirm approval' : pending === 'return' ? (role === 'legal' || role === 'security' ? 'Confirm return to DM' : 'Send return') : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
