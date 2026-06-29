import { getAuthToken, startPolling } from '../lib/api'
import { aiStreamStore, resetAIStream } from '../store'
import { streamTokens } from '../lib/mockAi'

type AIFeature =
  | 'pre_assessment'
  | 'copilot'
  | 'document_chat'
  | 'policy_chat'
  | 'request_builder'
  | 'evaluate_reply'

interface AIStreamOptions {
  feature: AIFeature
  message: string
  ticketId?: string
  policyId?: string
  context?: Record<string, unknown>
  onToken?: (token: string) => void
}

export async function streamAI(opts: AIStreamOptions): Promise<string> {
  const token = getAuthToken()

  if (!token) {
    // Demo / unauthenticated mode — simulate streaming
    resetAIStream()
    aiStreamStore.setState({ streaming: true, tokens: [], done: false, error: null })
    let fullText = ''
    for await (const t of streamTokens(opts.message)) {
      fullText += t
      opts.onToken?.(t)
      aiStreamStore.setState({ tokens: [...aiStreamStore.getState().tokens, t] })
    }
    aiStreamStore.setState({ streaming: false, done: true })
    return fullText
  }

  resetAIStream()
  aiStreamStore.setState({ streaming: true, tokens: [], done: false, error: null })

  const response = await fetch('/api/ai/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      feature:  opts.feature,
      message:  opts.message,
      ticketId: opts.ticketId,
      policyId: opts.policyId,
      context:  opts.context,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    aiStreamStore.setState({ streaming: false, error: err, done: true })
    throw new Error(err)
  }

  const reader  = response.body!.getReader()
  const decoder = new TextDecoder()
  let fullText  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      try {
        const payload = JSON.parse(line.slice(6)) as { token?: string; done?: boolean; error?: string }
        if (payload.token) {
          fullText += payload.token
          opts.onToken?.(payload.token)
          aiStreamStore.setState({ tokens: [...aiStreamStore.getState().tokens, payload.token] })
        }
        if (payload.done) aiStreamStore.setState({ streaming: false, done: true })
        if (payload.error) aiStreamStore.setState({ streaming: false, done: true, error: payload.error })
      } catch { /* malformed SSE line */ }
    }
  }

  aiStreamStore.setState({ streaming: false, done: true })
  return fullText
}

export async function generateExternalLink(
  ticketId: string,
  recipientEmail: string,
  expiresInHours = 72,
): Promise<{ token: string; link: string; expiresAt: string }> {
  const token = getAuthToken()
  const res = await fetch('/api/links/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ ticketId, recipientEmail, expiresInHours }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function redeemExternalLink(token: string): Promise<{
  ticket: Record<string, unknown>
  expiresAt: string
  recipientEmail: string
  alreadyDecided: boolean
  decision: string | null
}> {
  const res = await fetch('/api/links/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
    throw new Error(err.error ?? 'Failed to redeem link')
  }
  return res.json()
}

export async function submitExternalDecision(
  token: string,
  decision: 'approve' | 'reject',
  notes?: string,
): Promise<void> {
  const res = await fetch('/api/links/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, decision, notes }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
    throw new Error(err.error ?? 'Failed to submit decision')
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export { startPolling }
