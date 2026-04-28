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

/**
 * Streams an AI response.
 * - When Supabase is configured: calls the ai-stream Edge Function via SSE
 * - Otherwise: falls back to local mock streaming
 */
export async function streamAI(opts: AIStreamOptions): Promise<string> {
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
