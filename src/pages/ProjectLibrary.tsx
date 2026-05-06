import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PROJECTS, TICKETS } from '../data/seed'
import type { Project } from '../data/types'
import { FilterBar } from '../components/table'
import { formatDate } from '../lib/utils'

const STATUS_COLORS: Record<string, string> = {
  active: 'pill-emerald',
  on_hold: 'pill-amber',
  closed: 'pill-slate',
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}

function CreateProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName] = useState('')
  const [businessUnit, setBusinessUnit] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Project['status']>('active')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required.'); return }
    if (!businessUnit.trim()) { setError('Business unit is required.'); return }
    const now = new Date().toISOString()
    const newProject: Project = {
      id: `p-new-${Date.now()}`,
      code: `PROJ-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      name: name.trim(),
      businessUnit: businessUnit.trim(),
      description: description.trim(),
      status,
      ownerId: '',
      dataInventoryCount: 0,
      ticketIds: [],
      startedAt: now,
    }
    onCreated(newProject)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 460, padding: '28px 32px', zIndex: 1 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 20 }}>New project</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>PROJECT NAME *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Open Banking Integration" style={inputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>BUSINESS UNIT *</label>
            <input value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} placeholder="e.g. Engineering, Product, Finance" style={inputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>DESCRIPTION</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project and its data processing activities…"
              rows={3}
              style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>STATUS</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Project['status'])} style={inputSt}>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          {error && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create project</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProjectLibrary() {
  useEffect(() => { document.title = 'Projects — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [projects, setProjects] = useState<Project[]>([...PROJECTS])
  const [showCreate, setShowCreate] = useState(false)

  const ticketCountByProject = Object.fromEntries(
    projects.map((p) => [p.id, TICKETS.filter((t) => t.projectId === p.id).length])
  )

  const visible = projects.filter((p) => {
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
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          New project
        </button>
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
                  {proj.ownerId && <span>Owner: {proj.ownerId}</span>}
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
      {showCreate && (
        <CreateProjectDialog
          onClose={() => setShowCreate(false)}
          onCreated={(p) => setProjects((prev) => [p, ...prev])}
        />
      )}
    </div>
  )
}
