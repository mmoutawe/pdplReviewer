import { isDataverseConfigured } from '../lib/dataverse'
import { getDataverseToken } from './auth'
import { aiStreamStore } from '../store'
import { streamTokens } from '../lib/mockAi'
import { resetAIStream } from '../store'
import { config } from '../lib/config'

// Legacy Power Automate flow URLs (superseded by config.afBaseUrl in production)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _legacyEnv = (import.meta as any).env as Record<string, string | undefined>

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

const AZURE_SYSTEM_PROMPT = `You are a PDPL compliance intake assistant for a Saudi FinTech organization operating under the Personal Data Protection Law (Royal Decree M/19, 2021).

Given a freeform description of a data processing activity, extract the relevant fields and respond with ONLY valid JSON — no markdown, no code fences, no explanations, nothing before or after the JSON object.

The JSON must have exactly these keys:
{
  "title": "concise specific title, max 80 chars",
  "description": "formal complete description of the data processing activity",
  "dataCategories": ["array", "of", "data category strings"],
  "estimatedSubjects": "number as string, e.g. 5000",
  "crossBorder": true or false,
  "hasDPA": true or false,
  "legalBasis": "legal basis under PDPL with article reference",
  "notes": "PDPL compliance observations, relevant article numbers, risks"
}`

async function callAzureOpenAI(message: string): Promise<string> {
  const apiKey     = config.openAiKey
  const base       = config.openAiEndpoint?.replace(/\/$/, '')
  const deployment = config.openAiDeployment
  if (!apiKey) throw new Error('VITE_AZURE_OPENAI_KEY not set')
  if (!base)   throw new Error('VITE_AZURE_OPENAI_ENDPOINT not set')

  const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: AZURE_SYSTEM_PROMPT },
        { role: 'user',   content: message },
      ],
      max_completion_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Azure OpenAI error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

/**
 * Streams an AI response.
 * - request_builder with VITE_AZURE_OPENAI_KEY: calls Azure OpenAI directly
 * - When Dataverse is configured: calls the VITE_PA_AI_STREAM_URL Power Automate flow via SSE
 * - Otherwise: falls back to local mock streaming
 */
export async function streamAI(opts: AIStreamOptions): Promise<string> {
  // Route request_builder through Azure OpenAI whenever the key is available
  if (opts.feature === 'request_builder' && config.openAiKey) {
    resetAIStream()
    aiStreamStore.setState({ streaming: true, tokens: [], done: false, error: null })
    try {
      const text = await callAzureOpenAI(opts.message)
      opts.onToken?.(text)
      aiStreamStore.setState({ tokens: [text], streaming: false, done: true })
      return text
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      aiStreamStore.setState({ streaming: false, done: true, error: msg })
      throw err
    }
  }

  const afBase = config.afBaseUrl?.replace(/\/$/, '')
  const paStreamUrl = afBase ? `${afBase}/aiStream` : _legacyEnv.VITE_PA_AI_STREAM_URL
  if (!isDataverseConfigured || !paStreamUrl) {
    // Demo mode: simulate token-by-token streaming
    resetAIStream()
    aiStreamStore.setState({ streaming: true, tokens: [], done: false, error: null })
    let fullText = ''
    for await (const token of streamTokens(opts.message)) {
      fullText += token
      opts.onToken?.(token)
      aiStreamStore.setState({ tokens: [...aiStreamStore.getState().tokens, token] })
    }
    aiStreamStore.setState({ streaming: false, done: true })
    return fullText
  }

  const tok = await getDataverseToken()

  aiStreamStore.setState({ streaming: true, tokens: [], done: false, error: null })

  const response = await fetch(paStreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tok}`,
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

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const payload = JSON.parse(line.slice(6))
        if (payload.token) {
          fullText += payload.token
          opts.onToken?.(payload.token)
          aiStreamStore.setState({
            tokens: [...aiStreamStore.getState().tokens, payload.token],
          })
        }
        if (payload.done) {
          aiStreamStore.setState({ streaming: false, done: true })
        }
      } catch {
        // malformed SSE line — skip
      }
    }
  }

  aiStreamStore.setState({ streaming: false, done: true })
  return fullText
}

/**
 * Generates an external recipient link via a Power Automate HTTP-triggered flow.
 * Set VITE_PA_EL_GENERATE_URL to the flow's HTTP trigger URL.
 */
export async function generateExternalLink(
  ticketId: string,
  recipientEmail: string,
  expiresInHours = 72,
): Promise<{ token: string; link: string; expiresAt: string }> {
  const afBase = config.afBaseUrl?.replace(/\/$/, '')
  const url = afBase ? `${afBase}/generateLink` : _legacyEnv.VITE_PA_EL_GENERATE_URL
  if (!url) throw new Error('VITE_AF_BASE_URL is not configured')

  const tok = await getDataverseToken()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tok}`,
    },
    body: JSON.stringify({ ticketId, recipientEmail, expiresInHours }),
  })

  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/**
 * Redeems an external link token (no auth required).
 * Set VITE_PA_EL_REDEEM_URL to the flow's HTTP trigger URL.
 */
export async function redeemExternalLink(token: string): Promise<{
  ticket: Record<string, unknown>
  expiresAt: string
  recipientEmail: string
  alreadyDecided: boolean
  decision: string | null
}> {
  const afBase = config.afBaseUrl?.replace(/\/$/, '')
  const url = afBase ? `${afBase}/redeemLink` : _legacyEnv.VITE_PA_EL_REDEEM_URL
  if (!url) throw new Error('VITE_AF_BASE_URL is not configured')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? 'Failed to redeem link')
  }
  return res.json()
}

/**
 * Records an external recipient's decision.
 * Set VITE_PA_EL_DECIDE_URL to the flow's HTTP trigger URL.
 */
export async function submitExternalDecision(
  token: string,
  decision: 'approve' | 'reject',
  notes?: string,
): Promise<void> {
  const afBase = config.afBaseUrl?.replace(/\/$/, '')
  const url = afBase ? `${afBase}/submitDecision` : _legacyEnv.VITE_PA_EL_DECIDE_URL
  if (!url) throw new Error('VITE_AF_BASE_URL is not configured')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, decision, notes }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? 'Failed to submit decision')
  }
}
