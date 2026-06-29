import { apiStreamMessages } from '../lib/api'

export interface AssistMessage {
  role: 'user' | 'assistant'
  content: string
}

const ROLE_GUIDANCE: Record<string, string> = {
  data_management: 'You are advising the Data Management Reviewer who orchestrates the entire PDPL review. They balance Legal, Security, and Requester input.',
  legal:           'You are advising the Legal Reviewer focused on PDPL articles, cross-border transfers, contracts, DPAs, and lawful basis.',
  security:        'You are advising the Security Reviewer focused on encryption, access control, hosting, ISO 27001, PDPL Article 19 controls.',
  admin:           'You are advising the Admin who has oversight of the full workflow.',
  requester:       "You are helping the requester understand the reviewer's request and what evidence to provide.",
}

export const ROLE_INITIAL_MESSAGES: Record<string, string> = {
  data_management: 'Ready to help you review this ticket. Ask me to draft a return comment, explain a PDPL requirement, or assess a specific risk.',
  legal:           'Legal assist ready. I can help you check cross-border transfer requirements, draft contract clauses, or cite specific PDPL articles.',
  security:        'Security assist ready. Ask me to evaluate encryption controls, list ISO 27001 gaps, or check PDPL Article 19 compliance.',
  admin:           'Admin assist ready. I have full context on this ticket and can help you coordinate the review workflow.',
  requester:       'I can help you understand what the reviewer is asking for and guide you on what evidence or information to provide.',
}

function buildSystemPrompt(reviewerRole: string, replierRole: string, ticketContext: string, seed?: string): string {
  const guidance = ROLE_GUIDANCE[reviewerRole] ?? ROLE_GUIDANCE.data_management
  return `${guidance}

${seed ? seed + '\n\n' : ''}You operate inside a PDPL (Saudi Personal Data Protection Law) compliance workflow.

Ticket and message context (JSON):
${ticketContext}

Your responsibilities:
1. Help the ${reviewerRole.replace('_', ' ')} reviewer respond effectively to the ${replierRole.replace('_', ' ')}'s message.
2. Be specific and actionable - draft text, list controls, cite PDPL articles when relevant.
3. Use markdown headings and short paragraphs. No filler.
4. When drafting a reply, format it clearly so it can be copied directly.
5. Never invent facts that aren't in the context. Flag missing information.`
}

export async function* streamReviewerAssist(
  reviewerRole: string,
  replierRole: string,
  ticketContext: string,
  history: AssistMessage[],
  seed?: string,
): AsyncGenerator<string> {
  yield* apiStreamMessages(
    [
      { role: 'system', content: buildSystemPrompt(reviewerRole, replierRole, ticketContext, seed) },
      ...history,
    ],
    1024,
  )
}
