import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RequestType, Ticket, TicketPayload } from '../../data/types'
import { REQUEST_TYPE_LABELS, VENDORS, PROJECTS } from '../../data/seed'
import { Stepper } from '../../components/forms'
import { FormField } from '../../components/forms'
import { AICoPilotPanel } from '../../components/AICoPilotPanel'
import { showToast, saveDraft, loadDraft, clearDraft, authStore, updateTicket, demoAddTicket, ticketStore } from '../../store'
import { getWorkflowSettings } from '../../lib/workflowSettings'
import { useStore } from '../../hooks/useStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { createTicket, submitTicket } from '../../api/tickets'
import { chatWithRequestBuilder, type ChatMessage, type RequestBuilderResult, type RequestBuilderType } from '../../api/aiRequestBuilder'
import { runPresubmitAssessment, type PresubmitRequestType } from '../../api/aiPresubmit'
import { PresubmitAssessmentView } from '../../components/PresubmitAssessmentView'

type Method = 'manual' | 'ai' | 'xlsx'

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { key: 'method',         label: 'Creation method' },
  { key: 'vendor_project', label: 'Vendor & Project' },
  { key: 'initiation',     label: 'Initiation' },
  { key: 'declaration',    label: 'Data declaration' },
  { key: 'assessment',     label: 'AI assessment' },
  { key: 'confirm',        label: 'Confirm & submit' },
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
  // linked vendor / project (optional, set from URL search params)
  linkedVendorId: string
  linkedProjectId: string
  // type-specific questionnaire fields
  certifications: string[]
  subprocessors: string
  contractRef: string
  transferMechanism: string
  hasSaudiCopy: boolean
  docClassification: string
  docExpiry: string
  legalBasis: string
  systemName: string
  accessLevel: string
  accessDuration: string
  processingRoles: Array<{ role: string; party: string; description: string }>
}

const empty: WizardState = {
  method: 'manual', title: '', description: '',
  vendorName: '', vendorJurisdiction: 'KSA', hasDPA: false,
  dataCategories: [], estimatedSubjects: '', retentionDays: '',
  crossBorder: false, consentObtained: false, tags: '',
  linkedVendorId: '', linkedProjectId: '',
  certifications: [], subprocessors: '', contractRef: '',
  transferMechanism: 'sccs', hasSaudiCopy: false,
  docClassification: 'internal', docExpiry: '',
  legalBasis: 'legitimate_interest',
  systemName: '', accessLevel: 'read', accessDuration: '30d',
  processingRoles: [],
}

export default function Wizard() {
  const { type, method: urlMethod } = useParams<{ type: RequestType; method: string }>()
  const navigate = useNavigate()
  const { user } = useStore(authStore)

  const [currentStep, setCurrentStep] = useState(urlMethod === 'method' ? 'method' : 'initiation')
  const [form, setForm] = useState<WizardState>(() => {
    const draft = loadDraft<WizardState>()
    return draft ?? empty
  })
  const [errors, setErrors] = useState<Partial<Record<keyof WizardState, string>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assessmentData, setAssessmentData] = useState<Record<string, unknown> | null>(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatDone, setChatDone] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatInputRef  = useRef<HTMLInputElement>(null)
  const [xlsxFile, setXlsxFile] = useState<File | null>(null)
  const [xlsxParsing, setXlsxParsing] = useState(false)
  const [vendorSearch, setVendorSearch] = useState('')
  const [extraVendors, setExtraVendors] = useState<typeof VENDORS>([])
  const [showNewVendorModal, setShowNewVendorModal] = useState(false)
  const [newVendorForm, setNewVendorForm] = useState({ name: '', legalName: '', category: 'Technology', jurisdiction: '', contactName: '', contactEmail: '' })

  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chatMessages, chatLoading])

  useEffect(() => {
    if (!chatLoading && chatMessages.length > 0 && !chatDone)
      chatInputRef.current?.focus()
  }, [chatLoading, chatMessages.length, chatDone])

  const requestType = type as RequestType
  const stepIndex = StepIndex(currentStep)

  useEffect(() => {
    document.title = `New ${REQUEST_TYPE_LABELS[requestType] ?? 'Request'} — PDPL Reviewer`
  }, [requestType])

  // Autosave
  useEffect(() => { saveDraft(form) }, [form])

  // Clear draft when leaving the wizard without submitting
  useEffect(() => { return () => { clearDraft() } }, [])

  // Auto-trigger AI assessment when entering step
  useEffect(() => {
    if (currentStep !== 'assessment' || assessmentData || assessmentLoading) return
    void runAssessment()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  async function runAssessment() {
    setAssessmentLoading(true)
    setAssessmentError(null)
    try {
      const initiation = {
        title: form.title,
        description: form.description,
        ...(form.vendorName       && { vendorName:         form.vendorName }),
        ...(form.vendorJurisdiction && { vendorJurisdiction: form.vendorJurisdiction }),
        ...(form.tags             && { tags:               form.tags }),
      }
      const questionnaire = {
        dataCategories:    form.dataCategories,
        estimatedSubjects: form.estimatedSubjects,
        retentionDays:     form.retentionDays,
        crossBorder:       form.crossBorder,
        consentObtained:   form.consentObtained,
        hasDPA:            form.hasDPA,
      }
      const data = await runPresubmitAssessment(requestType as PresubmitRequestType, initiation, questionnaire)
      setAssessmentData(data)
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : 'Assessment failed. Please try again.')
    } finally {
      setAssessmentLoading(false)
    }
  }

  // Auto-start chat when entering the initiation step in AI mode
  useEffect(() => {
    if (form.method !== 'ai' || currentStep !== 'initiation') return
    if (chatMessages.length > 0 || chatLoading || chatDone) return
    void startChat()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.method, currentStep])

  async function startChat() {
    setChatLoading(true)
    setChatError(null)
    try {
      const { message, result } = await chatWithRequestBuilder(
        requestType as RequestBuilderType,
        [],
      )
      if (result) {
        applyBuilderResult(result)
      } else {
        setChatMessages([{ role: 'assistant', content: message }])
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to start conversation')
    } finally {
      setChatLoading(false)
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() }
    const next = [...chatMessages, userMsg]
    setChatMessages(next)
    setChatInput('')
    setChatLoading(true)
    setChatError(null)
    try {
      const { message, result } = await chatWithRequestBuilder(
        requestType as RequestBuilderType,
        next,
      )
      if (result) {
        applyBuilderResult(result)
      } else {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: message }])
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setChatLoading(false)
    }
  }

  function applyBuilderResult(result: RequestBuilderResult) {
    update({
      title:             result.title             ?? form.title,
      description:       result.description       ?? form.description,
      vendorName:        result.vendorName        ?? form.vendorName,
      vendorJurisdiction: result.vendorJurisdiction ?? form.vendorJurisdiction,
      hasDPA:            result.hasDPA            ?? form.hasDPA,
      dataCategories:    result.dataCategories    ?? form.dataCategories,
      estimatedSubjects: result.estimatedSubjects ?? form.estimatedSubjects,
      retentionDays:     result.retentionDays     ?? form.retentionDays,
      crossBorder:       result.crossBorder       ?? form.crossBorder,
    })
    setChatDone(true)
  }

  function update(partial: Partial<WizardState>) {
    setForm((f) => ({ ...f, ...partial }))
  }

  function handleCreateVendor() {
    if (!newVendorForm.name.trim()) return
    const id = `v-new-${Date.now()}`
    const vendor: typeof VENDORS[number] = {
      id, tradeName: newVendorForm.name.trim(),
      legalName: newVendorForm.legalName.trim() || newVendorForm.name.trim(),
      jurisdiction: newVendorForm.jurisdiction.trim() || 'KSA',
      category: newVendorForm.category,
      primaryContact: newVendorForm.contactEmail.trim(),
      riskScore: 50, riskTier: 'medium', status: 'pending',
      certifications: [], hasDPA: false,
      lastReviewedAt: new Date().toISOString().slice(0, 10),
      ticketIds: [], notes: '',
    }
    setExtraVendors((prev) => [...prev, vendor])
    update({ linkedVendorId: id, linkedProjectId: '' })
    setNewVendorForm({ name: '', legalName: '', category: 'Technology', jurisdiction: '', contactName: '', contactEmail: '' })
    setShowNewVendorModal(false)
  }

  function downloadTemplate() {
    const header = [
      'Title', 'Description', 'Vendor / Recipient Name', 'Jurisdiction',
      'Data Categories (comma-separated: name,email,phone,national_id,iban,transaction_history,device_id,location,biometric,health)',
      'Estimated Data Subjects', 'Retention Period (days)',
      'Cross-border Transfer (Yes/No)', 'Consent Obtained (Yes/No)', 'DPA Signed (Yes/No)',
      'Tags (comma-separated)',
    ]
    const example = [
      'Sahab Cloud — primary IaaS hosting',
      'Cloud infrastructure provider that will store and process customer personal data on our behalf.',
      'Sahab Cloud Ltd', 'UAE', 'email,phone,name',
      '50000', '730', 'No', 'Yes', 'Yes', 'tier-1-vendor,restricted-data',
    ]
    const csv = [header, example].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'pdpl-request-template.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function parseXlsxFile(file: File) {
    setXlsxParsing(true)
    try {
      const text = await file.text()
      const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
      if (lines.length < 2) {
        showToast('Template appears empty — fill in at least one data row.', 'error')
        return
      }
      function parseRow(line: string): string[] {
        const result: string[] = []
        let inQ = false, cur = ''
        for (const ch of line) {
          if (ch === '"' && !inQ) { inQ = true }
          else if (ch === '"' && inQ) { inQ = false }
          else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
          else { cur += ch }
        }
        result.push(cur.trim())
        return result
      }
      const row = parseRow(lines[1])
      const [title, description, vendorName, vendorJurisdiction, dataCatRaw,
             estimatedSubjects, retentionDays, crossBorderRaw, consentRaw, dpaRaw, tags] = row
      const toBool = (v: string) => v?.toLowerCase().startsWith('y')
      const cats = dataCatRaw
        ? dataCatRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : []
      update({
        title: title || '',
        description: description || '',
        vendorName: vendorName || '',
        vendorJurisdiction: vendorJurisdiction || 'KSA',
        dataCategories: cats,
        estimatedSubjects: estimatedSubjects || '',
        retentionDays: retentionDays || '',
        crossBorder: toBool(crossBorderRaw),
        consentObtained: toBool(consentRaw),
        hasDPA: toBool(dpaRaw),
        tags: tags || '',
      })
      showToast('Template parsed — review the pre-filled fields below.', 'success')
      const idx = StepIndex(currentStep)
      if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].key)
    } catch {
      showToast('Could not read the file. Make sure you upload the CSV template.', 'error')
    } finally {
      setXlsxParsing(false)
    }
  }

  function defaultProcessingRoles(): WizardState['processingRoles'] {
    const org = 'PDPL Reviewer Org'
    const vendor = form.vendorName || 'Third Party'
    if (requestType === 'vendor_onboarding') return [
      { role: 'Controller', party: org, description: 'Determines purposes and means of processing' },
      { role: 'Processor', party: vendor, description: 'Processes data on behalf of the controller per DPA' },
    ]
    if (requestType === 'cross_border_transfer') return [
      { role: 'Data Exporter (Controller)', party: org, description: 'Transfers personal data outside KSA' },
      { role: 'Data Importer', party: vendor, description: `Receives data in ${form.vendorJurisdiction}` },
    ]
    if (requestType === 'data_sharing_external') return [
      { role: 'Disclosing Controller', party: org, description: 'Shares dataset with receiving party' },
      { role: 'Receiving Party', party: vendor || 'External Org', description: 'Receives and uses the shared dataset' },
    ]
    if (requestType === 'external_document_sharing') return [
      { role: 'Document Owner', party: org, description: 'Shares document under restricted access' },
      { role: 'Recipient', party: vendor || 'External Recipient', description: 'Receives read access to the document' },
    ]
    if (requestType === 'internal_data_access') return [
      { role: 'Data Owner', party: org, description: 'Owns and governs the dataset' },
      { role: 'Accessor', party: user.fullName, description: `${form.systemName || 'System'} — ${form.accessLevel} access` },
    ]
    return []
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
    const nextKey = STEPS[idx + 1]?.key
    if (currentStep === 'vendor_project' && form.linkedVendorId) {
      const v = VENDORS.find((x) => x.id === form.linkedVendorId)
      if (v) update({ vendorName: v.tradeName, vendorJurisdiction: v.jurisdiction })
    }
    if (nextKey === 'confirm') {
      update({ processingRoles: defaultProcessingRoles() })
    }
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
        // Demo mode — build a full Ticket and inject it into the store
        const sensitive = ['biometric', 'health', 'national_id']
        const financial  = ['iban', 'transaction_history']
        const now        = new Date().toISOString()
        const year       = new Date().getFullYear()
        const count      = ticketStore.getState().tickets.length + 1
        const newId      = `PDPL-${year}-${String(count).padStart(4, '0')}`

        const payloadMap: Record<RequestType, TicketPayload> = {
          vendor_onboarding: {
            kind: 'vendor_onboarding', vendorName: form.vendorName || 'Unknown Vendor',
            vendorWebsite: '', servicesProvided: '', dataProcessingPurpose: form.description,
            contractRef: '', hasDPA: form.hasDPA, vendorJurisdiction: form.vendorJurisdiction,
            subprocessors: [], certifications: [],
          },
          external_document_sharing: {
            kind: 'external_document_sharing', documentTitle: form.title,
            recipientName: form.vendorName || '', recipientOrg: form.vendorName || '',
            recipientEmail: '', recipientJurisdiction: form.vendorJurisdiction,
            purpose: form.description, retentionDays: Number(form.retentionDays) || 30,
            expiryAt: new Date(Date.now() + (Number(form.retentionDays) || 30) * 86400000).toISOString(),
          },
          data_sharing_external: {
            kind: 'data_sharing_external', recipientOrg: form.vendorName || '',
            recipientJurisdiction: form.vendorJurisdiction, legalBasis: 'legitimate_interest',
            datasetName: form.title, rowCountEstimate: Number(form.estimatedSubjects) || 0,
            fieldsShared: form.dataCategories, encryptionAtRest: true, encryptionInTransit: true,
            recipientUseCase: form.description,
          },
          internal_data_access: {
            kind: 'internal_data_access', systemName: '', datasetName: form.title,
            accessLevel: 'read', accessDuration: '30d', businessJustification: form.description,
            managerApproverId: '', fieldsRequested: form.dataCategories,
          },
          cross_border_transfer: {
            kind: 'cross_border_transfer', destinationCountry: form.vendorJurisdiction,
            destinationOrg: form.vendorName || '', transferMechanism: 'sccs',
            dataCategories: form.dataCategories, estimatedRecords: Number(form.estimatedSubjects) || 0,
            encryptionInTransit: true, destinationCertifications: [], hasSaudiResidencyCopy: false,
          },
        }

        const demoTicket: Ticket = {
          id: newId, type: requestType, state: 'in_data_management',
          title: form.title, description: form.description, requesterId: user.id,
          vendorId: form.linkedVendorId || undefined,
          projectId: form.linkedProjectId || undefined,
          createdAt: now, updatedAt: now, submittedAt: now,
          payload: payloadMap[requestType],
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
          reviews: [{ role: 'data_management', reviewerId: null, verdict: 'pending' }],
          sla: {
            ackHours: 24, decisionHours: 72, startedAt: now, breached: false,
            decisionDueAt: new Date(Date.now() + 72 * 3600000).toISOString(),
          },
          attachments: [], returnThread: [],
          tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        }

        // Apply auto-route for low risk if setting is enabled
        const cfg = getWorkflowSettings()
        const isLowRisk = assessmentData && (assessmentData as Record<string,unknown>).riskLevel === 'low'
        if (cfg.autoRouteLowRisk && isLowRisk) {
          demoTicket.state = 'approved'
        }

        demoAddTicket(demoTicket)
        clearDraft()
        showToast(cfg.autoRouteLowRisk && isLowRisk ? 'Auto-approved (low risk).' : 'Request submitted successfully.', 'success')
        navigate(`/requests/${newId}`)
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

          {/* ── Step: Vendor & Project ── */}
          {currentStep === 'vendor_project' && (
            <section aria-labelledby="step-vendor-project">
              <h2 id="step-vendor-project" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Select Vendor &amp; Project</h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 20, fontSize: 13.5 }}>
                Choose the vendor and project for this compliance review request.
              </p>

              {/* Vendor card */}
              <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ color: 'var(--ink-500)', flexShrink: 0 }}>
                    <rect x="1" y="4" width="13" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Vendor</span>
                </div>

                {/* Search row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"
                      style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }}>
                      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <input
                      type="text" placeholder="Search vendors…"
                      value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px 7px 28px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap', gap: 4 }} onClick={() => setShowNewVendorModal(true)}>
                    <span aria-hidden="true">+</span> New Vendor
                  </button>
                </div>

                {/* Vendor list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...VENDORS, ...extraVendors].filter((v) => !vendorSearch || v.tradeName.toLowerCase().includes(vendorSearch.toLowerCase()) || v.category.toLowerCase().includes(vendorSearch.toLowerCase())).map((v) => {
                    const selected = form.linkedVendorId === v.id
                    return (
                      <button key={v.id}
                        onClick={() => update({ linkedVendorId: selected ? '' : v.id, linkedProjectId: '' })}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                          border: `1px solid ${selected ? 'var(--brand-700)' : 'var(--line)'}`,
                          borderRadius: 'var(--r-md)',
                          background: selected ? 'var(--brand-50)' : 'var(--surface-0)',
                          transition: 'all var(--t-fast)',
                        }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{v.tradeName}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{v.category} · {v.jurisdiction}</div>
                        </div>
                        <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: v.status === 'active' ? 'var(--green-100)' : 'var(--amber-100)', color: v.status === 'active' ? 'var(--green-700)' : 'var(--amber-700)', fontWeight: 600 }}>
                          {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Project card — only shown after a vendor is selected */}
              {form.linkedVendorId && (
                <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ color: 'var(--ink-500)', flexShrink: 0 }}>
                      <rect x="1" y="3" width="13" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M5 3V2h5v1" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>
                      Project under {VENDORS.find((v) => v.id === form.linkedVendorId)?.tradeName}
                    </span>
                  </div>

                  <button className="btn btn-ghost btn-sm" style={{ marginBottom: 10, gap: 4 }}>
                    <span aria-hidden="true">+</span> New Project
                  </button>

                  {(() => {
                    const vendorProjects = PROJECTS.filter((p) => p.vendorId === form.linkedVendorId)
                    if (vendorProjects.length === 0) {
                      return <p style={{ fontSize: 13, color: 'var(--ink-400)', padding: '8px 0' }}>No projects linked to this vendor yet.</p>
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {vendorProjects.map((p) => {
                          const selected = form.linkedProjectId === p.id
                          return (
                            <button key={p.id}
                              onClick={() => update({ linkedProjectId: selected ? '' : p.id })}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                                border: `1px solid ${selected ? 'var(--brand-700)' : 'var(--line)'}`,
                                borderRadius: 'var(--r-md)',
                                background: selected ? 'var(--brand-50)' : 'var(--surface-0)',
                                transition: 'all var(--t-fast)',
                              }}>
                              <div>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{p.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{p.code} · {p.businessUnit}</div>
                              </div>
                              <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: p.status === 'active' ? 'var(--green-100)' : 'var(--amber-100)', color: p.status === 'active' ? 'var(--green-700)' : 'var(--amber-700)', fontWeight: 600 }}>
                                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── New Vendor Modal ── */}
              {showNewVendorModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={(e) => { if (e.target === e.currentTarget) setShowNewVendorModal(false) }}>
                  <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>New Vendor</h3>
                      <button onClick={() => setShowNewVendorModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)', fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                      {/* Name */}
                      <div style={{ gridColumn: '1' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>
                          Name <span style={{ color: 'var(--red-600)' }}>*</span>
                        </label>
                        <input value={newVendorForm.name} onChange={(e) => setNewVendorForm((f) => ({ ...f, name: e.target.value }))}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${!newVendorForm.name.trim() && showNewVendorModal ? 'var(--brand-700)' : 'var(--line)'}`, borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }}
                          autoFocus />
                      </div>

                      {/* Legal Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>Legal Name</label>
                        <input value={newVendorForm.legalName} onChange={(e) => setNewVendorForm((f) => ({ ...f, legalName: e.target.value }))}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }} />
                      </div>

                      {/* Type */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>Type</label>
                        <select value={newVendorForm.category} onChange={(e) => setNewVendorForm((f) => ({ ...f, category: e.target.value }))}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }}>
                          {['Technology', 'IaaS / hosting', 'Payments processing', 'Marketing analytics', 'KYC / identity verification', 'Survey & research', 'Customer relationship mgmt.', 'Legal & compliance', 'Other'].map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Country */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>Country</label>
                        <input value={newVendorForm.jurisdiction} onChange={(e) => setNewVendorForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                          placeholder="e.g. KSA, UAE, US"
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }} />
                      </div>

                      {/* Contact Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>Contact Name</label>
                        <input value={newVendorForm.contactName} onChange={(e) => setNewVendorForm((f) => ({ ...f, contactName: e.target.value }))}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }} />
                      </div>

                      {/* Contact Email */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>Contact Email</label>
                        <input type="email" value={newVendorForm.contactEmail} onChange={(e) => setNewVendorForm((f) => ({ ...f, contactEmail: e.target.value }))}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                      <button className="btn btn-ghost" onClick={() => setShowNewVendorModal(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={handleCreateVendor} disabled={!newVendorForm.name.trim()}>
                        Create Vendor
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Step: Method ── */}
          {currentStep === 'method' && (
            <section aria-labelledby="step-method">
              <h2 id="step-method" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>How would you like to create this request?</h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 24, fontSize: 13.5 }}>
                The AI builder helps you describe your use case in plain language and generates a structured form.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { m: 'manual' as Method, icon: '📋', label: 'Fill out manually', desc: 'Complete the form fields directly.' },
                  { m: 'ai' as Method, icon: '✨', label: 'AI request builder', desc: 'Describe your use case in plain language and let AI structure it for you.' },
                  { m: 'xlsx' as Method, icon: '📊', label: 'Upload Excel template', desc: 'Download the blank template, fill it in offline, then upload for automatic field extraction.' },
                ]).map(({ m, icon, label, desc }) => (
                  <button key={m}
                    onClick={() => { update({ method: m }); if (m !== 'xlsx') next() }}
                    style={{
                      padding: '18px 20px', borderRadius: 'var(--r-lg)',
                      border: `1px solid ${form.method === m ? 'var(--brand-700)' : 'var(--line)'}`,
                      background: form.method === m ? 'var(--brand-50)' : 'var(--surface-0)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all var(--t-fast)',
                    }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
                      {icon} {label}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{desc}</div>
                  </button>
                ))}
              </div>

              {/* XLSX upload panel — shown after selecting the xlsx method */}
              {form.method === 'xlsx' && (
                <div style={{ marginTop: 20, padding: '20px 22px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Step 1: download */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 1 — Download blank template</div>
                    <button className="btn btn-ghost btn-sm" onClick={downloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                        <path d="M6.5 1v8M3.5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      Download pdpl-request-template.csv
                    </button>
                    <p style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 6 }}>Open in Excel or Google Sheets, fill in row 2, save as CSV.</p>
                  </div>

                  {/* Step 2: upload */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 2 — Upload completed template</div>
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: '20px 16px',
                      border: `2px dashed ${xlsxFile ? 'var(--brand-700)' : 'var(--line)'}`,
                      borderRadius: 'var(--r-md)', cursor: 'pointer',
                      background: xlsxFile ? 'var(--brand-50)' : 'var(--surface-0)',
                      transition: 'all var(--t-fast)',
                    }}>
                      <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                        onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)} />
                      {xlsxFile ? (
                        <>
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M4 10l4 4 8-8" stroke="var(--brand-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-800)' }}>{xlsxFile.name}</span>
                          <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>Click to replace</span>
                        </>
                      ) : (
                        <>
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)' }}>
                            <path d="M11 3v12M7 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M3 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                          </svg>
                          <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>Click to select your filled template</span>
                          <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>.csv, .xlsx, .xls</span>
                        </>
                      )}
                    </label>
                  </div>

                  {/* Extract button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      disabled={!xlsxFile || xlsxParsing}
                      onClick={() => xlsxFile && void parseXlsxFile(xlsxFile)}
                    >
                      {xlsxParsing ? 'Extracting fields…' : 'Extract & continue →'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Step: Initiation ── */}
          {currentStep === 'initiation' && (
            <section aria-labelledby="step-init">
              <h2 id="step-init" style={{ fontSize: 18, fontWeight: 700, marginBottom: form.method === 'ai' ? 8 : 20 }}>Request details</h2>

              {/* AI builder chat — shown only when method === 'ai' */}
              {form.method === 'ai' && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    border: '1px solid var(--brand-200)', borderRadius: 'var(--r-lg)',
                    overflow: 'hidden', background: 'var(--surface-0)',
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: '10px 14px', background: 'var(--brand-50)',
                      borderBottom: '1px solid var(--brand-200)',
                      fontSize: 13, fontWeight: 600, color: 'var(--brand-800)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span aria-hidden="true">✨</span> AI Request Builder
                      <button className="btn btn-sm" style={{ marginLeft: 'auto', fontSize: 12 }}
                        onClick={() => update({ method: 'manual' })}>
                        Fill manually
                      </button>
                    </div>

                    {/* Messages */}
                    <div ref={chatScrollRef} style={{
                      maxHeight: 300, overflowY: 'auto', padding: '12px 14px',
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                      {chatMessages.length === 0 && chatLoading && (
                        <div style={{ fontSize: 13, color: 'var(--ink-400)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite' }} aria-hidden="true">⏳</span>
                          Starting conversation…
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '85%', padding: '8px 12px', fontSize: 13, lineHeight: 1.5,
                            borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            background: msg.role === 'user' ? 'var(--brand-700)' : 'var(--surface-1)',
                            color: msg.role === 'user' ? '#fff' : 'var(--ink-800)',
                            border: msg.role === 'user' ? 'none' : '1px solid var(--line)',
                          }}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {chatMessages.length > 0 && chatLoading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <div style={{
                            padding: '8px 12px', borderRadius: '12px 12px 12px 2px',
                            background: 'var(--surface-1)', border: '1px solid var(--line)',
                            fontSize: 18, letterSpacing: 2, color: 'var(--ink-400)',
                          }}>···</div>
                        </div>
                      )}
                    </div>

                    {/* Error */}
                    {chatError && (
                      <div role="alert" style={{
                        padding: '8px 14px', background: 'var(--red-50)',
                        borderTop: '1px solid #FECACA', fontSize: 12.5, color: 'var(--red-700)',
                        display: 'flex', gap: 8, alignItems: 'center',
                      }}>
                        {chatError}
                        <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => void startChat()}>Retry</button>
                      </div>
                    )}

                    {/* Done banner */}
                    {chatDone && (
                      <div style={{
                        padding: '8px 14px', background: '#F0FDF4',
                        borderTop: '1px solid #BBF7D0',
                        fontSize: 12.5, color: '#166534', display: 'flex', gap: 8, alignItems: 'center',
                      }}>
                        <span aria-hidden="true">✓</span> Form pre-filled — review and edit the fields below.
                        <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => {
                          setChatMessages([]); setChatDone(false); setChatError(null); void startChat()
                        }}>
                          Start over
                        </button>
                      </div>
                    )}

                    {/* Input */}
                    {!chatDone && (
                      <div style={{
                        padding: '10px 14px', borderTop: '1px solid var(--line)',
                        display: 'flex', gap: 8, background: 'var(--surface-0)',
                      }}>
                        <input
                          ref={chatInputRef}
                          className="input"
                          style={{ flex: 1, fontSize: 13 }}
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChatMessage() } }}
                          placeholder="Type your answer…"
                          disabled={chatLoading || chatMessages.length === 0}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => void sendChatMessage()}
                          disabled={!chatInput.trim() || chatLoading || chatMessages.length === 0}
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
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
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
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

                {/* ── Type-specific questionnaire ── */}
                {requestType === 'vendor_onboarding' && (
                  <div style={{ marginTop: 8, padding: '16px 18px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>Vendor-specific details</div>
                    <FormField label="Contract reference" id="ts-contractref">
                      <input id="ts-contractref" className="input" value={form.contractRef}
                        onChange={(e) => update({ contractRef: e.target.value })} placeholder="e.g. MSA-2026-0012" />
                    </FormField>
                    <FormField label="Sub-processors (comma-separated)" id="ts-subproc">
                      <input id="ts-subproc" className="input" value={form.subprocessors}
                        onChange={(e) => update({ subprocessors: e.target.value })} placeholder="e.g. AWS EU, Cloudflare" />
                    </FormField>
                    <FormField label="Certifications held by vendor" id="ts-certs">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['SOC 2 Type II', 'ISO 27001', 'ISO 27018', 'PCI DSS', 'NIA Approved', 'SAMA CSF'].map((cert) => {
                          const checked = form.certifications.includes(cert)
                          return (
                            <label key={cert} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 10px', borderRadius: 'var(--r-md)', border: `1px solid ${checked ? 'var(--brand-700)' : 'var(--line)'}`, background: checked ? 'var(--brand-50)' : 'var(--surface-0)', fontSize: 12, fontFamily: 'var(--font-mono)', transition: 'all var(--t-fast)' }}>
                              <input type="checkbox" checked={checked} style={{ display: 'none' }}
                                onChange={() => update({ certifications: checked ? form.certifications.filter((c) => c !== cert) : [...form.certifications, cert] })} />
                              {cert}
                            </label>
                          )
                        })}
                      </div>
                    </FormField>
                  </div>
                )}

                {requestType === 'cross_border_transfer' && (
                  <div style={{ marginTop: 8, padding: '16px 18px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>Cross-border transfer details</div>
                    <FormField label="Transfer mechanism" id="ts-mechanism">
                      <select id="ts-mechanism" className="select" value={form.transferMechanism}
                        onChange={(e) => update({ transferMechanism: e.target.value })}>
                        <option value="sccs">Standard Contractual Clauses (SCCs)</option>
                        <option value="bcr">Binding Corporate Rules (BCRs)</option>
                        <option value="adequacy">Adequacy decision</option>
                        <option value="consent">Data subject consent</option>
                        <option value="other">Other legal basis</option>
                      </select>
                    </FormField>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
                      <input type="checkbox" checked={form.hasSaudiCopy} onChange={(e) => update({ hasSaudiCopy: e.target.checked })} />
                      Saudi-residency copy retained (PDPL Art. 30)
                    </label>
                  </div>
                )}

                {requestType === 'external_document_sharing' && (
                  <div style={{ marginTop: 8, padding: '16px 18px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>Document sharing details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <FormField label="Document classification" id="ts-docclass">
                        <select id="ts-docclass" className="select" value={form.docClassification}
                          onChange={(e) => update({ docClassification: e.target.value })}>
                          <option value="public">Public</option>
                          <option value="internal">Internal</option>
                          <option value="confidential">Confidential</option>
                          <option value="restricted">Restricted</option>
                        </select>
                      </FormField>
                      <FormField label="Access expiry date" id="ts-expiry">
                        <input id="ts-expiry" className="input" type="date" value={form.docExpiry}
                          onChange={(e) => update({ docExpiry: e.target.value })} />
                      </FormField>
                    </div>
                  </div>
                )}

                {requestType === 'data_sharing_external' && (
                  <div style={{ marginTop: 8, padding: '16px 18px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>Data sharing details</div>
                    <FormField label="Legal basis for sharing" id="ts-legalbasis">
                      <select id="ts-legalbasis" className="select" value={form.legalBasis}
                        onChange={(e) => update({ legalBasis: e.target.value })}>
                        <option value="contract">Contractual necessity</option>
                        <option value="legitimate_interest">Legitimate interest</option>
                        <option value="legal_obligation">Legal obligation</option>
                        <option value="vital_interests">Vital interests</option>
                        <option value="consent">Data subject consent</option>
                      </select>
                    </FormField>
                  </div>
                )}

                {requestType === 'internal_data_access' && (
                  <div style={{ marginTop: 8, padding: '16px 18px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>Access request details</div>
                    <FormField label="System / dataset name" id="ts-sysname">
                      <input id="ts-sysname" className="input" value={form.systemName}
                        onChange={(e) => update({ systemName: e.target.value })} placeholder="e.g. Customer Analytics DW" />
                    </FormField>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <FormField label="Access level" id="ts-accesslevel">
                        <select id="ts-accesslevel" className="select" value={form.accessLevel}
                          onChange={(e) => update({ accessLevel: e.target.value })}>
                          <option value="read">Read only</option>
                          <option value="read_write">Read / Write</option>
                          <option value="admin">Admin</option>
                        </select>
                      </FormField>
                      <FormField label="Access duration" id="ts-duration">
                        <select id="ts-duration" className="select" value={form.accessDuration}
                          onChange={(e) => update({ accessDuration: e.target.value })}>
                          <option value="30d">30 days</option>
                          <option value="90d">90 days</option>
                          <option value="180d">180 days</option>
                          <option value="365d">1 year</option>
                          <option value="indefinite">Indefinite</option>
                        </select>
                      </FormField>
                    </div>
                  </div>
                )}
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

              {/* Loading */}
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

              {/* Structured assessment */}
              {assessmentData && !assessmentLoading && (
                <PresubmitAssessmentView data={assessmentData} requestType={requestType} />
              )}

              {/* Error */}
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
              {/* Processing roles card */}
              {form.processingRoles.length > 0 && (
                <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Data processing roles</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.processingRoles.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ flexShrink: 0, width: 130, fontSize: 11.5, fontWeight: 600, color: 'var(--brand-700)', paddingTop: 1 }}>{r.role}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)' }}>{r.party}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{r.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
              {currentStep === 'vendor_project' && (
                <button className="btn btn-ghost" onClick={() => { update({ linkedVendorId: '', linkedProjectId: '' }); next() }}>
                  Skip
                </button>
              )}
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
