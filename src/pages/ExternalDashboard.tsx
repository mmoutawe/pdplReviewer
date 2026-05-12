import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authStore, signOut } from '../store'
import { useStore } from '../hooks/useStore'
import { EXTERNAL_LINKS, ticketById } from '../data/seed'
import Logo from '../components/Logo'
import { StatusPill } from '../components/primitives'
import { REQUEST_TYPE_LABELS } from '../data/seed'
import { formatDate } from '../lib/utils'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'

export default function ExternalDashboard() {
  useEffect(() => { document.title = 'External Portal — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const { user } = useStore(authStore)

  // In demo mode, show the seed external links for demonstration
  const demoLinks = EXTERNAL_LINKS
  const demoTickets = demoLinks.map((l) => ({ link: l, ticket: ticketById(l.ticketId) })).filter((x) => x.ticket)

  function handleSignOut() {
    signOut()
    navigate('/sign-in', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-1)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <header style={{
        height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
        borderBottom: '1px solid var(--line)', background: 'var(--surface-0)',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <Logo size="md" />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{user.email ?? user.fullName}</span>
        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red-700)' }} onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '32px 24px', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>
              External Review Portal
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ink-500)' }}>
              Review and respond to data privacy requests shared with you, or submit a new request.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/requests/new')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Submit new request
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--radius)', fontSize: 12.5, color: 'var(--amber-700)' }}>
            Demo mode — showing sample external link invitations.
          </div>
        )}

        {demoTickets.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-400)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>No pending reviews</div>
            <p style={{ fontSize: 13 }}>You have no open requests to review at this time.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {demoTickets.map(({ link, ticket }) => ticket && (
              <div key={link.token} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>{ticket.id}</span>
                      <StatusPill state={ticket.state} size="sm" />
                      <span className={`pill pill-no-dot ${link.status === 'redeemed' ? 'pill-emerald' : link.status === 'expired' || link.status === 'revoked' ? 'pill-slate' : 'pill-amber'}`}
                        style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>
                        {link.status}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>{ticket.title}</h2>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-500)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{REQUEST_TYPE_LABELS[ticket.type]}</span>
                      <span>Issued {formatDate(link.issuedAt)}</span>
                      <span>Expires {formatDate(link.expiresAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => navigate(`/requests/${ticket.id}`)}>
                      View details
                    </button>
                    {link.status === 'pending' && (
                      <button className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/external/approval/${link.token}`)}>
                        Review &amp; respond
                      </button>
                    )}
                  </div>
                </div>
                {link.permissions.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>Permissions:</span>
                    {link.permissions.map((p) => (
                      <span key={p} className="tag" style={{ fontSize: 10.5 }}>{p.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: 24, padding: '16px 20px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-800)', marginBottom: 4 }}>Need help?</div>
          <p style={{ fontSize: 12.5, color: 'var(--brand-700)', lineHeight: 1.6 }}>
            If you have questions about a specific request or need to report a concern, contact the data management team at the organization that shared the request with you.
          </p>
        </div>
      </main>
    </div>
  )
}
