import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { externalLinkByToken, ticketById, userById } from '../data/seed'
import Logo from '../components/Logo'
import { StatusPill } from '../components/primitives'
import { REQUEST_TYPE_LABELS } from '../data/seed'
import { formatDate, formatDateTime } from '../lib/utils'
import { isSupabaseConfigured } from '../lib/supabase'
import { submitExternalDecision } from '../api/ai'

type Decision = 'approved' | 'rejected' | null

export default function ExternalApproval() {
  const { token } = useParams<{ token: string }>()
  const link = externalLinkByToken(token ?? '')
  const ticket = link ? ticketById(link.ticketId) : null
  const requester = ticket ? userById(ticket.requesterId) : null

  useEffect(() => { document.title = 'Review Request — PDPL Reviewer' }, [])

  const [decision, setDecision] = useState<Decision>(null)
  const [comments, setComments] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signatureName, setSignatureName] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!link || !ticket) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-1)', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <Logo size="md" />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--red-700)', marginTop: 24, marginBottom: 8 }}>Invalid session</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>This approval link is invalid or your session has expired. Please return to your original link email.</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!decision || !signatureName.trim()) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      if (isSupabaseConfigured && token) {
        await submitExternalDecision(token, decision === 'approved' ? 'approve' : 'reject', comments || undefined)
      }
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <ExternalLayout>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{decision === 'approved' ? '✅' : '✕'}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: decision === 'approved' ? 'var(--emerald-700)' : 'var(--red-700)', marginBottom: 8 }}>
            {decision === 'approved' ? 'Approval confirmed' : 'Rejection recorded'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-500)', lineHeight: 1.65, maxWidth: 340, margin: '0 auto 16px' }}>
            Your decision has been securely recorded and the originating organization has been notified.
            This link has now been invalidated.
          </p>
          <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius)', padding: '12px 18px', display: 'inline-block', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-400)' }}>
            Reference: {ticket.id} · {formatDateTime(new Date().toISOString())}
          </div>
          {comments && (
            <div style={{ marginTop: 16, background: 'var(--surface-1)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: 13, color: 'var(--ink-600)', textAlign: 'left' }}>
              <strong style={{ display: 'block', marginBottom: 4, color: 'var(--ink-800)' }}>Your comments</strong>
              {comments}
            </div>
          )}
        </div>
      </ExternalLayout>
    )
  }

  return (
    <ExternalLayout>
      {/* Request summary */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)' }}>{ticket.id}</span>
          <StatusPill state={ticket.state} size="sm" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>{ticket.title}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-600)', lineHeight: 1.65, marginBottom: 12 }}>{ticket.description}</p>

        <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 12px', fontSize: 13, background: 'var(--surface-1)', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
          <dt style={{ color: 'var(--ink-500)' }}>Request type</dt>
          <dd>{REQUEST_TYPE_LABELS[ticket.type]}</dd>
          <dt style={{ color: 'var(--ink-500)' }}>Submitted by</dt>
          <dd>{requester?.fullName ?? ticket.requesterId}</dd>
          <dt style={{ color: 'var(--ink-500)' }}>Submitted on</dt>
          <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{ticket.submittedAt ? formatDate(ticket.submittedAt) : '—'}</dd>
          <dt style={{ color: 'var(--ink-500)' }}>Data subjects</dt>
          <dd>{ticket.dataDeclaration.estimatedSubjectCount.toLocaleString()}</dd>
          <dt style={{ color: 'var(--ink-500)' }}>Cross-border</dt>
          <dd>{ticket.dataDeclaration.crossBorderInvolved ? 'Yes' : 'No'}</dd>
          <dt style={{ color: 'var(--ink-500)' }}>Sensitive data</dt>
          <dd>{ticket.dataDeclaration.containsSensitive ? 'Yes — special handling required' : 'No'}</dd>
        </dl>
      </div>

      {/* Compliance note */}
      <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.6 }}>
        This request has been reviewed internally under the Saudi Personal Data Protection Law (PDPL). Your approval or rejection will be recorded as part of the compliance audit trail.
      </div>

      {/* Decision */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 10 }}>Your decision</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setDecision('approved')}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 'var(--radius)', border: `2px solid ${decision === 'approved' ? 'var(--emerald-700)' : 'var(--line)'}`,
              background: decision === 'approved' ? 'var(--emerald-50)' : 'var(--surface-0)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: decision === 'approved' ? 'var(--emerald-700)' : 'var(--ink-600)',
              transition: 'all var(--t-fast)',
            }}
          >
            ✓ Approve
          </button>
          <button
            onClick={() => setDecision('rejected')}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 'var(--radius)', border: `2px solid ${decision === 'rejected' ? 'var(--red-700)' : 'var(--line)'}`,
              background: decision === 'rejected' ? 'var(--red-50)' : 'var(--surface-0)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: decision === 'rejected' ? 'var(--red-700)' : 'var(--ink-600)',
              transition: 'all var(--t-fast)',
            }}
          >
            ✕ Reject
          </button>
        </div>
      </div>

      {/* Comments */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
          Comments {decision === 'rejected' && <span style={{ color: 'var(--red-600)' }}>*</span>}
        </label>
        <textarea
          className="textarea"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder={decision === 'rejected' ? 'Required: state your reason for rejection…' : 'Optional: add any notes for the requesting team…'}
          rows={4}
        />
      </div>

      {/* Electronic signature */}
      <div style={{ marginBottom: 24 }}>
        <label htmlFor="sig-name" style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
          Electronic signature <span style={{ color: 'var(--red-600)' }}>*</span>
        </label>
        <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 8 }}>
          Type your full legal name to confirm your decision. This constitutes an electronic signature.
        </p>
        <input
          id="sig-name"
          className="input"
          type="text"
          value={signatureName}
          onChange={(e) => setSignatureName(e.target.value)}
          placeholder="Full legal name"
        />
      </div>

      {submitError && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#B91C1C' }}>
          {submitError}
        </div>
      )}

      <button
        className={`btn ${decision === 'approved' ? 'btn-primary' : decision === 'rejected' ? 'btn-danger' : 'btn-primary'}`}
        style={{ width: '100%' }}
        onClick={() => void handleSubmit()}
        disabled={submitting || !decision || !signatureName.trim() || (decision === 'rejected' && !comments.trim())}
      >
        {submitting ? 'Submitting…' : decision === 'approved' ? 'Confirm approval' : decision === 'rejected' ? 'Confirm rejection' : 'Select a decision'}
      </button>

      <p style={{ fontSize: 11.5, color: 'var(--ink-400)', textAlign: 'center', marginTop: 10 }}>
        Your IP address and timestamp will be logged for audit purposes.
      </p>
    </ExternalLayout>
  )
}

function ExternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-1)', padding: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, paddingTop: 32, paddingBottom: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <Logo size="md" />
        </div>
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '28px 32px' }}>
          {children}
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--ink-400)' }}>
          PDPL Reviewer · Secure External Review Portal · Single-use time-limited access
        </p>
      </div>
    </div>
  )
}
