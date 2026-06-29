/* Reactive store — publish/subscribe pattern.
 *
 * When VITE_DATAVERSE_URL + VITE_MSAL_CLIENT_ID are set, the store
 * initializes from the live Dataverse environment and polls for updates.
 * Without those env vars it falls back to local seed data so the demo
 * works with zero backend setup.
 */

import type { Ticket, User, Role, ReturnThreadEntry, Vendor, Project, ExternalUserInvite } from '../data/types'
import {
  NOTIFICATIONS as SEED_NOTIFS,
  TICKETS as SEED_TICKETS,
  USERS,
} from '../data/seed'
import { isDataverseConfigured } from '../lib/dataverse'
import { fetchTickets } from '../api/tickets'
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, subscribeToNotifications } from '../api/notifications'
import { apiGetSession, apiSignOut, onAuthStateChange } from '../api/auth'

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

// ─── Auth store ──────────────────────────────────────────────────────────────

const ACTIVE_USER_KEY = 'pdpl_active_user'
const savedUserId = sessionStorage.getItem(ACTIVE_USER_KEY)
const defaultDemoUser = USERS.find((u) => u.id === savedUserId) ?? USERS.find((u) => u.role === 'data_management')!

export const authStore = createStore({
  user: defaultDemoUser,
  isSignedIn: !!savedUserId,
  loading: isDataverseConfigured,    // true while session check is in-flight
})

// Demo mode (no Dataverse): persona switcher
export function signIn(userId: string) {
  if (isDataverseConfigured) return  // use apiSignIn from auth.ts instead
  const user = USERS.find((u) => u.id === userId)
  if (!user) return
  sessionStorage.setItem(ACTIVE_USER_KEY, userId)
  authStore.setState({ user, isSignedIn: true })
  void loadUserData(user)
}

// Dataverse mode: admin-only role impersonation for testing
const IMPERSONATE_KEY = 'pdpl_impersonate_role'
export function impersonateRole(role: Role | null) {
  const { user } = authStore.getState()
  if (!user) return
  if (role) {
    sessionStorage.setItem(IMPERSONATE_KEY, role)
    authStore.setState({ user: { ...user, role } })
  } else {
    sessionStorage.removeItem(IMPERSONATE_KEY)
    // role will be restored on next session load — for now reflect real role from stored user
    authStore.setState({ user: { ...user, role: (sessionStorage.getItem('pdpl_real_role') as Role) ?? user.role } })
  }
}
export function getImpersonatedRole(): Role | null {
  return sessionStorage.getItem(IMPERSONATE_KEY) as Role | null
}

/** Called by the Setup page after creating the first admin profile via Dataverse. */
export function setAuthUser(user: User) {
  sessionStorage.setItem('pdpl_real_role', user.role)
  const impersonated = sessionStorage.getItem(IMPERSONATE_KEY) as Role | null
  authStore.setState({ user: impersonated ? { ...user, role: impersonated } : user, isSignedIn: true, loading: false })
  void loadUserData(user)
}

export function signOut() {
  if (isDataverseConfigured) {
    void apiSignOut().then(() => {
      sessionStorage.removeItem(ACTIVE_USER_KEY)
      authStore.setState({ user: USERS.find((u) => u.role === 'requester')!, isSignedIn: false })
    })
    return
  }
  sessionStorage.removeItem(ACTIVE_USER_KEY)
  authStore.setState({ user: USERS.find((u) => u.role === 'requester')!, isSignedIn: false })
}

// When Dataverse is configured, restore session on page load
if (isDataverseConfigured) {
  void apiGetSession().then((user) => {
    if (user) {
      sessionStorage.setItem('pdpl_real_role', user.role)
      const impersonated = sessionStorage.getItem(IMPERSONATE_KEY) as Role | null
      authStore.setState({ user: impersonated ? { ...user, role: impersonated } : user, isSignedIn: true, loading: false })
      void loadUserData(user)
    } else {
      authStore.setState({ loading: false })
    }
  })

  // Subscribe to auth state changes (sign in / sign out from another tab)
  onAuthStateChange((user) => {
    if (user) {
      sessionStorage.setItem('pdpl_real_role', user.role)
      const impersonated = sessionStorage.getItem(IMPERSONATE_KEY) as Role | null
      authStore.setState({ user: impersonated ? { ...user, role: impersonated } : user, isSignedIn: true })
      void loadUserData(user)
    } else {
      sessionStorage.removeItem('pdpl_real_role')
      sessionStorage.removeItem(IMPERSONATE_KEY)
      authStore.setState({ user: defaultDemoUser, isSignedIn: false })
    }
  })
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
  if (isDataverseConfigured) void markNotificationRead(id)
}

export function markAllRead(userId: string) {
  notifStore.setState({
    items: notifStore.getState().items.map((n) =>
      n.userId === userId ? { ...n, read: true } : n
    ),
  })
  if (isDataverseConfigured) void markAllNotificationsRead(userId)
}

export function unreadCount(userId: string): number {
  return notifStore.getState().items.filter((n) => n.userId === userId && !n.read).length
}

// ─── Ticket store ────────────────────────────────────────────────────────────

export const ticketStore = createStore({
  tickets: isDataverseConfigured ? [] as Ticket[] : [...SEED_TICKETS],
  loading: isDataverseConfigured,
})

export function updateTicket(id: string, partial: Partial<Ticket>) {
  ticketStore.setState({
    tickets: ticketStore.getState().tickets.map((t) =>
      t.id === id ? { ...t, ...partial, updatedAt: new Date().toISOString() } : t
    ),
  })
}

export function demoAddTicket(ticket: Ticket) {
  ticketStore.setState({ tickets: [ticket, ...ticketStore.getState().tickets] })
}

// ─── Dynamic vendor / project store (wizard-created records) ─────────────────

export const dynamicVendorStore = createStore({ vendors: [] as Vendor[] })
export const dynamicProjectStore = createStore({ projects: [] as Project[] })

export function demoAddVendor(vendor: Vendor) {
  dynamicVendorStore.setState({ vendors: [vendor, ...dynamicVendorStore.getState().vendors] })
}

export function demoAddProject(project: Project) {
  dynamicProjectStore.setState({ projects: [project, ...dynamicProjectStore.getState().projects] })
}

export function lookupVendor(id: string): Vendor | undefined {
  return dynamicVendorStore.getState().vendors.find((v) => v.id === id)
}

export function lookupProject(id: string): Project | undefined {
  return dynamicProjectStore.getState().projects.find((p) => p.id === id)
}

export function demoDeleteTicket(id: string) {
  ticketStore.setState({ tickets: ticketStore.getState().tickets.filter((t) => t.id !== id) })
}

export function demoAddReturnComment(ticketId: string, message: string, byRole: Role, byName: string) {
  const ticket = ticketStore.getState().tickets.find((t) => t.id === ticketId)
  if (!ticket) return
  const entry: ReturnThreadEntry = {
    id: crypto.randomUUID(),
    by: byName,
    byRole,
    message,
    createdAt: new Date().toISOString(),
  }
  updateTicket(ticketId, { returnThread: [...ticket.returnThread, entry] })
}

export async function refreshTickets() {
  if (!isDataverseConfigured) return
  ticketStore.setState({ loading: true })
  try {
    const tickets = await fetchTickets()
    ticketStore.setState({ tickets, loading: false })
  } catch {
    ticketStore.setState({ loading: false })
  }
}

// ─── Load user data (tickets + notifications) ────────────────────────────────

let _notifUnsubscribe: (() => void) | null = null

async function loadUserData(user: User) {
  if (!isDataverseConfigured) return

  // Tickets
  ticketStore.setState({ loading: true })
  try {
    const tickets = await fetchTickets()
    ticketStore.setState({ tickets, loading: false })
  } catch {
    ticketStore.setState({ loading: false })
  }

  // Notifications
  try {
    const items = await fetchNotifications(user.id)
    notifStore.setState({ items })
  } catch { /* noop */ }

  // Poll for new notifications
  _notifUnsubscribe?.()
  _notifUnsubscribe = subscribeToNotifications(user.id, (n) => {
    notifStore.setState({ items: [n, ...notifStore.getState().items] })
  })
}

// ─── External user demo registration ─────────────────────────────────────────
export function registerExternalUser(invite: ExternalUserInvite, fullName: string): void {
  const initials = fullName.trim().split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
  const newUser: User = {
    id: `u-ext-${Date.now()}`,
    fullName: fullName.trim(),
    email: invite.recipientEmail,
    role: 'external_user',
    department: 'External',
    jobTitle: 'External User',
    initials,
    avatarColor: '#6366f1',
    isActive: true,
  }
  authStore.setState({ user: newUser, isSignedIn: true, loading: false })
}

// ─── Draft persistence ───────────────────────────────────────────────────────

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

// ─── AI stream store ─────────────────────────────────────────────────────────

export interface AIStreamState {
  streaming: boolean
  tokens: string[]
  done: boolean
  error: string | null
}

export const aiStreamStore = createStore<AIStreamState>({
  streaming: false, tokens: [], done: false, error: null,
})

export function resetAIStream() {
  aiStreamStore.setState({ streaming: false, tokens: [], done: false, error: null })
}
