import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Sparkles, X, Send, Download, FileText, ClipboardList } from 'lucide-react'
import type { Ticket, Attachment, Vendor, Project, PreSubmissionAssessment, VendorQuestionnaire, ReviewerTemplate, TemplateCategory } from '../data/types'
import { TEMPLATE_CATEGORY_LABELS } from '../data/types'
import { streamDocument } from '../api/aiDocumentGenerator'
import { uploadAttachment } from '../api/attachments'
import { uploadDocument } from '../api/documentLibrary'
import { authStore, showToast } from '../store'
import { useStore } from '../hooks/useStore'
import { isDataverseConfigured } from '../lib/dataverse'

// ─── Demo seed templates (shown when Dataverse templates aren't available) ─────

const DEMO_TEMPLATES: ReviewerTemplate[] = [
  {
    id: 'demo-tpl-dpa',
    title: 'Standard Data Processing Agreement (DPA)',
    description: 'Governs how the vendor processes personal data on behalf of Cielo. Covers PDPL Articles 10–15.',
    file_path: '', file_type: 'docx', category: 'dpa',
    is_active: true, uploaded_by: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-tpl-nda',
    title: 'Non-Disclosure Agreement (NDA)',
    description: 'Mutual confidentiality agreement covering shared personal data and proprietary compliance information.',
    file_path: '', file_type: 'docx', category: 'nda',
    is_active: true, uploaded_by: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-tpl-pda',
    title: 'Personal Data Assessment (PDA)',
    description: 'Privacy impact assessment documenting data flows, legal basis, and PDPL compliance posture for this vendor relationship.',
    file_path: '', file_type: 'docx', category: 'assessment',
    is_active: true, uploaded_by: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-tpl-risk',
    title: 'Vendor Risk Assessment Letter',
    description: 'Formal letter documenting identified PDPL risks, recommended mitigations, and approval decision.',
    file_path: '', file_type: 'docx', category: 'letter',
    is_active: true, uploaded_by: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-tpl-consent',
    title: 'Data Subject Consent Form',
    description: 'Consent form compliant with PDPL Article 5 for data subjects whose data will be processed by this vendor.',
    file_path: '', file_type: 'docx', category: 'other',
    is_active: true, uploaded_by: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  },
]

const CATEGORY_COLORS: Record<TemplateCategory, { bg: string; color: string; border: string }> = {
  dpa:        { bg: 'var(--brand-50)',   color: 'var(--brand-700)',   border: 'var(--brand-100)' },
  nda:        { bg: 'var(--violet-50)',  color: 'var(--violet-700)',  border: 'var(--violet-100)' },
  letter:     { bg: 'var(--amber-50)',   color: 'var(--amber-700)',   border: 'var(--amber-200)' },
  assessment: { bg: 'var(--teal-50)',    color: 'var(--teal-700)',    border: 'var(--teal-100)' },
  other:      { bg: 'var(--surface-1)',  color: 'var(--ink-600)',     border: 'var(--line)' },
}

// ─── Context assembly ─────────────────────────────────────────────────────────

function buildDocumentContext(
  ticket: Ticket,
  vendor: Vendor | null,
  project: Project | null,
  assessment: PreSubmissionAssessment | undefined,
): string {
  const q = ticket.payload as unknown as VendorQuestionnaire
  return JSON.stringify({
    organizationName: 'Cielo',
    currentDate: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }),
    vendor: vendor ? {
      name: vendor.tradeName,
      legalName: vendor.legalName,
      country: vendor.jurisdiction,
      category: vendor.category,
      certifications: vendor.certifications,
      hasDPA: vendor.hasDPA,
      riskTier: vendor.riskTier,
    } : null,
    project: project ? { name: project.name, businessUnit: project.businessUnit } : null,
    ticket: {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      dataDeclaration: ticket.dataDeclaration,
    },
    questionnaire: q ? {
      dataUsage: q.dataUsage,
      purposeNecessity: q.purposeNecessity,
      processingRoles: q.processingRoles,
      storageHosting: q.storageHosting,
      dataAccess: q.dataAccess,
      securityControls: q.securityControls,
      complianceGovernance: q.complianceGovernance,
      contractualSafeguards: q.contractualSafeguards,
      dataLifecycle: q.dataLifecycle,
    } : null,
    priorAssessment: assessment ? {
      overallRisk: assessment.overallRisk,
      pdplAlignment: assessment.pdplAlignment,
      summary: assessment.summary,
      findings: assessment.findings.slice(0, 5).map((f) => ({
        severity: f.severity,
        title: f.title,
        detail: f.detail,
      })),
    } : null,
  }, null, 2)
}

// ─── Markdown → HTML (Word-compatible) for DOCX export ───────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineHtml(line: string): string {
  return escHtml(line)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:monospace;background:#f1f5f9;padding:1px 4px;border-radius:2px">$1</code>')
}

function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false
  const flush = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const line of lines) {
    if (line.startsWith('### ')) { flush(); out.push(`<h3 style="font-size:12pt;color:#334155;margin:12pt 0 4pt">${escHtml(line.slice(4))}</h3>`) }
    else if (line.startsWith('## ')) { flush(); out.push(`<h2 style="font-size:14pt;color:#1e3a5f;border-bottom:1pt solid #cbd5e1;padding-bottom:3pt;margin-top:18pt">${escHtml(line.slice(3))}</h2>`) }
    else if (line.startsWith('# ')) { flush(); out.push(`<h1 style="font-size:20pt;color:#0b5fff;margin-bottom:8pt">${escHtml(line.slice(2))}</h1>`) }
    else if (line.match(/^[-*] /)) { if (!inList) { out.push('<ul style="margin:4pt 0 8pt 20pt">'); inList = true } out.push(`<li style="margin-bottom:3pt;line-height:1.65">${inlineHtml(line.slice(2))}</li>`) }
    else if (line.trim() === '') { flush() }
    else { flush(); out.push(`<p style="margin:5pt 0;line-height:1.65">${inlineHtml(line)}</p>`) }
  }
  flush()
  return out.join('\n')
}

function makeDocxFile(markdown: string, vendorName: string): File {
  const body = mdToHtml(markdown)
  const date = new Date().toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:2.5cm;color:#1e293b}p{margin:5pt 0;line-height:1.65}ul{margin:4pt 0 8pt 20pt}li{line-height:1.65;margin-bottom:3pt}</style>
</head><body>
${body}
<p style="color:#94a3b8;font-size:9pt;margin-top:28pt;border-top:1pt solid #e2e8f0;padding-top:6pt">AI-Generated Compliance Document · PDPL Reviewer · ${date}</p>
</body></html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safe = vendorName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40)
  return new File([blob], `AI_Generated_${safe}_${ts}.doc`, {
    type: 'application/msword',
  })
}

// ─── Markdown → React (chat display) ─────────────────────────────────────────

function Inline({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
        if (part.startsWith('`') && part.endsWith('`')) return (
          <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: 'var(--surface-2)', padding: '0 3px', borderRadius: 3 }}>
            {part.slice(1, -1)}
          </code>
        )
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function MarkdownView({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let listBuf: string[] = []
  let key = 0

  const flush = () => {
    if (listBuf.length) {
      nodes.push(
        <ul key={key++} style={{ margin: '4px 0 8px 18px', padding: 0 }}>
          {listBuf.map((item, j) => (
            <li key={j} style={{ fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.7, marginBottom: 2 }}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      )
      listBuf = []
    }
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flush()
      nodes.push(<h3 key={key++} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', margin: '14px 0 4px' }}>{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      flush()
      nodes.push(<h2 key={key++} style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', margin: '18px 0 6px', paddingBottom: 5, borderBottom: '1px solid var(--line)' }}>{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      flush()
      nodes.push(<h1 key={key++} style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: '20px 0 8px' }}>{line.slice(2)}</h1>)
    } else if (line.match(/^[-*] /)) {
      listBuf.push(line.slice(2))
    } else if (line.trim() === '') {
      flush()
    } else {
      flush()
      nodes.push(<p key={key++} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-800)', margin: '4px 0' }}><Inline text={line} /></p>)
    }
  }
  flush()
  return <div>{nodes}</div>
}

// ─── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  {
    label: 'Data Processing Agreement (DPA)',
    icon: '📄',
    prompt: 'Generate a concise Data Processing Agreement (DPA) between Cielo and this vendor. Keep it under 1000 words. Cover the essentials: parties and roles (controller/processor), categories of personal data and purposes, security obligations, sub-processor restrictions, breach notification, data subject rights, and termination. Cite the key PDPL articles. End with a brief signature block.',
  },
  {
    label: 'Risk Assessment Letter',
    icon: '⚠️',
    prompt: 'Generate a concise Risk Assessment Letter (under 900 words) summarizing the top PDPL compliance risks for this vendor. Include: a one-paragraph executive summary, a bullet list of up to 5 key risks with severity and recommended mitigation, and a closing recommendation (approve / return / escalate). Cite relevant PDPL articles.',
  },
  {
    label: 'Compliance Questionnaire',
    icon: '📋',
    prompt: 'Generate a focused PDPL Compliance Questionnaire for this vendor (under 900 words). Include 4–5 sections: data governance, security controls, cross-border transfers, data subject rights, and breach response. 3–4 questions per section. Each question cites the PDPL obligation it assesses.',
  },
  {
    label: 'Data Sharing Notice',
    icon: '📨',
    prompt: 'Generate a concise Data Sharing Notice (under 800 words) for data subjects. Plain language. Cover: what data is shared and with whom, the purpose, retention period, data subject rights under PDPL, and how to contact us or lodge a complaint. Cite applicable PDPL articles.',
  },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  ticket: Ticket
  vendor: Vendor | null
  project: Project | null
  assessment: PreSubmissionAssessment | undefined
  templates?: ReviewerTemplate[]
  onGenerated: (att: Attachment) => void
  onClose: () => void
}

type Msg = { role: 'user' | 'assistant'; content: string }
type PanelTab = 'generate' | 'fill'

export function AIDocumentGeneratorPanel({ ticket, vendor, project, assessment, templates, onGenerated, onClose }: Props) {
  const { user } = useStore(authStore)

  const greeting = `Hello! I have full context loaded for ticket **${ticket.id}**${vendor ? ` — vendor: **${vendor.tradeName}** (${vendor.jurisdiction})` : ''}.\n\nQuestionnaire answers, data declaration, and the AI assessment are all available. What compliance document would you like me to generate?`

  const [tab, setTab]           = useState<PanelTab>('generate')
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greeting }])
  const [streamText, setStreamText] = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [input, setInput]           = useState('')
  const [saving, setSaving]         = useState(false)

  // Fill template state
  const [selectedTemplate, setSelectedTemplate] = useState<ReviewerTemplate | null>(null)
  const [extraContext, setExtraContext]          = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)

  // Use live templates if provided, otherwise fall back to demo seeds
  const availableTemplates = (templates && templates.length > 0) ? templates.filter((t) => t.is_active) : DEMO_TEMPLATES

  const context = buildDocumentContext(ticket, vendor, project, assessment)

  const lastAssistantDoc = messages.length > 1
    ? [...messages].reverse().find((m) => m.role === 'assistant')
    : undefined

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamText])

  // Switch to generate tab when a doc is produced (so the chat + actions are visible)
  useEffect(() => {
    if (messages.length > 1) setTab('generate')
  }, [messages.length])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setStreaming(true)
    setStreamText('')

    try {
      let full = ''
      for await (const token of streamDocument(context, trimmed)) {
        full += token
        setStreamText(full)
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: full }])
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const isRate = raw.includes('429') || raw.toLowerCase().includes('rate limit') || raw.toLowerCase().includes('too many')
      const isQuota = raw.includes('402') || raw.toLowerCase().includes('quota') || raw.toLowerCase().includes('credit')
      const friendly = isRate
        ? 'Rate limit reached — please wait a moment and try again.'
        : isQuota
        ? 'AI quota exhausted. Please check your API configuration.'
        : `Generation failed: ${raw}`
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${friendly}` }])
    } finally {
      setStreaming(false)
      setStreamText('')
    }
  }

  function handleFillTemplate() {
    if (!selectedTemplate) return
    const categoryLabel = TEMPLATE_CATEGORY_LABELS[selectedTemplate.category] ?? selectedTemplate.category
    const extraNote = extraContext.trim()
      ? `\n\nAdditional context provided by the reviewer:\n${extraContext.trim()}`
      : ''

    const prompt = `Fill in the **${selectedTemplate.title}** (${categoryLabel}) using the ticket context already loaded.

${selectedTemplate.description ? `Template purpose: ${selectedTemplate.description}\n` : ''}
Generate a complete, properly-filled document. Replace all placeholder sections with real data from the ticket context — vendor name, legal name, jurisdiction, data categories, processing purposes, risk findings, and dates. Use professional legal language appropriate for Saudi PDPL compliance.

Do not leave any unfilled placeholders, bracket markers like [INSERT X], or generic descriptions. Every field must be populated with actual information from the context.${extraNote}

Structure the document with proper sections, headings, and a signature block at the end.`

    setTab('generate')
    void send(prompt)
  }

  async function saveDocx() {
    if (!lastAssistantDoc || saving) return
    setSaving(true)
    try {
      const vendorName = vendor?.tradeName ?? ticket.title
      const file = makeDocxFile(lastAssistantDoc.content, vendorName)

      if (isDataverseConfigured) {
        const att = await uploadAttachment(ticket.id, file, 'dpa', undefined, user?.id)
        if (ticket.projectId) {
          uploadDocument(file, {
            title: file.name.replace(/\.doc$/, '').replace(/_/g, ' '),
            document_type: 'dpa',
            description: 'AI-generated compliance document',
            project_id: ticket.projectId,
            vendor_id: ticket.vendorId ?? undefined,
          }, user?.id).catch(() => undefined)
        }
        onGenerated(att)
        showToast('Document saved and attached to ticket.', 'success')
      } else {
        const demoAtt: Attachment = {
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          filename: file.name,
          sizeBytes: file.size,
          contentType: file.type,
          uploadedBy: user?.id ?? '',
          uploadedAt: new Date().toISOString(),
          storageBucket: 'demo',
          storagePath: file.name,
          signedUrl: URL.createObjectURL(file),
          scanStatus: 'clean',
          classification: 'internal',
          category: 'dpa',
          extractedSummary: 'AI Generated — PDPL compliance document',
        }
        onGenerated(demoAtt)
        showToast('Document ready — demo mode, not persisted.', 'success')
      }
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save document.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={16} color="var(--brand-700)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>AI Document Generator</div>
            <div style={{ fontSize: 12, color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Vendor data · Questionnaire · AI assessment — all pre-loaded
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', flexShrink: 0 }} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* ── Tab switcher ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          {([
            { key: 'generate' as PanelTab, label: 'Generate', icon: <Sparkles size={13} /> },
            { key: 'fill'     as PanelTab, label: 'Fill Template', icon: <ClipboardList size={13} /> },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: 13,
                background: 'transparent',
                fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? 'var(--brand-700)' : 'var(--ink-500)',
                borderBottom: tab === t.key ? '2px solid var(--brand-700)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.12s',
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: GENERATE (existing chat)
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'generate' && (
          <>
            <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>

              {messages.map((msg, i) => (
                msg.role === 'user' ? (
                  <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ maxWidth: '78%', padding: '10px 14px', background: 'var(--brand-700)', color: '#fff', borderRadius: '14px 14px 2px 14px', fontSize: 13, lineHeight: 1.55 }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ padding: '12px 16px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: '2px 14px 14px 14px', maxWidth: '95%' }}>
                    <MarkdownView text={msg.content} />
                    {i > 0 && !streaming && (
                      <button
                        onClick={() => { void navigator.clipboard.writeText(msg.content) }}
                        style={{ marginTop: 8, padding: '2px 8px', fontSize: 11.5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)' }}
                      >
                        Copy
                      </button>
                    )}
                  </div>
                )
              ))}

              {/* Quick prompts — only on empty state */}
              {messages.length === 1 && !streaming && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  {QUICK_PROMPTS.map((qp) => (
                    <button key={qp.label} className="btn btn-ghost"
                      style={{ textAlign: 'left', padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-700)', display: 'flex', alignItems: 'flex-start', gap: 10, height: 'auto', lineHeight: 1.45, cursor: 'pointer' }}
                      onClick={() => void send(qp.prompt)}>
                      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{qp.icon}</span>
                      <span>{qp.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Streaming output */}
              {streaming && (
                <div style={{ padding: '12px 16px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: '2px 14px 14px 14px', maxWidth: '95%' }}>
                  {streamText
                    ? <><MarkdownView text={streamText} /><span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--brand-700)', verticalAlign: 'text-bottom', marginLeft: 1, animation: 'blink 1s step-end infinite' }} aria-hidden /></>
                    : <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>···</span>
                  }
                </div>
              )}
            </div>

            {/* Action bar — visible once a document exists */}
            {lastAssistantDoc && !streaming && (
              <div style={{ padding: '10px 20px', background: 'rgba(26,184,142,0.05)', borderTop: '1px solid var(--brand-100)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <FileText size={13} color="var(--brand-700)" aria-hidden />
                <span style={{ fontSize: 12, color: 'var(--ink-500)', flex: 1 }}>
                  Document ready — download or attach to this ticket{ticket.projectId ? ' and project' : ''}
                </span>
                <button
                  className="btn btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--brand-300)', color: 'var(--brand-700)', background: 'var(--brand-50)' }}
                  onClick={() => {
                    const vendorName = vendor?.tradeName ?? ticket.title
                    const file = makeDocxFile(lastAssistantDoc.content, vendorName)
                    const url = URL.createObjectURL(file)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = file.name
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Download size={12} /> Download DOCX
                </button>
                <button className="btn btn-ai btn-sm" onClick={() => void saveDocx()} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {saving
                    ? <><span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Attaching…</>
                    : <><FileText size={12} />Attach to Ticket</>
                  }
                </button>
              </div>
            )}

            {/* Input row */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <input
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
                placeholder="Describe a document or ask a follow-up…"
                style={{ flex: 1, height: 36, fontSize: 13 }}
                disabled={streaming}
                aria-label="AI document request"
              />
              <button className="btn btn-ai btn-sm" onClick={() => void send(input)} disabled={!input.trim() || streaming} aria-label="Send">
                <Send size={13} />
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: FILL TEMPLATE
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'fill' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>

            {/* Intro */}
            <div style={{ padding: '12px 16px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--brand-700)', lineHeight: 1.6 }}>
              <strong>Pick a template</strong> and the AI will fill it in using this ticket's vendor data, questionnaire answers, and assessment findings. All placeholder fields will be replaced with real information.
              {!isDataverseConfigured && templates === undefined && (
                <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--ink-500)' }}>
                  Showing demo templates. Connect Dataverse to use your uploaded templates.
                </span>
              )}
            </div>

            {/* Template picker grid */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', letterSpacing: '0.04em', marginBottom: 10 }}>
                AVAILABLE TEMPLATES ({availableTemplates.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {availableTemplates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id
                  const cc = CATEGORY_COLORS[tpl.category] ?? CATEGORY_COLORS.other
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(isSelected ? null : tpl)}
                      style={{
                        textAlign: 'left', padding: '14px 16px',
                        border: `2px solid ${isSelected ? 'var(--brand-600)' : 'var(--line)'}`,
                        borderRadius: 'var(--r-md)', cursor: 'pointer',
                        background: isSelected ? 'var(--brand-50)' : 'var(--surface-0)',
                        boxShadow: isSelected ? '0 0 0 3px var(--brand-100)' : 'none',
                        transition: 'all 0.12s',
                      }}
                    >
                      {/* Category badge */}
                      <span style={{
                        display: 'inline-block', marginBottom: 8,
                        padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 600,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        background: cc.bg, color: cc.color, border: `1px solid ${cc.border}`,
                      }}>
                        {TEMPLATE_CATEGORY_LABELS[tpl.category] ?? tpl.category}
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.4, marginBottom: 6 }}>
                        {tpl.title}
                      </div>
                      {tpl.description && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.5 }}>
                          {tpl.description}
                        </div>
                      )}
                      {isSelected && (
                        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--brand-700)' }}>
                          ✓ Selected
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Extra context */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', letterSpacing: '0.04em', marginBottom: 6 }}>
                ADDITIONAL CONTEXT (optional)
              </label>
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="Add any extra details you'd like the AI to incorporate — special clauses, specific dates, jurisdiction-specific requirements, or notes from your conversation with the vendor…"
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
                  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                  background: 'var(--surface-0)', color: 'var(--ink-900)',
                  outline: 'none', minHeight: 80, fontFamily: 'inherit',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
              />
            </div>

            {/* Fill button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setSelectedTemplate(null); setExtraContext('') }}>
                Clear
              </button>
              <button
                className="btn btn-ai"
                disabled={!selectedTemplate || streaming}
                onClick={handleFillTemplate}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: 13.5, fontWeight: 600 }}
              >
                <Sparkles size={14} />
                {selectedTemplate
                  ? `Fill "${selectedTemplate.title.length > 30 ? selectedTemplate.title.slice(0, 28) + '…' : selectedTemplate.title}"`
                  : 'Select a template above'}
              </button>
            </div>

            {streaming && (
              <div style={{ padding: '14px 16px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--brand-700)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--brand-200)', borderTop: '2px solid var(--brand-700)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                AI is filling the template… switching to Generate tab when ready.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
