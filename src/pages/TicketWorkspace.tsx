import { useEffect, useState } from 'react'
import { useMobile } from '../hooks/useMobile'
import { useParams, useNavigate } from 'react-router-dom'
import { ticketStore, authStore, showToast, updateTicket, refreshTickets, demoAddReturnComment } from '../store'
import { useStore } from '../hooks/useStore'
import {
  vendorById, projectById, REQUEST_TYPE_LABELS,
  AI_GENERATIONS, PRE_ASSESSMENTS, AUDIT,
} from '../data/seed'
import type { Attachment } from '../data/types'
import { StatusPill, SLAIndicator, Avatar, RoleBadge, ConfidenceBadge, EmptyState } from '../components/primitives'
import { Tabs } from '../components/overlays'
import { EvidenceUploader } from '../components/forms'
import { CitationChip } from '../components/AICoPilotPanel'
import { AuditTimeline } from '../components/AuditTimeline'
import { CommentThread } from '../components/CommentThread'
import { formatDate, formatDateTime } from '../lib/utils'
import type { ReviewSlot, TicketState } from '../data/types'
import { isSupabaseConfigured } from '../lib/supabase'
import { saveReviewDecision, transitionTicket, addReturnComment, subscribeToTicket } from '../api/tickets'
import { getCachedUser } from '../lib/userCache'
import { runReviewerAssessment, type ReviewerRequestType } from '../api/aiReviewer'
import { ReviewerAssessmentView } from '../components/ReviewerAssessmentView'
import { AIDocumentChat } from '../components/AIDocumentChat'
import { ReviewerAssistPanel } from '../components/ReviewerAssistPanel'
import { runChecklistReview, type ChecklistResult, CHECKLIST_LABELS, type ChecklistVerdict } from '../api/aiChecklist'

type TabKey = 'overview' | 'evidence' | 'ai' | 'reviews' | 'returns' | 'audit' | 'documents'

const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'evidence',  label: 'Evidence' },
  { key: 'ai',        label: 'AI Assessment' },
  { key: 'documents', label: 'Documents' },
  { key: 'reviews',   label: 'Reviews' },
  { key: 'returns',   label: 'Return thread' },
  { key: 'audit',     label: 'Audit log' },
]

export default function TicketWorkspace() {
  const { id } = useParams<{ id: string }>()
  const { tickets } = useStore(ticketStore)
  const { user } = useStore(authStore)
  const navigate = useNavigate()
  const isMobile = useMobile()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [reviewerData, setReviewerData] = useState<Record<string, unknown> | null>(null)
  const [reviewerLoading, setReviewerLoading] = useState(false)
  const [reviewerError, setReviewerError] = useState<string | null>(null)
  const [checklistData, setChecklistData] = useState<ChecklistResult | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [checklistError, setChecklistError] = useState<string | null>(null)

  const ticket = tickets.find((t) => t.id === id)
  useEffect(() => {
    document.title = ticket ? `${ticket.id} — PDPL Reviewer` : 'Ticket — PDPL Reviewer'
  }, [ticket])

  // Live ticket updates via Supabase Realtime
  useEffect(() => {
    if (!isSupabaseConfigured || !id) return
    return subscribeToTicket(id, (updated) => updateTicket(updated.id, updated))
  }, [id])

  if (!ticket) {
    return <EmptyState title="Ticket not found" body={`No ticket with ID "${id}" exists.`} icon="🔍"
      action={<button className="btn btn-primary" onClick={() => navigate('/requests')}>Back to requests</button>} />
  }

  const requester = getCachedUser(ticket.requesterId)
  const vendor = ticket.vendorId ? vendorById(ticket.vendorId) : null
  const project = ticket.projectId ? projectById(ticket.projectId) : null
  const [attachments, setAttachments] = useState<Attachment[]>(ticket.attachments)
  const assessment = PRE_ASSESSMENTS.find((a) => a.ticketId === ticket.id)
  const generation = assessment ? AI_GENERATIONS.find((g) => g.id === assessment.generationId) : null
  const auditEvents = AUDIT.filter((e) => e.targetId === ticket.id)

  const tabsWithCount = TABS.map((t) => ({
    ...t,
    count: t.key === 'evidence' ? attachments.length
      : t.key === 'returns' ? ticket.returnThread.length
      : t.key === 'reviews' ? ticket.reviews.length
      : t.key === 'audit' ? auditEvents.length
      : undefined,
  }))

  const canReview = (
    (user.role === 'data_management' && ['submitted', 'in_data_management'].includes(ticket.state)) ||
    (user.role === 'legal' && ticket.state === 'in_legal_review') ||
    (user.role === 'security' && ticket.state === 'in_security_review')
  )

  async function generateReviewerAI() {
    if (!ticket) return
    setReviewerLoading(true)
    setReviewerError(null)
    try {
      const ticketPayload = {
        type:            ticket.type,
        title:           ticket.title,
        description:     ticket.description,
        payload:         ticket.payload,
        dataDeclaration: ticket.dataDeclaration,
        returnThread:    ticket.returnThread,
        tags:            ticket.tags,
      }
      const data = await runReviewerAssessment(ticket.type as ReviewerRequestType, ticketPayload)
      setReviewerData(data)
    } catch (err) {
      setReviewerError(err instanceof Error ? err.message : 'Failed to generate reviewer assessment.')
    } finally {
      setReviewerLoading(false)
    }
  }

  async function generateChecklist() {
    if (!ticket) return
    setChecklistLoading(true)
    setChecklistError(null)
    try {
      const ticketPayload = {
        type:            ticket.type,
        title:           ticket.title,
        description:     ticket.description,
        payload:         ticket.payload,
        dataDeclaration: ticket.dataDeclaration,
        attachments:     ticket.attachments.map((a) => ({ filename: a.filename, summary: a.extractedSummary })),
        tags:            ticket.tags,
      }
      const data = await runChecklistReview(ticketPayload)
      setChecklistData(data)
    } catch (err) {
      setChecklistError(err instanceof Error ? err.message : 'Failed to run checklist.')
    } finally {
      setChecklistLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface-0)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')} style={{ padding: '2px 6px', fontSize: 12 }}>← Requests</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-500)' }}>{ticket.id}</span>
              <StatusPill state={ticket.state} />
              {!['approved', 'rejected', 'archived', 'draft'].includes(ticket.state) && (
                <SLAIndicator dueAt={ticket.sla.decisionDueAt} breached={ticket.sla.breached} />
              )}
              {ticket.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.3 }}>{ticket.title}</h1>
            <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-500)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {ticket.state === 'returned_to_requester' && user.id === ticket.requesterId && (
              <button className="btn btn-primary" onClick={() => navigate(`/requests/${ticket.id}/respond`)}>
                Respond to reviewer
              </button>
            )}
            {canReview && (
              <ReviewActions ticket={ticket} role={user.role as 'data_management' | 'legal' | 'security'} userName={user.fullName} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabsWithCount} active={activeTab} onChange={(k) => setActiveTab(k as TabKey)} />

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px', display: activeTab === 'ai' && !isMobile ? 'flex' : 'block', gap: 20, minHeight: 0 }}>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.5fr) minmax(0,1fr)', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <section className="card" style={{ padding: '18px 20px' }} aria-labelledby="desc-heading">
                <h2 id="desc-heading" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 10 }}>Description</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7 }}>{ticket.description}</p>
              </section>

              <section className="card" style={{ padding: '18px 20px' }} aria-labelledby="decl-heading">
                <h2 id="decl-heading" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 10 }}>Data declaration</h2>
                <dl style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '200px 1fr', gap: '8px 12px', fontSize: 13 }}>
                  <dt style={{ color: 'var(--ink-500)' }}>Contains PII</dt>
                  <dd>{ticket.dataDeclaration.containsPII ? 'Yes — ' + ticket.dataDeclaration.piiCategories.join(', ') : 'No'}</dd>
                  <dt style={{ color: 'var(--ink-500)' }}>Contains sensitive data</dt>
                  <dd>{ticket.dataDeclaration.containsSensitive ? 'Yes' : 'No'}</dd>
                  <dt style={{ color: 'var(--ink-500)' }}>Financial data</dt>
                  <dd>{ticket.dataDeclaration.containsFinancial ? 'Yes — ' + ticket.dataDeclaration.financialCategories.join(', ') : 'No'}</dd>
                  <dt style={{ color: 'var(--ink-500)' }}>Est. data subjects</dt>
                  <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{ticket.dataDeclaration.estimatedSubjectCount.toLocaleString()}</dd>
                  <dt style={{ color: 'var(--ink-500)' }}>Retention</dt>
                  <dd>{ticket.dataDeclaration.retentionPeriodDays} days</dd>
                  <dt style={{ color: 'var(--ink-500)' }}>Encryption</dt>
                  <dd style={{ textTransform: 'capitalize' }}>{ticket.dataDeclaration.encryptionState.replace(/_/g, ' ')}</dd>
                  <dt style={{ color: 'var(--ink-500)' }}>Cross-border</dt>
                  <dd>{ticket.dataDeclaration.crossBorderInvolved ? 'Yes' : 'No'}</dd>
                  <dt style={{ color: 'var(--ink-500)' }}>Consent</dt>
                  <dd>{ticket.dataDeclaration.consentObtained ? `Yes — ${ticket.dataDeclaration.consentMechanism ?? 'mechanism unspecified'}` : 'No'}</dd>
                </dl>
              </section>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <section className="card" style={{ padding: '16px 18px' }} aria-labelledby="meta-heading">
                <h2 id="meta-heading" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 10 }}>Metadata</h2>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <dt style={{ color: 'var(--ink-500)' }}>Created</dt>
                    <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDateTime(ticket.createdAt)}</dd>
                  </div>
                  {ticket.submittedAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <dt style={{ color: 'var(--ink-500)' }}>Submitted</dt>
                      <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDateTime(ticket.submittedAt)}</dd>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <dt style={{ color: 'var(--ink-500)' }}>SLA due</dt>
                    <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDateTime(ticket.sla.decisionDueAt)}</dd>
                  </div>
                </dl>
              </section>

              {assessment && (
                <section className="card" style={{ padding: '14px 18px' }} aria-labelledby="risk-heading">
                  <h2 id="risk-heading" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 8 }}>Risk summary</h2>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span className={`pill pill-no-dot ${assessment.overallRisk === 'low' ? 'pill-emerald' : assessment.overallRisk === 'high' || assessment.overallRisk === 'critical' ? 'pill-red' : 'pill-amber'}`}>
                      Risk: {assessment.overallRisk}
                    </span>
                    <span className={`pill pill-no-dot ${assessment.pdplAlignment === 'aligned' ? 'pill-emerald' : assessment.pdplAlignment === 'misaligned' ? 'pill-red' : 'pill-amber'}`}>
                      PDPL: {assessment.pdplAlignment}
                    </span>
                    {generation && <ConfidenceBadge score={generation.confidence} />}
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.6 }}>{assessment.summary}</p>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setActiveTab('ai')}>
                    View full assessment →
                  </button>
                </section>
              )}

              {/* Reviewer status */}
              <section className="card" style={{ padding: '14px 18px' }} aria-labelledby="reviewers-heading">
                <h2 id="reviewers-heading" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 8 }}>Review status</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ticket.reviews.map((r) => (
                    <ReviewerRow key={r.role} slot={r} />
                  ))}
                  {ticket.reviews.length === 0 && (
                    <p style={{ fontSize: 12.5, color: 'var(--ink-400)' }}>Not yet assigned to reviewers.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── Evidence ── */}
        {activeTab === 'evidence' && (
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Evidence & attachments</h2>
            <EvidenceUploader
              attachments={attachments}
              ticketId={ticket.id}
              readOnly={['approved', 'rejected', 'archived'].includes(ticket.state)}
              onUploaded={(a) => setAttachments((prev) => [...prev, a])}
              onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
            />
            {attachments.filter((a) => a.extractedSummary).map((a) => (
              <div key={a.id} className="card" style={{ padding: '12px 16px', marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', marginBottom: 4 }}>
                  Extracted summary — {a.filename}
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.65 }}>{a.extractedSummary}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── AI Assessment ── */}
        {activeTab === 'ai' && (
          <>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Reviewer AI deep assessment */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>Reviewer AI Deep Assessment</h2>
                  {!reviewerData && !reviewerLoading && (
                    <button className="btn btn-primary btn-sm" onClick={() => void generateReviewerAI()}>
                      ✨ Generate
                    </button>
                  )}
                  {reviewerData && !reviewerLoading && (
                    <button className="btn btn-sm" onClick={() => { setReviewerData(null); void generateReviewerAI() }}>
                      Regenerate
                    </button>
                  )}
                </div>

                {reviewerLoading && (
                  <div style={{
                    padding: '16px 18px', background: 'var(--surface-1)',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-lg)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }} aria-hidden="true">⏳</span>
                    <span style={{ fontSize: 13.5, color: 'var(--ink-600)' }}>Running deep reviewer assessment…</span>
                  </div>
                )}

                {reviewerError && (
                  <div style={{
                    padding: '12px 16px', background: 'var(--red-50)',
                    border: '1px solid #FECACA', borderRadius: 'var(--r-md)',
                    fontSize: 13, color: 'var(--red-700)', display: 'flex', gap: 10, alignItems: 'center',
                  }}>
                    <span aria-hidden="true">⚠️</span>
                    <span style={{ flex: 1 }}>{reviewerError}</span>
                    <button className="btn btn-sm" onClick={() => void generateReviewerAI()}>Retry</button>
                  </div>
                )}

                {reviewerData && !reviewerLoading && (
                  <ReviewerAssessmentView data={reviewerData} requestType={ticket.type} />
                )}

                {!reviewerData && !reviewerLoading && !reviewerError && (
                  <div style={{
                    padding: '20px', background: 'var(--surface-1)',
                    border: '1px dashed var(--line)', borderRadius: 'var(--r-lg)',
                    textAlign: 'center', fontSize: 13.5, color: 'var(--ink-400)',
                  }}>
                    Click <strong>Generate</strong> to run a deep PDPL review for this ticket.
                  </div>
                )}
              </section>

              {/* Compliance checklist */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>Compliance Checklist</h2>
                  {!checklistData && !checklistLoading && (
                    <button className="btn btn-sm" onClick={() => void generateChecklist()}>
                      Run checklist
                    </button>
                  )}
                  {checklistData && !checklistLoading && (
                    <button className="btn btn-sm" onClick={() => { setChecklistData(null); void generateChecklist() }}>
                      Rerun
                    </button>
                  )}
                </div>

                {checklistLoading && (
                  <div style={{ padding: '12px 16px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }} aria-hidden="true">⏳</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-600)' }}>Running checklist…</span>
                  </div>
                )}

                {checklistError && (
                  <div style={{ padding: '10px 14px', background: 'var(--red-50)', border: '1px solid #FECACA', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--red-700)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span aria-hidden="true">⚠️</span>
                    <span style={{ flex: 1 }}>{checklistError}</span>
                    <button className="btn btn-sm" onClick={() => void generateChecklist()}>Retry</button>
                  </div>
                )}

                {checklistData && !checklistLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {checklistData.items.map((item) => {
                      const verdictColor: Record<ChecklistVerdict, string> = { pass: '#166534', warn: '#92400E', fail: '#991B1B' }
                      const verdictBg:    Record<ChecklistVerdict, string> = { pass: '#F0FDF4', warn: '#FFFBEB', fail: '#FEF2F2' }
                      const verdictBorder:Record<ChecklistVerdict, string> = { pass: '#BBF7D0', warn: '#FDE68A', fail: '#FECACA' }
                      const verdictIcon:  Record<ChecklistVerdict, string> = { pass: '✓', warn: '⚠', fail: '✕' }
                      const v = item.verdict
                      return (
                        <div key={item.key} style={{
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                          padding: '10px 14px', borderRadius: 'var(--r-md)',
                          background: verdictBg[v], border: `1px solid ${verdictBorder[v]}`,
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: verdictColor[v], flexShrink: 0, width: 14, textAlign: 'center', marginTop: 1 }}>
                            {verdictIcon[v]}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: verdictColor[v], marginBottom: 2 }}>
                              {CHECKLIST_LABELS[item.key] ?? item.key}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.5 }}>{item.justification}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {!checklistData && !checklistLoading && !checklistError && (
                  <div style={{ padding: '14px', background: 'var(--surface-1)', border: '1px dashed var(--line)', borderRadius: 'var(--r-lg)', textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>
                    Click <strong>Run checklist</strong> to evaluate the 5 PDPL compliance criteria.
                  </div>
                )}
              </section>

              {/* Pre-submission AI summary (from seed/submission) */}
              {assessment && (
                <section>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 14 }}>Pre-Submission AI Summary</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{
                      padding: '14px 18px',
                      background: assessment.overallRisk === 'low' ? 'var(--emerald-50)' : 'var(--red-50)',
                      border: `1px solid ${assessment.overallRisk === 'low' ? '#BBF7D0' : '#FECACA'}`,
                      borderRadius: 'var(--r-md)',
                    }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-900)', marginBottom: 4 }}>{assessment.summary}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {assessment.citations.map((c) => <CitationChip key={c.id} cite={c} />)}
                      </div>
                    </div>
                    {assessment.findings.map((f) => {
                      const sev = f.severity
                      const sevColor = sev === 'critical' || sev === 'high' ? 'var(--red-700)' : sev === 'medium' ? 'var(--amber-700)' : 'var(--ink-400)'
                      return (
                        <div key={f.id} className="card" style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
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
                            {f.citations.map((c) => <CitationChip key={c.id} cite={c} />)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>

            {!isMobile && (
              <aside style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }} aria-label="Reviewer assist">
                <ReviewerAssistPanel ticket={ticket} userRole={user.role} />
              </aside>
            )}
          </>
        )}

        {/* ── Documents ── */}
        {activeTab === 'documents' && (
          <div style={{ maxWidth: 760, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <AIDocumentChat ticket={ticket} />
          </div>
        )}

        {/* ── Reviews ── */}
        {activeTab === 'reviews' && (
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Review decisions</h2>
            {ticket.reviews.length === 0 ? (
              <EmptyState title="No reviews" body="Reviews will appear once the ticket is assigned." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ticket.reviews.map((r) => {
                  const reviewer = r.reviewerId ? getCachedUser(r.reviewerId) : null
                  return (
                    <div key={r.role} className="card" style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: r.notes ? 8 : 0 }}>
                        {reviewer && <Avatar initials={reviewer.initials} color={reviewer.avatarColor} size={28} />}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{reviewer?.fullName ?? 'Unassigned'}</div>
                          <RoleBadge role={r.role} size="sm" />
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                          <span className={`pill pill-no-dot ${r.verdict === 'approve' ? 'pill-emerald' : r.verdict === 'reject' ? 'pill-red' : r.verdict === 'return' ? 'pill-amber' : 'pill-slate'}`}>
                            {r.verdict === 'pending' ? 'Pending' : r.verdict}
                          </span>
                        </div>
                      </div>
                      {r.notes && <p style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.65, marginTop: 8 }}>{r.notes}</p>}
                      {r.decidedAt && <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{formatDateTime(r.decidedAt)}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Return thread ── */}
        {activeTab === 'returns' && (
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Return thread</h2>
            <CommentThread
              entries={ticket.returnThread}
              readOnly={ticket.state === 'approved' || ticket.state === 'rejected' || ticket.state === 'archived'}
              onReply={async (msg) => {
                if (isSupabaseConfigured) {
                  try {
                    await addReturnComment(ticket.id, msg)
                    await refreshTickets()
                    showToast('Comment added.', 'success')
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Failed to add comment.', 'error')
                  }
                } else {
                  demoAddReturnComment(ticket.id, msg, user.role as import('../data/types').Role, user.fullName)
                  showToast('Comment added.', 'success')
                }
              }}
            />
          </div>
        )}

        {/* ── Audit ── */}
        {activeTab === 'audit' && (
          <div style={{ maxWidth: 720 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Audit log — {ticket.id}</h2>
            {auditEvents.length === 0 ? (
              <EmptyState title="No audit events" body="Audit events will appear here as the ticket progresses." />
            ) : (
              <AuditTimeline events={auditEvents} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewerRow({ slot }: { slot: ReviewSlot }) {
  const reviewer = slot.reviewerId ? getCachedUser(slot.reviewerId) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
      {reviewer
        ? <Avatar initials={reviewer.initials} color={reviewer.avatarColor} size={22} />
        : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'inline-flex' }} aria-hidden="true" />}
      <span style={{ fontSize: 13, flex: 1 }}>
        {reviewer?.fullName ?? 'Unassigned'} <span style={{ color: 'var(--ink-400)', fontSize: 12 }}>({slot.role.replace('_', ' ')})</span>
      </span>
      <span className={`pill pill-no-dot ${slot.verdict === 'approve' ? 'pill-emerald' : slot.verdict === 'reject' ? 'pill-red' : slot.verdict === 'return' ? 'pill-amber' : 'pill-slate'}`}
        style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>
        {slot.verdict}
      </span>
    </div>
  )
}

function ReviewActions({ ticket, role, userName }: { ticket: import('../data/types').Ticket; role: 'data_management' | 'legal' | 'security'; userName: string }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<'approve' | 'return' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function nextState(verdict: 'approve' | 'return' | 'reject'): TicketState {
    if (verdict === 'return') return 'returned_to_requester'
    if (verdict === 'reject') return 'rejected'
    if (role === 'data_management') return 'in_legal_review'
    if (role === 'legal') return 'in_security_review'
    return 'approved'
  }

  async function confirmDecision() {
    if (!pending) return
    if (pending === 'return' && !notes.trim()) return
    setSaving(true)
    try {
      if (isSupabaseConfigured) {
        await saveReviewDecision(ticket.id, role, pending, notes || undefined)
        const updated = await transitionTicket(ticket.id, nextState(pending), notes || undefined)
        updateTicket(ticket.id, updated)
      } else {
        updateTicket(ticket.id, { state: nextState(pending) })
        if (pending === 'return' && notes.trim()) {
          demoAddReturnComment(ticket.id, notes, role, userName)
        }
      }
      showToast(`Decision recorded: ${pending}`, 'success')
      navigate('/requests')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save decision.', 'error')
    } finally {
      setSaving(false)
      setPending(null)
      setNotes('')
    }
  }

  return (
    <>
      <button className="btn" onClick={() => { setPending('return'); setNotes('') }}>Return to requester</button>
      <button className="btn btn-danger" onClick={() => { setPending('reject'); setNotes('') }}>Reject</button>
      <button className="btn btn-primary" onClick={() => { setPending('approve'); setNotes('') }}>Approve</button>

      {/* Decision confirmation modal */}
      {pending && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={(e) => { if (e.target === e.currentTarget) setPending(null) }}>
          <div style={{
            background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px',
            width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>
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
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>
                {pending === 'return' ? 'RETURN INSTRUCTIONS *' : 'NOTES (OPTIONAL)'}
              </label>
              <textarea
                className="textarea"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={pending === 'return' ? 'Explain what needs to be corrected or provided…' : 'Add any notes for the audit record…'}
              />
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
