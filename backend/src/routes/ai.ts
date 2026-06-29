import { Router } from 'express'
import OpenAI, { AzureOpenAI } from 'openai'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function makeClient() {
  const key      = process.env.OPENAI_API_KEY ?? process.env.AZURE_OPENAI_KEY
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiVer   = process.env.AZURE_OPENAI_API_VERSION ?? '2025-04-01-preview'

  if (endpoint) {
    return new AzureOpenAI({
      apiKey:     key,
      endpoint,
      deployment: process.env.OPENAI_DEPLOYMENT ?? process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: apiVer,
    })
  }
  return new OpenAI({ apiKey: key })
}

const SYSTEM_PROMPTS: Record<string, string> = {
  pre_assessment: `You are a PDPL compliance reviewer at a Saudi FinTech organization. You are conducting a pre-assessment of a data processing activity submitted for review under the Personal Data Protection Law (PDPL, Royal Decree M/19, 2021). Analyze the ticket details and give a structured assessment covering: PDPL compliance gaps or risks (cite article numbers), whether a DPIA is required, legal basis adequacy, data minimization concerns, and recommended conditions or clarifications before approval. Be specific, cite relevant PDPL articles, and keep your response professional and actionable.`,

  copilot: `You are a PDPL compliance copilot for a Saudi FinTech organization. You assist reviewers (Data Management, Legal, Security teams) in assessing data processing activities under the Personal Data Protection Law (PDPL, Royal Decree M/19, 2021) and its implementing regulations. Answer questions clearly and concisely. Always cite relevant PDPL articles. If a question requires legal advice beyond PDPL interpretation, recommend consulting qualified legal counsel.`,

  document_chat: `You are a document analysis assistant specializing in PDPL compliance for Saudi FinTech organizations. You have been provided with a document (DPIA, contract, privacy notice, policy, or agreement). Analyze the document in the context of Saudi Personal Data Protection Law (PDPL, Royal Decree M/19, 2021) and answer questions about it. Identify compliance gaps, missing clauses, or risks where relevant.`,

  policy_chat: `You are a PDPL policy advisor for a Saudi FinTech organization. You help teams understand how organizational data policies apply to specific data processing activities. Answer questions about policy applicability, conflicts between policies, and how to align activities with both internal policies and PDPL requirements. Cite policy sections and PDPL articles as appropriate.`,

  evaluate_reply: `You are a PDPL compliance reviewer evaluating a requester's reply to clarification questions raised during the review of a data processing activity. Assess whether the reply adequately addresses the concerns raised. Identify any remaining gaps, confirm whether the response resolves compliance issues, and recommend whether the ticket can proceed to approval or requires further clarification. Cite PDPL articles where relevant.`,
}

// SSE streaming endpoint (replaces Azure Function aiStream)
router.post('/stream', requireAuth, async (req, res) => {
  const { feature, message, context } = req.body as {
    feature?: string
    message?: string
    context?: Record<string, unknown>
  }

  if (!message) { res.status(400).json({ error: 'message is required' }); return }

  const systemPrompt = SYSTEM_PROMPTS[feature ?? 'copilot'] ?? SYSTEM_PROMPTS.copilot
  const userContent  = context
    ? `${message}\n\n<context>${JSON.stringify(context, null, 2)}</context>`
    : message

  const deployment = process.env.OPENAI_DEPLOYMENT ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o'

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const client = makeClient()
    const stream = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent },
      ],
      stream:     true,
      max_tokens: 2048,
    })

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`)
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
  } finally {
    res.end()
  }
})

// Raw SSE streaming with caller-supplied messages array
router.post('/stream-raw', requireAuth, async (req, res) => {
  const { messages, max_tokens } = req.body as { messages?: unknown[]; max_tokens?: number }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' }); return
  }

  const deployment = process.env.OPENAI_DEPLOYMENT ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o'

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const client = makeClient()
    const stream = await client.chat.completions.create({
      model:      deployment,
      messages:   messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
      stream:     true,
      max_tokens: max_tokens ?? 2048,
    })

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`)
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
  } finally {
    res.end()
  }
})

// Non-streaming completion proxy (used by presubmit, checklist, reviewer, etc.)
router.post('/complete', requireAuth, async (req, res) => {
  const { messages, tools, tool_choice, response_format, max_tokens } = req.body as Record<string, unknown>

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' })
    return
  }

  const deployment = process.env.OPENAI_DEPLOYMENT ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o'

  try {
    const client = makeClient()
    const body: Record<string, unknown> = {
      model:      deployment,
      messages,
      max_tokens: max_tokens ?? 2048,
    }
    if (response_format) body.response_format = response_format
    if (tools)           body.tools           = tools
    if (tool_choice)     body.tool_choice     = tool_choice

    const result = await (client.chat.completions.create as unknown as (b: Record<string, unknown>) => Promise<unknown>)(body)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

export default router
