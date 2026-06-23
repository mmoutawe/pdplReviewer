import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { AzureOpenAI } from 'openai'
import { corsHeaders, handlePreflight, jsonOk, jsonError } from '../lib/cors'

const TOOL_DEF = {
  type: 'function' as const,
  function: {
    name: 'submit_reply_evaluation',
    description: 'Submit the structured evaluation of the requester reply.',
    parameters: {
      type: 'object',
      properties: {
        overall_score:    { type: 'number',                         description: 'Composite score 0-100 for how well the reply addresses all concerns.' },
        resolved_points:  { type: 'array', items: { type: 'string' }, description: 'Concerns that are now fully addressed.' },
        open_concerns:    { type: 'array', items: { type: 'string' }, description: 'Concerns that remain unaddressed or partially addressed.' },
        new_requirements: { type: 'array', items: { type: 'string' }, description: 'New requirements or gaps surfaced by the reply.' },
        document_review:  {
          type: ['object', 'null'],
          description: 'Evaluation of any attached documents. null if no documents were mentioned.',
          properties: {
            present:        { type: 'boolean' },
            appears_signed: { type: 'boolean' },
            relevant:       { type: 'boolean' },
          },
          required: ['present', 'appears_signed', 'relevant'],
        },
        recommendation: { type: 'string', enum: ['accept', 'return_again', 'escalate'] },
        summary:        { type: 'string', description: 'One-paragraph human-readable summary of the evaluation.' },
      },
      required: ['overall_score', 'resolved_points', 'open_concerns', 'new_requirements', 'recommendation', 'summary'],
    },
  },
}

function makeOpenAIClient(): AzureOpenAI {
  return new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: '2025-04-01-preview',
  })
}

function buildSystemPrompt(roleLabel: string, reviewerComment: string, ticketContext: string, attachmentContext: string): string {
  return `You are a PDPL compliance review assistant. A previous message in a review thread raised concerns. The ${roleLabel} has now replied. Your job is to evaluate whether their reply AND any attached documents adequately address the open concerns and to flag what is still missing.

Original concern raised: "${reviewerComment}"

Ticket context: ${ticketContext}

IMPORTANT evaluation rules:
- If the message asked for a signed document, check if an attachment is present and whether it appears to be a signed version.
- If specific information was asked for, check BOTH the reply text and the attachment contents for that information.
- If the ${roleLabel} raised NEW concerns or requirements, describe them clearly.
- If no attachments were provided but the original request implied documents were needed, flag this as unresolved.
${attachmentContext}

Evaluate the ${roleLabel}'s reply and attachments, then return a structured assessment using the provided tool.`
}

export async function evaluateReplyHandler(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return handlePreflight()

  let roleLabel: string, reviewerComment: string, requesterReply: string,
      ticketContext: string, attachments: Array<{ filename: string; extractedSummary?: string | null }>
  try {
    const body = (await req.json()) as {
      roleLabel: string
      reviewerComment: string
      requesterReply: string
      ticketContext: string
      attachments: Array<{ filename: string; extractedSummary?: string | null }>
    }
    roleLabel       = body.roleLabel       ?? ''
    reviewerComment = body.reviewerComment ?? ''
    requesterReply  = body.requesterReply  ?? ''
    ticketContext   = body.ticketContext   ?? ''
    attachments     = body.attachments    ?? []
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const attachmentContext = attachments.length
    ? `\nAttachments provided:\n${attachments.map((a) => `- ${a.filename}${a.extractedSummary ? ': ' + a.extractedSummary : ''}`).join('\n')}`
    : ''

  const systemPrompt = buildSystemPrompt(roleLabel, reviewerComment, ticketContext, attachmentContext)
  const userMessage  = `${roleLabel}'s reply: "${requesterReply}"`

  try {
    const openai = makeOpenAIClient()
    const completion = await openai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT!,
      messages:    [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      tools:       [TOOL_DEF],
      tool_choice: { type: 'function', function: { name: 'submit_reply_evaluation' } },
      max_tokens:  1024,
    })

    const args = completion.choices[0]?.message?.tool_calls?.[0]?.function?.arguments
    if (!args) return jsonError(500, 'No evaluation returned from model.')
    return jsonOk(JSON.parse(args))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(500, 'Reply evaluation AI failed', msg)
  }
}

app.http('evaluateReply', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: evaluateReplyHandler,
})
