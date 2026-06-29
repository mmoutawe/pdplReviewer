import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { externalInviteByToken } from '../data/seed'
import { registerExternalUser } from '../store'
import { formatDateTime } from '../lib/utils'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13.5,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}

export default function ExternalRegister() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const invite = !isSupabaseConfigured ? externalInviteByToken(token ?? '') : null
  const isExpired = invite ? new Date(invite.expiresAt) < new Date() : false
  const isUsed = invite?.status === 'registered' || invite?.status === 'revoked'

  const [fullName, setFullName] = useState(invite?.recipientName ?? '')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { document.title = 'Create Account — PDPL Reviewer' }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!fullName.trim())   { setError('Full name is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    if (isSupabaseConfigured) {
      // TODO: call Azure Function to create Entra B2B user
      setError('Live registration not yet configured. Contact your data management team.')
      return
    }

    if (!invite) { setError('Invalid invite token.'); return }
    setSaving(true)
    setTimeout(() => {
      registerExternalUser(invite, fullName)
      navigate('/requests', { replace: true })
    }, 600)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-1)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
        </div>

        <div className="card" style={{ padding: '32px 36px' }}>
          {/* No invite found */}
          {!isSupabaseConfigured && !invite && (
            <StatusBlock
              icon="✕"
              title="Invalid invitation"
              message="This registration link is not recognized. It may have been revoked or never existed. Please contact the team that invited you."
              danger
            />
          )}

          {/* Expired */}
          {invite && isExpired && (
            <StatusBlock
              icon="⏱"
              title="Invitation expired"
              message={`This invitation expired on ${formatDateTime(invite.expiresAt)}. Please ask your contact to send a new invite link.`}
              danger
            />
          )}

          {/* Already registered */}
          {invite && !isExpired && isUsed && (
            <StatusBlock
              icon="✓"
              title="Already registered"
              message="This invitation has already been used. If you need to sign in, use the sign-in page."
            />
          )}

          {/* Valid — show registration form */}
          {((invite && !isExpired && !isUsed) || isSupabaseConfigured) && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔓</div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>Create your account</h1>
                <p style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6 }}>
                  You've been invited to submit compliance requests on the PDPL Reviewer platform.
                </p>
              </div>

              {invite && (
                <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--r-sm)', padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-500)' }}>Email</span>
                    <span style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{invite.recipientEmail}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink-500)' }}>Invite expires</span>
                    <span style={{ color: 'var(--amber-700)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDateTime(invite.expiresAt)}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>FULL NAME *</label>
                  <input
                    value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ahmad Al-Rashid"
                    style={inputSt}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>PASSWORD *</label>
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    style={inputSt}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>CONFIRM PASSWORD *</label>
                  <input
                    type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    style={inputSt}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                  />
                </div>

                {error && (
                  <div style={{ fontSize: 12.5, color: '#B91C1C', background: 'var(--red-50)', border: '1px solid #FECACA', borderRadius: 'var(--r-sm)', padding: '8px 12px' }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }} disabled={saving}>
                  {saving ? 'Creating account…' : 'Create account & sign in'}
                </button>
              </form>

              <p style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 16, textAlign: 'center', lineHeight: 1.6 }}>
                Your account has restricted access. You can submit vendor onboarding requests
                and manage your own vendors and projects. Access is temporary and will expire
                after your request reaches a final decision.
              </p>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--ink-400)' }}>
          PDPL Reviewer · Secure External Registration · Invitation-only access
        </p>
      </div>
    </div>
  )
}

function StatusBlock({ icon, title, message, danger }: { icon: string; title: string; message: string; danger?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: danger ? '#B91C1C' : 'var(--ink-800)', marginBottom: 8 }}>{title}</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.65 }}>{message}</p>
      <a href="/sign-in" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: 'var(--brand-700)', textDecoration: 'underline' }}>Go to sign-in</a>
    </div>
  )
}
