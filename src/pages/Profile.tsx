import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authStore, showToast } from '../store'
import { useStore } from '../hooks/useStore'
import { Avatar, RoleBadge } from '../components/primitives'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600,
  color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em',
}

function deriveInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function Profile() {
  useEffect(() => { document.title = 'My Profile — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const { user } = useStore(authStore)

  const [fullName, setFullName] = useState(user.fullName)
  const [department, setDepartment] = useState(user.department)
  const [jobTitle, setJobTitle] = useState(user.jobTitle)
  const [saving, setSaving] = useState(false)

  const previewInitials = deriveInitials(fullName) || user.initials

  function handleSave() {
    if (!fullName.trim()) { showToast('Full name is required.', 'error'); return }
    setSaving(true)
    authStore.setState({
      user: {
        ...user,
        fullName: fullName.trim(),
        department: department.trim() || user.department,
        jobTitle: jobTitle.trim() || user.jobTitle,
        initials: deriveInitials(fullName.trim()),
      },
    })
    showToast('Profile updated.', 'success')
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Update your display name, department, and job title</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 560 }}>
        {/* Identity card */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 20, display: 'flex', gap: 18, alignItems: 'center' }}>
          <Avatar initials={previewInitials} color={user.avatarColor} size={56} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>{fullName || user.fullName}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 3 }}>{user.email}</div>
            <div style={{ marginTop: 6 }}><RoleBadge role={user.role} size="sm" /></div>
          </div>
        </div>

        {/* Edit form */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelSt}>FULL NAME</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>

            <div>
              <label style={labelSt}>EMAIL</label>
              <input value={user.email} readOnly
                style={{ ...inputSt, background: 'var(--surface-1)', color: 'var(--ink-400)', cursor: 'not-allowed' }} />
              <p style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 4 }}>
                Email cannot be changed here. Contact your admin.
              </p>
            </div>

            <div>
              <label style={labelSt}>ROLE</label>
              <div style={{ padding: '8px 10px', background: 'var(--surface-1)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                <RoleBadge role={user.role} size="sm" />
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 4 }}>Role is assigned by an admin.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelSt}>DEPARTMENT</label>
                <input value={department} onChange={(e) => setDepartment(e.target.value)} style={inputSt}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
              </div>
              <div>
                <label style={labelSt}>JOB TITLE</label>
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={inputSt}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
              </div>
            </div>

            {!isSupabaseConfigured && (
              <p style={{ fontSize: 11.5, color: 'var(--amber-700)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
                Demo mode — changes update the active session only and reset on sign-out.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>Save changes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
