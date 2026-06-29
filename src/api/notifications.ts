import { apiGet, apiPost, apiPatch, startPolling } from '../lib/api'
import type { Notification } from '../data/types'

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  return apiGet<Notification[]>(`/notifications?userId=${encodeURIComponent(userId)}`)
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiPatch(`/notifications/${id}/read`, {})
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await apiPost('/notifications/read-all', { userId })
}

export function subscribeToNotifications(userId: string, onNew: (n: Notification) => void): () => void {
  let latestTs = new Date().toISOString()

  return startPolling(async () => {
    const all = await fetchNotifications(userId)
    for (const n of all) {
      if (n.ts > latestTs) {
        latestTs = n.ts
        onNew(n)
      }
    }
  }, 20_000)
}
