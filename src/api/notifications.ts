import { dvList, dvUpdate, T, toNotification, startPolling } from '../lib/dataverse'
import type { Notification } from '../data/types'

type DvRow = Record<string, unknown>

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const rows = await dvList<DvRow>(
    T.notifications,
    `$filter=pdplr_userid eq '${userId}'&$orderby=pdplr_ts desc&$top=100`,
  )
  return rows.map(toNotification)
}

export async function markNotificationRead(id: string): Promise<void> {
  await dvUpdate(T.notifications, id, { pdplr_read: true })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const rows = await dvList<DvRow>(
    T.notifications,
    `$filter=pdplr_userid eq '${userId}' and pdplr_read eq false&$select=pdplr_notificationid`,
  )
  await Promise.all(
    rows.map((r) => dvUpdate(T.notifications, r['pdplr_notificationid'] as string, { pdplr_read: true })),
  )
}

// Polls for new notifications every 20 seconds (replaces Supabase realtime)
export function subscribeToNotifications(
  userId: string,
  onNew: (n: Notification) => void,
): () => void {
  let latestTs = new Date().toISOString()

  return startPolling(async () => {
    const rows = await dvList<DvRow>(
      T.notifications,
      `$filter=pdplr_userid eq '${userId}' and pdplr_ts gt '${latestTs}'&$orderby=pdplr_ts asc`,
    )
    for (const r of rows) {
      const n = toNotification(r)
      latestTs = n.ts
      onNew(n)
    }
  }, 20_000)
}
