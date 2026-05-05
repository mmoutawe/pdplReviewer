import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

export default function NotFound() {
  useEffect(() => { document.title = '404 — PDPL Reviewer' }, [])
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-1)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <Logo size="lg" />
        </div>

        <div style={{
          fontSize: 80, fontWeight: 800, color: 'var(--ink-100)',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 16,
          letterSpacing: '-4px',
        }}>
          404
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 10 }}>
          Page not found
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-500)', lineHeight: 1.7, marginBottom: 32, maxWidth: 340, margin: '0 auto 32px' }}>
          The page you're looking for doesn't exist or you don't have permission to view it.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </button>
          <button className="btn" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>

        <p style={{ marginTop: 40, fontSize: 11.5, color: 'var(--ink-300)' }}>
          PDPL Reviewer · Saudi FinTech Compliance Platform
        </p>
      </div>
    </div>
  )
}
