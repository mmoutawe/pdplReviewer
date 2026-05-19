import { useState, useRef, useEffect } from 'react'
import { Sparkles, ArrowRight, CheckCircle, Check, Loader2 } from 'lucide-react'
import type { Ticket } from '../data/types'
import { streamDocument } from '../api/aiDocumentGenerator'

const QUICK_PROMPTS = [
  'Generate a Data Processing Agreement (DPA) for this vendor engagement.',
  'Generate a risk assessment letter summarizing the compliance risks.',
  'Generate a compliance questionnaire for the vendor to complete.',
  'Generate a data sharing notice for affected data subjects.',
]

function buildTicketContext(ticket: Ticket): string {
  return JSON.stringify({
    type:            ticket.type,
    title:           ticket.title,
    description:     ticket.description,
    payload:         ticket.payload,
    dataDeclaration: ticket.dataDeclaration,
    tags:            ticket.tags,
  }, null, 2)
}

interface Props { ticket: Ticket }

export function AIDocumentChat({ ticket }: Props) {
  const [phase, setPhase]           = useState<'idle' | 'generating' | 'done'>('idle')
  const [docText, setDocText]       = useState('')
  const [userRequest, setUserRequest] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [copied, setCopied]         = useState(false)
  const docRef = useRef<HTMLDivElement>(null)

  // Auto-scroll while streaming
  useEffect(() => {
    if (docRef.current) docRef.current.scrollTop = docRef.current.scrollHeight
  }, [docText])

  async function generate(request: string) {
    if (!request.trim()) return
    setPhase('generating')
    setDocText('')
    setError(null)
    setUserRequest(request)
    try {
      const context = buildTicketContext(ticket)
      for await (const token of streamDocument(context, request)) {
        setDocText((prev) => prev + token)
      }
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.')
      setPhase('idle')
    }
  }

  function handleCopy() {
    void navigator.clipboard.writeText(docText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function reset() {
    setPhase('idle')
    setDocText('')
    setError(null)
    setUserRequest('')
    setCustomInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

      {/* ── Idle: greeting + quick prompts + custom input ── */}
      {phase === 'idle' && (
        <>
          {/* AI greeting bubble */}
          <div style={{
            padding: '14px 18px', borderRadius: 'var(--r-lg)',
            background: 'var(--violet-50)', border: '1px solid #DDD6FE',
            fontSize: 13.5, color: 'var(--ink-800)', lineHeight: 1.65,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={14} color="var(--violet-700)" aria-hidden="true" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--violet-700)' }}>AI Document Generator</span>
            </div>
            I have the full context of this vendor engagement. What document would you like me to generate?
            Choose a quick option below or describe what you need.
          </div>

          {/* Quick prompt buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="btn"
                style={{ textAlign: 'left', fontSize: 13, padding: '10px 14px', height: 'auto', lineHeight: 1.4 }}
                onClick={() => void generate(prompt)}
              >
                <ArrowRight size={13} color="var(--brand-700)" style={{ marginRight: 6, flexShrink: 0 }} />{prompt}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && customInput.trim()) void generate(customInput) }}
              placeholder="Or describe the document you need…"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              disabled={!customInput.trim()}
              onClick={() => void generate(customInput)}
            >
              Generate
            </button>
          </div>

          {error && (
            <div role="alert" style={{
              padding: '10px 14px', background: 'var(--red-50)',
              border: '1px solid #FECACA', borderRadius: 'var(--r-md)',
              fontSize: 13, color: 'var(--red-700)',
            }}>
              {error}
            </div>
          )}
        </>
      )}

      {/* ── Generating: streaming preview ── */}
      {phase === 'generating' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 size={16} color="var(--violet-700)" style={{ animation: 'spin 1.2s linear infinite', flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontSize: 13.5, color: 'var(--ink-600)' }}>
              Generating: <em style={{ color: 'var(--ink-400)', fontWeight: 400 }}>
                {userRequest.length > 80 ? userRequest.slice(0, 80) + '…' : userRequest}
              </em>
            </span>
          </div>
          <div
            ref={docRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '18px 20px', minHeight: 240,
              background: 'var(--surface-0)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-lg)', fontSize: 13.5, lineHeight: 1.85,
              color: 'var(--ink-800)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)',
            }}
          >
            {docText}
            <span style={{
              display: 'inline-block', width: 2, height: '1em',
              background: 'var(--brand-700)', verticalAlign: 'text-bottom',
              marginLeft: 1, animation: 'blink 1s step-end infinite',
            }} aria-hidden="true" />
          </div>
        </>
      )}

      {/* ── Done: full document + actions ── */}
      {phase === 'done' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#166534', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} style={{ flexShrink: 0 }} />{userRequest.length > 90 ? userRequest.slice(0, 90) + '…' : userRequest}
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-sm" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {copied ? <><Check size={12} /> Copied</> : 'Copy'}
              </button>
              <button className="btn btn-sm" onClick={reset}>
                Generate another
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1, overflowY: 'auto', padding: '20px 24px',
              background: 'var(--surface-0)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-lg)', fontSize: 13.5, lineHeight: 1.9,
              color: 'var(--ink-800)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)',
            }}
          >
            {docText}
          </div>
        </>
      )}
    </div>
  )
}
