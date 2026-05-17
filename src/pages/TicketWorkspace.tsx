import { useEffect, useState } from 'react'
import { useMobile } from '../hooks/useMobile'
import { useParams, useNavigate } from 'react-router-dom'
import { ticketStore, authStore, showToast, updateTicket, refreshTickets, demoAddReturnComment, lookupVendor, lookupProject } from '../store'
import { useStore } from '../hooks/useStore'
import {
  vendorById, projectById, REQUEST_TYPE_LABELS,
  PRE_ASSESSMENTS, AUDIT,
} from '../data/seed'
import type { Attachment, Role, TicketState } from '../data/types'
import { StatusPill, SLAIndicator, Avatar, RoleBadge, EmptyState, RiskBadge, ArticleRefBadge } from '../components/primitives'
import { EvidenceUploader } from '../components/forms'
import { CitationChip } from '../components/AICoPilotPanel'
import { AuditTimeline } from '../components/AuditTimeline'
import { CommentThread } from '../components/CommentThread'
import { formatDate, formatDateTime } from '../lib/utils'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { exportAssessmentPdf } from '../lib/exportAssessmentPdf'
import { exportTicketDocx } from '../lib/exportTicketDocx'
import { getWorkflowSettings } from '../lib/workflowSettings'
import { saveReviewDecision, transitionTicket, addReturnComment, subscribeToTicket } from '../api/tickets'
import { getCachedUser } from '../lib/userCache'
import { runReviewerAssessment, type ReviewerRequestType } from '../api/aiReviewer'
import { ReviewerAssessmentView } from '../components/ReviewerAssessmentView'
import { AIDocumentChat } from '../components/AIDocumentChat'
import { ReviewerAssistPanel } from '../components/ReviewerAssistPanel'
import { runChecklistReview, type ChecklistResult } from '../api/aiChecklist'

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
  if (role === 'requester') return step <= 3 || step === 7
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
  const [reviewerData, setReviewerData] = useState<Record<string, unknown> | null>(null)
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
  const [dmSaving, setDmSaving] = useState(false)
  const [requesterReply, setRequesterReply] = useState('')
  const [requesterReplying, setRequesterReplying] = useState(false)
  const [requesterAttachments, setRequesterAttachments] = useState<Attachment[]>([])

  useEffect(() => {
    document.title = ticket ? `${ticket.id} — PDPL Reviewer` : 'Ticket — PDPL Reviewer'
  }, [ticket])

  useEffect(() => {
    if (!isSupabaseConfigured || !id) return
    return subscribeToTicket(id, (updated) => updateTicket(updated.id, updated))
  }, [id])

  // Re-sync wizard step when ticket state changes (e.g. after review action)
  useEffect(() => {
    if (!ticket) return
    setWizardStep(getDefaultWizardStep(ticket.state))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.state])

  if (!ticket) {
    return (
      <EmptyState title="Ticket not found" body={`No ticket with ID "${id}" exists.`} icon="🔍"
        action={<button className="btn btn-primary" onClick={() => navigate('/requests')}>Back to requests</button>} />
    )
  }

  const requester = getCachedUser(ticket.requesterId)
  const vendor = ticket.vendorId ? (vendorById(ticket.vendorId) ?? lookupVendor(ticket.vendorId)) : null
  const project = ticket.projectId ? (projectById(ticket.projectId) ?? lookupProject(ticket.projectId)) : null
  const [attachments, setAttachments] = useState<Attachment[]>(ticket.attachments)
  const assessment = PRE_ASSESSMENTS.find((a) => a.ticketId === ticket.id)
  const auditEvents = AUDIT.filter((e) => e.targetId === ticket.id)

  const canReview = (
    (user.role === 'data_management' && ['submitted', 'in_data_management', 'returned_to_requester'].includes(ticket.state)) ||
    (user.role === 'legal' && ticket.state === 'in_legal_review') ||
    (user.role === 'security' && ticket.state === 'in_security_review')
  )
  const canViewCurrentStep = canViewWizardStep(wizardStep, user.role as Role)

  async function generateReviewerAI() {
    if (!ticket) return
    setReviewerLoading(true); setReviewerError(null)
    try {
      const data = await runReviewerAssessment(ticket.type as ReviewerRequestType, {
        type: ticket.type, title: ticket.title, description: ticket.description,
        payload: ticket.payload, dataDeclaration: ticket.dataDeclaration,
        returnThread: ticket.returnThread, tags: ticket.tags,
      })
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

  async function handleDMAction(action: 'approve' | 'return' | 'escalate_legal' | 'escalate_security') {
    if (!ticket) return
    if (action === 'return' && !reviewComment.trim()) { showToast('Please add a return comment.', 'error'); return }
    setDmSaving(true)
    const nextDMState: Record<string, TicketState> = {
      approve: 'approved', return: 'returned_to_requester',
      escalate_legal: 'in_legal_review', escalate_security: 'in_security_review',
    }
    const newState = nextDMState[action] as TicketState
    try {
      if (isSupabaseConfigured) {
        const verdict = action === 'return' ? 'return' : action === 'approve' ? 'approve' : 'escalate'
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
      navigate('/requests')
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission failed.', 'error')
    } finally { setRequesterReplying(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface-0)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')} style={{ padding: '2px 6px', fontSize: 12 }}>← Requests</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-500)' }}>{ticket.id}</span>
              <StatusPill state={ticket.state} />
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
              {ticket.submittedAt && <span>Submitted {formatDate(ticket.submittedAt)}</span>}
              {project && <span>Project: {project.name}</span>}
              {vendor && <span>Vendor: {vendor.tradeName}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {ticket.state === 'returned_to_requester' && user.id === ticket.requesterId && (
              <button className="btn btn-primary" onClick={() => navigate(`/requests/${ticket.id}/respond`)}>
                Respond to reviewer
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => exportTicketDocx(ticket)} title="Download as Word document">↓ DOCX</button>
            {(user.role === 'admin' || user.role === 'data_management') && ticket.state === 'in_data_management' && (
              <button className="btn" onClick={() => setShowSplitDialog(true)}>⎇ Split to parallel review</button>
            )}
            {canReview && (
              <ReviewActions ticket={ticket} role={user.role as 'data_management' | 'legal' | 'security'} userName={user.fullName} />
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
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? 16 : 24, minHeight: 0 }}>

        {!canViewCurrentStep ? (
          // Requester on step 4 when ticket is returned for clarification
          ticket.state === 'returned_to_requester' && user.role === 'requester' ? (
            <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', background: 'var(--amber-50)', border: '1px solid #FDE68A', borderRadius: 'var(--r-lg)' }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>🔁</span>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--amber-800)', marginBottom: 4 }}>Request Returned for Clarification</h2>
                  <p style={{ fontSize: 13, color: 'var(--amber-700)', lineHeight: 1.6 }}>The reviewer has returned your request with comments. Please review and respond.</p>
                </div>
              </div>

              {/* Reviewer feedback thread */}
              {ticket.returnThread.length > 0 && (
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 16 }}>⚠</span>
                    <h3 style={{ fontSize: 14, fontWeight: 600 }}>Reviewer Feedback</h3>
                  </div>
                  <CommentThread
                    entries={ticket.returnThread}
                    attachments={[...ticket.attachments, ...requesterAttachments]}
                    readOnly
                  />
                </div>
              )}

              {/* Edit shortcut buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-sm" onClick={() => setWizardStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  Edit Initiation Details
                </button>
                <button className="btn btn-sm" onClick={() => setWizardStep(2)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  Edit Questionnaire
                </button>
              </div>

              {/* Your response */}
              <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M14 2L2 7l5 2 2 5 5-12z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
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
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M14 2L2 7l5 2 2 5 5-12z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/></svg>
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
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
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

              {/* Return thread — shown for requester when ticket is returned */}
              {ticket.state === 'returned_to_requester' && (
                <section className="card" style={{ padding: '18px 20px', borderColor: '#FDE68A', background: 'var(--amber-50)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }} aria-hidden>↩</span>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber-700)' }}>Ticket returned for clarification</h2>
                  </div>
                  <CommentThread
                    entries={ticket.returnThread}
                    attachments={ticket.attachments}
                    readOnly={false}
                    onReply={async (msg) => {
                      if (isSupabaseConfigured) {
                        try { await addReturnComment(ticket.id, msg, undefined, user.id, user.role); await refreshTickets(); showToast('Comment added.', 'success') }
                        catch (err) { showToast(err instanceof Error ? err.message : 'Failed.', 'error') }
                      } else {
                        demoAddReturnComment(ticket.id, msg, user.role as Role, user.fullName)
                        showToast('Comment added.', 'success')
                      }
                    }}
                  />
                  {user.id === ticket.requesterId && (
                    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate(`/requests/${ticket.id}/respond`)}>
                      Submit formal response →
                    </button>
                  )}
                </section>
              )}

              {/* Pre-submission AI */}
              {assessment && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>AI Pre-Submission Assessment</h2>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => exportAssessmentPdf(ticket.id, assessment, ticket.title)}>↓ Export PDF</button>
                      {assessment.overallRisk && (
                        <span className={`pill pill-no-dot ${assessment.overallRisk === 'low' ? 'pill-emerald' : assessment.overallRisk === 'medium' ? 'pill-amber' : 'pill-red'}`}>
                          {assessment.overallRisk === 'high' || assessment.overallRisk === 'critical' ? '⚠ ' : ''}{assessment.overallRisk.charAt(0).toUpperCase() + assessment.overallRisk.slice(1)} Risk
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{
                      padding: '14px 18px',
                      background: assessment.overallRisk === 'low' ? 'var(--emerald-50)' : 'var(--amber-50)',
                      border: `1px solid ${assessment.overallRisk === 'low' ? '#BBF7D0' : '#FDE68A'}`,
                      borderRadius: 'var(--r-md)',
                    }}>
                      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Executive Summary</h3>
                      <p style={{ fontWeight: 500, fontSize: 13.5, color: 'var(--ink-900)', marginBottom: 6, lineHeight: 1.6 }}>{assessment.summary}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {assessment.citations.map((c) => <CitationChip key={c.id} cite={c} />)}
                      </div>
                    </div>
                    {assessment.findings.map((f) => {
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

              {!assessment && (
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

            {!isMobile && (
              <aside style={{ width: 320, flexShrink: 0 }} aria-label="Reviewer assist">
                <ReviewerAssistPanel ticket={ticket} userRole={user.role} />
              </aside>
            )}
          </div>
        )}

        {/* ── Step 4: Data Management Review ── */}
        {wizardStep === 4 && (
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Data Management Review</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Validate AI findings and complete the review checklist.</p>
              </div>
              {assessment && <RiskBadge level={assessment.overallRisk} compact />}
            </div>

            {/* ── Submission Summary (collapsible) ── */}
            {ticket.submittedAt && (
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
                        <div>{formatDate(ticket.submittedAt)}</div>
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
                      <button className="btn btn-sm btn-ghost" style={{ fontSize: 12 }}>↓ Download</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Document Analysis — Findings ── */}
            {assessment && assessment.findings.length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  Document Analysis — Findings
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {assessment.findings.map((f) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', fontSize: 13 }}>
                      <p style={{ flex: 1, marginRight: 12, color: 'var(--ink-700)', lineHeight: 1.5 }}>{f.title}: {f.detail}</p>
                      <span className={`pill pill-no-dot ${f.severity === 'critical' || f.severity === 'high' ? 'pill-red' : f.severity === 'medium' ? 'pill-amber' : 'pill-emerald'}`} style={{ fontSize: 10.5, flexShrink: 0 }}>
                        {f.severity === 'critical' || f.severity === 'high' ? 'Fail' : f.severity === 'medium' ? 'Warning' : 'Pass'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Reviewer Copilot ── */}
            {assessment && (
              <div className="card" style={{ padding: '16px 18px', borderColor: 'var(--brand-200)', background: 'rgba(99,102,241,0.03)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M8 8h8M8 16h4"/></svg>
                  Reviewer Copilot
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 3 }}>Executive Summary:</div>
                    <p style={{ color: 'var(--ink-800)', lineHeight: 1.6 }}>{assessment.summary}</p>
                  </div>
                  {(() => { const r = assessment.findings.find((f) => f.severity === 'critical' || f.severity === 'high'); return r ? (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 3 }}>Top Risk:</div>
                      <p style={{ color: 'var(--red-700)', lineHeight: 1.6 }}>{r.title}: {r.detail}</p>
                    </div>
                  ) : null })()}
                  {(() => { const r = assessment.findings.find((f) => f.remediation); return r ? (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 3 }}>Recommendation:</div>
                      <p style={{ color: 'var(--amber-700)', lineHeight: 1.6 }}>{r.remediation}</p>
                    </div>
                  ) : null })()}
                </div>
              </div>
            )}

            {/* ── Identified Risks ── */}
            {assessment && assessment.findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--amber-600)' }}>⚠</span> Identified Risks
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assessment.findings.filter((f) => f.severity === 'high' || f.severity === 'critical').map((f) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                        <span style={{ color: 'var(--amber-500)', marginTop: 1 }}>⚠</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{f.detail}</div>
                        </div>
                      </div>
                      <RiskBadge level="high" compact />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Compliance Checks ── */}
            {assessment && assessment.findings.length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="2" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Compliance Checks
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assessment.findings.map((f) => (
                    <div key={`cc-${f.id}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1, color: f.severity === 'critical' || f.severity === 'high' ? 'var(--red-600)' : f.severity === 'medium' ? 'var(--amber-600)' : 'var(--emerald-600)' }}>
                          {f.severity === 'critical' || f.severity === 'high' ? '✕' : f.severity === 'medium' ? '⚠' : '✓'}
                        </span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{f.detail}</div>
                        </div>
                      </div>
                      <RiskBadge level={f.severity === 'info' || f.severity === 'low' ? 'low' : f.severity === 'medium' ? 'medium' : 'high'} compact />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Gaps Identified ── */}
            {assessment && assessment.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--red-600)', fontWeight: 700 }}>✕</span> Gaps Identified
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {assessment.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').map((f) => (
                    <div key={`cg-${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.04)', borderRadius: 'var(--r-md)' }}>
                      <span className="pill pill-no-dot pill-red" style={{ fontSize: 10.5, flexShrink: 0 }}>Compliance</span>
                      <span style={{ fontSize: 13 }}>{f.detail}</span>
                    </div>
                  ))}
                  {assessment.findings.filter((f) => (f.category.toLowerCase().includes('securit') || f.category.toLowerCase().includes('encrypt') || f.category.toLowerCase().includes('access')) && (f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium')).map((f) => (
                    <div key={`sg-${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(245,158,11,0.04)', borderRadius: 'var(--r-md)' }}>
                      <span className="pill pill-no-dot pill-amber" style={{ fontSize: 10.5, flexShrink: 0 }}>Security</span>
                      <span style={{ fontSize: 13 }}>{f.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Recommendations ── */}
            {assessment && assessment.findings.filter((f) => f.remediation).length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  Recommendations
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assessment.findings.filter((f) => f.remediation).map((f) => (
                    <div key={`rec-${f.id}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{f.remediation}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 2 }}>Category: {f.category}</div>
                        </div>
                      </div>
                      <RiskBadge level={f.severity === 'critical' || f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : 'low'} compact />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Return Thread ── */}
            {ticket.returnThread.length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Return Thread</h3>
                <CommentThread
                  entries={ticket.returnThread}
                  attachments={[...ticket.attachments, ...reviewerAttachments]}
                  readOnly={!canReview}
                  onReply={async (msg) => {
                    const attIds = reviewerAttachments.map((a) => a.id)
                    if (isSupabaseConfigured) {
                      try {
                        await addReturnComment(ticket.id, msg, attIds, user.id, user.role)
                        setReviewerAttachments([])
                        await refreshTickets()
                        showToast('Reply added.', 'success')
                      }
                      catch (err) { showToast(err instanceof Error ? err.message : 'Failed.', 'error') }
                    } else {
                      demoAddReturnComment(ticket.id, msg, user.role as Role, user.fullName)
                      showToast('Reply added.', 'success')
                    }
                  }}
                />
              </div>
            )}

            {/* ── Reviewer AI Deep Assessment ── */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>Reviewer AI Deep Assessment</h3>
                {!reviewerData && !reviewerLoading && (
                  <button className="btn btn-primary btn-sm" onClick={() => void generateReviewerAI()}>✨ Generate</button>
                )}
                {reviewerData && !reviewerLoading && (
                  <button className="btn btn-sm" onClick={() => { setReviewerData(null); void generateReviewerAI() }}>Regenerate</button>
                )}
              </div>
              {reviewerLoading && (
                <div style={{ padding: '14px 18px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }} aria-hidden>⏳</span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-600)' }}>Running deep reviewer assessment…</span>
                </div>
              )}
              {reviewerError && (
                <div style={{ padding: '12px 16px', background: 'var(--red-50)', border: '1px solid #FECACA', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--red-700)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span aria-hidden>⚠️</span><span style={{ flex: 1 }}>{reviewerError}</span>
                  <button className="btn btn-sm" onClick={() => void generateReviewerAI()}>Retry</button>
                </div>
              )}
              {reviewerData && !reviewerLoading && <ReviewerAssessmentView data={reviewerData} requestType={ticket.type} />}
              {!reviewerData && !reviewerLoading && !reviewerError && (
                <div style={{ padding: '16px', background: 'var(--surface-1)', border: '1px dashed var(--line)', borderRadius: 'var(--r-lg)', textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>
                  Click <strong>Generate</strong> to run a deep PDPL review for this ticket.
                </div>
              )}
            </section>

            {/* ── Review Checklist with Mode Toggle ── */}
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

            {/* ── Attach Documents (reviewer) ── */}
            <section>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Attach Documents</h3>
              <EvidenceUploader
                attachments={reviewerAttachments}
                ticketId={ticket.id}
                readOnly={!canReview}
                onUploaded={(a) => setReviewerAttachments((prev) => [...prev, a])}
                onRemove={(ai) => setReviewerAttachments((prev) => prev.filter((a) => a.id !== ai))}
              />
            </section>

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
                    disabled={dmSaving || !(reviewMode === 'manual' ? Object.values(manualChecklist).every(Boolean) : (checklistData !== null && checklistData.items.every((i) => i.verdict !== 'fail')))}
                  >
                    {dmSaving ? '…' : 'Approve'}
                  </button>
                  <button className="btn" onClick={() => void handleDMAction('return')} disabled={dmSaving}>
                    Return to Requester
                  </button>
                  <button className="btn" style={{ color: 'var(--amber-700)', borderColor: 'rgba(217,119,6,0.4)' }} onClick={() => void handleDMAction('escalate_legal')} disabled={dmSaving}>
                    Escalate to Legal
                  </button>
                  <button className="btn" style={{ color: 'var(--amber-700)', borderColor: 'rgba(217,119,6,0.4)' }} onClick={() => void handleDMAction('escalate_security')} disabled={dmSaving}>
                    Escalate to Security
                  </button>
                  <button className="btn" style={{ color: 'var(--brand-700)', borderColor: 'rgba(99,102,241,0.4)' }} onClick={() => setShowSplitDialog(true)} disabled={dmSaving}>
                    ⎇ Split &amp; Route in Parallel
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Step 5: Legal Review ── */}
        {wizardStep === 5 && (
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>⚖️ Legal Review</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Evaluate legal compliance, cross-border risks, and sensitive data handling.</p>
              </div>
              {assessment && <RiskBadge level={assessment.overallRisk} compact />}
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
                    if (isSupabaseConfigured) {
                      try { await addReturnComment(ticket.id, msg, undefined, user.id, user.role); await refreshTickets(); showToast('Reply added.', 'success') }
                      catch (err) { showToast(err instanceof Error ? err.message : 'Failed.', 'error') }
                    } else {
                      demoAddReturnComment(ticket.id, msg, user.role as Role, user.fullName)
                      showToast('Reply added.', 'success')
                    }
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
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>🔒 Security Review</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Define sharing controls and assess security requirements.</p>
              </div>
              {assessment && <RiskBadge level={assessment.overallRisk} compact />}
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
                    if (isSupabaseConfigured) {
                      try { await addReturnComment(ticket.id, msg, undefined, user.id, user.role); await refreshTickets(); showToast('Reply added.', 'success') }
                      catch (err) { showToast(err instanceof Error ? err.message : 'Failed.', 'error') }
                    } else {
                      demoAddReturnComment(ticket.id, msg, user.role as Role, user.fullName)
                      showToast('Reply added.', 'success')
                    }
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
              <div style={{ padding: '16px 18px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>Security Decision</h3>
                <ReviewActions ticket={ticket} role="security" userName={user.fullName} />
              </div>
            )}
          </div>
        )}

        {/* ── Step 7: Final Decision ── */}
        {wizardStep === 7 && (
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Final Decision &amp; Closure</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>Complete ticket summary and audit trail.</p>
              </div>
              <StatusPill state={ticket.state} />
            </div>

            {/* Decision banner */}
            {['approved', 'rejected'].includes(ticket.state) && (
              <div className="card" style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                borderColor: ticket.state === 'approved' ? '#BBF7D0' : '#FECACA',
                background: ticket.state === 'approved' ? 'var(--emerald-50)' : 'var(--red-50)',
              }}>
                <span style={{ fontSize: 32 }} aria-hidden>{ticket.state === 'approved' ? '✅' : '❌'}</span>
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
            {assessment && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Risk Summary</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <RiskBadge level={assessment.overallRisk} compact />
                  <p style={{ fontSize: 13.5, color: 'var(--ink-600)', lineHeight: 1.6, flex: 1 }}>{assessment.summary}</p>
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
          ? 'var(--emerald-600)'
          : isTicketCurrent || isActive
          ? 'var(--brand-700)'
          : 'var(--surface-1)'

        const circleBorder = isDone && accessible
          ? 'var(--emerald-600)'
          : isTicketCurrent || isActive
          ? 'var(--brand-700)'
          : 'var(--line)'

        const circleTextColor = (isDone && accessible) || isTicketCurrent || isActive
          ? '#fff'
          : 'var(--ink-300)'

        const labelColor = isActive || isTicketCurrent
          ? 'var(--brand-700)'
          : isDone && accessible
          ? 'var(--emerald-700)'
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
                border: (isActive || isTicketCurrent) ? '2px solid var(--brand-600)' : '2px solid transparent',
                background: (isActive || isTicketCurrent) ? 'var(--brand-50)' : 'none',
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
                background: isDone && canAccess(step.key + 1) ? 'var(--emerald-400)' : 'var(--line)',
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
  const [tracks, setTracks] = useState<Record<SplitTrack, boolean>>({ legal: true, security: true })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const hasExisting = (track: SplitTrack) => ticket.reviews.some((r) => r.role === track)
  function toggle(track: SplitTrack) { setTracks((prev) => ({ ...prev, [track]: !prev[track] })) }
  function confirm() {
    if (!tracks.legal && !tracks.security) return
    setSaving(true)
    const newReviews = [...ticket.reviews]
    if (tracks.legal && !hasExisting('legal')) newReviews.push({ role: 'legal', verdict: 'pending', reviewerId: null })
    if (tracks.security && !hasExisting('security')) newReviews.push({ role: 'security', verdict: 'pending', reviewerId: null })
    updateTicket(ticket.id, { reviews: newReviews, state: 'in_legal_review' })
    showToast('Ticket routed to parallel review tracks.', 'success')
    setSaving(false)
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Split to parallel review</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 20, lineHeight: 1.6 }}>
          Route this ticket to Legal and/or Security simultaneously.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {(['legal', 'security'] as SplitTrack[]).map((track) => (
            <label key={track} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `2px solid ${tracks[track] ? 'var(--brand-400)' : 'var(--line)'}`, borderRadius: 'var(--r-md)', cursor: hasExisting(track) ? 'not-allowed' : 'pointer', background: tracks[track] ? 'var(--brand-50)' : 'var(--surface-0)', opacity: hasExisting(track) ? 0.6 : 1 }}>
              <input type="checkbox" checked={tracks[track]} disabled={hasExisting(track)} onChange={() => toggle(track)} style={{ width: 16, height: 16, accentColor: 'var(--brand-600)' }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', textTransform: 'capitalize' }}>
                  {track} review {hasExisting(track) && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-400)' }}>(already assigned)</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>
                  {track === 'legal' ? 'Contract, regulatory, and legal compliance assessment' : 'Security controls, encryption, and risk evaluation'}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5 }}>ROUTING NOTES (OPTIONAL)</label>
          <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context for the reviewers…" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={saving || (!tracks.legal && !tracks.security)}>
            {saving ? 'Routing…' : 'Confirm split'}
          </button>
        </div>
      </div>
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

  function nextState(verdict: 'approve' | 'return' | 'reject'): TicketState {
    if (verdict === 'return') return 'returned_to_requester'
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
      navigate('/requests')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save decision.', 'error')
    } finally { setSaving(false); setPending(null); setNotes('') }
  }

  return (
    <>
      <button className="btn" onClick={() => { setPending('return'); setNotes('') }}>Return to requester</button>
      <button className="btn btn-danger" onClick={() => { setPending('reject'); setNotes('') }}>Reject</button>
      <button className="btn btn-primary" onClick={() => { setPending('approve'); setNotes('') }}>Approve</button>

      {pending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setPending(null) }}>
          <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              {pending === 'approve' ? 'Confirm approval' : pending === 'return' ? 'Return to requester' : 'Reject request'}
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 18, lineHeight: 1.6 }}>
              {pending === 'approve'
                ? `Approving will advance the ticket to ${nextState('approve').replace(/_/g, ' ')}.`
                : pending === 'return'
                ? 'Provide clear instructions so the requester knows what to address.'
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
                className={`btn ${pending === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => void confirmDecision()}
                disabled={saving || (pending === 'return' && !notes.trim())}>
                {saving ? 'Saving…' : pending === 'approve' ? 'Confirm approval' : pending === 'return' ? 'Send return' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
