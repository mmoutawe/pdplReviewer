import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Folder } from 'lucide-react'
import { projectById, TICKETS, userById } from '../data/seed'
import { EmptyState, StatusPill, SLAIndicator, Avatar } from '../components/primitives'
import { fetchProjects, updateProject } from '../api/projects'
import { isDataverseConfigured } from '../lib/dataverse'
import type { Project } from '../data/types'
import { showToast } from '../store'
import { formatDate } from '../lib/utils'
import type { ProjectDocumentType, ProjectDocumentStatus } from '../data/types'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from '../data/types'

interface ProjectDoc { id: string; title: string; type: ProjectDocumentType; status: ProjectDocumentStatus; date: string; fileType: string }

const PROJECT_DOC_MAP: Record<string, ProjectDoc[]> = {
  'p-instalend': [
    { id: 'pd1', title: 'Privacy Impact Assessment — InstaLend BNPL', type: 'report', status: 'active', date: '2026-03-10', fileType: 'PDF' },
    { id: 'pd2', title: 'DPA — Falcon ID (KYC)', type: 'dpa', status: 'active', date: '2026-03-18', fileType: 'PDF' },
    { id: 'pd3', title: 'Sahab Cloud Sub-processor Agreement', type: 'contract', status: 'active', date: '2026-02-10', fileType: 'PDF' },
  ],
  'p-velo': [
    { id: 'pd4', title: 'DPIA — Open Banking Aggregation', type: 'report', status: 'active', date: '2026-02-20', fileType: 'PDF' },
    { id: 'pd5', title: 'SAMA Open Banking Compliance Questionnaire', type: 'questionnaire', status: 'active', date: '2026-01-30', fileType: 'PDF' },
    { id: 'pd6', title: 'DPA — Core Banking Integration', type: 'dpa', status: 'active', date: '2026-01-12', fileType: 'PDF' },
  ],
  'p-noor': [
    { id: 'pd7', title: 'DPIA — Wealth Robo-Advisory (draft, on hold)', type: 'report', status: 'draft', date: '2025-09-15', fileType: 'DOCX' },
    { id: 'pd8', title: 'CMA Licensing Correspondence', type: 'other', status: 'draft', date: '2025-10-02', fileType: 'PDF' },
  ],
  'p-shams': [
    { id: 'pd9', title: 'KYB Data Processing Policy', type: 'contract', status: 'active', date: '2026-03-05', fileType: 'PDF' },
    { id: 'pd10', title: 'Merchant Onboarding NDA Template', type: 'nda', status: 'active', date: '2026-02-28', fileType: 'DOCX' },
  ],
}

const STATUS_COLORS: Record<string, string> = {
  active: 'pill-emerald',
  on_hold: 'pill-amber',
  closed: 'pill-slate',
}

interface DocVersion {
  id: string
  title: string
  fileType: string
  date: string
  status: ProjectDocumentStatus
  uploadedBy: string
}

function UploadVersionDialog({ docTitle, onClose, onUpload }: {
  docTitle: string
  onClose: () => void
  onUpload: (filename: string, fileType: string) => void
}) {
  const [filename, setFilename] = useState('')
  const [fileType, setFileType] = useState('PDF')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!filename.trim()) { setError('File name is required.'); return }
    onUpload(filename.trim(), fileType)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 400, padding: '24px 28px', zIndex: 1 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>Upload new version</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16 }}>{docTitle}</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>FILE NAME *</label>
            <input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="e.g. Privacy Impact Assessment v2"
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>FILE TYPE</label>
            <select value={fileType} onChange={(e) => setFileType(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none' }}>
              <option value="PDF">PDF</option>
              <option value="DOCX">DOCX</option>
              <option value="XLSX">XLSX</option>
            </select>
          </div>
          {error && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Upload version</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}

function EditProjectDialog({ project, onClose, onSaved }: {
  project: Project
  onClose: () => void
  onSaved: (p: Project) => void
}) {
  const [name,         setName]         = useState(project.name)
  const [description,  setDescription]  = useState(project.description ?? '')
  const [businessUnit, setBusinessUnit] = useState(project.businessUnit)
  const [status,       setStatus]       = useState<Project['status']>(project.status)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required.'); return }
    setError(null)
    const patch: Partial<Omit<Project, 'id' | 'ticketIds'>> = {
      name: name.trim(), description: description.trim(),
      businessUnit: businessUnit.trim(), status,
    }
    setSaving(true)
    try {
      if (isDataverseConfigured) await updateProject(project.id, patch)
      onSaved({ ...project, ...patch })
      showToast('Project updated.', 'success')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 480, padding: '28px 32px', zIndex: 1 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 20 }}>Edit project</h2>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>PROJECT NAME *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputSt} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>BUSINESS UNIT</label>
            <input value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} style={inputSt} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>STATUS</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Project['status'])} style={{ ...inputSt, cursor: 'pointer' }}>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>DESCRIPTION</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputSt, resize: 'vertical' }} />
          </div>
          {error && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProjectProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [proj, setProj] = useState<Project | undefined>(projectById(id ?? ''))
  const [dvLoading, setDvLoading] = useState(isDataverseConfigured && !projectById(id ?? ''))

  useEffect(() => {
    if (!isDataverseConfigured || !id || projectById(id)) return
    setDvLoading(true)
    fetchProjects()
      .then((ps) => setProj(ps.find((x) => x.id === id)))
      .catch(() => {})
      .finally(() => setDvLoading(false))
  }, [id])

  useEffect(() => { document.title = proj ? `${proj.name} — PDPL Reviewer` : 'Project — PDPL Reviewer' }, [proj])

  const baseProjectDocs = PROJECT_DOC_MAP[id ?? ''] ?? []

  const [versionHistory, setVersionHistory] = useState<Record<string, DocVersion[]>>(() => {
    const initial: Record<string, DocVersion[]> = {}
    baseProjectDocs.forEach((doc) => {
      initial[doc.id] = [{
        id: doc.id + '-v1',
        title: doc.title,
        fileType: doc.fileType,
        date: doc.date,
        status: doc.status,
        uploadedBy: 'System',
      }]
    })
    return initial
  })
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [showEditProject, setShowEditProject] = useState(false)

  function handleUpload(docId: string, filename: string, fileType: string) {
    setVersionHistory((prev) => {
      const existingVersions = (prev[docId] ?? []).map((ver) => ({ ...ver, status: 'superseded' as ProjectDocumentStatus }))
      const newVer: DocVersion = {
        id: `${docId}-v${Date.now()}`,
        title: filename,
        fileType,
        date: new Date().toISOString().slice(0, 10),
        status: 'active',
        uploadedBy: 'Current user',
      }
      return { ...prev, [docId]: [newVer, ...existingVersions] }
    })
  }

  if (dvLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>Loading project…</div>
  if (!proj) return <EmptyState title="Project not found" icon={<Folder size={26} color="var(--teal-600)" />}
    action={<button className="btn btn-primary" onClick={() => navigate('/projects')}>Back to projects</button>} />

  const relatedTickets = TICKETS.filter((t) => t.projectId === proj.id)
  const owner = userById(proj.ownerId)

  const byState: Record<string, number> = {}
  relatedTickets.forEach((t) => { byState[t.state] = (byState[t.state] ?? 0) + 1 })

  return (
    <div style={{ maxWidth: 860, padding: '28px 32px' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')} style={{ marginBottom: 16 }}>← Projects</button>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>{proj.name}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.6 }}>{proj.description}</p>
        </div>
        <span className={`pill pill-no-dot ${STATUS_COLORS[proj.status] ?? 'pill-slate'}`}>
          {proj.status.replace('_', ' ')}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowEditProject(true)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M10.5 2.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
          Edit
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Project details</h2>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={{ color: 'var(--ink-500)' }}>Business unit</dt>
              <dd>{proj.businessUnit}</dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={{ color: 'var(--ink-500)' }}>Created</dt>
              <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDate(proj.startedAt)}</dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={{ color: 'var(--ink-500)' }}>Total requests</dt>
              <dd>{relatedTickets.length}</dd>
            </div>
          </dl>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Project owner</h2>
          {owner ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={owner.initials} color={owner.avatarColor} size={36} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{owner.fullName}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{owner.department}</div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--ink-400)', fontSize: 13 }}>Owner not found.</p>
          )}
        </div>
      </div>

      {Object.keys(byState).length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Request breakdown</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(byState).map(([state, count]) => (
              <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-500)' }}>{state.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '14px 20px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Documents ({baseProjectDocs.length})</h2>
        {baseProjectDocs.length === 0 ? (
          <p style={{ color: 'var(--ink-400)', fontSize: 13 }}>No documents linked to this project.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {baseProjectDocs.map((doc) => {
              const versions = versionHistory[doc.id] ?? []
              const current = versions[0] ?? doc
              const isExpanded = expandedDoc === doc.id
              return (
                <div key={doc.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-1)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--brand-700)', flexShrink: 0 }}>
                      {current.fileType}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 1 }}>
                        {DOCUMENT_TYPE_LABELS[doc.type]} · {formatDate(current.date)} · v{versions.length}
                      </div>
                    </div>
                    <span className={`pill pill-no-dot ${current.status === 'active' ? 'pill-emerald' : current.status === 'draft' ? 'pill-amber' : 'pill-slate'}`}
                      style={{ fontSize: 10.5, height: 18, padding: '0 6px', flexShrink: 0 }}>
                      {DOCUMENT_STATUS_LABELS[current.status]}
                    </span>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, flexShrink: 0 }}
                      onClick={() => setUploadingFor(doc.id)}>
                      ↑ Upload
                    </button>
                    {versions.length > 1 && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, flexShrink: 0 }}
                        onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}>
                        {isExpanded ? 'Hide history' : `History (${versions.length})`}
                      </button>
                    )}
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--line-soft)', background: 'var(--surface-0)' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-400)', marginBottom: 6, letterSpacing: '0.04em' }}>VERSION HISTORY</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {versions.map((ver, i) => (
                          <div key={ver.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-700)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', minWidth: 24 }}>v{versions.length - i}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ver.title}</span>
                            <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>{formatDate(ver.date)}</span>
                            <span className={`pill pill-no-dot ${ver.status === 'active' ? 'pill-emerald' : 'pill-slate'}`}
                              style={{ fontSize: 10, height: 16, padding: '0 5px', flexShrink: 0 }}>
                              {ver.status === 'active' ? 'Active' : 'Superseded'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '14px 20px' }}>
        <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Requests ({relatedTickets.length})</h2>
        {relatedTickets.length === 0 ? (
          <p style={{ color: 'var(--ink-400)', fontSize: 13 }}>No requests linked to this project.</p>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {relatedTickets.map((t) => (
              <li key={t.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/requests/${t.id}`)}
                  style={{ justifyContent: 'flex-start', gap: 10, width: '100%' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-500)', flexShrink: 0 }}>{t.id}</span>
                  <StatusPill state={t.state} size="sm" />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: 'var(--ink-800)' }}>{t.title}</span>
                  <SLAIndicator dueAt={t.sla.decisionDueAt} breached={t.sla.breached} compact />
                  <span style={{ fontSize: 12, color: 'var(--ink-400)', flexShrink: 0 }}>{formatDate(t.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {uploadingFor !== null && (() => {
        const doc = baseProjectDocs.find((d) => d.id === uploadingFor)!
        return (
          <UploadVersionDialog
            docTitle={doc.title}
            onClose={() => setUploadingFor(null)}
            onUpload={(filename, fileType) => handleUpload(doc.id, filename, fileType)}
          />
        )
      })()}

      {showEditProject && (
        <EditProjectDialog
          project={proj}
          onClose={() => setShowEditProject(false)}
          onSaved={(updated) => { setProj(updated); setShowEditProject(false) }}
        />
      )}
    </div>
  )
}
