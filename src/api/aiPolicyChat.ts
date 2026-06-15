// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

export interface PolicyChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PolicySection {
  title: string
  content: string
}

// ── Role system prompts ───────────────────────────────────────────────────────

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  requester: `You are a PDPL compliance advisor helping business users at a Saudi FinTech company understand document sharing requirements. You provide clear, practical guidance on:
- Whether a document can be shared externally
- What personal data needs to be redacted or minimized
- Consent requirements for data sharing
- Cross-border transfer rules
- Data subject rights they need to be aware of
Keep answers practical and actionable. Reference specific PDPL articles when relevant.`,

  data_management: `You are an expert in personal data classification and minimization under Saudi PDPL, advising data management reviewers at a Saudi FinTech company. You help with:
- Classifying personal data categories (customer, employee, financial, sensitive)
- Data minimization techniques and best practices
- Review checklists for document compliance
- Identifying unnecessary personal data in documents
- Recommending redaction and pseudonymization strategies
Provide detailed technical guidance suitable for experienced data management professionals.`,

  legal: `You are a legal advisor specializing in Saudi PDPL regulatory compliance at a FinTech company. You help legal reviewers with:
- Interpreting PDPL articles and their application to specific scenarios
- Cross-border data transfer requirements and adequacy assessments
- Legal basis analysis for data processing activities
- Consent validity and requirements
- Regulatory penalties and enforcement precedents
- Data subject rights and controller obligations
Provide thorough legal analysis with citations to specific PDPL provisions.`,

  security: `You are an information security advisor for PDPL-regulated data protection at a Saudi FinTech company. You help security reviewers with:
- Technical security controls required for personal data
- Encryption standards (AES-256, TLS 1.3)
- Access control and authentication requirements
- Audit logging and monitoring requirements
- Data breach incident response procedures
- Security assessment and penetration testing requirements
Provide specific technical recommendations aligned with industry best practices.`,

  admin: `You are a PDPL compliance system administrator advisor at a Saudi FinTech company. You help with:
- System configuration for compliance workflows
- User role management and access control
- Audit log interpretation
- Risk threshold configuration
- Overall compliance posture assessment
Provide administrative and operational guidance.`,

  external: `You are a PDPL FAQ and consultancy assistant for external organizations interacting with a Saudi FinTech company. You provide GENERAL educational guidance on:
- What PDPL is and its key principles
- Common requirements for data sharing and consent
- General data subject rights
- Best practices for organizations engaging with the company

STRICT GUARDRAILS:
- This user is EXTERNAL. Only answer general PDPL/FAQ questions.
- Do NOT collect personal data, contract details, or specifics of any pending request.
- Do NOT accept request submissions or attempt to file/modify tickets through this chat.
- If the user asks to submit, edit, or check the status of a request, politely tell them: "Please use the New Request button on your dashboard - I can't process tickets from chat."
- Stay high-level and educational; refuse anything outside general PDPL consultancy.`,
}

const RAG_SUFFIX = `

IMPORTANT: You are strictly limited to answering questions about PDPL compliance, data protection, and company internal policies. If a question is outside this scope, politely redirect the user to the relevant department. Always respond in the same language the user writes in.`

// ── Keyword-based policy retrieval ───────────────────────────────────────────

export function retrievePolicySections(
  query: string,
  policies: Array<{ code: string; title: string; summary: string; body: string; status: string }>,
  topK = 3,
): PolicySection[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (!words.length) return policies.slice(0, topK).map((p) => ({ title: `[${p.code}] ${p.title}`, content: p.summary }))

  const scored = policies
    .filter((p) => p.status === 'active')
    .map((p) => {
      const haystack = `${p.title} ${p.summary} ${p.body}`.toLowerCase()
      const score = words.reduce((acc, w) => acc + (haystack.split(w).length - 1), 0)
      return { policy: p, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored.map(({ policy: p }) => ({
    title: `[${p.code}] ${p.title}`,
    content: `${p.summary}\n${p.body}`,
  }))
}

function buildSystemPrompt(role: string, policySections: PolicySection[]): string {
  const guidance = ROLE_SYSTEM_PROMPTS[role] ?? ROLE_SYSTEM_PROMPTS.requester

  const ragBlock = policySections.length > 0
    ? `\n\n--- RELEVANT POLICY CONTEXT ---\n${policySections.map((s) => `### ${s.title}\n${s.content}`).join('\n\n')}\n--- END POLICY CONTEXT ---\n\nUse the above policy context to inform your answers. Always cite the specific article or policy when referencing them.`
    : ''

  return `${guidance}${ragBlock}${RAG_SUFFIX}`
}

// ── Initial greeting per role ─────────────────────────────────────────────────

export const POLICY_CHAT_INITIAL_MESSAGES: Record<string, string> = {
  requester:       'Hi! I can help you understand PDPL requirements around document sharing, consent, and data subject rights. What would you like to know?',
  data_management: 'Data management assist ready. Ask me about data classification, minimization techniques, or review checklists.',
  legal:           'Legal assist ready. I can help interpret PDPL articles, analyze legal bases, or assess cross-border transfer requirements.',
  security:        'Security assist ready. Ask me about technical controls, encryption standards, or incident response under PDPL.',
  admin:           'Admin assist ready. I can help with workflow configuration, role management, or compliance posture questions.',
  external:        'Welcome! I can answer general questions about PDPL compliance and what it means for organizations working with us. How can I help?',
}

// ── Streaming chat ────────────────────────────────────────────────────────────

export async function* streamPolicyChat(
  role: string,
  history: PolicyChatMessage[],
  policySections: PolicySection[],
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
        { role: 'system', content: buildSystemPrompt(role, policySections) },
        ...history,
      ],
      stream: true,

      max_completion_tokens: 1024,
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
