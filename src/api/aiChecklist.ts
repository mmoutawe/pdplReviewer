import { apiComplete } from '../lib/api'

export type ChecklistVerdict = 'pass' | 'warn' | 'fail'

export interface ChecklistItem {
  key:           string
  verdict:       ChecklistVerdict
  justification: string
}

export interface ChecklistResult { items: ChecklistItem[] }

const CHECKLIST_ITEMS = [
  { key: 'purposeIsClear',         label: 'Purpose of data sharing is clearly stated' },
  { key: 'dataIsNecessary',        label: 'Data included is necessary for the stated purpose' },
  { key: 'noExcessivePersonalData',label: 'No excessive personal data beyond requirements' },
  { key: 'recipientIsAppropriate', label: 'Recipient is appropriate and verified' },
  { key: 'attachmentsReviewed',    label: 'All attachments have been reviewed' },
]

const CHECKLIST_SYSTEM = `You are a Saudi PDPL Data Management compliance reviewer. Evaluate the request below against each checklist item. For each item, return: - verdict: "pass" (clearly satisfied), "warn" (partially satisfied or unclear), or "fail" (clearly not satisfied) - justification: ONE concise sentence (max 25 words) referencing concrete evidence from the data. Be strict but fair.`

const CHECKLIST_TOOL = {
  type: 'function',
  function: {
    name: 'submit_checklist',
    description: 'Submit the checklist evaluation.',
    parameters: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, verdict: { type: 'string', enum: ['pass','warn','fail'] }, justification: { type: 'string' } }, required: ['key','verdict','justification'] } } },
      required: ['items'],
    },
  },
}

export async function runChecklistReview(ticketData: Record<string, unknown>): Promise<ChecklistResult> {
  const itemsList = CHECKLIST_ITEMS.map((i) => `${i.key} - ${i.label}`).join('\n')
  const result = await apiComplete({
    messages: [
      { role: 'system', content: CHECKLIST_SYSTEM },
      { role: 'user',   content: `Checklist items:\n${itemsList}\n\nRequest data:\n${JSON.stringify(ticketData, null, 2)}` },
    ],
    tools:       [CHECKLIST_TOOL],
    tool_choice: { type: 'function', function: { name: 'submit_checklist' } },
    max_tokens:  512,
  })
  const args = (result as { choices: { message: { tool_calls: { function: { arguments: string } }[] } }[] }).choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!args) throw new Error('No checklist returned from model.')
  return JSON.parse(args) as ChecklistResult
}

export const CHECKLIST_LABELS: Record<string, string> = {
  purposeIsClear:'Purpose is clear', dataIsNecessary:'Data is necessary',
  noExcessivePersonalData:'No excessive data', recipientIsAppropriate:'Recipient is appropriate',
  attachmentsReviewed:'Attachments reviewed',
}

// ── Document Validator ────────────────────────────────────────────────────────

export interface DocValidationResult {
  relevant: boolean; expired: boolean | null; effective_date: string | null
  expiry_date: string | null; excerpt: string; summary: string; reason: string
}

const DOC_VALIDATOR_TOOL = {
  type: 'function',
  function: {
    name: 'submit_document_validation',
    description: 'Submit the document validation result.',
    parameters: {
      type: 'object',
      properties: {
        relevant:       { type: 'boolean' },
        expired:        { type: ['boolean','null'] },
        effective_date: { type: ['string','null'] },
        expiry_date:    { type: ['string','null'] },
        excerpt:        { type: 'string' },
        summary:        { type: 'string' },
        reason:         { type: 'string' },
      },
      required: ['relevant','expired','effective_date','expiry_date','excerpt','summary','reason'],
    },
  },
}

export async function validateQuestionnaireDocument(opts: {
  questionKey: string; questionLabel: string; documentText: string
}): Promise<DocValidationResult> {
  const today = new Date().toISOString().slice(0, 10)
  const system = `You are a PDPL compliance document validator. Determine whether an uploaded supporting document is RELEVANT to a specific compliance question, and whether it is currently VALID. Question key: ${opts.questionKey}. Question text: ${opts.questionLabel}. Detect effective_date and expiry_date. expired = true if expiry_date is before today (${today}). expired = null if not time-bound.`

  const result = await apiComplete({
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: opts.documentText.slice(0, 6000) },
    ],
    tools:       [DOC_VALIDATOR_TOOL],
    tool_choice: { type: 'function', function: { name: 'submit_document_validation' } },
    max_tokens:  512,
  })
  const args = (result as { choices: { message: { tool_calls: { function: { arguments: string } }[] } }[] }).choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!args) throw new Error('No validation returned from model.')
  return JSON.parse(args) as DocValidationResult
}

// ── Form Extraction ───────────────────────────────────────────────────────────

export interface ExtractedRequest {
  title: string; description: string; vendorName: string; vendorJurisdiction: string
  hasDPA: boolean; dataCategories: string[]; estimatedSubjects: string
  retentionDays: string; crossBorder: boolean; consentObtained: boolean; tags: string
}

const FORM_EXTRACT_TOOL = {
  type: 'function',
  function: {
    name: 'extract_request_data',
    description: 'Extract structured PDPL compliance request data from the form.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' }, description: { type: 'string' }, vendorName: { type: 'string' },
        vendorJurisdiction: { type: 'string' }, hasDPA: { type: 'boolean' },
        dataCategories: { type: 'array', items: { type: 'string' } },
        estimatedSubjects: { type: 'string' }, retentionDays: { type: 'string' },
        crossBorder: { type: 'boolean' }, consentObtained: { type: 'boolean' }, tags: { type: 'string' },
      },
      required: ['title','description'],
    },
  },
}

const FORM_EXTRACT_SYSTEM = `You extract PDPL compliance review request data from uploaded request forms. The document has three columns: Section, Field, Value. Use the Value column to populate the structured output. Always call the extract_request_data tool.`

export async function extractRequestForm(documentText: string): Promise<ExtractedRequest> {
  const result = await apiComplete({
    messages: [
      { role: 'system', content: FORM_EXTRACT_SYSTEM },
      { role: 'user',   content: documentText.slice(0, 8000) },
    ],
    tools:       [FORM_EXTRACT_TOOL],
    tool_choice: { type: 'function', function: { name: 'extract_request_data' } },
    max_tokens:  1024,
  })
  const args = (result as { choices: { message: { tool_calls: { function: { arguments: string } }[] } }[] }).choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!args) throw new Error('No extraction returned from model.')
  return JSON.parse(args) as ExtractedRequest
}
