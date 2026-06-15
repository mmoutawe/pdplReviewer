import { dvList, dvUpsert, T } from '../lib/dataverse'
import type { NotificationType } from '../data/types'

type DvRow = Record<string, unknown>

export async function fetchPreferences(userId: string): Promise<Record<NotificationType, boolean>> {
  const rows = await dvList<DvRow>(
    T.notifPreferences,
    `$filter=pdplr_userid eq '${userId}'&$select=pdplr_type,pdplr_inapp`,
  ).catch(() => [])

  const map: Record<string, boolean> = {}
  for (const r of rows) {
    map[r['pdplr_type'] as string] = !!(r['pdplr_inapp'])
  }
  return map as Record<NotificationType, boolean>
}

export async function upsertPreference(userId: string, type: NotificationType, inApp: boolean): Promise<void> {
  // Alternate key on (pdplr_userid, pdplr_type)
  await dvUpsert(
    T.notifPreferences,
    `pdplr_userid='${userId}',pdplr_type='${type}'`,
    {
      pdplr_userid:    userId,
      pdplr_type:      type,
      pdplr_inapp:     inApp,
    },
  )
}
