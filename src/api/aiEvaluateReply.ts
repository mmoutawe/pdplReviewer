import { apiComplete } from '../lib/api'

export interface ReplyEvaluation {
  overall_score:     number
  resolved_points:   string[]
  open_concerns:     string[]
  new_requirements:  string[]
  document_review:   { present: boolean; appears_signed: boolean; relevant: boolean } | null
  recommendation:    'accept' | 'return_again' | 'escalate'
  summary:           string
}

const TOOL_DEF = {
  type: 'function',
  function: {
    name: 'submit_reply_evaluation',
    description: 'Submit the structured evaluation of the requester reply.',
    parameters: {
      type: 'object',
      properties: {
        overall_score:    { type: 'number', description: 'Composite score 0-100 for how well the reply addresses all concerns.' },
        resolved_points:  { type: 'array', items: { type: 'string' }, description: 'Concerns that are now fully addressed.' },
        open_concerns:    { type: 'array', items: { type: 'string' }, description: 'Concerns that remain unaddressed or partially addressed.' },
        new_requirements: { type: 'array', items: { type: 'string' }, description: 'New requirements or gaps surfaced by the reply that the reviewer must action.' },
        document_review:  {
          type: ['object', 'null'],
          description: 'Evaluation of any attached documents. null if no documents were mentioned.',
          properties: {
            present:       { type: 'boolean', description: 'Attachment is present.' },
            appears_signed:{ type: 'boolean', description: 'The attachment appears to be a signed version.' },
            relevant:      { type: 'boolean', description: 'The attachment is relevant to the original concern.' },
          },
          required: ['present', 'appears_signed', 'relevant'],
        },
        recommendation:   { type: 'string', enum: ['accept', 'return_again', 'escalate'], description: 'Next action for the reviewer.' },
        summary:          { type: 'string', description: 'One-paragraph human-readable summary of the evaluation.' },
      },
      required: ['overall_score', 'resolved_points', 'open_concerns', 'new_requirements', 'recommendation', 'summary'],
    },
  },
}

function buildSystemPrompt(roleLabel: string, reviewerComment: string, ticketContext: string, attachmentContext: string): string {
  return `You are a PDPL compliance review assistant. A previous message in a review thread raised concerns. The ${roleLabel} has now replied. Your job is to evaluate whether their reply AND any attached documents adequately address the open concerns and to flag what is still missing.

Original concern raised: "${reviewerComment}"

Ticket context: ${ticketContext}

IMPORTANT evaluation rules:
- If the message asked for a signed document, check if an attachment is present and whether it appears to be a signed version.
- If specific information was asked for, check BOTH the reply text and the attachment contents for that information.
- If the ${roleLabel} raised NEW concerns or requirements (e.g. Legal flagged a contract gap, Security flagged missing controls), describe them clearly so the receiving reviewer understands what to action.
- If no attachments were provided but the original request implied documents were needed, flag this as unresolved.
${attachmentContext}

Evaluate the ${roleLabel}'s reply and attachments, then return a structured assessment using the provided tool. Phrase findings from the perspective of someone who must act on them next.`
}

function buildAttachmentContext(attachments: Array<{ filename: string; extractedSummary?: string | null }>): string {
  if (!attachments.length) return ''
  const lines = attachments.map((a) => `- ${a.filename}${a.extractedSummary ? ': ' + a.extractedSummary : ''}`)
  return `\nAttachments provided:\n${lines.join('\n')}`
}

export async function evaluateReply(opts: {
  roleLabel:       string
  reviewerComment: string
  requesterReply:  string
  ticketContext:   string
  attachments:     Array<{ filename: string; extractedSummary?: string | null }>
}): Promise<ReplyEvaluation> {
  const { roleLabel, reviewerComment, requesterReply, ticketContext, attachments } = opts

  const result = await apiComplete({
    messages: [
      { role: 'system', content: buildSystemPrompt(roleLabel, reviewerComment, ticketContext, buildAttachmentContext(attachments)) },
      { role: 'user',   content: `${roleLabel}'s reply: "${requesterReply}"` },
    ],
    tools:       [TOOL_DEF],
    tool_choice: { type: 'function', function: { name: 'submit_reply_evaluation' } },
    max_tokens:  1024,
  })

  const args = (result as { choices: { message: { tool_calls: { function: { arguments: string } }[] } }[] }).choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!args) throw new Error('No evaluation returned from model.')
  return JSON.parse(args) as ReplyEvaluation
}
