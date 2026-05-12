import { useEffect, useState, useCallback } from 'react'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { fetchTemplates, uploadTemplate, toggleTemplateActive, deleteTemplate, downloadTemplate } from '../api/templatesLibrary'
import { EmptyState } from '../components/primitives'
import { showToast, authStore } from '../store'
import { useStore } from '../hooks/useStore'
import { TEMPLATE_CATEGORY_LABELS } from '../data/types'
import type { ReviewerTemplate, TemplateCategory } from '../data/types'
import { formatDate } from '../lib/utils'

export default function TemplatesLibrary() {
  useEffect(() => { document.title = 'Templates Library — PDPL Reviewer' }, [])

  const { user } = useStore(authStore)
  const [templates, setTemplates] = useState<ReviewerTemplate[]>([])
  const [loading, setLoading]     = useState(isSupabaseConfigured)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm]   = useState(false)

  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [category, setCategory]   = useState<TemplateCategory>('other')
  const [file, setFile]           = useState<File | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    try { setTemplates(await fetchTemplates()) }
    catch (err) { showToast(err instanceof Error ? err.message : 'Failed to load templates.', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleUpload() {
    if (!file || !title.trim()) { showToast('Title and file are required.', 'error'); return }
    setUploading(true)
    try {
      const t = await uploadTemplate(file, { title: title.trim(), description: description.trim() || undefined, category }, user.fullName)
      setTemplates((prev) => [t, ...prev])
      setShowForm(false); setTitle(''); setDesc(''); setCategory('other'); setFile(null)
      showToast('Template uploaded.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error')
    } finally { setUploading(false) }
  }

  async function handleToggle(t: ReviewerTemplate) {
    try {
      await toggleTemplateActive(t.id, !t.is_active)
      setTemplates((prev) => prev.map((x) => x.id === t.id ? { ...x, is_active: !t.is_active } : x))
      showToast(t.is_active ? 'Template deactivated.' : 'Template activated.', 'success')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Update failed.', 'error') }
  }

  async function handleDelete(t: ReviewerTemplate) {
    if (!confirm(`Delete "${t.title}"?`)) return
    try {
      await deleteTemplate(t)
      setTemplates((prev) => prev.filter((x) => x.id !== t.id))
      showToast('Template deleted.', 'success')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed.', 'error') }
  }

  async function handleDownload(t: ReviewerTemplate) {
    try { await downloadTemplate(t) }
    catch (err) { showToast(err instanceof Error ? err.message : 'Download failed.', 'error') }
  }

  const canUpload = ['admin', 'data_management', 'legal', 'security'].includes(user.role)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates Library</h1>
          <p className="page-subtitle">Reusable document templates — DPAs, NDAs, compliance letters — used when attaching documents to a request</p>
        </div>
        {isSupabaseConfigured && canUpload && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((o) => !o)}>
            {showForm ? 'Cancel' : '+ Upload template'}
          </button>
        )}
      </div>

      {/* Upload form */}
      {showForm && isSupabaseConfigured && (
        <div className="card" style={{ margin: '0 24px 20px', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Upload new template</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Title *</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Standard DPA Template" />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
                {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <input className="input" value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Brief description of when this template is used" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>File (PDF, DOCX, TXT) *</label>
              <input type="file" className="input" accept=".pdf,.docx,.doc,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void handleUpload()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload template'}
            </button>
          </div>
        </div>
      )}

      {!isSupabaseConfigured && (
        <div style={{ margin: '0 24px 16px', padding: '12px 16px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--amber-700)' }}>
          ⚠ Templates Library requires Supabase. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to upload and manage templates.
        </div>
      )}

      <div style={{ padding: '0 24px 24px' }}>
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>Loading templates…</div>
        ) : templates.length === 0 ? (
          <EmptyState title="No templates yet" body={isSupabaseConfigured ? 'Upload your first template using the button above.' : 'Connect Supabase to manage reviewer templates.'} icon="📋" />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--line)' }}>
                  {['Template', 'Category', 'Type', 'Uploaded', 'Active', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-600)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < templates.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 2, maxWidth: 300 }}>{t.description}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="tag" style={{ fontSize: 11 }}>{TEMPLATE_CATEGORY_LABELS[t.category] ?? t.category}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase' }}>{t.file_type}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-400)', fontSize: 12 }}>{formatDate(t.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        role="switch"
                        aria-checked={t.is_active}
                        onClick={() => void handleToggle(t)}
                        style={{
                          width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                          background: t.is_active ? 'var(--emerald-600)' : 'var(--ink-200)',
                          position: 'relative', transition: 'background var(--t-med)', flexShrink: 0,
                        }}
                        aria-label={`Toggle ${t.title}`}
                      >
                        <span style={{
                          position: 'absolute', top: 3, left: t.is_active ? 21 : 3,
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          transition: 'left var(--t-med)', boxShadow: 'var(--shadow-sm)',
                        }} />
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => void handleDownload(t)}>Download</button>
                        {canUpload && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }} onClick={() => void handleDelete(t)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 500,
  color: 'var(--ink-700)', marginBottom: 4,
}
