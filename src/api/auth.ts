import {
  PublicClientApplication,
  EventType,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser'
import { dvList, isDataverseConfigured, initDataverseTokenProvider, T, toUser } from '../lib/dataverse'
import type { User } from '../data/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env as Record<string, string | undefined>

const clientId  = env.VITE_MSAL_CLIENT_ID  ?? ''
const tenantId  = env.VITE_MSAL_TENANT_ID  ?? 'common'
const dvUrl     = env.VITE_DATAVERSE_URL   ?? ''

// Scopes needed to call the Dataverse Web API
const DV_SCOPES = dvUrl ? [`${dvUrl}/.default`] : []

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
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
  // The user's object ID from Entra ID is used as the Dataverse user record's ID
  const rows = await dvList<Record<string, unknown>>(
    T.users,
    `$filter=pdplr_entraobjectid eq '${account.localAccountId}'&$top=1`,
  )
  if (!rows.length) return null
  return toUser(rows[0])
}

// ── Public API ─────────────────────────────────────────────

/**
 * Triggers the Entra ID login popup.
 * The `email` param is used as a login hint so the right account is pre-filled.
 * The `password` param is ignored — authentication is handled by Entra ID.
 */
export async function apiSignIn(email: string, _password: string): Promise<User> {
  if (!isDataverseConfigured) throw new Error('Dataverse not configured')

  const result: AuthenticationResult = await msalInstance.loginPopup({
    scopes: DV_SCOPES,
    loginHint: email,
  })

  const profile = await fetchUserProfile(result.account)
  if (!profile) throw new Error('User profile not found in Dataverse. Contact your administrator.')
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
    return await fetchUserProfile(accounts[0])
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
