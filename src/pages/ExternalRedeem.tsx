import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { externalLinkByToken, ticketById } from '../data/seed'
import Logo from '../components/Logo'
import { formatDateTime } from '../lib/utils'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { redeemExternalLink } from '../api/ai'

interface LiveLinkData {
  ticket: { id: string; title: string }
  expiresAt: string
  recipientEmail: string
  alreadyDecided: boolean
  decision: string | null
}

export default function ExternalRedeem() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [redeemed, setRedeemed] = useState(false)
  const [liveData, setLiveData] = useState<LiveLinkData | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => { document.title = 'Secure Approval Request — PDPL Reviewer' }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !token) { setLoading(false); return }
    redeemExternalLink(token)
      .then((data) => setLiveData(data as LiveLinkData))
      .catch((err: unknown) => setLiveError(err instanceof Error ? err.message : 'Invalid or expired link'))
      .finally(() => setLoading(false))
  }, [token])

  // Demo mode fallback
  const demoLink = !isSupabaseConfigured ? externalLinkByToken(token ?? '') : null
  const demoTicket = demoLink ? ticketById(demoLink.ticketId) : null

  const isExpired = demoLink ? new Date(demoLink.expiresAt) < new Date() : false
  const isUsed = demoLink?.status === 'redeemed'

  const handleProceed = () => {
    if (isSupabaseConfigured) {
      if (liveData?.alreadyDecided) return
      setRedeemed(true)
      setTimeout(() => navigate(`/external/approval/${token}`), 800)
      return
    }
    if (!demoLink || isExpired || isUsed) return
    setRedeemed(true)
    setTimeout(() => navigate(`/external/approval/${token}`), 800)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-1)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
        </div>

        <div className="card" style={{ padding: '32px 36px' }}>
          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>⋯</div>
              <p style={{ fontSize: 14, color: 'var(--ink-500)' }}>Validating secure link…</p>
            </div>
          )}

          {/* Live error */}
          {!loading && liveError && (
            <InvalidLink title="Link unavailable" message={liveError} />
          )}

          {/* Already decided */}
          {!loading && liveData?.alreadyDecided && (
            <InvalidLink title="Decision already recorded" message={`A decision (${liveData.decision}) has already been recorded for this link. Each link may only be used once.`} />
          )}

          {/* Demo: invalid */}
          {!isSupabaseConfigured && !demoLink && (
            <InvalidLink title="Invalid link" message="This approval link is not recognized. It may have been revoked or never existed." />
          )}

          {/* Demo: expired */}
          {!isSupabaseConfigured && demoLink && isExpired && (
            <InvalidLink title="Link expired" message={`This approval link expired on ${formatDateTime(demoLink.expiresAt)}. Please contact the originating organization to request a new link.`} />
          )}

          {/* Demo: already used */}
          {!isSupabaseConfigured && demoLink && isUsed && (
            <InvalidLink title="Already redeemed" message="This approval link has already been used. Each link may only be accessed once for security purposes." />
          )}

          {/* Valid link — demo */}
          {!loading && !isSupabaseConfigured && demoLink && !isExpired && !isUsed && !redeemed && demoTicket && (
            <ValidLinkView
              ticketId={demoTicket.id}
              title={demoTicket.title}
              expiresAt={demoLink.expiresAt}
              permissions={demoLink.permissions}
              onProceed={handleProceed}
            />
          )}

          {/* Valid link — live */}
          {!loading && isSupabaseConfigured && liveData && !liveData.alreadyDecided && !redeemed && (
            <ValidLinkView
              ticketId={liveData.ticket.id}
              title={liveData.ticket.title}
              expiresAt={liveData.expiresAt}
              permissions={['view', 'decide']}
              onProceed={handleProceed}
            />
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

function ValidLinkView({ ticketId, title, expiresAt, permissions, onProceed }: {
  ticketId: string; title: string; expiresAt: string; permissions: string[]; onProceed: () => void
}) {
  return (
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
            <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-800)' }}>{ticketId}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <dt style={{ color: 'var(--ink-500)', flexShrink: 0 }}>Subject</dt>
            <dd style={{ color: 'var(--ink-900)', fontWeight: 500, textAlign: 'right' }}>{title}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <dt style={{ color: 'var(--ink-500)', flexShrink: 0 }}>Link expires</dt>
            <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber-700)' }}>{formatDateTime(expiresAt)}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <dt style={{ color: 'var(--ink-500)', flexShrink: 0 }}>Permissions</dt>
            <dd style={{ color: 'var(--ink-600)', fontSize: 12 }}>{permissions.join(', ')}</dd>
          </div>
        </dl>
      </div>

      <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: 'var(--amber-700)', lineHeight: 1.5 }}>
        ⚠ This is a time-limited, single-use secure link. Your access is restricted to review and approval only. Do not share this link.
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={onProceed}>
        Proceed to review
      </button>
    </>
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
