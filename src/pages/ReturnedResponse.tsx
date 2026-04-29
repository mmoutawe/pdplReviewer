import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ticketStore, showToast, refreshTickets } from '../store'
import { useStore } from '../hooks/useStore'
import { CommentThread } from '../components/CommentThread'
import { EvidenceUploader } from '../components/forms'
import { EmptyState } from '../components/primitives'
import { AICoPilotPanel } from '../components/AICoPilotPanel'
import { isSupabaseConfigured } from '../lib/supabase'
import { addReturnComment, transitionTicket } from '../api/tickets'
import { streamAI } from '../api/ai'
import { AI_CANNED } from '../lib/mockAi'

export default function ReturnedResponse() {
  const { id } = useParams<{ id: string }>()
  const { tickets } = useStore(ticketStore)
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastReply, setLastReply] = useState('')

  const ticket = tickets.find((t) => t.id === id)
  useEffect(() => { document.title = `Respond — ${id} — PDPL Reviewer` }, [id])

  if (!ticket) return <EmptyState title="Ticket not found" icon="🔍" action={<button className="btn btn-primary" onClick={() => navigate('/requests')}>Back</button>} />
  if (ticket.state !== 'returned_to_requester') {
    return <EmptyState title="Ticket is not returned" body="This ticket is not currently awaiting your response." icon="ℹ️"
      action={<button className="btn btn-primary" onClick={() => navigate(`/requests/${id}`)}>Open ticket</button>} />
  }

  async function handleReply(msg: string) {
    setLastReply(msg)
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
      showToast('Reply added (demo mode).', 'success')
    }
    // Trigger AI evaluation of the reply
    const evalPrompt = ticket!.returnThread.length > 0
      ? `Reviewer comment: "${ticket!.returnThread[ticket!.returnThread.length - 1].message}"\n\nRequester reply: "${msg}"\n\nEvaluate this reply.`
      : msg
    void streamAI({ feature: 'evaluate_reply', message: evalPrompt, ticketId: ticket!.id })
  }

  async function handleResubmit() {
    setSubmitting(true)
    try {
      if (isSupabaseConfigured) {
        const updated = await transitionTicket(ticket!.id, 'in_data_management', 'Resubmitted after addressing return comments')
        const { updateTicket } = await import('../store')
        updateTicket(updated.id, updated)
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

  const evalContext = lastReply
    ? `Evaluating reply to return comment on ticket ${ticket.id}`
    : undefined

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', maxWidth: 680 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/requests/${id}`)} style={{ marginBottom: 16 }}>← Back to ticket</button>
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
          <EvidenceUploader attachmentIds={ticket.attachments} readOnly />
        </section>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => navigate(`/requests/${id}`)}>Cancel</button>
          <button className="btn btn-primary btn-lg" onClick={() => void handleResubmit()} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit response & resubmit ticket'}
          </button>
        </div>
      </div>

      {/* AI scoring panel */}
      <aside style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--line)', padding: 16, background: 'var(--surface-0)' }} aria-label="AI evaluation panel">
        <AICoPilotPanel
          title="AI Evaluate Reply"
          cannedKey={AI_CANNED.evaluate_reply_high ? 'evaluate_reply_high' : 'reviewer_copilot_vendor_check'}
          initialText={lastReply ? undefined : 'Write your reply above — the AI will score it for completeness, specificity, and evidentiary support.'}
          feature="evaluate_reply"
          ticketId={ticket.id}
          context={evalContext ?? `Return thread — ${ticket.id}`}
        />
      </aside>
    </div>
  )
}
