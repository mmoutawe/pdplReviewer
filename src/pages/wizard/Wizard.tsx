import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RequestType } from '../../data/types'
import { REQUEST_TYPE_LABELS, AI_GENERATIONS, PRE_ASSESSMENTS } from '../../data/seed'
import { Stepper } from '../../components/forms'
import { FormField } from '../../components/forms'
import { AICoPilotPanel } from '../../components/AICoPilotPanel'
import { ConfidenceBadge } from '../../components/primitives'
import { showToast, saveDraft, loadDraft, clearDraft, authStore } from '../../store'
import { useStore } from '../../hooks/useStore'

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

  const requestType = type as RequestType
  const stepIndex = StepIndex(currentStep)

  useEffect(() => {
    document.title = `New ${REQUEST_TYPE_LABELS[requestType] ?? 'Request'} — PDPL Reviewer`
  }, [requestType])

  // Autosave
  useEffect(() => { saveDraft(form) }, [form])

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

  function submit() {
    if (!validate('confirm')) return
    clearDraft()
    setSubmitted(true)
    showToast('Request submitted successfully.', 'success')
  }

  // Demo assessment — use Zenith if vendor type, otherwise Sahab
  const demoAssessment = PRE_ASSESSMENTS[0]
  const demoGen = AI_GENERATIONS.find((g) => g.id === demoAssessment.generationId)

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
              <h2 id="step-init" style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Request details</h2>
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
                Review the AI-generated assessment before submitting. Address any <strong>critical</strong> or <strong>high</strong> findings before proceeding.
              </p>

              {/* Risk summary */}
              <div style={{
                display: 'flex', gap: 12, marginBottom: 20,
                padding: '14px 18px',
                background: demoAssessment.overallRisk === 'low' ? 'var(--emerald-50)' : 'var(--amber-50)',
                border: `1px solid ${demoAssessment.overallRisk === 'low' ? '#BBF7D0' : '#FDE68A'}`,
                borderRadius: 'var(--r-lg)', alignItems: 'center',
              }}>
                <span style={{ fontSize: 24 }} aria-hidden="true">
                  {demoAssessment.overallRisk === 'low' ? '✅' : demoAssessment.overallRisk === 'high' ? '🚨' : '⚠️'}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-900)' }}>
                    Overall risk: <span style={{ textTransform: 'capitalize' }}>{demoAssessment.overallRisk}</span>
                    {' · '}
                    PDPL alignment: <span style={{ textTransform: 'capitalize' }}>{demoAssessment.pdplAlignment}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 2 }}>{demoAssessment.summary}</div>
                </div>
                {demoGen && <ConfidenceBadge score={demoGen.confidence} />}
              </div>

              {/* Findings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {demoAssessment.findings.map((f) => {
                  const sev = f.severity
                  const bg = sev === 'critical' || sev === 'high' ? 'var(--red-50)' : sev === 'medium' ? 'var(--amber-50)' : 'var(--surface-1)'
                  const border = sev === 'critical' || sev === 'high' ? '#FECACA' : sev === 'medium' ? '#FDE68A' : 'var(--line)'
                  return (
                    <div key={f.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 'var(--r-md)', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          color: sev === 'critical' || sev === 'high' ? 'var(--red-700)' : sev === 'medium' ? 'var(--amber-700)' : 'var(--ink-500)',
                        }}>{sev}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-800)' }}>{f.title}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.6, margin: 0 }}>{f.detail}</p>
                      {f.remediation && (
                        <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 6, fontStyle: 'italic' }}>
                          Recommendation: {f.remediation}
                        </p>
                      )}
                      {f.citations.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {f.citations.map((c) => (
                            <abbr key={c.id} className={`cite ${c.source === 'pdpl' ? 'cite-pdpl' : 'cite-policy'}`} title={c.excerpt}>{c.ref}</abbr>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
                <button className="btn btn-primary btn-lg" onClick={submit}>Submit request</button>
              ) : (
                <button className="btn btn-primary" onClick={next}>Continue →</button>
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
              title={currentStep === 'assessment' ? 'AI Assessment' : 'AI Policy Guidance'}
              cannedKey="policy_chat_pdpl29"
              citations={demoGen?.citations ?? []}
              confidence={demoGen?.confidence}
              initialText={currentStep === 'assessment' ? demoAssessment.summary : undefined}
              context={`${REQUEST_TYPE_LABELS[requestType]} — ${form.title || 'Untitled'}`}
              feature="request_builder"
            />
          </aside>
        )}
      </div>
    </div>
  )
}
