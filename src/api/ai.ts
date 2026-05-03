import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { aiStreamStore } from '../store'
import { streamTokens } from '../lib/mockAi'
import { resetAIStream } from '../store'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

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
  const apiKey     = viteEnv.VITE_AZURE_OPENAI_KEY
  const base       = viteEnv.VITE_AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const deployment = viteEnv.VITE_AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4.1-mini'
  if (!apiKey) throw new Error('VITE_AZURE_OPENAI_KEY not set')
  if (!base)   throw new Error('VITE_AZURE_OPENAI_ENDPOINT not set')

  const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2024-12-01-preview`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: AZURE_SYSTEM_PROMPT },
        { role: 'user',   content: message },
      ],
      temperature: 0.7,
      max_tokens: 1024,
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
 * - request_builder with VITE_GEMINI_API_KEY: calls Gemini directly from browser
 * - When Supabase is configured: calls the ai-stream Edge Function via SSE
 * - Otherwise: falls back to local mock streaming
 */
export async function streamAI(opts: AIStreamOptions): Promise<string> {
  // Route request_builder through Azure OpenAI whenever the key is available
  if (opts.feature === 'request_builder' && viteEnv.VITE_AZURE_OPENAI_KEY) {
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

  if (!isSupabaseConfigured || !supabase) {
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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const supabaseUrl = viteEnv.VITE_SUPABASE_URL
  const url = `${supabaseUrl}/functions/v1/ai-stream`

  aiStreamStore.setState({ streaming: true, tokens: [], done: false, error: null })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': viteEnv.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({
      feature: opts.feature,
      message: opts.message,
      ticketId: opts.ticketId,
      policyId: opts.policyId,
      context: opts.context,
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
 * Generates an external recipient link via the external-link Edge Function.
 */
export async function generateExternalLink(
  ticketId: string,
  recipientEmail: string,
  expiresInHours = 72,
): Promise<{ token: string; link: string; expiresAt: string }> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const supabaseUrl = viteEnv.VITE_SUPABASE_URL
  const url = `${supabaseUrl}/functions/v1/external-link/generate`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': viteEnv.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({ ticketId, recipientEmail, expiresInHours }),
  })

  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/**
 * Redeems an external link token (no auth required).
 */
export async function redeemExternalLink(token: string): Promise<{
  ticket: Record<string, unknown>
  expiresAt: string
  recipientEmail: string
  alreadyDecided: boolean
  decision: string | null
}> {
  const supabaseUrl = viteEnv.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Supabase not configured')

  const anonKey = viteEnv.VITE_SUPABASE_ANON_KEY

  const url = `${supabaseUrl}/functions/v1/external-link/redeem`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey ?? '' },
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
 */
export async function submitExternalDecision(
  token: string,
  decision: 'approve' | 'reject',
  notes?: string,
): Promise<void> {
  const supabaseUrl = viteEnv.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Supabase not configured')

  const anonKey = viteEnv.VITE_SUPABASE_ANON_KEY

  const url = `${supabaseUrl}/functions/v1/external-link/decide`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey ?? '' },
    body: JSON.stringify({ token, decision, notes }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? 'Failed to submit decision')
  }
}
