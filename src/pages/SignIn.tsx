import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authStore, signIn } from '../store'
import { useStore } from '../hooks/useStore'
import Logo from '../components/Logo'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { apiSignIn } from '../api/auth'

// ── Demo credentials (used in both Supabase and demo mode) ───────────────────
const DEMO_CREDENTIALS = [
  { email: 'admin@pdpl.demo',      password: 'Admin#2026!',       label: 'Admin',           role: 'admin',           userId: 'u-sara' },
  { email: 'requester@pdpl.demo',  password: 'Requester#2026!',   label: 'Requester',       role: 'requester',       userId: 'u-rana' },
  { email: 'datamgmt@pdpl.demo',   password: 'DataMgmt#2026!',    label: 'Data Management', role: 'data_management', userId: 'u-mohammed' },
  { email: 'legal@pdpl.demo',      password: 'Legal#2026!',       label: 'Legal',           role: 'legal',           userId: 'u-tariq' },
  { email: 'security@pdpl.demo',   password: 'Security#2026!',    label: 'Security',        role: 'security',        userId: 'u-yousef' },
]

const ROLE_PILL_COLOR: Record<string, string> = {
  admin: '#7C3AED', requester: '#1D4ED8', data_management: '#0369A1', legal: '#6D28D9', security: '#B45309',
}

// ── Shared input style helper ─────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}

// ── Real auth form (Supabase mode) ────────────────────────

function SupabaseSignIn() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [credsOpen, setCredsOpen] = useState(false)
  const navigate = useNavigate()
  const { isSignedIn } = useStore(authStore)

  useEffect(() => {
    if (isSignedIn) navigate('/dashboard')
  }, [isSignedIn, navigate])

  async function handleSignIn(e: React.FormEvent) {
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

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    // User accounts are managed in Microsoft Entra ID.
    // Self-registration is not supported — contact your administrator.
    setError('Account creation is managed through Microsoft Entra ID. Please contact your administrator.')
  }

  const tabBtn = (tab: 'signin' | 'signup', label: string) => (
    <button type="button" onClick={() => { setActiveTab(tab); setError(null); setSuccess(null) }}
      style={{
        flex: 1, padding: '8px 0', fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400,
        color: activeTab === tab ? 'var(--brand-700)' : 'var(--ink-500)',
        background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? 'var(--brand-700)' : 'transparent'}`,
        cursor: 'pointer', transition: 'all var(--t-fast)',
      }}>{label}</button>
  )

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Logo size="lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-500)', fontSize: 14, lineHeight: 1.6 }}>
            AI-powered PDPL compliance platform.
          </p>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', marginBottom: 24 }}>
          {tabBtn('signin', 'Sign In')}
          {tabBtn('signup', 'Sign Up')}
        </div>

        {activeTab === 'signin' ? (
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>WORK EMAIL</label>
              <input id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <label htmlFor="password" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', letterSpacing: '0.02em' }}>PASSWORD</label>
                <Link to="/forgot-password" style={{ fontSize: 11.5, color: 'var(--brand-700)', textDecoration: 'none' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            {error && <div role="alert" style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#B91C1C' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ marginTop: 4, padding: '10px 0', borderRadius: 'var(--r-sm)', background: loading ? 'var(--brand-300)' : 'var(--brand-700)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background var(--t-fast)' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="su-name" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>FULL NAME</label>
              <input id="su-name" type="text" autoComplete="name" required value={fullName}
                onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label htmlFor="su-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>WORK EMAIL</label>
              <input id="su-email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label htmlFor="su-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>PASSWORD</label>
              <input id="su-password" type="password" autoComplete="new-password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            {error && <div role="alert" style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#B91C1C' }}>{error}</div>}
            {success && <div role="status" style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 13, color: '#15803D' }}>{success}</div>}
            <button type="submit" disabled={loading}
              style={{ marginTop: 4, padding: '10px 0', borderRadius: 'var(--r-sm)', background: loading ? 'var(--brand-300)' : 'var(--brand-700)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background var(--t-fast)' }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Demo credentials accordion — only on sign-in tab */}
        {activeTab === 'signin' && (
          <div style={{ marginTop: 20, borderRadius: 'var(--r-md)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <button type="button" onClick={() => setCredsOpen((o) => !o)}
              style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-600)' }}>
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
                    style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background var(--t-fast)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#fff', background: ROLE_PILL_COLOR[c.role] ?? '#6B7280' }}>
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
        )}

        <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--ink-400)', textAlign: 'center', lineHeight: 1.5 }}>
          PDPL Reviewer — Saudi FinTech privacy compliance under Royal Decree M/19, 2021.
        </p>
      </div>
    </div>
  )
}

// ── Demo mode: email/password form ────────────────────────

function DemoSignIn() {
  useEffect(() => { document.title = 'Sign In — PDPL Reviewer' }, [])
  const { isSignedIn } = useStore(authStore)
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [credsOpen, setCredsOpen] = useState(false)

  useEffect(() => {
    if (isSignedIn) navigate('/dashboard')
  }, [isSignedIn, navigate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const match = DEMO_CREDENTIALS.find(
      (c) => c.email.toLowerCase() === email.trim().toLowerCase() && c.password === password
    )
    if (!match) {
      setError('Invalid email or password. Use the demo credentials below.')
      return
    }
    signIn(match.userId)
    navigate('/dashboard')
  }

  const tabBtn = (tab: 'signin' | 'signup', label: string) => (
    <button type="button" onClick={() => { setActiveTab(tab); setError(null) }}
      style={{
        flex: 1, padding: '8px 0', fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400,
        color: activeTab === tab ? 'var(--brand-700)' : 'var(--ink-500)',
        background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? 'var(--brand-700)' : 'transparent'}`,
        cursor: 'pointer', transition: 'all var(--t-fast)',
      }}>{label}</button>
  )

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo size="lg" />
          <p style={{ marginTop: 14, color: 'var(--ink-500)', fontSize: 14, lineHeight: 1.6 }}>
            AI-powered PDPL compliance platform.
          </p>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
          {tabBtn('signin', 'Sign In')}
          {tabBtn('signup', 'Sign Up')}
        </div>

        {/* Demo mode banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--brand-50)', border: '1px solid #BFDBFE',
          borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 20,
          fontSize: 12, color: 'var(--brand-800)',
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4.5 6.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Demo mode — all data is synthetic.
        </div>

        {activeTab === 'signin' ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="demo-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>EMAIL</label>
              <input id="demo-email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="e.g. admin@pdpl.demo" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label htmlFor="demo-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em' }}>PASSWORD</label>
              <input id="demo-password" type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            {error && <div role="alert" style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#B91C1C' }}>{error}</div>}
            <button type="submit" style={{ marginTop: 4, padding: '10px 0', borderRadius: 'var(--r-sm)', background: 'var(--brand-700)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background var(--t-fast)' }}>
              Sign In
            </button>
          </form>
        ) : (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 8 }}>Sign-up requires Supabase</p>
            <p style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6 }}>
              Self-registration is not available in demo mode. Use one of the demo accounts below to sign in.
            </p>
          </div>
        )}

        {/* Demo credentials accordion — only on sign-in tab */}
        {activeTab === 'signin' && (
          <div style={{ marginTop: 20, borderRadius: 'var(--r-md)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <button type="button" onClick={() => setCredsOpen((o) => !o)}
              style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-600)' }}>
              <span>Demo credentials</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                style={{ transform: credsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            {credsOpen && (
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {DEMO_CREDENTIALS.map((c) => (
                  <button key={c.email} type="button"
                    onClick={() => { setEmail(c.email); setPassword(c.password); setCredsOpen(false); setError(null) }}
                    style={{ width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer', textAlign: 'left', transition: 'background var(--t-fast)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#fff', background: ROLE_PILL_COLOR[c.role] ?? '#6B7280' }}>
                      {c.label.slice(0, 2).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-800)' }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{c.email}</div>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{c.password}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--ink-400)', textAlign: 'center', lineHeight: 1.5 }}>
          PDPL Reviewer — Saudi FinTech privacy compliance under Royal Decree M/19, 2021.
        </p>
      </div>
    </div>
  )
}

export default function SignIn() {
  useEffect(() => { document.title = 'Sign In — PDPL Reviewer' }, [])
  return isSupabaseConfigured ? <SupabaseSignIn /> : <DemoSignIn />
}
