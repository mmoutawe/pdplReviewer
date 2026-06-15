// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

// ── A.1  Checklist Review ─────────────────────────────────────────────────────

export type ChecklistVerdict = 'pass' | 'warn' | 'fail'

export interface ChecklistItem {
  key:           string
  verdict:       ChecklistVerdict
  justification: string
}

export interface ChecklistResult {
  items: ChecklistItem[]
}

const CHECKLIST_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'purposeIsClear',        label: 'Purpose of data sharing is clearly stated' },
  { key: 'dataIsNecessary',       label: 'Data included is necessary for the stated purpose' },
  { key: 'noExcessivePersonalData', label: 'No excessive personal data beyond requirements' },
  { key: 'recipientIsAppropriate', label: 'Recipient is appropriate and verified' },
  { key: 'attachmentsReviewed',   label: 'All attachments have been reviewed' },
]

const CHECKLIST_SYSTEM = `You are a Saudi PDPL Data Management compliance reviewer.
Evaluate the request below against each checklist item. For each item, return:
- verdict: "pass" (clearly satisfied), "warn" (partially satisfied or unclear), or "fail" (clearly not satisfied)
- justification: ONE concise sentence (max 25 words) referencing concrete evidence from the data.
Be strict but fair. Use available AI assessments, questionnaire and document findings as evidence.`

const CHECKLIST_TOOL = {
  type: 'function',
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

export async function runChecklistReview(
  ticketData: Record<string, unknown>,
): Promise<ChecklistResult> {
  const apiKey     = viteEnv.VITE_AZURE_OPENAI_KEY
  const base       = viteEnv.VITE_AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const deployment = viteEnv.VITE_AZURE_OPENAI_DEPLOYMENT ?? 'gpt-5.1-chat'
  if (!apiKey) throw new Error('VITE_AZURE_OPENAI_KEY not set')
  if (!base)   throw new Error('VITE_AZURE_OPENAI_ENDPOINT not set')

  const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`

  const itemsList = CHECKLIST_ITEMS.map((i) => `${i.key} - ${i.label}`).join('\n')
  const userMessage = `Checklist items:\n${itemsList}\n\nRequest data:\n${JSON.stringify(ticketData, null, 2)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: CHECKLIST_SYSTEM },
        { role: 'user',   content: userMessage },
      ],
      tools:       [CHECKLIST_TOOL],
      tool_choice: { type: 'function', function: { name: 'submit_checklist' } },

      max_completion_tokens:  512,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Azure OpenAI error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!args) throw new Error('No checklist returned from model.')
  return JSON.parse(args) as ChecklistResult
}

export const CHECKLIST_LABELS: Record<string, string> = {
  purposeIsClear:         'Purpose is clear',
  dataIsNecessary:        'Data is necessary',
  noExcessivePersonalData: 'No excessive data',
  recipientIsAppropriate: 'Recipient is appropriate',
  attachmentsReviewed:    'Attachments reviewed',
}

// ── A.2  Questionnaire Document Validator ─────────────────────────────────────

export interface DocValidationResult {
  relevant:       boolean
  expired:        boolean | null
  effective_date: string | null
  expiry_date:    string | null
  excerpt:        string
  summary:        string
  reason:         string
}

const DOC_VALIDATOR_TOOL = {
  type: 'function',
  function: {
    name: 'submit_document_validation',
    description: 'Submit the document validation result.',
    parameters: {
      type: 'object',
      properties: {
        relevant:       { type: 'boolean',        description: 'Document directly substantiates a Yes answer to the question.' },
        expired:        { type: ['boolean', 'null'], description: 'True if expired, false if valid, null if not time-bound.' },
        effective_date: { type: ['string', 'null'], description: 'Effective/issued date in YYYY-MM-DD format.' },
        expiry_date:    { type: ['string', 'null'], description: 'Expiry date in YYYY-MM-DD format.' },
        excerpt:        { type: 'string',          description: 'Most relevant 1-3 sentences from the document.' },
        summary:        { type: 'string',          description: 'One sentence describing what the document is.' },
        reason:         { type: 'string',          description: 'One sentence explaining relevance/expiry verdict.' },
      },
      required: ['relevant', 'expired', 'effective_date', 'expiry_date', 'excerpt', 'summary', 'reason'],
    },
  },
}

function buildDocValidatorSystem(questionKey: string, questionLabel: string, today: string): string {
  return `You are a PDPL compliance document validator.
You must determine whether an uploaded supporting document is RELEVANT to a specific compliance question, and whether it is currently VALID (not expired).

Question key: ${questionKey}
Question text: ${questionLabel}

Rules:
- "relevant" = true ONLY if the document content directly substantiates a "Yes" answer to that specific question (e.g. an ISO 27001 certificate for an ISO 27001 question, a signed DPA for a DPA question).
- Detect any effective_date and expiry_date you can find in the text (ISO format YYYY-MM-DD if possible).
- expired = true if expiry_date is before today (${today}).
- expired = null if the document is not time-bound (e.g. a policy document with no expiry).
- excerpt: the most relevant 1-3 sentences from the document that justify the verdict.
- summary: one sentence describing what the document is.
- reason: one sentence explaining why it is relevant/irrelevant or expired/valid.`
}

export async function validateQuestionnaireDocument(opts: {
  questionKey:   string
  questionLabel: string
  documentText:  string
}): Promise<DocValidationResult> {
  const { questionKey, questionLabel, documentText } = opts

  const apiKey     = viteEnv.VITE_AZURE_OPENAI_KEY
  const base       = viteEnv.VITE_AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const deployment = viteEnv.VITE_AZURE_OPENAI_DEPLOYMENT ?? 'gpt-5.1-chat'
  if (!apiKey) throw new Error('VITE_AZURE_OPENAI_KEY not set')
  if (!base)   throw new Error('VITE_AZURE_OPENAI_ENDPOINT not set')

  const today = new Date().toISOString().slice(0, 10)
  const url   = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: buildDocValidatorSystem(questionKey, questionLabel, today) },
        { role: 'user',   content: documentText.slice(0, 6000) },
      ],
      tools:       [DOC_VALIDATOR_TOOL],
      tool_choice: { type: 'function', function: { name: 'submit_document_validation' } },

      max_completion_tokens:  512,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Azure OpenAI error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!args) throw new Error('No validation returned from model.')
  return JSON.parse(args) as DocValidationResult
}

// ── A.3  Request Form Extraction ──────────────────────────────────────────────

export interface ExtractedRequest {
  title:              string
  description:        string
  vendorName:         string
  vendorJurisdiction: string
  hasDPA:             boolean
  dataCategories:     string[]
  estimatedSubjects:  string
  retentionDays:      string
  crossBorder:        boolean
  consentObtained:    boolean
  tags:               string
}

const FORM_EXTRACT_TOOL = {
  type: 'function',
  function: {
    name: 'extract_request_data',
    description: 'Extract structured PDPL compliance request data from the form.',
    parameters: {
      type: 'object',
      properties: {
        title:              { type: 'string',  description: 'Concise descriptive title, max 80 chars.' },
        description:        { type: 'string',  description: 'Full formal description of the data processing activity.' },
        vendorName:         { type: 'string',  description: 'Vendor or recipient legal name.' },
        vendorJurisdiction: { type: 'string',  description: 'Country of registration.' },
        hasDPA:             { type: 'boolean', description: 'DPA or equivalent safeguard in place.' },
        dataCategories:     { type: 'array', items: { type: 'string' }, description: 'Personal data categories involved.' },
        estimatedSubjects:  { type: 'string',  description: 'Approximate number of data subjects as a string.' },
        retentionDays:      { type: 'string',  description: 'Retention period in days as a string.' },
        crossBorder:        { type: 'boolean', description: 'Whether cross-border data transfer is involved.' },
        consentObtained:    { type: 'boolean', description: 'Whether data subject consent has been obtained.' },
        tags:               { type: 'string',  description: 'Comma-separated compliance tags.' },
      },
      required: ['title', 'description'],
    },
  },
}

const FORM_EXTRACT_SYSTEM = `You extract PDPL compliance review request data from uploaded request forms. The document is the contents of an Excel template with three columns: Section, Field, Value. Use the Value column to populate the structured output. For fields the user left blank, use sensible defaults: empty strings, false for booleans, "other" for unknown enums, and "no" for yes/no/partially fields. Always call the extract_request_data tool with the complete structured object.`

export async function extractRequestForm(documentText: string): Promise<ExtractedRequest> {
  const apiKey     = viteEnv.VITE_AZURE_OPENAI_KEY
  const base       = viteEnv.VITE_AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const deployment = viteEnv.VITE_AZURE_OPENAI_DEPLOYMENT ?? 'gpt-5.1-chat'
  if (!apiKey) throw new Error('VITE_AZURE_OPENAI_KEY not set')
  if (!base)   throw new Error('VITE_AZURE_OPENAI_ENDPOINT not set')

  const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: FORM_EXTRACT_SYSTEM },
        { role: 'user',   content: documentText.slice(0, 8000) },
      ],
      tools:       [FORM_EXTRACT_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_request_data' } },

      max_completion_tokens:  1024,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Azure OpenAI error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!args) throw new Error('No extraction returned from model.')
  return JSON.parse(args) as ExtractedRequest
}
