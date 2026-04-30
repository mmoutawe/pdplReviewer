import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RequestType } from '../../data/types'
import { REQUEST_TYPE_LABELS } from '../../data/seed'
import { Stepper } from '../../components/forms'
import { FormField } from '../../components/forms'
import { AICoPilotPanel } from '../../components/AICoPilotPanel'
import { showToast, saveDraft, loadDraft, clearDraft, authStore, updateTicket, resetAIStream } from '../../store'
import { useStore } from '../../hooks/useStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { createTicket, submitTicket } from '../../api/tickets'
import { streamAI } from '../../api/ai'

type Method = 'manual' | 'ai'

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { key: 'method',       label: 'Creation method' },
  { key: 'initiation',   label: 'Initiation' },
  { key: 'declaration',  label: 'Data declaration' },
  { key: 'assessment',   label: 'AI assessment' },
  { key: 'confirm',      label: 'Confirm & submit' },
]

function StepIndex(step: string) { return STEPS.findIndex((s) => s.key === step) }

interface WizardState {
  method: Method
  title: string
  description: string
  vendorName: string
  vendorJurisdiction: string
  hasDPA: boolean
  dataCategories: string[]
  estimatedSubjects: string
  retentionDays: string
  crossBorder: boolean
  consentObtained: boolean
  tags: string
}

const empty: WizardState = {
  method: 'manual', title: '', description: '',
  vendorName: '', vendorJurisdiction: 'KSA', hasDPA: false,
  dataCategories: [], estimatedSubjects: '', retentionDays: '',
  crossBorder: false, consentObtained: false, tags: '',
}

export default function Wizard() {
  const { type, method: urlMethod } = useParams<{ type: RequestType; method: string }>()
  const navigate = useNavigate()
  const { user } = useStore(authStore)

  const [currentStep, setCurrentStep] = useState(urlMethod === 'method' ? 'method' : 'initiation')
  const [form, setForm] = useState<WizardState>(() => loadDraft<WizardState>() ?? { ...empty })
  const [errors, setErrors] = useState<Partial<Record<keyof WizardState, string>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assessmentText, setAssessmentText] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const [aiBuilderInput, setAiBuilderInput] = useState('')
  const [aiBuilderLoading, setAiBuilderLoading] = useState(false)
  const [aiBuilderDone, setAiBuilderDone] = useState(false)
  const [aiBuilderError, setAiBuilderError] = useState<string | null>(null)

  const requestType = type as RequestType
  const stepIndex = StepIndex(currentStep)

  useEffect(() => {
    document.title = `New ${REQUEST_TYPE_LABELS[requestType] ?? 'Request'} — PDPL Reviewer`
  }, [requestType])

  // Autosave
  useEffect(() => { saveDraft(form) }, [form])

  // Auto-trigger AI assessment when entering step
  useEffect(() => {
    if (currentStep !== 'assessment' || assessmentText || assessmentLoading) return
    void runAssessment()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  function buildAssessmentPrompt() {
    const parts = [
      `Request type: ${REQUEST_TYPE_LABELS[requestType]}`,
      `Title: ${form.title}`,
      `Description: ${form.description}`,
      form.vendorName ? `Vendor/recipient: ${form.vendorName}` : null,
      `Jurisdiction: ${form.vendorJurisdiction}`,
      `DPA signed: ${form.hasDPA ? 'Yes' : 'No'}`,
      `Data categories: ${form.dataCategories.join(', ') || 'None specified'}`,
      `Estimated data subjects: ${form.estimatedSubjects || 'Unknown'}`,
      `Retention period (days): ${form.retentionDays || 'Unknown'}`,
      `Cross-border transfer involved: ${form.crossBorder ? 'Yes' : 'No'}`,
      `Data subject consent obtained: ${form.consentObtained ? 'Yes' : 'No'}`,
    ]
    return parts.filter(Boolean).join('\n')
  }

  async function runAssessment() {
    setAssessmentLoading(true)
    setAssessmentError(null)
    setStreamingText('')
    resetAIStream()
    try {
      const text = await streamAI({
        feature: 'pre_assessment',
        message: buildAssessmentPrompt(),
        onToken: (t) => setStreamingText((prev) => prev + t),
      })
      setAssessmentText(text)
      setStreamingText('')
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : 'Assessment failed. Please try again.')
    } finally {
      setAssessmentLoading(false)
    }
  }

  async function runAIBuilder() {
    if (!aiBuilderInput.trim()) return
    setAiBuilderLoading(true)
    setAiBuilderError(null)
    resetAIStream()
    try {
      const raw = await streamAI({ feature: 'request_builder', message: aiBuilderInput })
      // Parse JSON — try direct parse, then strip any accidental markdown fences
      let parsed: Record<string, unknown> | null = null
      try {
        parsed = JSON.parse(raw)
      } catch {
        const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (m) { try { parsed = JSON.parse(m[1]) } catch { /* fall through */ } }
      }
      if (!parsed) throw new Error('Gemini response was not valid JSON. Try rephrasing your description.')
      update({
        title:              typeof parsed.title === 'string'           ? parsed.title : form.title,
        description:        typeof parsed.description === 'string'     ? parsed.description : form.description,
        dataCategories:     Array.isArray(parsed.dataCategories)       ? parsed.dataCategories as string[] : form.dataCategories,
        estimatedSubjects:  typeof parsed.estimatedSubjects === 'string' ? parsed.estimatedSubjects : form.estimatedSubjects,
        crossBorder:        typeof parsed.crossBorder === 'boolean'    ? parsed.crossBorder : form.crossBorder,
        hasDPA:             typeof parsed.hasDPA === 'boolean'         ? parsed.hasDPA : form.hasDPA,
      })
      setAiBuilderDone(true)
    } catch (err) {
      setAiBuilderError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setAiBuilderLoading(false)
    }
  }

  function update(partial: Partial<WizardState>) {
    setForm((f) => ({ ...f, ...partial }))
  }

  function validate(step: string): boolean {
    const e: typeof errors = {}
    if (step === 'initiation') {
      if (!form.title.trim()) e.title = 'Title is required.'
      if (!form.description.trim()) e.description = 'Description is required.'
    }
    if (step === 'declaration') {
      if (!form.estimatedSubjects || isNaN(Number(form.estimatedSubjects))) e.estimatedSubjects = 'Enter a valid number.'
      if (!form.retentionDays || isNaN(Number(form.retentionDays))) e.retentionDays = 'Enter a valid number.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validate(currentStep)) return
    const idx = StepIndex(currentStep)
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].key)
  }

  function back() {
    const idx = StepIndex(currentStep)
    if (idx > 0) setCurrentStep(STEPS[idx - 1].key)
    else navigate(`/requests/new`)
  }

  async function submit() {
    if (!validate('confirm')) return
    if (submitting) return
    setSubmitting(true)
    try {
      if (isSupabaseConfigured) {
        const sensitive = ['biometric', 'health', 'national_id']
        const financial  = ['iban', 'transaction_history']
        const ticket = await createTicket({
          type: requestType,
          title: form.title,
          description: form.description,
          payload: {
            vendorName: form.vendorName || undefined,
            vendorJurisdiction: form.vendorJurisdiction || undefined,
            hasDPA: form.hasDPA,
          },
          dataDeclaration: {
            containsPII: form.dataCategories.length > 0,
            piiCategories: form.dataCategories,
            containsSensitive: form.dataCategories.some((c) => sensitive.includes(c)),
            sensitiveCategories: form.dataCategories.filter((c) => sensitive.includes(c)),
            containsFinancial: form.dataCategories.some((c) => financial.includes(c)),
            financialCategories: form.dataCategories.filter((c) => financial.includes(c)),
            affectedDataSubjectGroups: ['customers'],
            estimatedSubjectCount: Number(form.estimatedSubjects) || 0,
            retentionPeriodDays: Number(form.retentionDays) || 90,
            encryptionState: 'both',
            crossBorderInvolved: form.crossBorder,
            consentObtained: form.consentObtained,
            consentMechanism: form.consentObtained ? 'explicit' : undefined,
          },
          tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        })
        const ready = await submitTicket(ticket.id)
        updateTicket(ready.id, ready)
        clearDraft()
        showToast('Request submitted successfully.', 'success')
        navigate(`/requests/${ready.id}`)
      } else {
        clearDraft()
        setSubmitted(true)
        showToast('Request submitted successfully.', 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>Request submitted</h1>
        <p style={{ color: 'var(--ink-500)', marginBottom: 28, lineHeight: 1.6 }}>
          Your request has been assigned to the Data Management queue. You'll be notified when it moves to the next stage.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => navigate('/requests')}>View my requests</button>
          <button className="btn" onClick={() => { setSubmitted(false); setForm({ ...empty }); setCurrentStep('method') }}>New request</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Wizard header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface-0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={back} aria-label="Go back">
            ← Back
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-900)' }}>
            {REQUEST_TYPE_LABELS[requestType] ?? 'New Request'}
          </h1>
        </div>
        <Stepper steps={STEPS.map((s, i) => ({
          ...s, index: i,
          done: i < stepIndex,
          active: i === stepIndex,
        }))} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', minHeight: 0 }}>
        {/* Main content */}
        <div style={{ flex: 1, padding: '28px 32px', maxWidth: 680, minWidth: 0 }}>

          {/* ── Step: Method ── */}
          {currentStep === 'method' && (
            <section aria-labelledby="step-method">
              <h2 id="step-method" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>How would you like to create this request?</h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 24, fontSize: 13.5 }}>
                The AI builder helps you describe your use case in plain language and generates a structured form.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['manual', 'ai'] as Method[]).map((m) => (
                  <button key={m} onClick={() => { update({ method: m }); next() }}
                    style={{
                      padding: '18px 20px', borderRadius: 'var(--r-lg)',
                      border: `1px solid ${form.method === m ? 'var(--brand-700)' : 'var(--line)'}`,
                      background: form.method === m ? 'var(--brand-50)' : 'var(--surface-0)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all var(--t-fast)',
                    }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
                      {m === 'manual' ? '📋 Fill out manually' : '✨ AI request builder'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
                      {m === 'manual' ? 'Complete the form fields directly.' : 'Describe your use case in plain language and let AI structure it for you.'}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Step: Initiation ── */}
          {currentStep === 'initiation' && (
            <section aria-labelledby="step-init">
              <h2 id="step-init" style={{ fontSize: 18, fontWeight: 700, marginBottom: form.method === 'ai' ? 8 : 20 }}>Request details</h2>

              {/* AI builder panel — shown only when method === 'ai' */}
              {form.method === 'ai' && (
                <div style={{ marginBottom: 24 }}>
                  {!aiBuilderDone ? (
                    <div style={{
                      background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
                      borderRadius: 'var(--r-lg)', padding: '16px 18px',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span aria-hidden="true">✨</span> Gemini request builder
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--brand-700)', marginBottom: 12, lineHeight: 1.5 }}>
                        Describe your use case in plain language. Gemini will extract the structured fields for you.
                      </p>
                      <textarea
                        className="textarea"
                        rows={4}
                        value={aiBuilderInput}
                        onChange={(e) => setAiBuilderInput(e.target.value)}
                        placeholder="e.g. We need to onboard Sahab Cloud as an IaaS provider to host our InstaLend application. They'll process KYC data including national ID, IBAN, and credit scores for Saudi residents. The contract is 3 years and they're based in KSA."
                        style={{ marginBottom: 10 }}
                        disabled={aiBuilderLoading}
                      />
                      {aiBuilderError && (
                        <div role="alert" style={{ fontSize: 12.5, color: 'var(--red-700)', background: 'var(--red-50)', border: '1px solid #FECACA', borderRadius: 'var(--r-sm)', padding: '8px 12px', marginBottom: 10 }}>
                          {aiBuilderError}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => void runAIBuilder()}
                          disabled={!aiBuilderInput.trim() || aiBuilderLoading}
                        >
                          {aiBuilderLoading
                            ? <><span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6 }} aria-hidden="true" />Generating…</>
                            : '✨ Generate with Gemini'}
                        </button>
                        <button className="btn btn-sm" onClick={() => update({ method: 'manual' })}>
                          Fill manually instead
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: '#F0FDF4', border: '1px solid #BBF7D0',
                      borderRadius: 'var(--r-md)', padding: '10px 14px',
                      fontSize: 12.5, color: '#166534', display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                      <span aria-hidden="true">✓</span>
                      Form pre-filled by Gemini. Review and edit the fields below before continuing.
                      <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setAiBuilderDone(false); setAiBuilderInput('') }}>
                        Regenerate
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FormField label="Request title" required error={errors.title} id="req-title">
                  <input id="req-title" className="input" value={form.title}
                    onChange={(e) => update({ title: e.target.value })}
                    placeholder="e.g. Sahab Cloud — primary IaaS hosting" />
                </FormField>
                <FormField label="Description" required error={errors.description} id="req-desc"
                  help="Explain what data is involved, why this request is needed, and what business purpose it serves.">
                  <textarea id="req-desc" className="textarea" rows={5} value={form.description}
                    onChange={(e) => update({ description: e.target.value })}
                    placeholder="Describe the data processing activity, the parties involved, and the intended use case…" />
                </FormField>
                {(requestType === 'vendor_onboarding' || requestType === 'data_sharing_external') && (
                  <FormField label="Vendor / recipient name" id="req-vendor">
                    <input id="req-vendor" className="input" value={form.vendorName}
                      onChange={(e) => update({ vendorName: e.target.value })}
                      placeholder="Legal entity name" />
                  </FormField>
                )}
                {(requestType === 'cross_border_transfer' || requestType === 'vendor_onboarding') && (
                  <FormField label="Jurisdiction" id="req-jur" help="Country where the vendor/recipient is based.">
                    <select id="req-jur" className="select" value={form.vendorJurisdiction}
                      onChange={(e) => update({ vendorJurisdiction: e.target.value })}>
                      <option value="KSA">Kingdom of Saudi Arabia</option>
                      <option value="UAE">United Arab Emirates</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="EU">European Union</option>
                      <option value="Other">Other</option>
                    </select>
                  </FormField>
                )}
                <FormField label="Tags" id="req-tags" help="Comma-separated labels, e.g. restricted-data, tier-1-vendor">
                  <input id="req-tags" className="input" value={form.tags}
                    onChange={(e) => update({ tags: e.target.value })}
                    placeholder="restricted-data, tier-1-vendor" />
                </FormField>
              </div>
            </section>
          )}

          {/* ── Step: Data declaration ── */}
          {currentStep === 'declaration' && (
            <section aria-labelledby="step-decl">
              <h2 id="step-decl" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Data declaration</h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 22, fontSize: 13.5 }}>
                Describe the personal data involved. This information drives the AI PDPL assessment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FormField label="Data categories (select all that apply)" id="req-cats">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['name', 'national_id', 'email', 'phone', 'iban', 'transaction_history', 'device_id', 'location', 'biometric', 'health'].map((cat) => {
                      const checked = form.dataCategories.includes(cat)
                      return (
                        <label key={cat} style={{
                          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                          padding: '5px 10px', borderRadius: 'var(--r-md)',
                          border: `1px solid ${checked ? 'var(--brand-700)' : 'var(--line)'}`,
                          background: checked ? 'var(--brand-50)' : 'var(--surface-0)',
                          fontSize: 12.5, fontFamily: 'var(--font-mono)',
                          transition: 'all var(--t-fast)',
                        }}>
                          <input type="checkbox" checked={checked} style={{ display: 'none' }}
                            onChange={() => update({
                              dataCategories: checked
                                ? form.dataCategories.filter((c) => c !== cat)
                                : [...form.dataCategories, cat],
                            })} />
                          {cat.replace(/_/g, ' ')}
                        </label>
                      )
                    })}
                  </div>
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FormField label="Estimated data subjects" required error={errors.estimatedSubjects} id="req-subj">
                    <input id="req-subj" className="input" type="number" min="0"
                      value={form.estimatedSubjects} onChange={(e) => update({ estimatedSubjects: e.target.value })}
                      placeholder="e.g. 50000" />
                  </FormField>
                  <FormField label="Retention period (days)" required error={errors.retentionDays} id="req-ret">
                    <input id="req-ret" className="input" type="number" min="1"
                      value={form.retentionDays} onChange={(e) => update({ retentionDays: e.target.value })}
                      placeholder="e.g. 730" />
                  </FormField>
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
                    <input type="checkbox" checked={form.crossBorder} onChange={(e) => update({ crossBorder: e.target.checked })} />
                    Cross-border transfer involved
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
                    <input type="checkbox" checked={form.consentObtained} onChange={(e) => update({ consentObtained: e.target.checked })} />
                    Data subject consent obtained
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
                    <input type="checkbox" checked={form.hasDPA} onChange={(e) => update({ hasDPA: e.target.checked })} />
                    DPA signed
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* ── Step: AI assessment ── */}
          {currentStep === 'assessment' && (
            <section aria-labelledby="step-assess">
              <h2 id="step-assess" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                AI PDPL assessment
              </h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 20, fontSize: 13.5 }}>
                Review the AI-generated assessment before submitting. Address any critical or high-risk findings before proceeding.
              </p>

              {/* Loading state */}
              {assessmentLoading && (
                <div style={{
                  padding: '16px 18px', background: 'var(--surface-1)',
                  border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16, animation: 'spin 1.2s linear infinite', display: 'inline-block' }} aria-hidden="true">⏳</span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-600)' }}>Generating PDPL assessment…</span>
                </div>
              )}

              {/* Streaming preview — shown while tokens arrive */}
              {(assessmentLoading || assessmentText) && (
                <div style={{
                  padding: '16px 18px',
                  background: 'var(--surface-0)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-lg)',
                  fontSize: 13.5,
                  lineHeight: 1.75,
                  color: 'var(--ink-800)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-sans)',
                  minHeight: 120,
                }}>
                  {assessmentLoading ? streamingText : assessmentText}
                  {assessmentLoading && (
                    <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--brand-700)', verticalAlign: 'text-bottom', marginLeft: 1, animation: 'blink 1s step-end infinite' }} aria-hidden="true" />
                  )}
                </div>
              )}

              {/* Error state */}
              {assessmentError && (
                <div style={{
                  padding: '14px 16px', background: 'var(--red-50)',
                  border: '1px solid #FECACA', borderRadius: 'var(--r-md)',
                  fontSize: 13, color: 'var(--red-700)', display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <span aria-hidden="true">⚠️</span>
                  <span style={{ flex: 1 }}>{assessmentError}</span>
                  <button className="btn btn-sm" onClick={() => void runAssessment()}>Retry</button>
                </div>
              )}
            </section>
          )}

          {/* ── Step: Confirm ── */}
          {currentStep === 'confirm' && (
            <section aria-labelledby="step-confirm">
              <h2 id="step-confirm" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Review and submit</h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 22, fontSize: 13.5 }}>
                Verify the details below before submitting. Once submitted, the request will be routed to the Data Management queue.
              </p>
              <div className="card" style={{ padding: '18px 20px', marginBottom: 20 }}>
                <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px 16px', fontSize: 13.5 }}>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 500 }}>Type</dt>
                  <dd>{REQUEST_TYPE_LABELS[requestType]}</dd>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 500 }}>Title</dt>
                  <dd style={{ fontWeight: 500 }}>{form.title || <em style={{ color: 'var(--ink-400)' }}>Not set</em>}</dd>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 500 }}>Requester</dt>
                  <dd>{user.fullName}</dd>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 500 }}>Data categories</dt>
                  <dd>{form.dataCategories.length > 0 ? form.dataCategories.join(', ') : '—'}</dd>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 500 }}>Est. subjects</dt>
                  <dd>{form.estimatedSubjects || '—'}</dd>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 500 }}>Retention (days)</dt>
                  <dd>{form.retentionDays || '—'}</dd>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 500 }}>Cross-border</dt>
                  <dd>{form.crossBorder ? 'Yes' : 'No'}</dd>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 500 }}>DPA signed</dt>
                  <dd>{form.hasDPA ? 'Yes' : 'No'}</dd>
                </dl>
              </div>
              <div style={{
                padding: '12px 16px', background: 'var(--amber-50)',
                border: '1px solid #FDE68A', borderRadius: 'var(--r-md)',
                fontSize: 13, color: 'var(--amber-700)', marginBottom: 20,
              }}>
                <strong>Submitting is final.</strong> You cannot retract a submitted request; only a reviewer can return it to you. Ensure all details are accurate.
              </div>
            </section>
          )}

          {/* Nav buttons */}
          {currentStep !== 'method' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
              <button className="btn" onClick={back}>← Back</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => { saveDraft(form); showToast('Draft saved.', 'info') }}>
                Save draft
              </button>
              {currentStep === 'confirm' ? (
                <button className="btn btn-primary btn-lg" onClick={() => void submit()} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={next}
                  disabled={currentStep === 'assessment' && (assessmentLoading || !!assessmentError)}
                >
                  {currentStep === 'assessment' && assessmentLoading ? 'Generating…' : 'Continue →'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* AI side panel — shown during declaration and assessment steps */}
        {(currentStep === 'declaration' || currentStep === 'assessment') && (
          <aside style={{
            width: 340, flexShrink: 0, borderLeft: '1px solid var(--line)',
            display: 'flex', flexDirection: 'column', padding: 16,
            background: 'var(--surface-0)',
          }} aria-label="AI guidance panel">
            <AICoPilotPanel
              title="PDPL Policy Guidance"
              cannedKey="policy_chat_pdpl29"
              initialText={
                currentStep === 'assessment'
                  ? 'Assessment complete — ask any follow-up question about PDPL requirements for this request type.'
                  : undefined
              }
              context={`${REQUEST_TYPE_LABELS[requestType]} — ${form.title || 'Untitled'}`}
              feature="policy_chat"
            />
          </aside>
        )}
      </div>
    </div>
  )
}
