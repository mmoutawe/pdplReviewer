/* Minimal reactive store — avoids Zustand/Redux dependency for a prototype.
 * Each slice is a plain object + subscribe/notify pattern.
 * Swap for a proper state library before production.
 */

import type { Ticket } from '../data/types'
import {
  NOTIFICATIONS as SEED_NOTIFS,
  TICKETS as SEED_TICKETS,
  USERS,
} from '../data/seed'

type Listener = () => void

function createStore<T extends object>(initial: T) {
  let state = { ...initial }
  const listeners = new Set<Listener>()

  function getState(): T { return state }
  function setState(partial: Partial<T>) {
    state = { ...state, ...partial }
    listeners.forEach((l) => l())
  }
  function subscribe(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  }
  return { getState, setState, subscribe }
}

// ─── Auth store ─────────────────────────────────────────────────────────────

const DEMO_USERS = USERS
const ACTIVE_USER_KEY = 'pdpl_active_user'
const savedUserId = sessionStorage.getItem(ACTIVE_USER_KEY)
const defaultUser = DEMO_USERS.find((u) => u.id === savedUserId) ?? DEMO_USERS.find((u) => u.role === 'data_management')!

export const authStore = createStore({
  user: defaultUser,
  isSignedIn: !!savedUserId,
})

export function signIn(userId: string) {
  const user = DEMO_USERS.find((u) => u.id === userId)
  if (!user) return
  sessionStorage.setItem(ACTIVE_USER_KEY, userId)
  authStore.setState({ user, isSignedIn: true })
}

export function signOut() {
  sessionStorage.removeItem(ACTIVE_USER_KEY)
  authStore.setState({ user: DEMO_USERS.find((u) => u.role === 'requester')!, isSignedIn: false })
}

// ─── Notification store ──────────────────────────────────────────────────────

export const notifStore = createStore({
  items: [...SEED_NOTIFS],
})

export function markNotifRead(id: string) {
  notifStore.setState({
    items: notifStore.getState().items.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
  })
}

export function markAllRead(userId: string) {
  notifStore.setState({
    items: notifStore.getState().items.map((n) =>
      n.userId === userId ? { ...n, read: true } : n
    ),
  })
}

export function unreadCount(userId: string): number {
  return notifStore.getState().items.filter((n) => n.userId === userId && !n.read).length
}

// ─── Ticket store ─────────────────────────────────────────────────────────────

export const ticketStore = createStore({
  tickets: [...SEED_TICKETS],
})

export function updateTicket(id: string, partial: Partial<Ticket>) {
  ticketStore.setState({
    tickets: ticketStore.getState().tickets.map((t) =>
      t.id === id ? { ...t, ...partial, updatedAt: new Date().toISOString() } : t
    ),
  })
}

// Draft persistence — autosave draft wizard state to sessionStorage
const DRAFT_KEY = 'pdpl_wizard_draft'
export function saveDraft(data: object) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)) } catch { /* noop */ }
}
export function loadDraft<T>(): T | null {
  try {
    const s = sessionStorage.getItem(DRAFT_KEY)
    return s ? (JSON.parse(s) as T) : null
  } catch { return null }
}
export function clearDraft() { sessionStorage.removeItem(DRAFT_KEY) }

// ─── Toast store ─────────────────────────────────────────────────────────────

export interface ToastItem {
  id: string
  message: string
  kind?: 'default' | 'success' | 'error' | 'info'
}

export const toastStore = createStore({ items: [] as ToastItem[] })

let _toastCounter = 0
export function showToast(message: string, kind: ToastItem['kind'] = 'default') {
  const id = `t-${++_toastCounter}`
  toastStore.setState({ items: [...toastStore.getState().items, { id, message, kind }] })
  setTimeout(() => {
    toastStore.setState({ items: toastStore.getState().items.filter((t) => t.id !== id) })
  }, 4000)
}

// ─── AI state ─────────────────────────────────────────────────────────────────

export interface AIStreamState {
  streaming: boolean
  tokens: string[]
  done: boolean
  error: string | null
}

export const aiStreamStore = createStore<AIStreamState>({
  streaming: false,
  tokens: [],
  done: false,
  error: null,
})

export function resetAIStream() {
  aiStreamStore.setState({ streaming: false, tokens: [], done: false, error: null })
}
