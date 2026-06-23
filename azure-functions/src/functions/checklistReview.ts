import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { AzureOpenAI } from 'openai'
import { corsHeaders, handlePreflight, jsonOk, jsonError } from '../lib/cors'

const CHECKLIST_ITEMS = [
  { key: 'purposeIsClear',          label: 'Purpose of data sharing is clearly stated' },
  { key: 'dataIsNecessary',         label: 'Data included is necessary for the stated purpose' },
  { key: 'noExcessivePersonalData', label: 'No excessive personal data beyond requirements' },
  { key: 'recipientIsAppropriate',  label: 'Recipient is appropriate and verified' },
  { key: 'attachmentsReviewed',     label: 'All attachments have been reviewed' },
]

const SYSTEM_PROMPT = `You are a Saudi PDPL Data Management compliance reviewer.
Evaluate the request below against each checklist item. For each item, return:
- verdict: "pass" (clearly satisfied), "warn" (partially satisfied or unclear), or "fail" (clearly not satisfied)
- justification: ONE concise sentence (max 25 words) referencing concrete evidence from the data.
Be strict but fair. Use available AI assessments, questionnaire and document findings as evidence.`

const CHECKLIST_TOOL = {
  type: 'function' as const,
  function: {
    name: 'submit_checklist',
    description: 'Submit the checklist evaluation.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key:           { type: 'string' },
              verdict:       { type: 'string', enum: ['pass', 'warn', 'fail'] },
              justification: { type: 'string' },
            },
            required: ['key', 'verdict', 'justification'],
          },
        },
      },
      required: ['items'],
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

export async function checklistReviewHandler(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return handlePreflight()

  let ticketData: Record<string, unknown>
  try {
    const body = (await req.json()) as { ticketData: Record<string, unknown> }
    ticketData = body.ticketData ?? {}
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const itemsList   = CHECKLIST_ITEMS.map((i) => `${i.key} - ${i.label}`).join('\n')
  const userMessage = `Checklist items:\n${itemsList}\n\nRequest data:\n${JSON.stringify(ticketData, null, 2)}`

  try {
    const openai = makeOpenAIClient()
    const completion = await openai.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT!,
      messages:    [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      tools:       [CHECKLIST_TOOL],
      tool_choice: { type: 'function', function: { name: 'submit_checklist' } },
      max_tokens:  512,
    })

    const args = completion.choices[0]?.message?.tool_calls?.[0]?.function?.arguments
    if (!args) return jsonError(500, 'No checklist returned from model.')
    return jsonOk(JSON.parse(args))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(500, 'Checklist AI failed', msg)
  }
}

app.http('checklistReview', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: checklistReviewHandler,
})
