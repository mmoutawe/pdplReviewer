import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { AzureOpenAI } from 'openai'
import { corsHeaders, handlePreflight, jsonOk, jsonError } from '../lib/cors'

type ReviewerRequestType =
  | 'vendor_onboarding'
  | 'external_document_sharing'
  | 'data_sharing_external'
  | 'internal_data_access'
  | 'cross_border_transfer'

const SYSTEM_PROMPTS: Record<ReviewerRequestType, string> = {
  vendor_onboarding: `You are the Data Management deep reviewer for a VENDOR ONBOARDING ticket under Saudi PDPL.
Be strict but fair. Use the requester answers and any attached document evidence provided in the ticket.
If attachments are present, cross-reference each document (DPA, SOC2, contracts, etc.) against the questionnaire answers and highlight discrepancies.
For controller_processor_roles, compare what the questionnaire states versus what the documents say — flag mismatches.
For compliance_checks, evaluate purpose limitation, data minimization, cross-border transfer, security controls, and contractual safeguards.
For approval_guidance, recommend approve / return / escalate-legal / escalate-security and explain why, referencing specific document findings where relevant.
For document_findings, extract 3–6 specific, concrete compliance findings directly from the attached documents. Each finding must reference specific document content. If no documents are provided, return an empty array.
Respond with a JSON object only using these exact top-level keys: executive_summary, data_classification, controller_processor_roles, risk_assessment, compliance_checks, issues, recommendations, approval_guidance, document_findings.
- document_findings: array of objects, each with: title (short finding label), detail (1–2 sentence explanation referencing document evidence), severity ("fail"|"warning"|"pass")
- compliance_checks: array of objects, each with: area (string), status ("pass"|"concern"|"fail"), detail (string)
- risk_assessment: array of objects, each with: risk (string title), detail (string explanation), priority ("high"|"medium"|"low")
- approval_guidance: object with: recommendation ("approve"|"return"|"escalate-legal"|"escalate-security"), rationale (string)
- controller_processor_roles: object with: questionnaire: { vendor_role: string, our_org_role: string, joint_controllers: boolean }, document: { vendor_role: string, our_org_role: string, status: "confirmed"|"not_mentioned"|"contradicts", detail: string }, match: boolean, mismatch_note: string
- issues, recommendations: arrays of strings
- executive_summary, data_classification: strings`,

  external_document_sharing: `You are the Data Management deep reviewer for an EXTERNAL DOCUMENT SHARING ticket under Saudi PDPL.
Be specific and actionable. Reference the document content where possible.
Respond with a JSON object only using these exact top-level keys: document_classification, personal_data_analysis, sensitive_data_exposure, data_minimization_assessment, sharing_risk_analysis, compliance_issues, recommendations, approval_decision.
- compliance_issues, recommendations: arrays of strings
- approval_decision: object with: recommendation ("approve"|"return"|"escalate-legal"|"escalate-security"), rationale (string)
- all other values: strings`,

  data_sharing_external: `You are the Data Management deep reviewer for a DATA SHARING WITH EXTERNAL PARTIES ticket under Saudi PDPL.
Respond with a JSON object only using these exact top-level keys: data_classification, purpose_legitimacy, data_minimization_evaluation, transfer_risk, security_control_assessment, compliance_gaps, recommendations, approval_guidance.
- compliance_gaps, recommendations: arrays of strings
- approval_guidance: object with: recommendation ("approve"|"return"|"escalate-legal"|"escalate-security"), rationale (string)
- all other values: strings`,

  internal_data_access: `You are the Data Management deep reviewer for an INTERNAL DATA ACCESS REQUEST under Saudi PDPL.
Respond with a JSON object only using these exact top-level keys: access_justification_review, data_sensitivity, least_privilege_assessment, duration_scope_risk, policy_compliance, recommendations, approval_decision.
- recommendations: array of strings
- approval_decision: object with: recommendation ("approve"|"return"|"escalate-legal"|"escalate-security"), rationale (string)
- all other values: strings`,

  cross_border_transfer: `You are the Data Management deep reviewer for a CROSS-BORDER DATA TRANSFER REQUEST under Saudi PDPL Art. 29.
Respond with a JSON object only using these exact top-level keys: transfer_risk_assessment, destination_country_risk, legal_safeguards_check, data_sensitivity_impact, compliance_violations, required_legal_actions, approval_guidance.
- compliance_violations, required_legal_actions: arrays of strings
- approval_guidance: object with: recommendation ("approve"|"return"|"escalate-legal"|"escalate-security"), rationale (string)
- all other values: strings`,
}

function makeOpenAIClient(): AzureOpenAI {
  return new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: '2025-04-01-preview',
  })
}

export async function reviewerAssessmentHandler(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') return handlePreflight()

  let requestType: ReviewerRequestType, ticket: Record<string, unknown>
  try {
    const body = (await req.json()) as { requestType: ReviewerRequestType; ticket: Record<string, unknown> }
    requestType = body.requestType
    ticket = body.ticket ?? {}
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!requestType) return jsonError(400, 'requestType is required')

  const { systemPrompt: _sp, ...ticketData } = ticket as Record<string, unknown> & { systemPrompt?: string }
  const systemPrompt = SYSTEM_PROMPTS[requestType] ?? SYSTEM_PROMPTS.vendor_onboarding

  const attachments = (ticketData.attachments as Array<{ filename: string; category?: string; classification?: string; summary?: string }> | undefined) ?? []
  const attachmentBlock = attachments.length > 0
    ? `\n\n=== ATTACHED DOCUMENTS (${attachments.length}) ===\nYou MUST reference these documents in your analysis.\n${attachments.map((a, i) =>
        `\nDocument ${i + 1}: ${a.filename}\nCategory: ${a.category ?? 'unknown'} | Classification: ${a.classification ?? 'unknown'}\nExtracted Summary:\n${a.summary ?? '(no extracted text)'}`
      ).join('\n---')}\n=== END DOCUMENTS ===`
    : '\n\nAttached Documents: none provided'

  const userMessage = `Reviewer deep-assessment.\nTicket:\n${JSON.stringify({ ...ticketData, attachments: undefined }, null, 2)}${attachmentBlock}`

  try {
    const openai = makeOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    })
    const content = completion.choices[0]?.message?.content ?? '{}'
    return jsonOk(JSON.parse(content))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(500, 'Reviewer AI assessment failed', msg)
  }
}

app.http('reviewerAssessment', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: reviewerAssessmentHandler,
})
