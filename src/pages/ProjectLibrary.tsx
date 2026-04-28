import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PROJECTS, TICKETS } from '../data/seed'
import { FilterBar } from '../components/table'
import { formatDate } from '../lib/utils'

const STATUS_COLORS: Record<string, string> = {
  active: 'pill-emerald',
  on_hold: 'pill-amber',
  closed: 'pill-slate',
}

export default function ProjectLibrary() {
  useEffect(() => { document.title = 'Projects — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const ticketCountByProject = Object.fromEntries(
    PROJECTS.map((p) => [p.id, TICKETS.filter((t) => t.projectId === p.id).length])
  )

  const visible = PROJECTS.filter((p) => {
    if (filterStatus && p.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.businessUnit.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Library</h1>
          <p className="page-subtitle">{visible.length} project{visible.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <FilterBar
        search={search} onSearch={setSearch} placeholder="Search by project name or business unit…"
        filters={[{
          key: 'status', label: 'Status',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'on_hold', label: 'On Hold' },
            { value: 'closed', label: 'Closed' },
          ],
          value: filterStatus, onChange: setFilterStatus,
        }]}
      />
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((proj) => {
          const ticketCount = ticketCountByProject[proj.id] ?? 0
          return (
            <button key={proj.id} onClick={() => navigate(`/projects/${proj.id}`)}
              className="card card-hover"
              style={{ padding: '16px 20px', textAlign: 'left', width: '100%', display: 'flex', gap: 16, alignItems: 'flex-start', background: 'var(--surface-0)', border: '1px solid var(--line)', cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-900)' }}>{proj.name}</span>
                  <span className={`pill pill-no-dot ${STATUS_COLORS[proj.status] ?? 'pill-slate'}`}
                    style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>{proj.status.replace('_', ' ')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 6, lineHeight: 1.6 }}>{proj.description}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-400)', flexWrap: 'wrap' }}>
                  <span>Unit: {proj.businessUnit}</span>
                  <span>Owner: {proj.ownerId}</span>
                  <span>{ticketCount} request{ticketCount !== 1 ? 's' : ''}</span>
                  <span>Created {formatDate(proj.startedAt)}</span>
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)', marginTop: 4, flexShrink: 0 }}>
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )
        })}
        {visible.length === 0 && (
          <p style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>No projects match your filters.</p>
        )}
      </div>
    </div>
  )
}
