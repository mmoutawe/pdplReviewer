import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { externalLinkByToken, ticketById } from '../data/seed'
import Logo from '../components/Logo'
import { formatDateTime } from '../lib/utils'

export default function ExternalRedeem() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const link = externalLinkByToken(token ?? '')
  const ticket = link ? ticketById(link.ticketId) : null
  const [redeemed, setRedeemed] = useState(false)

  useEffect(() => { document.title = 'Secure Approval Request — PDPL Reviewer' }, [])

  const isExpired = link ? new Date(link.expiresAt) < new Date() : false
  const isUsed = link?.status === 'redeemed'

  const handleProceed = () => {
    if (!link || isExpired || isUsed) return
    setRedeemed(true)
    setTimeout(() => navigate(`/external/approval/${token}`), 800)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-1)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
        </div>

        <div className="card" style={{ padding: '32px 36px' }}>
          {!link && (
            <InvalidLink title="Invalid link" message="This approval link is not recognized. It may have been revoked or never existed." />
          )}

          {link && isExpired && (
            <InvalidLink title="Link expired" message={`This approval link expired on ${formatDateTime(link.expiresAt)}. Please contact the originating organization to request a new link.`} />
          )}

          {link && isUsed && (
            <InvalidLink title="Already redeemed" message="This approval link has already been used. Each link may only be accessed once for security purposes." />
          )}

          {link && !isExpired && !isUsed && !redeemed && ticket && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔐</div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>Secure Approval Request</h1>
                <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.6 }}>
                  You have been invited to review and approve a privacy compliance request.
                </p>
              </div>

              <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 20 }}>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <dt style={{ color: 'var(--ink-500)', flexShrink: 0 }}>Request ID</dt>
                    <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-800)' }}>{ticket.id}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <dt style={{ color: 'var(--ink-500)', flexShrink: 0 }}>Subject</dt>
                    <dd style={{ color: 'var(--ink-900)', fontWeight: 500, textAlign: 'right' }}>{ticket.title}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <dt style={{ color: 'var(--ink-500)', flexShrink: 0 }}>Link expires</dt>
                    <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber-700)' }}>{formatDateTime(link.expiresAt)}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <dt style={{ color: 'var(--ink-500)', flexShrink: 0 }}>Permissions</dt>
                    <dd style={{ color: 'var(--ink-600)', fontSize: 12 }}>{link.permissions.join(', ')}</dd>
                  </div>
                </dl>
              </div>

              <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: 'var(--amber-700)', lineHeight: 1.5 }}>
                ⚠ This is a time-limited, single-use secure link. Your access is restricted to review and approval only. Do not share this link.
              </div>

              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleProceed}>
                Proceed to review
              </button>
            </>
          )}

          {redeemed && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>↗</div>
              <p style={{ fontSize: 14, color: 'var(--ink-600)' }}>Loading secure review…</p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--ink-400)' }}>
          PDPL Reviewer · Secure External Review Portal · Links are single-use and time-limited
        </p>
      </div>
    </div>
  )
}

function InvalidLink({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✕</div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--red-700)', marginBottom: 8 }}>{title}</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.65 }}>{message}</p>
    </div>
  )
}
