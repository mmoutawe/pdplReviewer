import { apiGet, apiPost, setAuthToken } from '../lib/api'
import type { User } from '../data/types'

export async function apiSignIn(email: string, password: string): Promise<User> {
  const { token, user } = await apiPost<{ token: string; user: User }>('/auth/login', { email, password })
  setAuthToken(token)
  return user
}

export async function apiSignOut(): Promise<void> {
  setAuthToken(null)
}

export async function apiGetSession(): Promise<User | null> {
  try {
    return await apiGet<User>('/auth/me')
  } catch {
    return null
  }
}

export async function apiResetPassword(_email: string): Promise<void> {
  throw new Error('Please contact your administrator to reset your password.')
}

export async function apiUpdatePassword(newPassword: string): Promise<void> {
  await apiPost('/auth/change-password', { newPassword })
}

// Not needed for JWT auth — kept for interface compatibility
export function onAuthStateChange(_callback: (user: User | null) => void): () => void {
  return () => {}
}
