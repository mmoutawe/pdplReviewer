// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

const SYSTEM_PROMPT_TEMPLATE = `You are a PDPL (Saudi Personal Data Protection Law) compliance document specialist.

You have full context about a vendor engagement:
{TICKET_CONTEXT}

Your role:
- Generate professional compliance documents (DPAs, compliance letters, questionnaires, risk assessments, data sharing notices).
- Use the vendor data, questionnaire answers, and AI assessment provided in the context.
- Format output in clean, professional markdown.
- Include proper legal language aligned with PDPL requirements.
- Add placeholders like [COMPANY NAME], [DATE], [AUTHORIZED SIGNATORY] where specific info is needed.
- Be thorough and produce production-ready documents.

ARTICLE REFERENCES (IMPORTANT):
- Whenever a clause, obligation, right, or safeguard you draft is grounded in a specific PDPL article or its Implementing Regulation, append an inline reference at the end of that sentence or bullet, using the format: (Ref: PDPL Article X) or (Ref: Implementing Regulation Article Y).
- At the end of every generated document, add a final section titled "## References" that lists every article you cited, one per line, in the format: "- PDPL Article X - short one-line description of what the article covers."
- Only cite articles that genuinely apply to the drafted clause. Do NOT fabricate article numbers. If you are not certain an article applies, omit the reference rather than guess.
- If no PDPL articles are applicable to the drafted document (rare), omit the References section entirely.`

export function buildDocumentSystemPrompt(ticketContext: string): string {
  return SYSTEM_PROMPT_TEMPLATE.replace('{TICKET_CONTEXT}', ticketContext)
}

/**
 * Streams a generated compliance document token-by-token.
 * The caller accumulates tokens to build the full document text.
 */
export async function* streamDocument(
  ticketContext: string,
  userRequest: string,
): AsyncGenerator<string> {
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
        { role: 'system', content: buildDocumentSystemPrompt(ticketContext) },
        { role: 'user',   content: userRequest },
      ],
      stream: true,
      temperature: 0.4,
      max_completion_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Azure OpenAI error ${response.status}: ${err}`)
  }

  const reader  = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (jsonStr === '[DONE]') return
      try {
        const data  = JSON.parse(jsonStr)
        const token = data.choices?.[0]?.delta?.content
        if (token) yield token
      } catch {
        // malformed SSE chunk — skip
      }
    }
  }
}
