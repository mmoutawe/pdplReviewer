import { supabase } from '../lib/supabase'
import type { NotificationType } from '../data/types'

export async function fetchPreferences(userId: string): Promise<Record<NotificationType, boolean>> {
  if (!supabase) return {} as Record<NotificationType, boolean>
  const { data } = await (supabase as any)
    .from('notification_preferences')
    .select('type, in_app')
    .eq('user_id', userId)
  const map: Record<string, boolean> = {}
  if (data) (data as { type: string; in_app: boolean }[]).forEach((r) => { map[r.type] = r.in_app })
  return map as Record<NotificationType, boolean>
}

export async function upsertPreference(userId: string, type: NotificationType, inApp: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await (supabase as any)
    .from('notification_preferences')
    .upsert({ user_id: userId, type, in_app: inApp, updated_at: new Date().toISOString() }, { onConflict: 'user_id,type' })
  if (error) throw error
}
