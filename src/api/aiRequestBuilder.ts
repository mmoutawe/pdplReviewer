// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

export type RequestBuilderType =
  | 'vendor_onboarding'
  | 'external_document_sharing'
  | 'data_sharing_external'
  | 'internal_data_access'
  | 'cross_border_transfer'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RequestBuilderResult {
  title: string
  description: string
  vendorName?: string
  vendorJurisdiction?: string
  hasDPA?: boolean
  dataCategories?: string[]
  estimatedSubjects?: string
  retentionDays?: string
  crossBorder?: boolean
}

export interface ChatResponse {
  message: string
  result?: RequestBuilderResult
}

const COMMON_RULES = `CRITICAL CONVERSATION RULES:
- Ask ONE focused question at a time. Wait for the answer before continuing.
- Be conversational, friendly and concise. Do not overload the user.
- ATTACHMENTS: If the user uploads documents at any point, IMMEDIATELY scan them
  and try to pre-fill answers. After processing, summarise what you extracted in
  one sentence and then ONLY ask for fields that are still missing or ambiguous.
  Do not re-ask questions you can answer from the documents.
- Never invent answers. If unsure, ask.
- When you have enough information, call the relevant tool to submit the request.
- Do not call the tool until you have at least the minimum fields described below.
- Reply in the language the user writes to you in.`

const SYSTEM_PROMPTS: Record<RequestBuilderType, string> = {
  vendor_onboarding: `You are a Saudi PDPL Compliance assistant helping a requester create a Vendor Onboarding & Data Processing Assessment.
${COMMON_RULES}

Information to collect:
1. Vendor: name, registration country, contact email (existing or new).
2. Project: name and short description.
3. Engagement: title, purpose, business unit, sharing/processing location, hosting model.
4. Data processed: types of personal data, sensitivity, approximate volume, retention period.
5. Cross-border transfer (yes/no), and which country.
6. Vendor questionnaire highlights: roles (controller/processor/sub-processor), security (encryption, access control, ISO 27001), DPA in place, sub-processors.
Call submit_vendor_request when complete.`,

  external_document_sharing: `You are a Saudi PDPL Compliance assistant helping a requester create an External Document Sharing request.
${COMMON_RULES}

Information to collect:
1. Document: title, what it is, format (PDF/Word/etc.), and which department or system it comes from.
2. Recipient: organisation name, country, business relationship, why they need it.
3. Personal data inside: which categories (names, IDs, financial, health, etc.), approximate volume, sensitivity.
4. Purpose & legal basis for sharing.
5. Safeguards: redaction applied? NDA/contract in place? secure transfer channel?
6. Retention: how long the recipient may keep it.
This is NOT a vendor onboarding request - DO NOT ask vendor questionnaire questions.
Call submit_doc_sharing_request when complete.`,

  data_sharing_external: `You are a Saudi PDPL Compliance assistant helping a requester create a Data Sharing with External Parties request.
${COMMON_RULES}

Information to collect:
1. Dataset: name, what it contains, approximate record count, source system.
2. Personal data categories and sensitivity.
3. Recipient: organisation, country, role (controller / joint controller / processor), business purpose.
4. Frequency: one-off, periodic, real-time feed.
5. Transfer mechanism (SFTP, API, secure portal, encrypted file).
6. Cross-border: yes/no + destination + adequacy / standard contractual safeguards.
7. Legal basis, retention, deletion guarantee.
This is NOT a vendor onboarding request - DO NOT ask vendor questionnaire questions.
Call submit_data_sharing_request when complete.`,

  internal_data_access: `You are a Saudi PDPL Compliance assistant helping a requester create an Internal Data Access request.
${COMMON_RULES}

Information to collect:
1. Who needs access: user, team, or system, and their department.
2. Which dataset / system / table they need access to.
3. Access type (read, write, admin) and least-privilege scope.
4. Business justification: why they need it.
5. Sensitivity of the data.
6. Duration: temporary (with end date) or permanent.
7. Existing controls: MFA, audit logging, environment (prod / staging).
This is NOT a vendor request and there is no external recipient - DO NOT ask vendor or sharing questions.
Call submit_internal_access_request when complete.`,

  cross_border_transfer: `You are a Saudi PDPL Compliance assistant helping a requester create a Cross-Border Data Transfer request.
${COMMON_RULES}

Information to collect:
1. Destination country and the receiving entity (name, relationship).
2. Personal data categories transferred, sensitivity, volume.
3. Transfer purpose and legal basis.
4. Legal safeguards: SCCs, BCRs, adequacy decision, explicit consent.
5. Technical safeguards: encryption in transit/at rest, access control.
6. Frequency and duration.
7. Data subjects affected and notification status.
This is NOT a vendor request - DO NOT ask vendor questionnaire questions unless the receiving entity is a vendor being onboarded for the first time.
Call submit_cross_border_request when complete.`,
}

const RESULT_PARAMS = {
  type: 'object',
  properties: {
    title:              { type: 'string',                        description: 'Concise descriptive title (max 80 chars)' },
    description:        { type: 'string',                        description: 'Full formal description of the activity' },
    vendorName:         { type: 'string',                        description: 'Vendor or recipient legal name' },
    vendorJurisdiction: { type: 'string',                        description: 'Country of registration / destination country' },
    hasDPA:             { type: 'boolean',                       description: 'DPA, NDA, or equivalent safeguard in place' },
    dataCategories:     { type: 'array', items: { type: 'string' }, description: 'Personal data categories involved' },
    estimatedSubjects:  { type: 'string',                        description: 'Approximate number of data subjects as a string' },
    retentionDays:      { type: 'string',                        description: 'Retention period in days as a string' },
    crossBorder:        { type: 'boolean',                       description: 'Whether cross-border data transfer is involved' },
  },
  required: ['title', 'description'],
}

const TOOLS: Record<RequestBuilderType, object> = {
  vendor_onboarding:       { type: 'function', function: { name: 'submit_vendor_request',          description: 'Submit the completed vendor onboarding request',                       parameters: RESULT_PARAMS } },
  external_document_sharing: { type: 'function', function: { name: 'submit_doc_sharing_request',   description: 'Submit the completed external document sharing request',              parameters: RESULT_PARAMS } },
  data_sharing_external:   { type: 'function', function: { name: 'submit_data_sharing_request',    description: 'Submit the completed data sharing with external parties request',     parameters: RESULT_PARAMS } },
  internal_data_access:    { type: 'function', function: { name: 'submit_internal_access_request', description: 'Submit the completed internal data access request',                  parameters: RESULT_PARAMS } },
  cross_border_transfer:   { type: 'function', function: { name: 'submit_cross_border_request',    description: 'Submit the completed cross-border data transfer request',             parameters: RESULT_PARAMS } },
}

const CHAT_INIT = 'Hello, I would like to create this request. Please guide me through the required information.'

/**
 * Sends one turn to the AI request builder conversation.
 * Pass the full visible chat history; the initial trigger and system prompt are
 * prepended automatically. Returns either a follow-up question or a filled result.
 */
export async function chatWithRequestBuilder(
  requestType: RequestBuilderType,
  visibleMessages: ChatMessage[],
): Promise<ChatResponse> {
  const apiKey     = viteEnv.VITE_AZURE_OPENAI_KEY
  const base       = viteEnv.VITE_AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const deployment = viteEnv.VITE_AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4.1-mini'
  if (!apiKey) throw new Error('VITE_AZURE_OPENAI_KEY not set')
  if (!base)   throw new Error('VITE_AZURE_OPENAI_ENDPOINT not set')

  const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2024-12-01-preview`

  const messages = [
    { role: 'system',    content: SYSTEM_PROMPTS[requestType] },
    { role: 'user',      content: CHAT_INIT },
    ...visibleMessages,
  ]

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages,
      tools: [TOOLS[requestType]],
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Azure OpenAI error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const choice = data?.choices?.[0]

  if (choice?.finish_reason === 'tool_calls' && choice?.message?.tool_calls?.length > 0) {
    const args = JSON.parse(choice.message.tool_calls[0].function.arguments) as RequestBuilderResult
    return { message: '', result: args }
  }

  return { message: choice?.message?.content ?? '' }
}
