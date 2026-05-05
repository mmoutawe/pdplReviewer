import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authStore, signIn } from '../store'
import { useStore } from '../hooks/useStore'
import { USERS, ROLE_LABELS } from '../data/seed'
import { Avatar } from '../components/primitives'
import Logo from '../components/Logo'
import { isSupabaseConfigured } from '../lib/supabase'
import { apiSignIn } from '../api/auth'

const PERSONAS = USERS.filter((u) => u.role !== 'external_recipient')

// ── Demo credentials for Supabase mode ───────────────────
const DEMO_CREDENTIALS = [
  { email: 'admin@pdpl.demo',      password: 'Admin#2026!',       label: 'Admin',           role: 'admin' },
  { email: 'requester@pdpl.demo',  password: 'Requester#2026!',   label: 'Requester',       role: 'requester' },
  { email: 'datamgmt@pdpl.demo',   password: 'DataMgmt#2026!',    label: 'Data Management', role: 'data_management' },
  { email: 'legal@pdpl.demo',      password: 'Legal#2026!',       label: 'Legal',           role: 'legal' },
  { email: 'security@pdpl.demo',   password: 'Security#2026!',    label: 'Security',        role: 'security' },
]

const ROLE_PILL_COLOR: Record<string, string> = {
  admin: '#7C3AED', requester: '#1D4ED8', data_management: '#0369A1', legal: '#6D28D9', security: '#B45309',
}

// ── Real auth form (Supabase mode) ────────────────────────

function SupabaseSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credsOpen, setCredsOpen] = useState(false)
  const navigate = useNavigate()
  const { isSignedIn } = useStore(authStore)

  useEffect(() => {
    if (isSignedIn) navigate('/dashboard')
  }, [isSignedIn, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiSignIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-500)', fontSize: 14, lineHeight: 1.6 }}>
            AI-powered PDPL compliance platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>
              WORK EMAIL
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                width: '100%', padding: '9px 12px', fontSize: 14,
                border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                background: 'var(--surface-0)', color: 'var(--ink-900)',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <label htmlFor="password" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', letterSpacing: '0.02em' }}>
                PASSWORD
              </label>
              <Link to="/forgot-password" style={{ fontSize: 11.5, color: 'var(--brand-700)', textDecoration: 'none' }}
                onMouseOver={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                onMouseOut={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '9px 12px', fontSize: 14,
                border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                background: 'var(--surface-0)', color: 'var(--ink-900)',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
            />
          </div>

          {error && (
            <div role="alert" style={{
              padding: '8px 12px', borderRadius: 'var(--r-sm)',
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontSize: 13, color: '#B91C1C',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '10px 0', borderRadius: 'var(--r-sm)',
              background: loading ? 'var(--brand-300)' : 'var(--brand-700)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background var(--t-fast)',
            }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Demo credentials accordion */}
        <div style={{ marginTop: 20, borderRadius: 'var(--r-md)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setCredsOpen((o) => !o)}
            style={{
              width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface-1)', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
              color: 'var(--ink-600)',
            }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M6.5 4v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Demo credentials
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
              style={{ transform: credsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          {credsOpen && (
            <div style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              {DEMO_CREDENTIALS.map((c) => (
                <button key={c.email} type="button"
                  onClick={() => { setEmail(c.email); setPassword(c.password); setCredsOpen(false) }}
                  style={{
                    width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    transition: 'background var(--t-fast)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#fff',
                    background: ROLE_PILL_COLOR[c.role] ?? '#6B7280',
                  }}>
                    {c.label.slice(0, 2).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-800)' }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{c.email}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{c.password}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--ink-400)', textAlign: 'center', lineHeight: 1.5 }}>
          PDPL Reviewer — Saudi FinTech privacy compliance under Royal Decree M/19, 2021.
        </p>
      </div>
    </div>
  )
}

// ── Demo persona switcher (no-backend mode) ───────────────

function DemoSignIn() {
  useEffect(() => { document.title = 'Sign In — PDPL Reviewer' }, [])
  const { isSignedIn, user } = useStore(authStore)
  const navigate = useNavigate()

  useEffect(() => {
    if (isSignedIn) navigate('/dashboard')
  }, [isSignedIn, navigate])

  function choose(userId: string) {
    signIn(userId)
    navigate('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-500)', fontSize: 14, lineHeight: 1.6 }}>
            AI-powered PDPL compliance platform.<br />
            Select a demo persona to explore the platform.
          </p>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--brand-50)', border: '1px solid #BFDBFE',
          borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 24,
          fontSize: 12, color: 'var(--brand-800)',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M4.5 7l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Demo mode — all data is synthetic and does not contain real personal information.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PERSONAS.map((u) => (
            <button key={u.id} onClick={() => choose(u.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 'var(--r-md)',
                border: `1px solid ${user?.id === u.id ? '#BFDBFE' : 'var(--line)'}`,
                background: user?.id === u.id ? 'var(--brand-50)' : 'var(--surface-0)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'all var(--t-fast) var(--ease-out)',
              }}
              onMouseEnter={(e) => {
                if (user?.id !== u.id) {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-700)'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-50)'
                }
              }}
              onMouseLeave={(e) => {
                if (user?.id !== u.id) {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-0)'
                }
              }}>
              <Avatar initials={u.initials} color={u.avatarColor} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{u.fullName}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 1 }}>
                  {ROLE_LABELS[u.role]} · {u.department}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)', flexShrink: 0 }}>
                <path d="M4.5 2.5l5 4.5-5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>

        <p style={{ marginTop: 20, fontSize: 11.5, color: 'var(--ink-400)', textAlign: 'center', lineHeight: 1.5 }}>
          PDPL Reviewer is designed for Saudi FinTech organizations operating under the Personal Data Protection Law (Royal Decree M/19, 2021).
        </p>
      </div>
    </div>
  )
}

export default function SignIn() {
  useEffect(() => { document.title = 'Sign In — PDPL Reviewer' }, [])
  return isSupabaseConfigured ? <SupabaseSignIn /> : <DemoSignIn />
}
