import { useEffect, useRef, useState } from 'react'
import { authStore, showToast } from '../store'
import { useStore } from '../hooks/useStore'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { getWorkflowSettings, setWorkflowSetting, syncWorkflowSettings, saveWorkflowSettings, type WorkflowSettings } from '../lib/workflowSettings'
import {
  fetchAppSettings, updateDocValidationSetting,
  fetchExternalLinks, createExternalAccount,
  toggleRevokeLink, deleteExternalLink,
  type AppSettings,
} from '../api/adminSettings'
import type { AdminExternalLink } from '../data/types'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch" aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
        background: checked ? 'var(--brand-700)' : 'var(--ink-200)',
        position: 'relative', transition: 'background var(--t-med)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left var(--t-med)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{description}</div>
      </div>
      {children}
    </div>
  )
}

const settingLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600,
  color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em',
}

export default function Settings() {
  useEffect(() => { document.title = 'Settings — PDPL Reviewer' }, [])
  const { user } = useStore(authStore)
  const isAdmin = user.role === 'admin'
  const isDM = user.role === 'data_management'
  const canEditPolicy = isAdmin || isDM
  const canManageLinks = isAdmin || isDM

  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowSettings>(() => getWorkflowSettings())
  const settingsIdRef = useRef<string | null>(null)

  const [links, setLinks]       = useState<AdminExternalLink[]>([])
  const [linksLoading, setLinksLoading] = useState(false)
  const [showNewLink, setShowNewLink]   = useState(false)
  const [newLabel, setNewLabel]   = useState('')
  const [newEmail, setNewEmail]   = useState('')
  const [newName, setNewName]     = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [creating, setCreating]   = useState(false)

  const [riskThreshold, setRiskThreshold] = useState(3)
  const [confidenceThreshold, setConfidenceThreshold] = useState(95)

  const CHECKLIST_ITEMS = [
    'Purpose is clearly stated',
    'Data is necessary for purpose',
    'No excessive personal data',
    'Recipient is appropriate',
    'Attachments reviewed',
  ]

  useEffect(() => {
    if (!isSupabaseConfigured) return
    setSettingsLoading(true)
    void fetchAppSettings()
      .then((s) => {
        setAppSettings(s)
        if (s?.workflowConfig) {
          settingsIdRef.current = s.id
          setWorkflowConfig(s.workflowConfig)
        }
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false))

    void syncWorkflowSettings().then(({ settingsId, settings }) => {
      if (settingsId) settingsIdRef.current = settingsId
      setWorkflowConfig(settings)
    })

    if (canManageLinks) {
      setLinksLoading(true)
      void fetchExternalLinks()
        .then((l) => setLinks(l))
        .catch(() => {})
        .finally(() => setLinksLoading(false))
    }
  }, [canManageLinks])

  async function handleDocValidationToggle(value: boolean) {
    setWorkflowConfig((prev) => ({ ...prev, requireDocumentValidation: value }))
    setWorkflowSetting('requireDocumentValidation', value)
    if (isSupabaseConfigured && appSettings) {
      try {
        await updateDocValidationSetting(appSettings.id, value)
        setAppSettings({ ...appSettings, requireDocumentValidation: value })
        showToast(value ? 'Document validation required.' : 'Document validation optional.', 'success')
      } catch {
        showToast('Failed to save setting.', 'error')
      }
    }
  }

  async function handleWorkflowToggle(key: keyof WorkflowSettings, value: boolean) {
    if (!isAdmin) return
    const updated = { ...workflowConfig, [key]: value }
    setWorkflowConfig(updated)
    setWorkflowSetting(key, value)
    if (isSupabaseConfigured && settingsIdRef.current) {
      try {
        await saveWorkflowSettings(settingsIdRef.current, updated)
      } catch {
        showToast('Failed to save workflow setting.', 'error')
      }
    }
  }

  async function handleCreateLink() {
    if (!newLabel.trim()) { showToast('Label is required.', 'error'); return }
    if (!newEmail.trim() || !newName.trim()) { showToast('Email and full name are required.', 'error'); return }
    setCreating(true)
    try {
      await createExternalAccount({ label: newLabel, email: newEmail, fullName: newName, expiresAt: newExpiry ? new Date(newExpiry).toISOString() : null })
      showToast('External account created.', 'success')
      setShowNewLink(false); setNewLabel(''); setNewEmail(''); setNewName(''); setNewExpiry('')
      const updated = await fetchExternalLinks()
      setLinks(updated)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create account.', 'error')
    } finally { setCreating(false) }
  }

  async function handleToggleRevoke(link: AdminExternalLink) {
    try {
      await toggleRevokeLink(link.id, !link.revoked)
      setLinks((prev) => prev.map((l) => l.id === link.id ? { ...l, revoked: !l.revoked } : l))
      showToast(link.revoked ? 'Link reactivated.' : 'Link revoked.', 'success')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Update failed.', 'error') }
  }

  async function handleDeleteLink(link: AdminExternalLink) {
    if (!confirm(`Delete link "${link.label}"?`)) return
    try {
      await deleteExternalLink(link.id)
      setLinks((prev) => prev.filter((l) => l.id !== link.id))
      showToast('Link deleted.', 'success')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed.', 'error') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">Configure submission policies, review workflow, and access controls</p>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>

        {/* ── Submission Policy ── */}
        <SettingsCard
          title="Submission Policy"
          description="Control whether requesters must resolve AI document validation before submitting."
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '12px 16px', background: 'var(--surface-1)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-900)', marginBottom: 3 }}>
                Require AI document validation before submission
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.6 }}>
                When enabled, requesters cannot submit a request to reviewers if any supporting document is flagged irrelevant, expired, or still validating.
              </div>
              {!canEditPolicy && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 4, fontStyle: 'italic' }}>
                  Only Admins and Data Management reviewers can change this setting.
                </div>
              )}
              {!isSupabaseConfigured && (
                <div style={{ fontSize: 11.5, color: 'var(--amber-700)', marginTop: 4, fontStyle: 'italic' }}>
                  Requires Dataverse to persist — changes are local only.
                </div>
              )}
            </div>
            {settingsLoading ? (
              <div style={{ width: 44, height: 24, borderRadius: 12, background: 'var(--surface-2)', flexShrink: 0 }} />
            ) : (
              <Toggle
                checked={workflowConfig.requireDocumentValidation}
                onChange={(v) => void handleDocValidationToggle(v)}
                disabled={!canEditPolicy || settingsLoading}
              />
            )}
          </div>
        </SettingsCard>

        {/* ── External Request Links ── */}
        {canManageLinks && (
          <SettingsCard
            title="External Request Links"
            description="Generate shareable links so external organizations can submit and track requests."
          >
            {!isSupabaseConfigured ? (
              <div style={{ padding: '10px 14px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: 'var(--amber-700)' }}>
                External link management requires a Dataverse connection and the Azure Function <code>generateLink</code>.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowNewLink((o) => !o)}>
                    {showNewLink ? 'Cancel' : '+ New Link'}
                  </button>
                </div>

                {showNewLink && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, padding: 16, background: 'var(--surface-1)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                    <div>
                      <label style={settingLabelStyle}>FULL NAME *</label>
                      <input className="input" placeholder="Jane Doe" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </div>
                    <div>
                      <label style={settingLabelStyle}>EMAIL *</label>
                      <input className="input" type="email" placeholder="jane@partner.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    </div>
                    <div>
                      <label style={settingLabelStyle}>PURPOSE / LABEL *</label>
                      <input className="input" placeholder="e.g. Q1 vendor onboarding" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                    </div>
                    <div>
                      <label style={settingLabelStyle}>LINK EXPIRES (OPTIONAL)</label>
                      <input className="input" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--ink-400)', lineHeight: 1.6 }}>
                      A temporary password is generated and emailed to the recipient. They must change it on first sign-in. The account is auto-deleted 7 days after the request is approved.
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowNewLink(false)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={() => void handleCreateLink()} disabled={creating}>
                        {creating ? 'Creating…' : 'Create account & send invite'}
                      </button>
                    </div>
                  </div>
                )}

                {linksLoading ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>Loading links…</div>
                ) : links.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>
                    No external links yet. Click "New Link" to create one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {links.map((link) => {
                      const url = `${window.location.origin}/external/${link.token}`
                      const expired = link.expires_at && new Date(link.expires_at) < new Date()
                      const statusLabel = link.revoked ? 'Revoked' : expired ? 'Expired' : 'Active'
                      const statusColor = link.revoked || expired ? 'var(--red-700)' : 'var(--emerald-700)'
                      return (
                        <div key={link.id} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink-900)' }}>{link.label}</div>
                              {link.recipient_name && (
                                <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 2 }}>{link.recipient_name} · {link.recipient_email}</div>
                              )}
                              <div style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: statusColor, flexShrink: 0 }}>
                              {link.status === 'approved' ? 'Approved' : link.status === 'deleted' ? 'Deleted' : statusLabel}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>
                              Created {new Date(link.created_at).toLocaleDateString()}
                              {link.expires_at && <> · Expires {new Date(link.expires_at).toLocaleDateString()}</>}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5 }}
                                onClick={() => { navigator.clipboard.writeText(url); showToast('Link copied.', 'success') }}>
                                Copy
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5 }}
                                onClick={() => void handleToggleRevoke(link)}>
                                {link.revoked ? 'Reactivate' : 'Revoke'}
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, color: 'var(--red-700)' }}
                                onClick={() => void handleDeleteLink(link)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </SettingsCard>
        )}

        {/* ── Risk Thresholds ── */}
        <SettingsCard
          title="Risk Thresholds"
          description="Configure when tickets escalate to additional reviewers."
        >
          {!isAdmin && (
            <div style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic', marginBottom: 14 }}>
              Read-only for Data Management — only Admins can change these.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 4 }}>High Risk Threshold (personal data items)</div>
              <input
                type="range" min={1} max={10} value={riskThreshold}
                onChange={(e) => isAdmin && setRiskThreshold(Number(e.target.value))}
                disabled={!isAdmin}
                style={{ width: '100%', maxWidth: 300, accentColor: 'var(--brand-700)', cursor: isAdmin ? 'pointer' : 'default' }}
              />
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>
                Tickets with {riskThreshold}+ high-sensitivity items auto-escalate to Legal
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 4 }}>Auto-Approval Confidence Threshold</div>
              <input
                type="range" min={50} max={100} value={confidenceThreshold}
                onChange={(e) => isAdmin && setConfidenceThreshold(Number(e.target.value))}
                disabled={!isAdmin}
                style={{ width: '100%', maxWidth: 300, accentColor: 'var(--brand-700)', cursor: isAdmin ? 'pointer' : 'default' }}
              />
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>
                AI reviews above {confidenceThreshold}% confidence with low risk can be auto-approved
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* ── Workflow Configuration ── */}
        <SettingsCard
          title="Workflow Configuration"
          description="Enable or disable conditional review steps."
        >
          {!isAdmin && (
            <div style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic', marginBottom: 14 }}>
              Read-only for Data Management — only Admins can change these.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { key: 'legalForCrossBorder',  label: 'Legal Review for Cross-Border Transfers', desc: 'Require legal review when sharing outside KSA' },
              { key: 'securityForSensitive', label: 'Security Review for Sensitive Data',       desc: 'Require security review when sensitive data is detected' },
              { key: 'autoRouteLowRisk',     label: 'Auto-Route Low Risk Tickets',              desc: 'Skip manual review for AI-flagged low risk submissions' },
            ] as const).map(({ key, label, desc }) => {
              const on = workflowConfig[key as keyof typeof workflowConfig] as boolean
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-1)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-900)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{desc}</div>
                  </div>
                  <Toggle
                    checked={on}
                    disabled={!isAdmin}
                    onChange={(v) => void handleWorkflowToggle(key as keyof WorkflowSettings, v)}
                  />
                </div>
              )
            })}
          </div>
        </SettingsCard>

        {/* ── Checklist Configuration ── */}
        <SettingsCard
          title="Checklist Configuration"
          description="Customize the Data Management review checklist items."
        >
          {!isAdmin && (
            <div style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic', marginBottom: 14 }}>
              Read-only for Data Management — only Admins can change these.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)' }}>
                <input
                  defaultValue={item}
                  disabled={!isAdmin}
                  style={{ ...inputSt, border: 'none', padding: 0, background: 'transparent', fontSize: 13.5, color: 'var(--ink-800)' }}
                />
              </div>
            ))}
            {isAdmin && (
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                + Add Checklist Item
              </button>
            )}
          </div>
        </SettingsCard>

        {/* ── Save button (admin only) ── */}
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => showToast('Settings saved.', 'success')}>
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
