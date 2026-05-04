import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ticketStore, authStore, showToast, updateTicket, refreshTickets, demoAddReturnComment } from '../store'
import { useStore } from '../hooks/useStore'
import { CommentThread } from '../components/CommentThread'
import { EvidenceUploader } from '../components/forms'
import type { Attachment } from '../data/types'
import { EmptyState } from '../components/primitives'
import { EvaluateReplyView } from '../components/EvaluateReplyView'
import { isSupabaseConfigured } from '../lib/supabase'
import { addReturnComment, transitionTicket } from '../api/tickets'
import { evaluateReply, type ReplyEvaluation } from '../api/aiEvaluateReply'

const ROLE_LABELS: Record<string, string> = {
  requester:       'Requester',
  data_management: 'Data Management Reviewer',
  legal:           'Legal Reviewer',
  security:        'Security Reviewer',
  admin:           'Admin',
}

export default function ReturnedResponse() {
  const { id } = useParams<{ id: string }>()
  const { tickets } = useStore(ticketStore)
  const navigate = useNavigate()
  const [submitted, setSubmitted]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([])
  const [evaluation, setEvaluation]   = useState<ReplyEvaluation | null>(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const [evalError, setEvalError]     = useState<string | null>(null)

  const ticket = tickets.find((t) => t.id === id)
  useEffect(() => { document.title = `Respond — ${id} — PDPL Reviewer` }, [id])

  if (!ticket) return (
    <EmptyState title="Ticket not found" icon="🔍"
      action={<button className="btn btn-primary" onClick={() => navigate('/requests')}>Back</button>} />
  )
  if (ticket.state !== 'returned_to_requester') {
    return (
      <EmptyState title="Ticket is not returned" body="This ticket is not currently awaiting your response." icon="ℹ️"
        action={<button className="btn btn-primary" onClick={() => navigate(`/requests/${id}`)}>Open ticket</button>} />
    )
  }

  async function handleReply(msg: string) {
    if (isSupabaseConfigured) {
      try {
        await addReturnComment(ticket!.id, msg)
        await refreshTickets()
        showToast('Comment added.', 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to add comment.', 'error')
        return
      }
    } else {
      const { user } = authStore.getState()
      demoAddReturnComment(ticket!.id, msg, 'requester', user.fullName)
      showToast('Reply added.', 'success')
    }

    // Trigger evaluation
    const lastReviewerComment = ticket!.returnThread.length > 0
      ? ticket!.returnThread[ticket!.returnThread.length - 1].message
      : ''

    const ticketContext = JSON.stringify({
      id:          ticket!.id,
      type:        ticket!.type,
      title:       ticket!.title,
      description: ticket!.description,
      tags:        ticket!.tags,
    })

    setEvalLoading(true)
    setEvalError(null)
    setEvaluation(null)

    try {
      const result = await evaluateReply({
        roleLabel:       ROLE_LABELS['requester'],
        reviewerComment: lastReviewerComment,
        requesterReply:  msg,
        ticketContext,
        attachments:     [...ticket!.attachments, ...newAttachments],
      })
      setEvaluation(result)
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed.')
    } finally {
      setEvalLoading(false)
    }
  }

  async function handleResubmit() {
    setSubmitting(true)
    try {
      if (isSupabaseConfigured) {
        const updated = await transitionTicket(ticket!.id, 'in_data_management', 'Resubmitted after addressing return comments')
        updateTicket(updated.id, updated)
      } else {
        updateTicket(ticket!.id, { state: 'in_data_management' })
      }
      setSubmitted(true)
      showToast('Response submitted and ticket resubmitted.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Resubmission failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Response submitted</h1>
        <p style={{ color: 'var(--ink-500)', marginBottom: 24 }}>Your reply has been sent to the reviewer. AI has evaluated and scored it.</p>
        <button className="btn btn-primary" onClick={() => navigate(`/requests/${id}`)}>Back to ticket</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: reply form */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', maxWidth: 680 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/requests/${id}`)} style={{ marginBottom: 16 }}>
          ← Back to ticket
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Respond to reviewer — {ticket.id}</h1>
        <p style={{ color: 'var(--ink-500)', marginBottom: 24, fontSize: 13.5 }}>
          Address each comment from the reviewer. Attach supporting evidence where needed. The AI will score your response for completeness.
        </p>

        <section aria-labelledby="thread-heading" style={{ marginBottom: 28 }}>
          <h2 id="thread-heading" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Reviewer comments</h2>
          <CommentThread entries={ticket.returnThread} onReply={(msg) => void handleReply(msg)} />
        </section>

        <section aria-labelledby="evidence-heading" style={{ marginBottom: 28 }}>
          <h2 id="evidence-heading" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Attach supporting evidence</h2>
          <EvidenceUploader
            attachments={[...ticket.attachments, ...newAttachments]}
            ticketId={ticket.id}
            onUploaded={(a) => setNewAttachments((prev) => [...prev, a])}
            onRemove={(id) => setNewAttachments((prev) => prev.filter((a) => a.id !== id))}
          />
        </section>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => navigate(`/requests/${id}`)}>Cancel</button>
          <button className="btn btn-primary btn-lg" onClick={() => void handleResubmit()} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit response & resubmit ticket'}
          </button>
        </div>
      </div>

      {/* Right: AI evaluation panel */}
      <aside style={{
        width: 340, flexShrink: 0,
        borderLeft: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface-0)',
      }} aria-label="AI evaluation panel">

        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
          borderBottom: '1px solid #DDD6FE', background: 'var(--violet-50)',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1l1.5 3 3.5.5-2.5 2.5.5 3.5L8 9l-3 1.5.5-3.5L3 4.5 6.5 4 8 1z" fill="var(--violet-700)" opacity=".8" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--violet-700)' }}>AI Evaluate Reply</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--violet-500)', fontFamily: 'var(--font-mono)' }}>
            {evalLoading ? 'evaluating…' : evaluation ? 'done' : 'ready'}
          </span>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {!evaluation && !evalLoading && !evalError && (
            <p style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.65 }}>
              Write your reply above — the AI will score it for completeness, specificity, and evidentiary support.
            </p>
          )}

          {evalLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }} aria-hidden="true">⏳</span>
              <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>Evaluating your reply…</span>
            </div>
          )}

          {evalError && (
            <div role="alert" style={{
              fontSize: 12.5, color: 'var(--red-700)', background: 'var(--red-50)',
              border: '1px solid #FECACA', borderRadius: 'var(--r-sm)', padding: '10px 12px',
            }}>
              {evalError}
            </div>
          )}

          {evaluation && !evalLoading && (
            <EvaluateReplyView evaluation={evaluation} />
          )}
        </div>
      </aside>
    </div>
  )
}
