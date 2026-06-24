import { config } from '../lib/config'

export type PresubmitRequestType =
  | 'vendor_onboarding'
  | 'external_document_sharing'
  | 'data_sharing_external'
  | 'internal_data_access'
  | 'cross_border_transfer'

const SYSTEM_PROMPTS: Record<PresubmitRequestType, string> = {
  vendor_onboarding: `You are a Saudi PDPL pre-submission AI reviewer for a VENDOR ONBOARDING & DATA PROCESSING ASSESSMENT.
Your job is to give the requester a structured, friendly pre-check before submission.
Tailor every section to vendor onboarding (controller/processor classification, sub-processors,
cross-border hosting, ISO27001, DPA, security controls, breach response).
Each finding must include: short title, concrete detail (1-2 sentences), severity, and where useful a PDPL article reference.
Section values must be plain text, never nested code blocks. Findings should reference the requester's own answers.
Respond with a JSON object only. The JSON must have exactly these top-level keys: executive_summary, risk_level, inferred_roles, key_risks, missing_inputs, suggested_fixes.
- risk_level: one of "low", "medium", "high", "critical"
- inferred_roles: object with keys data_controller (string), data_processor (string), sub_processor (string) — infer each from the request context
- key_risks: array of objects, each with: title (string), detail (string), severity ("low"|"medium"|"high"|"critical"), article_ref (optional string like "PDPL Art. 28")
- suggested_fixes: array of objects, each with: title (string), detail (string)
- missing_inputs: array of strings
- executive_summary: string`,

  external_document_sharing: `You are a Saudi PDPL pre-submission AI reviewer for an EXTERNAL DOCUMENT SHARING REQUEST.
Tailor the analysis to documents being shared externally: classify document, detect personal/sensitive data,
flag data minimization issues, evaluate the recipient and destination, and list missing safeguards.
Each finding must be specific to the document content and recipient.
Respond with a JSON object only using these exact top-level keys: document_risk_summary, personal_data_detection, sensitive_data_presence, data_minimization_issues, sharing_risk, missing_safeguards.
- data_minimization_issues, missing_safeguards: arrays of strings
- all other values: strings`,

  data_sharing_external: `You are a Saudi PDPL pre-submission AI reviewer for DATA SHARING WITH EXTERNAL PARTIES.
Focus on data classification, lawful basis, minimization, recipient legitimacy, cross-border posture, and security controls.
Respond with a JSON object only using these exact top-level keys: data_sensitivity_classification, purpose_vs_necessity, data_minimization_check, cross_border_risk, security_readiness, missing_controls.
- missing_controls: array of strings
- all other values: strings`,

  internal_data_access: `You are a Saudi PDPL pre-submission AI reviewer for INTERNAL DATA ACCESS REQUESTS.
Focus on need-to-know, least privilege, duration of access, dataset sensitivity, and policy alignment.
Respond with a JSON object only using these exact top-level keys: access_justification_assessment, data_sensitivity_level, least_privilege_evaluation, duration_risk, policy_compliance_gaps.
- policy_compliance_gaps: array of strings
- all other values: strings`,

  cross_border_transfer: `You are a Saudi PDPL pre-submission AI reviewer for CROSS-BORDER DATA TRANSFER REQUESTS.
Focus on destination country risk (PDPL Art. 29), required safeguards (SCCs/BCRs/adequacy), and lawful transfer basis.
Respond with a JSON object only using these exact top-level keys: destination_risk_level, data_sensitivity, legal_safeguard_check, transfer_justification, missing_legal_controls.
- missing_legal_controls: array of strings
- all other values: strings`,
}

export const SECTION_ORDER: Record<PresubmitRequestType, string[]> = {
  vendor_onboarding:        ['executive_summary', 'risk_level', 'inferred_roles', 'key_risks', 'missing_inputs', 'suggested_fixes'],
  external_document_sharing:['document_risk_summary', 'personal_data_detection', 'sensitive_data_presence', 'data_minimization_issues', 'sharing_risk', 'missing_safeguards'],
  data_sharing_external:    ['data_sensitivity_classification', 'purpose_vs_necessity', 'data_minimization_check', 'cross_border_risk', 'security_readiness', 'missing_controls'],
  internal_data_access:     ['access_justification_assessment', 'data_sensitivity_level', 'least_privilege_evaluation', 'duration_risk', 'policy_compliance_gaps'],
  cross_border_transfer:    ['destination_risk_level', 'data_sensitivity', 'legal_safeguard_check', 'transfer_justification', 'missing_legal_controls'],
}

export const SECTION_LABELS: Record<string, string> = {
  executive_summary:               'Executive Summary',
  risk_level:                      'Overall Risk Level',
  inferred_roles:                  'Inferred Processing Roles',
  key_risks:                       'Key Risks',
  missing_inputs:                  'Missing Information',
  suggested_fixes:                 'Suggested Fixes',
  document_risk_summary:           'Document Risk Summary',
  personal_data_detection:         'Personal Data Detected',
  sensitive_data_presence:         'Sensitive Data',
  data_minimization_issues:        'Data Minimization Issues',
  sharing_risk:                    'Sharing Risk',
  missing_safeguards:              'Missing Safeguards',
  data_sensitivity_classification: 'Data Sensitivity Classification',
  purpose_vs_necessity:            'Purpose vs Necessity',
  data_minimization_check:         'Data Minimization Check',
  cross_border_risk:               'Cross-Border Risk',
  security_readiness:              'Security Readiness',
  missing_controls:                'Missing Controls',
  access_justification_assessment: 'Access Justification',
  data_sensitivity_level:          'Data Sensitivity Level',
  least_privilege_evaluation:      'Least Privilege Evaluation',
  duration_risk:                   'Duration Risk',
  policy_compliance_gaps:          'Policy Compliance Gaps',
  destination_risk_level:          'Destination Risk Level',
  data_sensitivity:                'Data Sensitivity',
  legal_safeguard_check:           'Legal Safeguard Check',
  transfer_justification:          'Transfer Justification',
  missing_legal_controls:          'Missing Legal Controls',
}

export async function runPresubmitAssessment(
  requestType: PresubmitRequestType,
  initiation: Record<string, unknown>,
  questionnaire: Record<string, unknown>,
  documentText?: string,
): Promise<Record<string, unknown>> {
  const apiKey     = config.openAiKey
  const base       = config.openAiEndpoint?.replace(/\/$/, '')
  const deployment = config.openAiDeployment

  if (!apiKey || !base) {
    return {
      riskLevel: 'medium',
      summary: 'AI pre-submission assessment is not configured. Set VITE_AZURE_OPENAI_KEY in .env.local to enable AI-assisted assessment. Your request will proceed to manual review.',
      flags: [],
      canProceed: true,
      aiConfigured: false,
    }
  }

  const userMessage = `Request type: ${requestType}
Initiation:
${JSON.stringify(initiation, null, 2)}
Questionnaire:
${JSON.stringify(questionnaire, null, 2)}
Document text excerpts (may be empty):
${(documentText ?? '').slice(0, 6000)}`

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
