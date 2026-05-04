// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

export type ReviewerRequestType =
  | 'vendor_onboarding'
  | 'external_document_sharing'
  | 'data_sharing_external'
  | 'internal_data_access'
  | 'cross_border_transfer'

const SYSTEM_PROMPTS: Record<ReviewerRequestType, string> = {
  vendor_onboarding: `You are the Data Management deep reviewer for a VENDOR ONBOARDING ticket under Saudi PDPL.
Be strict but fair. Use the requester answers, the pre-submission AI output, and any document evidence.
For compliance_checks, evaluate purpose limitation, data minimization, cross-border, security, contractual safeguards.
For approval_guidance, recommend approve / return / escalate-legal / escalate-security and explain why.
Respond with a JSON object only using these exact top-level keys: executive_summary, data_classification, controller_processor_roles, risk_assessment, compliance_checks, issues, recommendations, approval_guidance.
- compliance_checks: array of objects, each with: area (string), status ("pass"|"concern"|"fail"), detail (string)
- approval_guidance: object with: recommendation ("approve"|"return"|"escalate-legal"|"escalate-security"), rationale (string)
- issues, recommendations: arrays of strings
- all other values: strings`,

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
  vendor_onboarding:        ['executive_summary', 'data_classification', 'controller_processor_roles', 'risk_assessment', 'compliance_checks', 'issues', 'recommendations', 'approval_guidance'],
  external_document_sharing:['document_classification', 'personal_data_analysis', 'sensitive_data_exposure', 'data_minimization_assessment', 'sharing_risk_analysis', 'compliance_issues', 'recommendations', 'approval_decision'],
  data_sharing_external:    ['data_classification', 'purpose_legitimacy', 'data_minimization_evaluation', 'transfer_risk', 'security_control_assessment', 'compliance_gaps', 'recommendations', 'approval_guidance'],
  internal_data_access:     ['access_justification_review', 'data_sensitivity', 'least_privilege_assessment', 'duration_scope_risk', 'policy_compliance', 'recommendations', 'approval_decision'],
  cross_border_transfer:    ['transfer_risk_assessment', 'destination_country_risk', 'legal_safeguards_check', 'data_sensitivity_impact', 'compliance_violations', 'required_legal_actions', 'approval_guidance'],
}

export const REVIEWER_SECTION_LABELS: Record<string, string> = {
  executive_summary:           'Executive Summary',
  data_classification:         'Data Classification',
  controller_processor_roles:  'Controller / Processor Roles',
  risk_assessment:             'Risk Assessment',
  compliance_checks:           'Compliance Checks',
  issues:                      'Issues',
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

export async function runReviewerAssessment(
  requestType: ReviewerRequestType,
  ticket: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const apiKey     = viteEnv.VITE_AZURE_OPENAI_KEY
  const base       = viteEnv.VITE_AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const deployment = viteEnv.VITE_AZURE_OPENAI_DEPLOYMENT ?? 'gpt-5.1-chat'
  if (!apiKey) throw new Error('VITE_AZURE_OPENAI_KEY not set')
  if (!base)   throw new Error('VITE_AZURE_OPENAI_ENDPOINT not set')

  const userMessage = `Reviewer deep-assessment.
Ticket:
${JSON.stringify(ticket, null, 2)}`

  const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[requestType] },
        { role: 'user',   content: userMessage },
      ],

      max_completion_tokens: 2048,
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
