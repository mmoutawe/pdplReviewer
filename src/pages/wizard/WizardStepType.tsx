import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RequestType } from '../../data/types'
import { REQUEST_TYPE_LABELS } from '../../data/seed'

const TYPE_DESCRIPTIONS: Record<RequestType, string> = {
  vendor_onboarding: 'Assess a new vendor or third-party service provider that will process personal data on your behalf.',
  external_document_sharing: 'Share an internal document with an external party under a time-limited, permissioned link.',
  data_sharing_external: 'Share a dataset or data feed with an external organization on an ongoing or one-time basis.',
  internal_data_access: 'Request read or write access to an internal data system or analytics dataset.',
  cross_border_transfer: 'Transfer personal data to a recipient or system outside the Kingdom of Saudi Arabia.',
}

const TYPE_ICONS: Record<RequestType, string> = {
  vendor_onboarding: '🏢',
  external_document_sharing: '📤',
  data_sharing_external: '🔗',
  internal_data_access: '🔑',
  cross_border_transfer: '🌐',
}

const TYPES: RequestType[] = [
  'vendor_onboarding',
  'external_document_sharing',
  'data_sharing_external',
  'internal_data_access',
  'cross_border_transfer',
]

export default function WizardStepType() {
  useEffect(() => { document.title = 'New Request — PDPL Reviewer' }, [])
  const navigate = useNavigate()

  function handleSelectType(type: RequestType) {
    navigate(`/requests/new/${type}/method`)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: 24, fontSize: 12.5, color: 'var(--ink-400)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')} style={{ padding: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>Requests</button>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: 'var(--ink-800)' }}>New request</span>
      </nav>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>New privacy request</h1>
      <p style={{ color: 'var(--ink-500)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
        Select the type of request you want to submit. Each type follows a tailored assessment process aligned with PDPL obligations.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TYPES.map((type) => (
          <button key={type}
            onClick={() => handleSelectType(type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 20px',
              background: 'var(--surface-0)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-lg)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'all var(--t-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-700)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-50)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-0)'
            }}>
            <span style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">{TYPE_ICONS[type]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
                {REQUEST_TYPE_LABELS[type]}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.55 }}>
                {TYPE_DESCRIPTIONS[type]}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)', flexShrink: 0 }}>
              <path d="M4.5 2.5l5 4.5-5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
