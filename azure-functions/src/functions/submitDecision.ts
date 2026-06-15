import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { dvGet, dvPatch, P } from '../lib/dataverse'
import { handlePreflight, jsonOk, jsonError } from '../lib/cors'

interface DvList {
  value: Record<string, unknown>[]
}

export async function submitDecisionHandler(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return handlePreflight()

  let token: string, decision: 'approve' | 'reject', notes: string | undefined
  try {
    const body = (await req.json()) as {
      token: string
      decision: 'approve' | 'reject'
      notes?: string
    }
    token    = body.token
    decision = body.decision
    notes    = body.notes
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!token) return jsonError(400, 'token is required')
  if (decision !== 'approve' && decision !== 'reject') {
    return jsonError(400, 'decision must be "approve" or "reject"')
  }

  let linkId: string
  try {
    const res = await dvGet<DvList>(
      `${P}externallinks?$filter=${P}token eq '${token}'&$top=1` +
      `&$select=${P}externallinkid`,
    )
    if (!res.value?.length) return jsonError(404, 'Invalid token')
    linkId = res.value[0][`${P}externallinkid`] as string
  } catch (err) {
    return jsonError(500, 'Dataverse error', String(err))
  }

  try {
    const patch: Record<string, unknown> = {
      [`${P}status`]:     decision,
      [`${P}approvedat`]: new Date().toISOString(),
    }
    if (notes) patch[`${P}notes`] = notes

    await dvPatch(`${P}externallinks(${linkId})`, patch)
  } catch (err) {
    return jsonError(500, 'Failed to record decision', String(err))
  }

  return jsonOk({})
}

app.http('submitDecision', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: submitDecisionHandler,
})
