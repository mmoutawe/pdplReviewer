import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { randomUUID } from 'crypto'
import { dvPost, P } from '../lib/dataverse'
import { corsHeaders, handlePreflight, jsonOk, jsonError } from '../lib/cors'

export async function generateLinkHandler(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return handlePreflight()

  let ticketId: string, recipientEmail: string, expiresInHours: number
  try {
    const body = (await req.json()) as {
      ticketId: string
      recipientEmail: string
      expiresInHours?: number
    }
    ticketId = body.ticketId
    recipientEmail = body.recipientEmail
    expiresInHours = body.expiresInHours ?? 72
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!ticketId || !recipientEmail) {
    return jsonError(400, 'ticketId and recipientEmail are required')
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
  const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '')

  try {
    await dvPost(`${P}externallinks`, {
      [`${P}token`]:          token,
      [`${P}ticketid`]:       ticketId,
      [`${P}recipientemail`]: recipientEmail,
      [`${P}expiresat`]:      expiresAt,
      [`${P}status`]:         'pending',
      [`${P}revoked`]:        false,
    })
  } catch (err) {
    return jsonError(500, 'Failed to create external link', String(err))
  }

  return jsonOk({
    token,
    link:      `${appUrl}/external/${token}`,
    expiresAt,
  })
}

app.http('generateLink', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: generateLinkHandler,
})
