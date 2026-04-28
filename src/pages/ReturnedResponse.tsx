import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ticketStore, showToast } from '../store'
import { useStore } from '../hooks/useStore'
import { CommentThread } from '../components/CommentThread'
import { EvidenceUploader } from '../components/forms'
import { EmptyState } from '../components/primitives'
import { AICoPilotPanel } from '../components/AICoPilotPanel'

export default function ReturnedResponse() {
  const { id } = useParams<{ id: string }>()
  const { tickets } = useStore(ticketStore)
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)

  const ticket = tickets.find((t) => t.id === id)
  useEffect(() => { document.title = `Respond — ${id} — PDPL Reviewer` }, [id])

  if (!ticket) return <EmptyState title="Ticket not found" icon="🔍" action={<button className="btn btn-primary" onClick={() => navigate('/requests')}>Back</button>} />
  if (ticket.state !== 'returned_to_requester') {
    return <EmptyState title="Ticket is not returned" body="This ticket is not currently awaiting your response." icon="ℹ️"
      action={<button className="btn btn-primary" onClick={() => navigate(`/requests/${id}`)}>Open ticket</button>} />
  }

  function handleReply(_msg: string) {
    showToast('Reply submitted. AI is evaluating your response…', 'info')
    setTimeout(() => showToast('AI evaluation complete. Score: 87/100.', 'success'), 2000)
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
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', maxWidth: 680 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/requests/${id}`)} style={{ marginBottom: 16 }}>← Back to ticket</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Respond to reviewer — {ticket.id}</h1>
        <p style={{ color: 'var(--ink-500)', marginBottom: 24, fontSize: 13.5 }}>
          Address each comment from the reviewer. Attach supporting evidence where needed. The AI will score your response for completeness.
        </p>

        <section aria-labelledby="thread-heading" style={{ marginBottom: 28 }}>
          <h2 id="thread-heading" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Reviewer comments</h2>
          <CommentThread entries={ticket.returnThread} onReply={handleReply} />
        </section>

        <section aria-labelledby="evidence-heading" style={{ marginBottom: 28 }}>
          <h2 id="evidence-heading" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Attach supporting evidence</h2>
          <EvidenceUploader attachmentIds={ticket.attachments} readOnly />
        </section>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => navigate(`/requests/${id}`)}>Cancel</button>
          <button className="btn btn-primary btn-lg" onClick={() => setSubmitted(true)}>
            Submit response & resubmit ticket
          </button>
        </div>
      </div>

      {/* AI scoring panel */}
      <aside style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--line)', padding: 16, background: 'var(--surface-0)' }} aria-label="AI evaluation panel">
        <AICoPilotPanel
          title="AI Evaluate Reply"
          cannedKey="evaluate_reply_high"
          initialText="Write your reply and click 'Submit' — the AI will score it for completeness, specificity, and evidentiary support."
          feature="copilot"
          context={`Return thread — ${ticket.id}`}
        />
      </aside>
    </div>
  )
}
