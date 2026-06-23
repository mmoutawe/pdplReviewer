import {
  PublicClientApplication,
  EventType,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser'
import { dvList, dvCreate, dvUpdate, isDataverseConfigured, initDataverseTokenProvider, T, toUser } from '../lib/dataverse'
import type { User } from '../data/types'
import { config } from '../lib/config'

const AVATAR_COLORS = ['#0B5FFF', '#5B21B6', '#047857', '#B45309', '#0E7490', '#9333EA']

// Scopes needed to call the Dataverse Web API
const DV_SCOPES = config.dataverseUrl ? [`${config.dataverseUrl}/.default`] : []

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId:    config.msalClientId,
    authority:   `https://login.microsoftonline.com/${config.msalTenantId}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
})

// Wire up the token provider for the Dataverse client
initDataverseTokenProvider(async () => {
  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) throw new Error('No MSAL account — user must sign in first')
  const result = await msalInstance.acquireTokenSilent({
    scopes: DV_SCOPES,
    account: accounts[0],
  })
  return result.accessToken
})

// ── User profile lookup ────────────────────────────────────

async function fetchUserProfile(account: AccountInfo): Promise<User | null> {
  // Primary lookup: by Entra Object ID (fast path after first sign-in)
  const rows = await dvList<Record<string, unknown>>(
    T.users,
    `$filter=pdplr_entraobjectid eq '${account.localAccountId}'&$top=1`,
  )
  if (rows.length) return toUser(rows[0])

  // First sign-in: admin pre-created the record with email only — match by email
  // then stamp the Entra Object ID so future lookups use the fast path
  const byEmail = await dvList<Record<string, unknown>>(
    T.users,
    `$filter=pdplr_email eq '${account.username.toLowerCase()}'&$top=1`,
  )
  if (!byEmail.length) return null

  const record = byEmail[0]
  const recordId = record['pdplr_userid'] as string
  await dvUpdate(T.users, recordId, { pdplr_entraobjectid: account.localAccountId })
  return toUser({ ...record, pdplr_entraobjectid: account.localAccountId })
}

// ── First-run setup ────────────────────────────────────────

/** Returns true when no users exist in Dataverse — safe to call after MSAL login. */
export async function checkIsFirstSetup(): Promise<boolean> {
  if (!isDataverseConfigured) return false
  const rows = await dvList<unknown>(T.users, '$top=1&$select=pdplr_userid')
  return rows.length === 0
}

/** Creates the first admin account after MSAL authentication. */
export async function createAdminProfile(
  account: AccountInfo,
  fields: { fullName: string; department: string; jobTitle: string },
): Promise<User> {
  const inits = fields.fullName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  const row = await dvCreate<Record<string, unknown>>(T.users, {
    pdplr_entraobjectid: account.localAccountId,
    pdplr_email:         account.username.toLowerCase(),
    pdplr_fullname:      fields.fullName.trim(),
    pdplr_role:          'admin',
    pdplr_department:    fields.department.trim(),
    pdplr_jobtitle:      fields.jobTitle.trim(),
    pdplr_initials:      inits,
    pdplr_avatarcolor:   avatarColor,
  })
  return toUser(row)
}

// ── Public API ─────────────────────────────────────────────

/**
 * Triggers the Entra ID login popup.
 * The `email` param is used as a login hint so the right account is pre-filled.
 * The `password` param is ignored — authentication is handled by Entra ID.
 */
export async function apiSignIn(email: string, _password: string): Promise<User> {
  if (!isDataverseConfigured) throw new Error('Dataverse not configured')

  await msalInstance.initialize()

  const result: AuthenticationResult = await msalInstance.loginPopup({
    scopes: DV_SCOPES,
    loginHint: email,
  })

  const profile = await fetchUserProfile(result.account)
  if (!profile) throw new Error('User profile not found in Dataverse. Contact your administrator.')
  if (profile.isActive === false) throw new Error('Your account has been deactivated. Contact your administrator.')
  return profile
}

export async function apiSignOut(): Promise<void> {
  const accounts = msalInstance.getAllAccounts()
  await msalInstance.logoutPopup({
    account: accounts[0] ?? undefined,
    postLogoutRedirectUri: window.location.origin,
  })
}

export async function apiGetSession(): Promise<User | null> {
  if (!isDataverseConfigured) return null

  await msalInstance.initialize()
  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) return null

  try {
    // Refresh token silently to verify session is still valid
    await msalInstance.acquireTokenSilent({ scopes: DV_SCOPES, account: accounts[0] })
    const profile = await fetchUserProfile(accounts[0])
    if (profile?.isActive === false) return null   // treat deactivated as not signed in
    return profile
  } catch {
    return null
  }
}

/**
 * Redirects to the Entra ID self-service password reset flow.
 * Password management is handled by Microsoft Entra ID, not by the app.
 */
export async function apiResetPassword(_email: string): Promise<void> {
  await msalInstance.loginRedirect({
    scopes: [],
    extraQueryParameters: { prompt: 'login' },
  })
}

/**
 * Password updates are managed via Entra ID.
 * This redirects the user to the Microsoft account security page.
 */
export async function apiUpdatePassword(_newPassword: string): Promise<void> {
  window.open('https://mysignins.microsoft.com/security-info', '_blank')
}

/**
 * Subscribe to auth state changes (sign-in / sign-out from any tab).
 * Returns a cleanup function.
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const id = msalInstance.addEventCallback(async (message) => {
    if (message.eventType === EventType.LOGIN_SUCCESS) {
      const payload = message.payload as AuthenticationResult | null
      if (!payload?.account) return
      const profile = await fetchUserProfile(payload.account)
      callback(profile)
    }
    if (
      message.eventType === EventType.LOGOUT_SUCCESS ||
      message.eventType === EventType.LOGOUT_FAILURE
    ) {
      callback(null)
    }
  })

  return () => {
    if (id) msalInstance.removeEventCallback(id)
  }
}

/** Exposed so other modules can get a fresh Dataverse token directly */
export async function getDataverseToken(): Promise<string> {
  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) throw new Error('Not authenticated')
  const result = await msalInstance.acquireTokenSilent({
    scopes: DV_SCOPES,
    account: accounts[0],
  })
  return result.accessToken
}
