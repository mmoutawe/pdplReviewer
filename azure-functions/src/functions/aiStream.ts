import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { AzureOpenAI } from 'openai'
import { corsHeaders, handlePreflight, jsonError } from '../lib/cors'

type AIFeature = 'pre_assessment' | 'copilot' | 'document_chat' | 'policy_chat' | 'evaluate_reply'

const SYSTEM_PROMPTS: Record<AIFeature, string> = {
  pre_assessment: `You are a PDPL compliance reviewer at a Saudi FinTech organization. You are conducting a pre-assessment of a data processing activity submitted for review under the Personal Data Protection Law (PDPL, Royal Decree M/19, 2021).

Analyze the ticket details provided and give a structured assessment covering:
1. PDPL compliance gaps or risks (cite article numbers)
2. Whether a Data Protection Impact Assessment (DPIA) is required
3. Legal basis adequacy
4. Data minimization concerns
5. Recommended conditions or clarifications before approval

Be specific, cite relevant PDPL articles, and keep your response professional and actionable.`,

  copilot: `You are a PDPL compliance copilot for a Saudi FinTech organization. You assist reviewers (Data Management, Legal, Security teams) in assessing data processing activities under the Personal Data Protection Law (PDPL, Royal Decree M/19, 2021) and its implementing regulations.

Answer questions clearly and concisely. Always cite relevant PDPL articles. If a question requires legal advice beyond PDPL interpretation, recommend consulting qualified legal counsel.`,

  document_chat: `You are a document analysis assistant specializing in PDPL compliance for Saudi FinTech organizations. You have been provided with a document (DPIA, contract, privacy notice, policy, or agreement).

Analyze the document in the context of Saudi Personal Data Protection Law (PDPL, Royal Decree M/19, 2021) and answer questions about it. Identify compliance gaps, missing clauses, or risks where relevant.`,

  policy_chat: `You are a PDPL policy advisor for a Saudi FinTech organization. You help teams understand how organizational data policies apply to specific data processing activities.

Answer questions about policy applicability, conflicts between policies, and how to align activities with both internal policies and PDPL requirements. Cite policy sections and PDPL articles as appropriate.`,

  evaluate_reply: `You are a PDPL compliance reviewer evaluating a requester's reply to clarification questions raised during the review of a data processing activity.

Assess whether the reply adequately addresses the concerns raised. Identify any remaining gaps, confirm whether the response resolves compliance issues, and recommend whether the ticket can proceed to approval or requires further clarification. Cite PDPL articles where relevant.`,
}

function makeOpenAIClient(): AzureOpenAI {
  return new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: '2025-04-01-preview',
  })
}

export async function aiStreamHandler(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return handlePreflight()

  let feature: AIFeature, message: string, context: Record<string, unknown> | undefined
  try {
    const body = (await req.json()) as {
      feature: AIFeature
      message: string
      ticketId?: string
      policyId?: string
      context?: Record<string, unknown>
    }
    feature = body.feature
    message = body.message
    context = body.context
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!message) return jsonError(400, 'message is required')

  const systemPrompt = SYSTEM_PROMPTS[feature] ?? SYSTEM_PROMPTS.copilot

  const userContent = context
    ? `${message}\n\n<context>${JSON.stringify(context, null, 2)}</context>`
    : message

  const openai = makeOpenAIClient()

  const stream = await openai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    stream: true,
    max_tokens: 2048,
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content ?? ''
          if (token) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
    body: readable,
  }
}

app.http('aiStream', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: aiStreamHandler,
})
