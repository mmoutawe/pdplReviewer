import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { POLICIES } from '../data/seed'
import { FilterBar } from '../components/table'
import { formatDate } from '../lib/utils'
import { PolicyChatPanel } from '../components/PolicyChatPanel'
import { authStore } from '../store'
import { useStore } from '../hooks/useStore'
import { useMobile } from '../hooks/useMobile'

export default function PolicyLibrary() {
  useEffect(() => { document.title = 'Policies — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const { user } = useStore(authStore)
  const isMobile = useMobile()
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [chatOpen, setChatOpen] = useState(false)

  const visible = POLICIES.filter((p) => {
    if (filterCat && p.category !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      return p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q)
    }
    return true
  })

  const cats = [...new Set(POLICIES.map((p) => p.category))]

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Main list */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Policy Library</h1>
            <p className="page-subtitle">{visible.length} polic{visible.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          {isMobile && (
            <button
              className="btn btn-ai btn-sm"
              onClick={() => setChatOpen((o) => !o)}
              style={{ marginLeft: 'auto' }}
            >
              {chatOpen ? '✕ Close chat' : '✨ Ask AI'}
            </button>
          )}
        </div>
        <FilterBar
          search={search} onSearch={setSearch} placeholder="Search policy title or code…"
          filters={[{
            key: 'cat', label: 'Category',
            options: cats.map((c) => ({ value: c, label: c.replace('_', ' ').toUpperCase() })),
            value: filterCat, onChange: setFilterCat,
          }]}
        />
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((pol) => (
            <button key={pol.id} onClick={() => navigate(`/policies/${pol.id}`)}
              className="card card-hover"
              style={{
                padding: '16px 20px', textAlign: 'left', width: '100%',
                display: 'flex', gap: 16, alignItems: 'flex-start',
                background: 'var(--surface-0)', border: '1px solid var(--line)',
                cursor: 'pointer',
              }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className="tag">{pol.code}</span>
                  <span className={`pill pill-no-dot ${pol.status === 'active' ? 'pill-emerald' : 'pill-slate'}`}
                    style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>
                    {pol.status}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>v{pol.version}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>Effective {formatDate(pol.effectiveDate)}</span>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>{pol.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6 }}>{pol.summary}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 6 }}>
                  Owner: {pol.ownerDept} · {pol.citationCount} citation{pol.citationCount !== 1 ? 's' : ''}
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)', marginTop: 4, flexShrink: 0 }}>
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Policy chat panel — always visible on desktop, toggleable on mobile */}
      {(!isMobile || chatOpen) && (
        <aside style={{
          width: 360, flexShrink: 0,
          borderLeft: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column',
          ...(isMobile ? {
            position: 'fixed', inset: '0 0 0 auto', zIndex: 200,
            background: 'var(--surface-0)', boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
          } : {}),
        }} aria-label="Policy assistant">
          <PolicyChatPanel userRole={user?.role ?? 'requester'} policies={POLICIES} />
        </aside>
      )}
    </div>
  )
}
