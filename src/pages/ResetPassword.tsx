import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { apiUpdatePassword } from '../api/auth'

type Phase = 'waiting' | 'ready' | 'success' | 'error'

export default function ResetPassword() {
  const [phase, setPhase] = useState<Phase>('waiting')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Set new password — PDPL Reviewer' }, [])

  // Listen for Supabase's PASSWORD_RECOVERY auth event.
  // When the user follows the reset link, Supabase parses the
  // URL fragment and fires this event automatically.
  useEffect(() => {
    if (!supabase) { setPhase('error'); return }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPhase('ready')
    })

    // If the page loaded with an existing recovery session already active
    // (e.g. page reload), check for it immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && phase === 'waiting') setPhase('ready')
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError(null)
    setLoading(true)
    try {
      await apiUpdatePassword(password)
      setPhase('success')
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed.')
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

  if (!isSupabaseConfigured) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: '40px 36px', textAlign: 'center' }}>
          <Logo size="lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-500)', fontSize: 14 }}>Password reset is not available in demo mode.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/sign-in')}>Back to sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Logo size="lg" />
        </div>

        {phase === 'waiting' && (
          <div style={{ textAlign: 'center', color: 'var(--ink-500)', fontSize: 14, padding: '20px 0' }}>
            <span style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite', fontSize: 24, marginBottom: 12 }} aria-hidden="true">⏳</span>
            <p>Verifying reset link…</p>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Set new password</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 24, lineHeight: 1.6 }}>
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="rp-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>
                  NEW PASSWORD
                </label>
                <input
                  id="rp-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                />
              </div>

              <div>
                <label htmlFor="rp-confirm" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>
                  CONFIRM PASSWORD
                </label>
                <input
                  id="rp-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
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
                {loading ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          </>
        )}

        {phase === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">✅</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Password updated</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.6 }}>
              Your password has been changed. Redirecting to your dashboard…
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">⚠️</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Invalid reset link</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.6, marginBottom: 20 }}>
              This link has expired or already been used. Request a new one.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/forgot-password')}>
              Request new link
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
