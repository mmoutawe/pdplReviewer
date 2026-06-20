import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { apiResetPassword } from '../api/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Reset password — PDPL Reviewer' }, [])

  // Demo mode — no Supabase, just redirect back
  if (!isSupabaseConfigured) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: '40px 36px', textAlign: 'center' }}>
          <Logo size="lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-500)', fontSize: 14 }}>
            Password reset is not available in demo mode.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/sign-in')}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiResetPassword(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
    background: 'var(--surface-0)', color: 'var(--ink-900)',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Logo size="lg" />
        </div>

          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Reset your password</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 24, lineHeight: 1.6 }}>
              Passwords are managed through Microsoft Entra ID. Enter your work email and you'll be redirected to Microsoft to complete the reset.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="fp-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>
                  WORK EMAIL
                </label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                />
              </div>

              {error && (
                <div role="alert" style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#B91C1C' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                marginTop: 4, padding: '10px 0', borderRadius: 'var(--r-sm)',
                background: loading ? 'var(--brand-300)' : 'var(--brand-700)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Redirecting…' : 'Reset via Microsoft'}
              </button>
            </form>
          </>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>
          <Link to="/sign-in" style={{ color: 'var(--brand-700)', textDecoration: 'none' }}>← Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
