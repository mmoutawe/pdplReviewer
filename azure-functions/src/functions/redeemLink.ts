import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { dvGet, P } from '../lib/dataverse'
import { handlePreflight, jsonOk, jsonError } from '../lib/cors'

interface DvRow {
  [key: string]: unknown
}
interface DvList {
  value: DvRow[]
}

export async function redeemLinkHandler(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return handlePreflight()

  let token: string
  try {
    const body = (await req.json()) as { token: string }
    token = body.token
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!token) return jsonError(400, 'token is required')

  let link: DvRow
  try {
    const res = await dvGet<DvList>(
      `${P}externallinks?$filter=${P}token eq '${token}'&$top=1`,
    )
    if (!res.value?.length) return jsonError(404, 'Invalid or expired link')
    link = res.value[0]
  } catch (err) {
    return jsonError(500, 'Dataverse error', String(err))
  }

  if (link[`${P}revoked`] === true) {
    return jsonError(403, 'This link has been revoked')
  }

  const expiresAt = link[`${P}expiresat`] as string | null
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return jsonError(410, 'This link has expired')
  }

  const ticketNumber = link[`${P}ticketid`] as string
  let ticket: DvRow | null = null
  try {
    const tRes = await dvGet<DvList>(
      `${P}tickets?$filter=${P}ticketnumber eq '${ticketNumber}'&$top=1` +
      `&$select=${P}ticketnumber,${P}type,${P}state,${P}title,${P}description`,
    )
    ticket = tRes.value?.[0] ?? null
  } catch {
    // non-fatal — return link data without ticket details
  }

  const status = link[`${P}status`] as string
  return jsonOk({
    token,
    expiresAt,
    recipientEmail:  link[`${P}recipientemail`],
    alreadyDecided:  status !== 'pending',
    decision:        status !== 'pending' ? status : null,
    ticket,
  })
}

app.http('redeemLink', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: redeemLinkHandler,
})
