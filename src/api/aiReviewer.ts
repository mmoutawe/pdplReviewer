import { getDataverseToken } from './auth'
import { isDataverseConfigured } from '../lib/dataverse'
import { config } from '../lib/config'

export type ReviewerRequestType =
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
- document_findings: array of objects, each with: title (short finding label, e.g. "Cross-border Data Transfer"), detail (1–2 sentence explanation referencing document evidence), severity ("fail"|"warning"|"pass")
- compliance_checks: array of objects, each with: area (string), status ("pass"|"concern"|"fail"), detail (string)
- risk_assessment: array of objects, each with: risk (string title), detail (string explanation), priority ("high"|"medium"|"low")
- approval_guidance: object with: recommendation ("approve"|"return"|"escalate-legal"|"escalate-security"), rationale (string)
- controller_processor_roles: object with:
    questionnaire: { vendor_role: string, our_org_role: string, joint_controllers: boolean }
    document: { vendor_role: string, our_org_role: string, status: "confirmed"|"not_mentioned"|"contradicts", detail: string }
    match: boolean
    mismatch_note: string (empty string if match is true)
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

export const REVIEWER_SECTION_ORDER: Record<ReviewerRequestType, string[]> = {
  vendor_onboarding:        ['executive_summary', 'risk_assessment', 'compliance_checks', 'issues', 'recommendations', 'data_classification', 'approval_guidance'],
  external_document_sharing:['document_classification', 'personal_data_analysis', 'sensitive_data_exposure', 'data_minimization_assessment', 'sharing_risk_analysis', 'compliance_issues', 'recommendations', 'approval_decision'],
  data_sharing_external:    ['data_classification', 'purpose_legitimacy', 'data_minimization_evaluation', 'transfer_risk', 'security_control_assessment', 'compliance_gaps', 'recommendations', 'approval_guidance'],
  internal_data_access:     ['access_justification_review', 'data_sensitivity', 'least_privilege_assessment', 'duration_scope_risk', 'policy_compliance', 'recommendations', 'approval_decision'],
  cross_border_transfer:    ['transfer_risk_assessment', 'destination_country_risk', 'legal_safeguards_check', 'data_sensitivity_impact', 'compliance_violations', 'required_legal_actions', 'approval_guidance'],
}

export const REVIEWER_SECTION_LABELS: Record<string, string> = {
  executive_summary:           'Reviewer Copilot',
  data_classification:         'Data Classification',
  controller_processor_roles:  'Controller / Processor Roles',
  risk_assessment:             'Identified Risks',
  compliance_checks:           'Compliance Checks',
  issues:                      'Gaps Identified',
  recommendations:             'Recommendations',
  approval_guidance:           'Approval Guidance',
  document_classification:     'Document Classification',
  personal_data_analysis:      'Personal Data Analysis',
  sensitive_data_exposure:     'Sensitive Data Exposure',
  data_minimization_assessment:'Data Minimization Assessment',
  sharing_risk_analysis:       'Sharing Risk Analysis',
  compliance_issues:           'Compliance Issues',
  approval_decision:           'Approval Decision',
  purpose_legitimacy:          'Purpose Legitimacy',
  data_minimization_evaluation:'Data Minimization Evaluation',
  transfer_risk:               'Transfer Risk',
  security_control_assessment: 'Security Control Assessment',
  compliance_gaps:             'Compliance Gaps',
  access_justification_review: 'Access Justification Review',
  data_sensitivity:            'Data Sensitivity',
  least_privilege_assessment:  'Least Privilege Assessment',
  duration_scope_risk:         'Duration & Scope Risk',
  policy_compliance:           'Policy Compliance',
  transfer_risk_assessment:    'Transfer Risk Assessment',
  destination_country_risk:    'Destination Country Risk',
  legal_safeguards_check:      'Legal Safeguards Check',
  data_sensitivity_impact:     'Data Sensitivity Impact',
  compliance_violations:       'Compliance Violations',
  required_legal_actions:      'Required Legal Actions',
}

function demoReviewerResult(): Record<string, unknown> {
  return {
    executive_summary: 'AI assessment not available — set VITE_AZURE_OPENAI_KEY in .env.local to enable direct Azure OpenAI, or configure VITE_AF_BASE_URL with a /reviewerAssessment endpoint.',
    issues: [],
    recommendations: ['Complete the review manually using the checklist below.'],
    compliance_checks: [],
    risk_assessment: [],
    document_findings: [],
    approval_guidance: {
      recommendation: 'return',
      rationale: 'AI assessment is not configured. Manual review required.',
    },
  }
}

export async function runReviewerAssessment(
  requestType: ReviewerRequestType,
  ticket: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const apiKey     = config.openAiKey
  const base       = config.openAiEndpoint?.replace(/\/$/, '')
  const deployment = config.openAiDeployment
  const afBase     = config.afBaseUrl?.replace(/\/$/, '')

  const attachments = (ticket.attachments as Array<{ filename: string; category: string; classification: string; summary?: string }> | undefined) ?? []
  const attachmentBlock = attachments.length > 0
    ? `\n\n=== ATTACHED DOCUMENTS (${attachments.length}) ===\nYou MUST reference these documents in your analysis. Cross-reference each document summary against the questionnaire answers.\n${attachments.map((a, i) => `\nDocument ${i + 1}: ${a.filename}\nCategory: ${a.category ?? 'unknown'} | Classification: ${a.classification ?? 'unknown'}\nExtracted Summary:\n${a.summary ?? '(no extracted text — base analysis on filename and category only)'}`).join('\n---')}\n=== END DOCUMENTS ===`
    : '\n\nAttached Documents: none provided'

  const userMessage = `Reviewer deep-assessment.
Ticket:
${JSON.stringify({ ...ticket, attachments: undefined }, null, 2)}${attachmentBlock}`

  // Path 1: Direct Azure OpenAI (when VITE_AZURE_OPENAI_KEY is configured)
  if (apiKey && base) {
    const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[requestType] },
          { role: 'user',   content: userMessage },
        ],
        max_completion_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Azure OpenAI error ${response.status}: ${err}`)
    }
    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content ?? '{}'
    return JSON.parse(content) as Record<string, unknown>
  }

  // Path 2: Azure Functions (when VITE_AF_BASE_URL is configured)
  if (afBase && isDataverseConfigured) {
    const tok = await getDataverseToken()
    const res = await fetch(`${afBase}/reviewerAssessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ requestType, ticket: { ...ticket, systemPrompt: SYSTEM_PROMPTS[requestType] } }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Reviewer AI error ${res.status}: ${err}`)
    }
    return res.json() as Promise<Record<string, unknown>>
  }

  // Demo mode: neither key nor AF configured
  return demoReviewerResult()
}
