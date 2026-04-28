import { supabase, toNotification } from '../lib/supabase'
import type { Notification } from '../data/types'

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('ts', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []).map(toNotification)
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.from('notifications').update({ read: true })
    .eq('user_id', userId).eq('read', false)
}

export function subscribeToNotifications(
  userId: string,
  onNew: (n: Notification) => void,
) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`notif:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      onNew(toNotification(payload.new as Parameters<typeof toNotification>[0]))
    })
    .subscribe()

  return () => { void supabase!.removeChannel(channel) }
}
