import { dvList, dvCreate, isDataverseConfigured, T } from './dataverse'
import type { NotificationType } from '../data/types'

export interface NotifyParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
  actionLabel?: string
  ticketId?: string
}

/**
 * Insert a notification if the user's preference for this type is enabled.
 * Falls back silently in demo mode (no Dataverse).
 */
export async function notify(params: NotifyParams): Promise<void> {
  if (!isDataverseConfigured) return

  try {
    // Check user preference (default to enabled if no row exists)
    const prefs = await dvList<Record<string, unknown>>(
      T.notifPreferences,
      `$filter=pdplr_userid eq '${params.userId}' and pdplr_type eq '${params.type}'&$top=1`,
    )
    if (prefs.length && prefs[0]['pdplr_inapp'] === false) return

    await dvCreate(T.notifications, {
      pdplr_userid:      params.userId,
      pdplr_type:        params.type,
      pdplr_title:       params.title,
      pdplr_body:        params.body,
      pdplr_link:        params.link ?? null,
      pdplr_actionlabel: params.actionLabel ?? null,
      pdplr_ticketid:    params.ticketId ?? null,
      pdplr_read:        false,
      pdplr_ts:          new Date().toISOString(),
    })
  } catch {
    // Non-fatal — notifications must never break core flows
  }
}

/** Notify multiple users in parallel. */
export function notifyMany(recipients: NotifyParams[]): Promise<void[]> {
  return Promise.all(recipients.map(notify))
}
