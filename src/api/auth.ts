import { supabase, toUser } from '../lib/supabase'
import type { User } from '../data/types'

export async function apiSignIn(email: string, password: string): Promise<User> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single()
  if (profileError) throw profileError

  return toUser(profile)
}

export async function apiSignOut(): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function apiGetSession(): Promise<User | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return profile ? toUser(profile) : null
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) { callback(null); return }
    const { data: profile } = await supabase!
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
    callback(profile ? toUser(profile) : null)
  })
  return () => subscription.unsubscribe()
}
