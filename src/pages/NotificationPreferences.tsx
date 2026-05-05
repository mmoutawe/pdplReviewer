import { useEffect, useState, useCallback } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { fetchPreferences, upsertPreference } from '../api/notificationPreferences'
import { showToast, authStore } from '../store'
import { useStore } from '../hooks/useStore'
import { ALL_NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from '../data/types'
import type { NotificationType } from '../data/types'

export default function NotificationPreferences() {
  useEffect(() => { document.title = 'Notification Preferences — PDPL Reviewer' }, [])

  const { user } = useStore(authStore)

  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>(
    () => Object.fromEntries(ALL_NOTIFICATION_TYPES.map((t) => [t, true])) as Record<NotificationType, boolean>
  )
  const [saving, setSaving] = useState<NotificationType | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const loaded = await fetchPreferences(user.id)
      setPrefs((prev) => ({ ...prev, ...loaded }))
    } catch { /* noop */ }
  }, [user.id])

  useEffect(() => { void load() }, [load])

  async function handleToggle(type: NotificationType, value: boolean) {
    setPrefs((p) => ({ ...p, [type]: value }))
    if (!isSupabaseConfigured) return   // persist locally only in demo mode
    setSaving(type)
    try {
      await upsertPreference(user.id, type, value)
    } catch {
      showToast('Failed to save preference.', 'error')
      setPrefs((p) => ({ ...p, [type]: !value }))
    } finally { setSaving(null) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notification preferences</h1>
          <p className="page-subtitle">Choose which in-app notifications you want to receive</p>
        </div>
      </div>

      <div style={{ padding: '0 24px 32px', maxWidth: 680 }}>
        {!isSupabaseConfigured && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--radius)', fontSize: 12.5, color: 'var(--amber-700)' }}>
            Demo mode — preferences are applied locally this session only and will not persist after refresh.
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--surface-1)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>In-app notifications</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 2 }}>
              Disabled events will still appear in the audit log, but won't show in your notification bell.
            </div>
          </div>

          {ALL_NOTIFICATION_TYPES.map((type, i) => (
            <div key={type} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: i < ALL_NOTIFICATION_TYPES.length - 1 ? '1px solid var(--line-soft)' : 'none',
            }}>
              <label htmlFor={`pref-${type}`} style={{ fontSize: 13.5, color: 'var(--ink-800)', cursor: 'pointer', flex: 1 }}>
                {NOTIFICATION_TYPE_LABELS[type]}
              </label>
              <button
                id={`pref-${type}`}
                role="switch"
                aria-checked={prefs[type]}
                disabled={saving === type}
                onClick={() => void handleToggle(type, !prefs[type])}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  cursor: saving === type ? 'wait' : 'pointer',
                  background: prefs[type] ? 'var(--brand-700)' : 'var(--ink-200)',
                  position: 'relative', transition: 'background var(--t-med)', flexShrink: 0,
                  opacity: saving === type ? 0.6 : 1,
                }}
                aria-label={`Toggle ${NOTIFICATION_TYPE_LABELS[type]}`}
              >
                <span style={{
                  position: 'absolute', top: 3, left: prefs[type] ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left var(--t-med)', boxShadow: 'var(--shadow-sm)',
                }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
