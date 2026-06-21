import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { AccountInfo } from '@azure/msal-browser'
import Logo from '../components/Logo'
import { isDataverseConfigured } from '../lib/dataverse'
import { msalInstance, checkIsFirstSetup, createAdminProfile } from '../api/auth'
import { authStore } from '../store'
import { setAuthUser } from '../store'
import { useStore } from '../hooks/useStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env as Record<string, string | undefined>
const DV_SCOPES = isDataverseConfigured ? [`${_env.VITE_DATAVERSE_URL}/.default`] : []

type Step = 'landing' | 'checking' | 'already-set-up' | 'profile' | 'creating' | 'done'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--ink-700)', marginBottom: 5, letterSpacing: '0.02em',
}

export default function Setup() {
  useEffect(() => { document.title = 'Admin Setup — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const { isSignedIn } = useStore(authStore)
  const [step, setStep]         = useState<Step>('landing')
  const [account, setAccount]   = useState<AccountInfo | null>(null)
  const [fullName, setFullName] = useState('')
  const [department, setDept]   = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [error, setError]       = useState<string | null>(null)

  // Redirect if already authenticated
  useEffect(() => { if (isSignedIn) navigate('/', { replace: true }) }, [isSignedIn, navigate])

  if (!isDataverseConfigured) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: '40px 36px', textAlign: 'center' }}>
          <Logo size="lg" />
          <p style={{ marginTop: 16, color: 'var(--ink-500)', fontSize: 14 }}>
            Admin setup is not available in demo mode.
          </p>
          <Link to="/sign-in" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-block' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  async function handleMicrosoftSignIn() {
    setError(null)
    setStep('checking')
    try {
      await msalInstance.initialize()
      const result = await msalInstance.loginPopup({ scopes: DV_SCOPES })
      const acc = result.account

      const isFirst = await checkIsFirstSetup()
      if (!isFirst) {
        setStep('already-set-up')
        return
      }

      setAccount(acc)
      setFullName(acc.name ?? '')
      setStep('profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
      setStep('landing')
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!account) return
    setError(null)
    setStep('creating')
    try {
      const user = await createAdminProfile(account, { fullName, department, jobTitle })
      setAuthUser(user)
      setStep('done')
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.')
      setStep('profile')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Logo size="lg" />
        </div>

        {/* ── Landing ── */}
        {(step === 'landing' || step === 'checking') && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 'var(--r-lg)',
                background: 'var(--brand-50)', color: 'var(--brand-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2z" stroke="currentColor" strokeWidth="1.7"/>
                  <path d="M3 21c0-4.4 4-8 9-8s9 3.6 9 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                  <path d="M16 8l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>
                Set up your admin account
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.6 }}>
                This one-time setup creates the first administrator account for PDPL Reviewer.
                Sign in with your Microsoft work account to continue.
              </p>
            </div>

            {error && (
              <div role="alert" style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#B91C1C', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleMicrosoftSignIn}
              disabled={step === 'checking'}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 'var(--r-sm)',
                background: step === 'checking' ? 'var(--brand-300)' : 'var(--brand-700)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: step === 'checking' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              {step === 'checking' ? 'Checking…' : 'Continue with Microsoft'}
            </button>

            <p style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-400)', textAlign: 'center', lineHeight: 1.5 }}>
              Already have an account?{' '}
              <Link to="/sign-in" style={{ color: 'var(--brand-700)', textDecoration: 'none' }}>Sign in</Link>
            </p>
          </>
        )}

        {/* ── Already set up ── */}
        {step === 'already-set-up' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 'var(--r-lg)',
              background: 'var(--amber-50)', color: 'var(--amber-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>
              Setup already complete
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.6, marginBottom: 24 }}>
              An admin account already exists for this organisation.
              Contact your administrator to request access, or sign in if you already have an account.
            </p>
            <Link to="/sign-in" className="btn btn-primary" style={{ display: 'inline-block' }}>
              Go to sign in
            </Link>
          </div>
        )}

        {/* ── Profile form ── */}
        {(step === 'profile' || step === 'creating') && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>
              Complete your profile
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20, lineHeight: 1.5 }}>
              Signed in as <strong style={{ color: 'var(--ink-800)' }}>{account?.username}</strong>
            </p>

            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelSt}>FULL NAME *</label>
                <input
                  required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sara Al-Mutairi" style={inputSt}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                />
              </div>
              <div>
                <label style={labelSt}>DEPARTMENT *</label>
                <input
                  required value={department} onChange={(e) => setDept(e.target.value)}
                  placeholder="e.g. Data Protection Office" style={inputSt}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                />
              </div>
              <div>
                <label style={labelSt}>JOB TITLE *</label>
                <input
                  required value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Data Protection Officer" style={inputSt}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                />
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--brand-50)', border: '1px solid #BFDBFE', fontSize: 12.5, color: 'var(--brand-800)' }}>
                Your account will be created with the <strong>Admin</strong> role. You can invite other users and assign roles from the Admin panel.
              </div>

              {error && (
                <div role="alert" style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#B91C1C' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={step === 'creating'}
                style={{
                  marginTop: 4, padding: '10px 0', borderRadius: 'var(--r-sm)',
                  background: step === 'creating' ? 'var(--brand-300)' : 'var(--brand-700)',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: step === 'creating' ? 'not-allowed' : 'pointer',
                }}
              >
                {step === 'creating' ? 'Creating account…' : 'Create admin account'}
              </button>
            </form>
          </>
        )}

        {/* ── Done ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--emerald-50)', color: 'var(--emerald-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>
              Admin account created
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>
              Redirecting to your dashboard…
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
