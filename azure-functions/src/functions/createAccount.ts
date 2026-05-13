import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { dvPost, graphToken, P } from '../lib/dataverse'
import { handlePreflight, jsonOk, jsonError } from '../lib/cors'

function generateTempPassword(): string {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower  = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const rand   = (s: string) => s[Math.floor(Math.random() * s.length)]
  return (
    rand(upper) + rand(upper) +
    rand(lower) + rand(lower) +
    rand(digits) + rand(digits) +
    '!7'
  )
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export async function createAccountHandler(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return handlePreflight()

  let email: string, fullName: string, label: string | undefined
  try {
    const body = (await req.json()) as {
      email: string
      fullName: string
      label?: string
    }
    email    = body.email
    fullName = body.fullName
    label    = body.label
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!email || !fullName) return jsonError(400, 'email and fullName are required')

  const tempPassword = generateTempPassword()
  const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '')

  let gToken: string
  try {
    gToken = await graphToken()
  } catch (err) {
    return jsonError(500, 'Failed to acquire Graph token', String(err))
  }

  const mailNickname = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '.')

  const graphRes = await fetch('https://graph.microsoft.com/v1.0/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gToken}`,
    },
    body: JSON.stringify({
      accountEnabled:   true,
      displayName:      fullName,
      mailNickname,
      userPrincipalName: email,
      passwordProfile: {
        forceChangePasswordNextSignIn: true,
        password: tempPassword,
      },
      usageLocation: 'SA',
    }),
  })

  if (!graphRes.ok) {
    const detail = await graphRes.json().catch(() => ({}))
    return jsonError(400, 'Failed to create Entra ID user', detail)
  }

  const entraUser = (await graphRes.json()) as { id: string }

  try {
    await dvPost(`${P}users`, {
      [`${P}entraobjectid`]: entraUser.id,
      [`${P}fullname`]:      fullName,
      [`${P}email`]:         email,
      [`${P}role`]:          'external_recipient',
      [`${P}initials`]:      initials(fullName),
      ...(label ? { [`${P}label`]: label } : {}),
    })
  } catch (err) {
    return jsonError(500, 'Entra user created but Dataverse row failed', String(err))
  }

  return jsonOk({ tempPassword, portalUrl: appUrl })
}

app.http('createAccount', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: createAccountHandler,
})
