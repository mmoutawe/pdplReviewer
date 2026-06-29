import { apiGet, apiPost } from '../lib/api'
import type { NotificationType } from '../data/types'

export async function fetchPreferences(userId: string): Promise<Record<NotificationType, boolean>> {
  return apiGet<Record<NotificationType, boolean>>(
    `/notif-preferences?userId=${encodeURIComponent(userId)}`,
  ).catch(() => ({} as Record<NotificationType, boolean>))
}

export async function upsertPreference(userId: string, type: NotificationType, inApp: boolean): Promise<void> {
  await apiPost('/notif-preferences', { userId, type, inApp })
}
