import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PROJECTS, TICKETS, VENDORS } from '../data/seed'
import type { Project } from '../data/types'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}

function StatusBadge({ status }: { status: Project['status'] }) {
  const map = {
    active:  { bg: 'var(--emerald-50)', color: 'var(--emerald-700)', border: 'var(--emerald-200)', label: 'Active' },
    on_hold: { bg: 'var(--amber-50)',   color: 'var(--amber-700)',   border: 'var(--amber-200)',   label: 'On Hold' },
    closed:  { bg: 'var(--surface-2)', color: 'var(--ink-500)',      border: 'var(--line)',        label: 'Closed' },
  }
  const s = map[status] ?? map.closed
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
      borderRadius: 'var(--r-full)', fontSize: 12, fontWeight: 500,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  )
}

function CreateProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName]               = useState('')
  const [businessUnit, setBusinessUnit] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus]           = useState<Project['status']>('active')
  const [error, setError]             = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required.'); return }
    if (!businessUnit.trim()) { setError('Business unit is required.'); return }
    const now = new Date().toISOString()
    const newProject: Project = {
      id: `p-new-${Date.now()}`,
      code: `PROJ-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      name: name.trim(), businessUnit: businessUnit.trim(),
      description: description.trim(), status,
      ownerId: '', dataInventoryCount: 0, ticketIds: [], startedAt: now,
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
            <input value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} placeholder="Engineering, Product, Finance…" style={inputSt}
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
  const navigate  = useNavigate()
  const [search, setSearch]           = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [projects, setProjects]       = useState<Project[]>([...PROJECTS])
  const [showCreate, setShowCreate]   = useState(false)

  // Derive cross-border flag from ticket types associated with each project
  const crossBorderProjects = new Set(
    TICKETS.filter((t) => t.type === 'cross_border_transfer' && t.projectId).map((t) => t.projectId!)
  )

  const visible = projects.filter((p) => {
    if (vendorFilter && p.vendorId !== vendorFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.businessUnit.toLowerCase().includes(q)
  })

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage vendor projects and engagements</p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 14, fontWeight: 600 }}
          onClick={() => setShowCreate(true)}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 1.5v10M1.5 6.5h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New Project
        </button>
      </div>

      {/* ── Table card ── */}
      <div className="page-content">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Search + vendor filter */}
          <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }}>
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                style={{ ...inputSt, paddingLeft: 32 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                style={{
                  padding: '8px 32px 8px 12px', fontSize: 13, border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-700)',
                  outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: 140,
                }}
              >
                <option value="">All Vendors</option>
                {VENDORS.map((v) => (
                  <option key={v.id} value={v.id}>{v.tradeName}</option>
                ))}
              </select>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }}>
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* Table */}
          {visible.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>
              No projects match your filters.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['Project', 'Vendor', 'Business Unit', 'Status', 'Cross-border'].map((h) => (
                    <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-500)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p, i) => {
                  const vendor = p.vendorId ? VENDORS.find((v) => v.id === p.vendorId) : null
                  const hasCrossBorder = crossBorderProjects.has(p.id)
                  return (
                    <tr
                      key={p.id}
                      style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-1)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                    >
                      {/* Project name */}
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--ink-900)' }}>
                        {p.name}
                      </td>
                      {/* Vendor */}
                      <td style={{ padding: '14px 20px' }}>
                        {vendor ? (
                          <span
                            style={{ color: 'var(--brand-700)', fontWeight: 500, cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); navigate(`/vendors/${vendor.id}`) }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.textDecoration = 'underline' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.textDecoration = 'none' }}
                          >
                            {vendor.tradeName}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-400)' }}>—</span>
                        )}
                      </td>
                      {/* Business Unit */}
                      <td style={{ padding: '14px 20px', color: 'var(--ink-700)' }}>
                        {p.businessUnit}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={p.status} />
                      </td>
                      {/* Cross-border */}
                      <td style={{ padding: '14px 20px', color: hasCrossBorder ? 'var(--amber-700)' : 'var(--ink-500)', fontWeight: hasCrossBorder ? 600 : 400 }}>
                        {hasCrossBorder ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
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
