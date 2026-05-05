import { supabase, isSupabaseConfigured } from './supabase'
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
 * Falls back silently in demo mode (no Supabase).
 */
export async function notify(params: NotifyParams): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return

  try {
    // Check user preference
    const { data: pref } = await (supabase as any)
      .from('notification_preferences')
      .select('in_app')
      .eq('user_id', params.userId)
      .eq('type', params.type)
      .maybeSingle()

    // Default to enabled if no preference row exists
    if (pref && pref.in_app === false) return

    await (supabase as any)
      .from('notifications')
      .insert({
        user_id:      params.userId,
        type:         params.type,
        title:        params.title,
        body:         params.body,
        link:         params.link ?? null,
        action_label: params.actionLabel ?? null,
        ticket_id:    params.ticketId ?? null,
        read:         false,
      })
  } catch {
    // Non-fatal — notifications must never break core flows
  }
}

/** Notify multiple users in parallel. */
export function notifyMany(recipients: NotifyParams[]): Promise<void[]> {
  return Promise.all(recipients.map(notify))
}
