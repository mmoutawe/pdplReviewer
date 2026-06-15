import { useEffect, useState, type ReactNode } from 'react'
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

const TYPE_ICONS: Record<RequestType, ReactNode> = {
  vendor_onboarding: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="7" width="16" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 7V5a6 6 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 13h4M10 11v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  external_document_sharing: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2v10M7 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 13v3a1 1 0 001 1h10a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  data_sharing_external: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8 12a4 4 0 005.66 0l2-2a4 4 0 00-5.66-5.66l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 8a4 4 0 00-5.66 0l-2 2a4 4 0 005.66 5.66l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  internal_data_access: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M11.5 11.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  cross_border_transfer: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2.5c0 0-4 3-4 7.5s4 7.5 4 7.5M10 2.5c0 0 4 3 4 7.5s-4 7.5-4 7.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2.5 10h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
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
  const [selected, setSelected] = useState<RequestType | null>(null)

  function handleSelectType(type: RequestType) {
    setSelected(type)
    navigate(`/requests/new/${type}/method`)
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 24, fontSize: 12.5, color: 'var(--ink-400)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')} style={{ padding: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>Requests</button>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: 'var(--ink-800)' }}>New request</span>
      </nav>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>What kind of request is this?</h1>
      <p style={{ color: 'var(--ink-500)', marginBottom: 28, fontSize: 13.5, lineHeight: 1.6 }}>
        Choose the type that best matches your situation. The questionnaire and AI assessment will adapt accordingly.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {TYPES.map((type) => {
          const isSelected = selected === type
          return (
            <button
              key={type}
              onClick={() => handleSelectType(type)}
              style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                padding: '18px 20px',
                background: 'var(--surface-0)',
                border: `2px solid ${isSelected ? 'var(--teal-600)' : 'var(--line)'}`,
                borderRadius: 'var(--r-lg)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'all var(--t-fast)',
                boxShadow: isSelected ? `0 0 0 3px var(--teal-100)` : 'none',
              }}
              onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--teal-600)' }}
              onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--r-lg)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? 'var(--teal-600)' : 'var(--teal-50)',
                color: isSelected ? 'white' : 'var(--teal-600)',
                transition: 'all var(--t-fast)',
              }}>
                {TYPE_ICONS[type]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
                  {REQUEST_TYPE_LABELS[type]}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-500)', lineHeight: 1.55 }}>
                  {TYPE_DESCRIPTIONS[type]}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
