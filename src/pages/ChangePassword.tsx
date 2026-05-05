import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { showToast, authStore } from '../store'
import { useStore } from '../hooks/useStore'
import Logo from '../components/Logo'

export default function ChangePassword() {
  useEffect(() => { document.title = 'Change Password — PDPL Reviewer' }, [])

  const navigate   = useNavigate()
  const { user }   = useStore(authStore)
  const [pw, setPw]   = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 10) { showToast('Use at least 10 characters.', 'error'); return }
    if (pw !== pw2)     { showToast('Passwords do not match.', 'error'); return }
    if (!isSupabaseConfigured || !supabase) { showToast('Password change requires Supabase.', 'error'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) { showToast(error.message, 'error'); setBusy(false); return }
    await (supabase as any).from('profiles').update({ must_change_password: false }).eq('id', user.id)
    showToast('Password updated successfully.', 'success')
    setBusy(false)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-1)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <Logo size="lg" />
        </div>

        <div className="card" style={{ padding: '32px 36px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>Set a new password</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6 }}>
              {isSupabaseConfigured
                ? "You're using a temporary password. Please choose a new one to continue."
                : 'Password change requires a Supabase backend. This feature is not available in demo mode.'}
            </p>
          </div>

          {isSupabaseConfigured ? (
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle} htmlFor="pw">New password</label>
                <input id="pw" className="input" type="password" autoComplete="new-password" required
                  minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min. 10 characters" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="pw2">Confirm new password</label>
                <input id="pw2" className="input" type="password" autoComplete="new-password" required
                  value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat password" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </form>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--ink-400)' }}>
          PDPL Reviewer · Secure password management
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: 'var(--ink-800)', marginBottom: 5,
}
