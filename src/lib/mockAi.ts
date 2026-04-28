/* Simulated AI streaming — mimics a streaming SSE gateway response.
 * Each call resolves to a token-by-token stream via an async generator.
 * Replace with a real fetch('/api/ai/stream', ...) in production.
 */

import { aiStreamStore, resetAIStream } from '../store'

const AVG_TOKEN_DELAY = 28 // ms per token

export async function* streamTokens(text: string): AsyncGenerator<string> {
  const tokens = text.split(/(\s+)/).filter(Boolean)
  for (const token of tokens) {
    await new Promise<void>((r) => setTimeout(r, AVG_TOKEN_DELAY + Math.random() * 20))
    yield token
  }
}

export async function runAIStream(
  text: string,
  onToken?: (t: string) => void,
): Promise<void> {
  resetAIStream()
  aiStreamStore.setState({ streaming: true, tokens: [], done: false, error: null })
  try {
    for await (const token of streamTokens(text)) {
      aiStreamStore.setState({
        tokens: [...aiStreamStore.getState().tokens, token],
      })
      onToken?.(token)
    }
    aiStreamStore.setState({ streaming: false, done: true })
  } catch (e) {
    aiStreamStore.setState({ streaming: false, done: true, error: String(e) })
  }
}

// Pre-canned responses keyed by prompt type

export const AI_CANNED: Record<string, string> = {
  policy_chat_pdpl29:
    'Under PDPL Article 29, a cross-border transfer of personal data is permissible only if the destination country provides an adequate level of protection, OR if appropriate safeguards are in place — such as Standard Contractual Clauses (SCCs), Binding Corporate Rules (BCRs), or a consent-based exemption for individual data subjects. For the UAE specifically, no formal adequacy decision has been issued by SDAIA as of this date, so SCCs or BCRs are the recommended mechanism. You should also check whether the data falls under the Article 30 residency requirement for critical-sector data, in which case a Saudi copy must be retained regardless of any transfer.',

  policy_chat_dpa:
    'A Data Processing Agreement (DPA) is required under PDPL Article 12 before disclosing personal data to any third-party processor. The DPA must specify: the subject matter and duration of processing, the nature and purpose, the type of personal data and categories of data subjects, and the obligations and rights of the controller. Per POL-VENDOR-002, Tier-1 vendors must have a signed DPA in place before any data flows.',

  reviewer_copilot_vendor_check:
    'Reviewing this vendor onboarding request, I highlight three items for your attention: (1) The DPA is signed and current — no issues. (2) SOC 2 Type II is within the 12-month validity window. (3) The key management section notes vendor-managed KMS; per POL-DATA-001, Restricted-class data should use customer-managed keys. I recommend conditioning approval on a BYOK migration commitment within 60 days. Legal should confirm the cross-border transfer mechanism is not triggered given the KSA-resident data centres. Security should validate the WAF and CDN posture independently.',

  document_chat_dpa:
    'Based on the uploaded DPA, the sub-processor list is in Exhibit B. The document grants Sahab Cloud the right to add sub-processors with 30-day advance notice; however, it does not include a controller right-of-objection or a no-fault termination right if an objection is raised. This is weaker than the standard required by POL-VENDOR-002. I recommend raising this gap in the review comments.',

  evaluate_reply_high:
    'Score: 87/100. The response directly addresses the reviewer\'s question regarding SCC Module 1 obligations, includes a verifiable contractual reference (SCC v2.docx, Clause 8.5), and attaches documentary evidence. Minor deduction: the 30-day SLA for data-subject rights mentioned is not explicitly cross-referenced to a specific clause in the attached document. To strengthen: quote the clause number in your reply.',

  evaluate_reply_low:
    'Score: 42/100. The response acknowledges the reviewer\'s concern but does not provide a concrete mechanism or documentary evidence. Phrases like "we will ensure compliance" are insufficient without a documented action plan, a named responsible party, and an attached evidence file. Please revise to include: (1) the specific transfer mechanism (SCC/BCR/adequacy), (2) a signed or draft DPA, (3) the sub-processor due-diligence packets.',

  request_builder_vendor:
    'I\'ve understood your request. You\'re onboarding a new cloud hosting vendor — Sahab Cloud — to process Restricted-class customer data (KYC and repayment records) for the InstaLend product. Let me structure this as a Vendor Onboarding & Data Processing Assessment. I\'ve pre-filled: vendor jurisdiction (KSA), data categories (name, national ID, IBAN, phone), legal basis (contract + consent), retention (7 years per SAMA KYC requirement), encryption (required at rest and in transit). Please review and confirm the sub-processor list and certifications before proceeding.',
}
