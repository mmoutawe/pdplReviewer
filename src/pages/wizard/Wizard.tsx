import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RequestType, Ticket, TicketPayload } from '../../data/types'
import { REQUEST_TYPE_LABELS, VENDORS, PROJECTS } from '../../data/seed'
import { Stepper } from '../../components/forms'
import { FormField } from '../../components/forms'
import { showToast, saveDraft, loadDraft, clearDraft, authStore, demoAddTicket, ticketStore, demoAddVendor, demoAddProject, refreshTickets } from '../../store'
import { getWorkflowSettings } from '../../lib/workflowSettings'
import { useStore } from '../../hooks/useStore'
import { isDataverseConfigured as isSupabaseConfigured } from '../../lib/dataverse'
import { createTicket, submitTicket } from '../../api/tickets'
import { createVendor } from '../../api/vendors'
import { createProject } from '../../api/projects'
import { chatWithRequestBuilder, type ChatMessage, type RequestBuilderResult, type RequestBuilderType } from '../../api/aiRequestBuilder'
import { runPresubmitAssessment, type PresubmitRequestType } from '../../api/aiPresubmit'
import { PresubmitAssessmentView } from '../../components/PresubmitAssessmentView'

type Method = 'manual' | 'ai' | 'xlsx'

// ─── Step definitions ─────────────────────────────────────────────────────────

// Internal navigation steps (unchanged — drive next/back/validate logic)
const STEPS = [
  { key: 'method',         label: 'Creation method' },
  { key: 'vendor_project', label: 'Vendor & Project' },
  { key: 'initiation',     label: 'Initiation' },
  { key: 'declaration',    label: 'Data declaration' },
  { key: 'assessment',     label: 'AI assessment' },
]

function StepIndex(step: string) { return STEPS.findIndex((s) => s.key === step) }

// Display stepper — full 8-step lifecycle shown to the user (matches TicketWorkspace)
const DISPLAY_STEPS = [
  { index: 0, label: 'Vendor & Project' },
  { index: 1, label: 'Initiation' },
  { index: 2, label: 'Questionnaire' },
  { index: 3, label: 'AI Assessment' },
  { index: 4, label: 'Data Mgmt' },
  { index: 5, label: 'Legal' },
  { index: 6, label: 'Security' },
  { index: 7, label: 'Decision' },
]

function displayStepIndex(step: string): number {
  switch (step) {
    case 'method':
    case 'vendor_project': return 0
    case 'initiation':     return 1
    case 'declaration':    return 2
    case 'assessment':     return 3
    default:               return 0
  }
}

interface WizardState {
  method: Method
  title: string
  description: string          // Section B — Service Description
  engagementObjective: string  // Section B — Engagement Objective
  vendorAccessesSystems: boolean
  vendorProcessesPersonalData: boolean
  documentType: string
  businessUnit: string
  purposeOfSharing: string
  vendorName: string           // External Recipient Name
  recipientOrganization: string
  recipientType: string
  sharingLocation: string
  vendorJurisdiction: string
  hasDPA: boolean
  dataCategories: string[]
  estimatedSubjects: string
  retentionDays: string
  crossBorder: boolean
  consentObtained: boolean
  tags: string
  linkedVendorId: string
  linkedProjectId: string
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
  // ── Questionnaire fields ──
  qPersonalDataShared: boolean
  qDataTypes: string[]
  qDataElements: string[]
  qDataElementsOther: string
  qSensitiveDataInvolved: boolean
  qPurpose: string
  qWhyRequired: string
  qCanDeliverWithout: boolean
  qCanAnonymize: 'yes' | 'no' | 'partially'
  qCanAnonymizeDetails: string
  qDeterminesPurpose: 'company' | 'vendor' | 'both'
  qDeterminesHow: 'company' | 'vendor' | 'both'
  qUsesSubProcessors: boolean
  qStorageLocation: 'inside_ksa' | 'outside_ksa'
  qStorageCountry: string
  qCloudUsed: boolean
  qCloudProvider: string
  qWhoCanAccess: string
  qRbacEnabled: boolean
  qAccessLogging: boolean
  qEncryptionAtRest: 'yes' | 'no' | 'partially'
  qEncryptionAtRestDetails: string
  qEncryptionInTransit: 'yes' | 'no' | 'partially'
  qEncryptionInTransitDetails: string
  qAccessControls: 'yes' | 'no' | 'partially'
  qAccessControlsDetails: string
  qDataMasking: 'yes' | 'no' | 'partially'
  qDataMaskingDetails: string
  qPdplCompliant: boolean
  qDataProtectionPolicies: boolean
  qIso27001: boolean
  qBreachResponseProcess: boolean
  qNdaSigned: boolean
  qDpaExists: boolean
  qDataProtectionClauses: boolean
  qRetentionPeriod: string
  qDeletedAfterEngagement: boolean
  qDeletionMethod: string
  qDocClassification: string
}

const empty: WizardState = {
  method: 'manual', title: '', description: '',
  engagementObjective: '', vendorAccessesSystems: false, vendorProcessesPersonalData: true,
  documentType: 'contract', businessUnit: '', purposeOfSharing: '',
  vendorName: '', recipientOrganization: '', recipientType: 'partner', sharingLocation: 'inside_ksa',
  vendorJurisdiction: 'KSA', hasDPA: false,
  dataCategories: [], estimatedSubjects: '', retentionDays: '',
  crossBorder: false, consentObtained: false, tags: '',
  linkedVendorId: '', linkedProjectId: '',
  certifications: [], subprocessors: '', contractRef: '',
  transferMechanism: 'sccs', hasSaudiCopy: false,
  docClassification: 'internal', docExpiry: '',
  legalBasis: 'legitimate_interest',
  systemName: '', accessLevel: 'read', accessDuration: '30d',
  processingRoles: [],
  qPersonalDataShared: false, qDataTypes: [], qDataElements: [], qDataElementsOther: '',
  qSensitiveDataInvolved: false, qPurpose: '', qWhyRequired: '',
  qCanDeliverWithout: false, qCanAnonymize: 'no', qCanAnonymizeDetails: '',
  qDeterminesPurpose: 'company', qDeterminesHow: 'company',
  qUsesSubProcessors: false, qStorageLocation: 'inside_ksa', qStorageCountry: '',
  qCloudUsed: false, qCloudProvider: '', qWhoCanAccess: '',
  qRbacEnabled: false, qAccessLogging: false,
  qEncryptionAtRest: 'no', qEncryptionAtRestDetails: '',
  qEncryptionInTransit: 'no', qEncryptionInTransitDetails: '',
  qAccessControls: 'no', qAccessControlsDetails: '',
  qDataMasking: 'no', qDataMaskingDetails: '',
  qPdplCompliant: false, qDataProtectionPolicies: false, qIso27001: false, qBreachResponseProcess: false,
  qNdaSigned: false, qDpaExists: false, qDataProtectionClauses: false,
  qRetentionPeriod: '', qDeletedAfterEngagement: false, qDeletionMethod: '',
  qDocClassification: 'internal',
}

export default function Wizard() {
  const { type, method: urlMethod } = useParams<{ type: RequestType; method: string }>()
  const navigate = useNavigate()
  const { user } = useStore(authStore)

  const [currentStep, setCurrentStep] = useState(urlMethod === 'method' ? 'method' : 'initiation')
  const [form, setForm] = useState<WizardState>(() => {
    const draft = loadDraft<WizardState>()
    return draft ? { ...empty, ...draft } : empty
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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [extraVendors, setExtraVendors] = useState<typeof VENDORS>([])
  const [showNewVendorModal, setShowNewVendorModal] = useState(false)
  const [newVendorForm, setNewVendorForm] = useState({ name: '', legalName: '', category: 'Technology', jurisdiction: '', contactName: '', contactEmail: '' })
  const [extraProjects, setExtraProjects] = useState<typeof PROJECTS>([])
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newProjectForm, setNewProjectForm] = useState({ name: '', businessUnit: '', serviceType: '', description: '' })
  const [qOpenSections, setQOpenSections] = useState<Record<string, boolean>>({
    dataUsage: true, purposeNecessity: true, processingRoles: true, storageHosting: true,
    dataAccess: true, securityControls: true, complianceGovernance: true, contractualSafeguards: true, dataLifecycle: true,
  })
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chatMessages, chatLoading])

  useEffect(() => {
    if (!chatLoading && chatMessages.length > 0 && !chatDone)
      chatInputRef.current?.focus()
  }, [chatLoading, chatMessages.length, chatDone])

  const requestType = type as RequestType

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
        // Questionnaire step data
        personalDataShared:       form.qPersonalDataShared,
        dataTypes:                form.qDataTypes,
        dataElements:             form.qDataElements,
        sensitiveDataInvolved:    form.qSensitiveDataInvolved,
        purpose:                  form.qPurpose,
        whyRequired:              form.qWhyRequired,
        canAnonymize:             form.qCanAnonymize,
        determinesPurpose:        form.qDeterminesPurpose,
        determinesHow:            form.qDeterminesHow,
        usesSubProcessors:        form.qUsesSubProcessors,
        storageLocation:          form.qStorageLocation,
        cloudUsed:                form.qCloudUsed,
        cloudProvider:            form.qCloudProvider,
        rbacEnabled:              form.qRbacEnabled,
        accessLogging:            form.qAccessLogging,
        encryptionAtRest:         form.qEncryptionAtRest,
        encryptionInTransit:      form.qEncryptionInTransit,
        accessControls:           form.qAccessControls,
        dataMasking:              form.qDataMasking,
        pdplCompliant:            form.qPdplCompliant,
        iso27001:                 form.qIso27001,
        ndaSigned:                form.qNdaSigned,
        dpaExists:                form.qDpaExists,
        retentionPeriod:          form.qRetentionPeriod,
        deletedAfterEngagement:   form.qDeletedAfterEngagement,
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

  function buildQuestionnaire(f: WizardState) {
    return {
      dataUsage: { personalDataShared: f.qPersonalDataShared, dataTypes: f.qDataTypes, dataElements: f.qDataElements, dataElementsOther: f.qDataElementsOther, sensitiveDataInvolved: f.qSensitiveDataInvolved },
      purposeNecessity: { purpose: f.qPurpose, whyRequired: f.qWhyRequired, canDeliverWithout: f.qCanDeliverWithout, canAnonymize: f.qCanAnonymize, canAnonymizeDetails: f.qCanAnonymizeDetails },
      processingRoles: { determinesPurpose: f.qDeterminesPurpose, determinesHow: f.qDeterminesHow, usesSubProcessors: f.qUsesSubProcessors },
      storageHosting: { storageLocation: f.qStorageLocation, country: f.qStorageCountry, cloudUsed: f.qCloudUsed, cloudProvider: f.qCloudProvider },
      dataAccess: { whoCanAccess: f.qWhoCanAccess, rbacEnabled: f.qRbacEnabled, accessLogging: f.qAccessLogging },
      securityControls: { encryptionAtRest: f.qEncryptionAtRest, encryptionAtRestDetails: f.qEncryptionAtRestDetails, encryptionInTransit: f.qEncryptionInTransit, encryptionInTransitDetails: f.qEncryptionInTransitDetails, accessControls: f.qAccessControls, accessControlsDetails: f.qAccessControlsDetails, dataMasking: f.qDataMasking, dataMaskingDetails: f.qDataMaskingDetails },
      complianceGovernance: { pdplCompliant: f.qPdplCompliant, dataProtectionPolicies: f.qDataProtectionPolicies, iso27001: f.qIso27001, breachResponseProcess: f.qBreachResponseProcess },
      contractualSafeguards: { ndaSigned: f.qNdaSigned, dpaExists: f.qDpaExists, dataProtectionClauses: f.qDataProtectionClauses },
      dataLifecycle: { retentionPeriod: f.qRetentionPeriod, deletedAfterEngagement: f.qDeletedAfterEngagement, deletionMethod: f.qDeletionMethod },
    }
  }

  function handleCreateProject() {
    if (!newProjectForm.name.trim()) return
    const code = `PRJ-${new Date().getFullYear()}-${String(extraProjects.length + 100).padStart(4, '0')}`
    const projectData = {
      code, name: newProjectForm.name.trim(),
      businessUnit: newProjectForm.businessUnit.trim() || newProjectForm.serviceType.trim() || '—',
      ownerId: user.id,
      vendorId: form.linkedVendorId || undefined,
      status: 'active' as const,
      dataInventoryCount: 0,
      description: newProjectForm.description.trim(),
      startedAt: new Date().toISOString().slice(0, 10),
    }
    if (isSupabaseConfigured) {
      createProject(projectData).then((saved) => {
        setExtraProjects((prev) => [...prev, saved])
        demoAddProject(saved)
        update({ linkedProjectId: saved.id })
        setNewProjectForm({ name: '', businessUnit: '', serviceType: '', description: '' })
        setShowNewProjectModal(false)
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to save project'
        showToast(msg, 'error')
      })
    } else {
      const project = { ...projectData, id: `p-new-${Date.now()}`, ticketIds: [] }
      setExtraProjects((prev) => [...prev, project])
      demoAddProject(project)
      update({ linkedProjectId: project.id })
      setNewProjectForm({ name: '', businessUnit: '', serviceType: '', description: '' })
      setShowNewProjectModal(false)
    }
  }

  function toggleQSection(key: string) {
    setQOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleCreateVendor() {
    if (!newVendorForm.name.trim()) return
    const vendorData = {
      tradeName:     newVendorForm.name.trim(),
      legalName:     newVendorForm.legalName.trim() || newVendorForm.name.trim(),
      jurisdiction:  newVendorForm.jurisdiction.trim() || 'KSA',
      category:      newVendorForm.category,
      primaryContact:newVendorForm.contactEmail.trim(),
      riskScore: 50, riskTier: 'medium' as const, status: 'pending' as const,
      certifications: [], hasDPA: false,
      lastReviewedAt: new Date().toISOString().slice(0, 10),
      notes: '',
    }
    if (isSupabaseConfigured) {
      createVendor(vendorData).then((saved) => {
        setExtraVendors((prev) => [...prev, saved])
        demoAddVendor(saved)
        update({ linkedVendorId: saved.id, linkedProjectId: '' })
        setNewVendorForm({ name: '', legalName: '', category: 'Technology', jurisdiction: '', contactName: '', contactEmail: '' })
        setShowNewVendorModal(false)
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to save vendor'
        showToast(msg, 'error')
      })
    } else {
      const vendor = { ...vendorData, id: `v-new-${Date.now()}`, ticketIds: [] }
      setExtraVendors((prev) => [...prev, vendor])
      demoAddVendor(vendor)
      update({ linkedVendorId: vendor.id, linkedProjectId: '' })
      setNewVendorForm({ name: '', legalName: '', category: 'Technology', jurisdiction: '', contactName: '', contactEmail: '' })
      setShowNewVendorModal(false)
    }
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

  function validate(step: string): boolean {
    const e: typeof errors = {}
    if (step === 'vendor_project') {
      if (!form.linkedVendorId) e.linkedVendorId = 'Please select or create a vendor.'
      if (!form.linkedProjectId) e.linkedProjectId = 'Please select or create a project.'
    }
    if (step === 'initiation') {
      if (!form.title.trim()) e.title = 'Request title is required.'
      if (!form.description.trim()) e.description = 'Service description is required.'
      if (!form.businessUnit.trim()) e.businessUnit = 'Business unit is required.'
      if (!form.purposeOfSharing.trim()) e.purposeOfSharing = 'Purpose of sharing is required.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validate(currentStep)) return
    const idx = StepIndex(currentStep)
    if (currentStep === 'vendor_project') {
      const v = VENDORS.find((x) => x.id === form.linkedVendorId) ?? extraVendors.find((x) => x.id === form.linkedVendorId)
      const p = [...PROJECTS, ...extraProjects].find((x) => x.id === form.linkedProjectId)
      if (v) update({ vendorName: v.tradeName, vendorJurisdiction: v.jurisdiction, businessUnit: p?.businessUnit ?? form.businessUnit })
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
            ...(requestType === 'vendor_onboarding' ? { questionnaire: buildQuestionnaire(form) } : {}),
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
        }, user.id)
        const ready = await submitTicket(ticket.id)
        demoAddTicket(ready)
        clearDraft()
        showToast('Request submitted successfully.', 'success')
        navigate(`/requests/${ready.id}`)
        void refreshTickets()
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
            questionnaire: buildQuestionnaire(form),
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

  const displayIdx = displayStepIndex(currentStep)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Wizard header */}
      <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-0)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={back} style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-label="Go back">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              New Compliance Review Request
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 10px', borderRadius: 'var(--r-full)',
              fontSize: 12, fontWeight: 500,
              background: 'var(--teal-50)', color: 'var(--teal-600)',
              border: '1px solid var(--teal-100)',
            }}>
              {REQUEST_TYPE_LABELS[requestType] ?? 'New Request'}
            </span>
          </div>
        </div>
        <Stepper steps={DISPLAY_STEPS.map((s) => ({
          key: String(s.index),
          label: s.label,
          index: s.index,
          done: s.index < displayIdx,
          active: s.index === displayIdx,
        }))} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {/* Main content */}
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 40px', minWidth: 0 }}>

          {/* ── Step: Vendor & Project ── */}
          {currentStep === 'vendor_project' && (
            <section aria-labelledby="step-vendor-project">
              <h2 id="step-vendor-project" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Select Vendor &amp; Project</h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 20, fontSize: 13.5 }}>
                You must link this request to a vendor and a project before proceeding.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

              {/* Vendor card */}
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--teal-50)', color: 'var(--teal-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <rect x="1" y="5" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 5V4a4 4 0 018 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>Vendor</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Select the third-party vendor involved in this request</div>
                  </div>
                </div>

                {/* Search row */}
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"
                    style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }}>
                    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text" placeholder="Search vendors…"
                    value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px 8px 28px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Vendor list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...VENDORS, ...extraVendors].filter((v) => !vendorSearch || v.tradeName.toLowerCase().includes(vendorSearch.toLowerCase()) || v.category.toLowerCase().includes(vendorSearch.toLowerCase())).map((v) => {
                    const selected = form.linkedVendorId === v.id
                    return (
                      <button key={v.id}
                        onClick={() => update({ linkedVendorId: selected ? '' : v.id, linkedProjectId: '' })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', textAlign: 'left', width: '100%',
                          border: selected ? '2px solid var(--teal-600)' : '1px solid var(--line)',
                          borderRadius: 'var(--r-md)',
                          background: selected ? 'var(--teal-50)' : 'var(--surface-0)',
                          boxShadow: selected ? '0 0 0 3px var(--teal-100)' : 'none',
                          cursor: 'pointer', transition: 'all var(--t-fast)',
                        }}
                        onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-strong)' }}
                        onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: selected ? 'var(--teal-600)' : 'var(--surface-2)', color: selected ? '#fff' : 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="11" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M4 4V3a4 4 0 018 0v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{v.tradeName}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{v.category} · {v.jurisdiction}</div>
                        </div>
                        <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 'var(--r-full)', fontWeight: 500,
                          background: v.status === 'active' ? 'var(--emerald-50)' : 'var(--amber-50)',
                          color: v.status === 'active' ? 'var(--emerald-700)' : 'var(--amber-700)',
                          border: `1px solid ${v.status === 'active' ? 'var(--emerald-200)' : 'var(--amber-200)'}`,
                          flexShrink: 0,
                        }}>
                          {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                        </span>
                        {selected && (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--teal-600)', flexShrink: 0 }}>
                            <circle cx="8" cy="8" r="7" fill="var(--teal-600)"/>
                            <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setShowNewVendorModal(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', width: '100%',
                      border: '1.5px dashed var(--teal-500)',
                      borderRadius: 'var(--r-md)',
                      background: 'transparent', color: 'var(--teal-600)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      transition: 'all var(--t-fast)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--teal-50)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    Add New Vendor
                  </button>
                </div>
                {errors.linkedVendorId && (
                  <p style={{ fontSize: 12.5, color: 'var(--red-600)', marginTop: 8 }}>{errors.linkedVendorId}</p>
                )}
              </div>

              {/* Project card — right column */}
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--teal-50)', color: 'var(--teal-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2 5a2 2 0 012-2h3l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>Project</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                      {form.linkedVendorId
                        ? <>Select a project under <strong>{[...VENDORS, ...extraVendors].find((v) => v.id === form.linkedVendorId)?.tradeName}</strong></>
                        : 'Select a vendor first to see its projects'}
                    </div>
                  </div>
                </div>

                {!form.linkedVendorId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', color: 'var(--ink-400)', gap: 8 }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.35 }}><path d="M4 9a4 4 0 014-4h6l4 4h10a4 4 0 014 4v10a4 4 0 01-4 4H8a4 4 0 01-4-4V9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                    <span style={{ fontSize: 13 }}>Select a vendor on the left first</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(() => {
                      const vendorProjects = [...PROJECTS, ...extraProjects].filter((p) => p.vendorId === form.linkedVendorId)
                      return (
                        <>
                          {vendorProjects.length === 0 && (
                            <p style={{ fontSize: 13, color: 'var(--ink-400)', padding: '4px 0 8px' }}>No projects linked to this vendor yet.</p>
                          )}
                          {vendorProjects.map((p) => {
                            const selected = form.linkedProjectId === p.id
                            return (
                              <button key={p.id}
                                onClick={() => update({ linkedProjectId: selected ? '' : p.id })}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 12,
                                  padding: '12px 14px', textAlign: 'left', width: '100%',
                                  border: selected ? '2px solid var(--teal-600)' : '1px solid var(--line)',
                                  borderRadius: 'var(--r-md)',
                                  background: selected ? 'var(--teal-50)' : 'var(--surface-0)',
                                  boxShadow: selected ? '0 0 0 3px var(--teal-100)' : 'none',
                                  cursor: 'pointer', transition: 'all var(--t-fast)',
                                }}
                                onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-strong)' }}
                                onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}
                              >
                                <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: selected ? 'var(--teal-600)' : 'var(--surface-2)', color: selected ? '#fff' : 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4a2 2 0 012-2h2l2 2h4a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{p.name}</div>
                                  <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{p.code} · {p.businessUnit}</div>
                                </div>
                                <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 'var(--r-full)', fontWeight: 500,
                                  background: p.status === 'active' ? 'var(--emerald-50)' : 'var(--amber-50)',
                                  color: p.status === 'active' ? 'var(--emerald-700)' : 'var(--amber-700)',
                                  border: `1px solid ${p.status === 'active' ? 'var(--emerald-200)' : 'var(--amber-200)'}`,
                                  flexShrink: 0,
                                }}>
                                  {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                                </span>
                                {selected && (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--teal-600)', flexShrink: 0 }}>
                                    <circle cx="8" cy="8" r="7" fill="var(--teal-600)"/>
                                    <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </button>
                            )
                          })}
                          <button
                            onClick={() => setShowNewProjectModal(true)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '10px 14px', width: '100%',
                              border: '1.5px dashed var(--teal-500)',
                              borderRadius: 'var(--r-md)',
                              background: 'transparent', color: 'var(--teal-600)',
                              cursor: 'pointer', fontSize: 13, fontWeight: 500,
                              transition: 'all var(--t-fast)',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--teal-50)' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                            Add New Project
                          </button>
                        </>
                      )
                    })()}
                  </div>
                )}
                {errors.linkedProjectId && (
                  <p style={{ fontSize: 12.5, color: 'var(--red-600)', marginTop: 6 }}>{errors.linkedProjectId}</p>
                )}
              </div>{/* end project column */}

              </div>{/* end 2-col grid */}

              {/* ── New Project Modal ── */}
              {showNewProjectModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={(e) => { if (e.target === e.currentTarget) setShowNewProjectModal(false) }}>
                  <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--teal-50)', color: 'var(--teal-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 5a2 2 0 012-2h3l2 2h7a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>New Project</h3>
                        <p style={{ fontSize: 12.5, color: 'var(--ink-500)', margin: 0, marginTop: 1 }}>
                          Under {[...VENDORS, ...extraVendors].find((v) => v.id === form.linkedVendorId)?.tradeName}
                        </p>
                      </div>
                      <button onClick={() => setShowNewProjectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Project Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>
                          Project Name <span style={{ color: 'var(--red-600)' }}>*</span>
                        </label>
                        <input value={newProjectForm.name} onChange={(e) => setNewProjectForm((f) => ({ ...f, name: e.target.value }))}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }}
                          autoFocus />
                      </div>

                      {/* Business Unit + Service Type */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>Business Unit</label>
                          <input value={newProjectForm.businessUnit} onChange={(e) => setNewProjectForm((f) => ({ ...f, businessUnit: e.target.value }))}
                            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>Service Type</label>
                          <input value={newProjectForm.serviceType} onChange={(e) => setNewProjectForm((f) => ({ ...f, serviceType: e.target.value }))}
                            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 5 }}>Description</label>
                        <textarea value={newProjectForm.description} onChange={(e) => setNewProjectForm((f) => ({ ...f, description: e.target.value }))} rows={3}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                      <button className="btn btn-ghost" onClick={() => setShowNewProjectModal(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={handleCreateProject} disabled={!newProjectForm.name.trim()}>
                        Create Project
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── New Vendor Modal ── */}
              {showNewVendorModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={(e) => { if (e.target === e.currentTarget) setShowNewVendorModal(false) }}>
                  <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--teal-50)', color: 'var(--teal-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M6 6V5a4 4 0 018 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>New Vendor</h3>
                        <p style={{ fontSize: 12.5, color: 'var(--ink-500)', margin: 0, marginTop: 1 }}>Add a new third-party vendor to the registry</p>
                      </div>
                      <button onClick={() => setShowNewVendorModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {([
                  {
                    m: 'manual' as Method,
                    label: 'Fill in the form manually',
                    desc: 'Step through the wizard yourself — vendor & project, initiation, and questionnaire.',
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M6 7h8M6 10.5h8M6 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                  {
                    m: 'ai' as Method,
                    label: 'Create the request with AI',
                    desc: 'Chat with an AI assistant that asks you the questions one by one and builds the request.',
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M16 14l.75 2.25L19 17l-2.25.75L16 20l-.75-2.25L13 17l2.25-.75L16 14z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                      </svg>
                    ),
                  },
                  {
                    m: 'xlsx' as Method,
                    label: 'Upload request form',
                    desc: 'Download a template, fill it in, and upload it — AI will extract the data automatically.',
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <rect x="2" y="4" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M2 8h16M8 8v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                ]).map(({ m, icon, label, desc }) => {
                  const isSelected = form.method === m
                  return (
                    <button key={m}
                      onClick={() => { update({ method: m }); if (m !== 'xlsx') next() }}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 12,
                        padding: '18px 16px', borderRadius: 'var(--r-lg)',
                        border: `2px solid ${isSelected ? 'var(--teal-600)' : 'var(--line)'}`,
                        background: 'var(--surface-0)',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all var(--t-fast)',
                        boxShadow: isSelected ? '0 0 0 3px var(--teal-100)' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--teal-600)' }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 'var(--r-lg)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isSelected ? 'var(--teal-600)' : 'var(--teal-50)',
                        color: isSelected ? 'white' : 'var(--teal-600)',
                        transition: 'all var(--t-fast)',
                      }}>
                        {icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-500)', lineHeight: 1.55 }}>{desc}</div>
                      </div>
                    </button>
                  )
                })}
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
              <h2 id="step-init" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Request Initiation</h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 20, fontSize: 13.5 }}>
                Provide vendor details and engagement information for compliance assessment.
              </p>

              {/* AI builder chat — shown only when method === 'ai' and not done */}
              {form.method === 'ai' && !chatDone && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ border: '1px solid var(--brand-200)', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--surface-0)' }}>
                    <div style={{ padding: '10px 14px', background: 'var(--brand-50)', borderBottom: '1px solid var(--brand-200)', fontSize: 13, fontWeight: 600, color: 'var(--brand-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span aria-hidden="true">✨</span> AI Request Builder
                      <button className="btn btn-sm" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => update({ method: 'manual' })}>Fill manually</button>
                    </div>
                    <div ref={chatScrollRef} style={{ maxHeight: 300, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {chatMessages.length === 0 && chatLoading && (
                        <div style={{ fontSize: 13, color: 'var(--ink-400)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite' }} aria-hidden="true">⏳</span> Starting conversation…
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          <div style={{ maxWidth: '85%', padding: '8px 12px', fontSize: 13, lineHeight: 1.5, borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: msg.role === 'user' ? 'var(--brand-700)' : 'var(--surface-1)', color: msg.role === 'user' ? '#fff' : 'var(--ink-800)', border: msg.role === 'user' ? 'none' : '1px solid var(--line)' }}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {chatMessages.length > 0 && chatLoading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <div style={{ padding: '8px 12px', borderRadius: '12px 12px 12px 2px', background: 'var(--surface-1)', border: '1px solid var(--line)', fontSize: 18, letterSpacing: 2, color: 'var(--ink-400)' }}>···</div>
                        </div>
                      )}
                    </div>
                    {chatError && (
                      <div role="alert" style={{ padding: '8px 14px', background: 'var(--red-50)', borderTop: '1px solid #FECACA', fontSize: 12.5, color: 'var(--red-700)', display: 'flex', gap: 8, alignItems: 'center' }}>
                        {chatError}
                        <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => void startChat()}>Retry</button>
                      </div>
                    )}
                    {!chatDone && (
                      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, background: 'var(--surface-0)' }}>
                        <input ref={chatInputRef} className="input" style={{ flex: 1, fontSize: 13 }} value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChatMessage() } }}
                          placeholder="Type your answer…" disabled={chatLoading || chatMessages.length === 0} />
                        <button className="btn btn-primary btn-sm" onClick={() => void sendChatMessage()} disabled={!chatInput.trim() || chatLoading || chatMessages.length === 0}>Send</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI done banner */}
              {form.method === 'ai' && chatDone && (
                <div style={{ padding: '8px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--r-md)', fontSize: 12.5, color: '#166534', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
                  <span aria-hidden="true">✓</span> Form pre-filled — review and edit the fields below.
                  <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setChatMessages([]); setChatDone(false); setChatError(null); void startChat() }}>Start over</button>
                </div>
              )}

              {/* Show form for manual/xlsx, or after AI chat is done */}
              {(form.method !== 'ai' || chatDone) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Vendor & Project Summary */}
                  {form.linkedVendorId && (() => {
                    const v = [...VENDORS, ...extraVendors].find((x) => x.id === form.linkedVendorId)
                    const p = [...PROJECTS, ...extraProjects].find((x) => x.id === form.linkedProjectId)
                    if (!v) return null
                    return (
                      <div className="card" style={{ padding: '16px 18px', background: 'var(--surface-1)', border: '1px solid var(--line)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Vendor &amp; Project Summary</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 13 }}>
                          <div><span style={{ color: 'var(--ink-500)' }}>Vendor: </span><strong>{v.tradeName}</strong></div>
                          <div><span style={{ color: 'var(--ink-500)' }}>Type: </span>{v.category}</div>
                          <div><span style={{ color: 'var(--ink-500)' }}>Country: </span>{v.jurisdiction}</div>
                          <div><span style={{ color: 'var(--ink-500)' }}>Contact: </span>{v.primaryContact || '—'}</div>
                          {p && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--ink-500)' }}>Business Unit: </span>{p.businessUnit}</div>}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Section B — Engagement Overview */}
                  <div className="card" style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Section B — Engagement Overview</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <FormField label="Service Description" required error={errors.description} id="req-desc">
                        <textarea id="req-desc" className="textarea" rows={3} value={form.description}
                          onChange={(e) => update({ description: e.target.value })}
                          placeholder="Describe the service the vendor will provide…" />
                      </FormField>
                      <FormField label="Engagement Objective" id="req-obj">
                        <textarea id="req-obj" className="textarea" rows={3} value={form.engagementObjective}
                          onChange={(e) => update({ engagementObjective: e.target.value })}
                          placeholder="State the business objective of this engagement…" />
                      </FormField>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 10 }}>Will vendor access internal systems?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {[true, false].map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="vendorAccess" checked={form.vendorAccessesSystems === val} onChange={() => update({ vendorAccessesSystems: val })}
                                style={{ accentColor: 'var(--brand-700)', width: 15, height: 15 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 10 }}>Will vendor process data on behalf of the company?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {[true, false].map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="vendorProcesses" checked={form.vendorProcessesPersonalData === val} onChange={() => update({ vendorProcessesPersonalData: val })}
                                style={{ accentColor: 'var(--brand-700)', width: 15, height: 15 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section C — Request Details */}
                  <div className="card" style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Section C — Request Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <FormField label="Request Title" required error={errors.title} id="req-title">
                        <input id="req-title" className="input" value={form.title}
                          onChange={(e) => update({ title: e.target.value })}
                          placeholder="e.g. Sahab Cloud — primary IaaS hosting" />
                      </FormField>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <FormField label="Document Type" required id="req-doctype">
                          <select id="req-doctype" className="select" value={form.documentType} onChange={(e) => update({ documentType: e.target.value })}>
                            <option value="contract">Contract</option>
                            <option value="nda">NDA</option>
                            <option value="dpa">DPA</option>
                            <option value="sow">Statement of Work</option>
                            <option value="sla">SLA</option>
                            <option value="other">Other</option>
                          </select>
                        </FormField>
                        <FormField label="Business Unit" required error={errors.businessUnit} id="req-bu">
                          <input id="req-bu" className="input" value={form.businessUnit}
                            onChange={(e) => update({ businessUnit: e.target.value })}
                            placeholder="e.g. Customer Experience" />
                        </FormField>
                      </div>

                      <FormField label="Purpose of Sharing" required error={errors.purposeOfSharing} id="req-purpose">
                        <input id="req-purpose" className="input" value={form.purposeOfSharing}
                          onChange={(e) => update({ purposeOfSharing: e.target.value })}
                          placeholder="Why is this data/document being shared?" />
                      </FormField>

                      <FormField label="External Recipient Name" id="req-recip">
                        <input id="req-recip" className="input" value={form.vendorName}
                          onChange={(e) => update({ vendorName: e.target.value })} />
                      </FormField>

                      <FormField label="Recipient Organization" id="req-org">
                        <input id="req-org" className="input" value={form.recipientOrganization}
                          onChange={(e) => update({ recipientOrganization: e.target.value })}
                          placeholder="Organization name" />
                      </FormField>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <FormField label="Recipient Type" required id="req-rtype">
                          <select id="req-rtype" className="select" value={form.recipientType} onChange={(e) => update({ recipientType: e.target.value })}>
                            <option value="partner">Partner</option>
                            <option value="client">Client</option>
                            <option value="regulator">Regulator</option>
                            <option value="vendor">Vendor</option>
                            <option value="internal">Internal</option>
                            <option value="other">Other</option>
                          </select>
                        </FormField>
                        <FormField label="Sharing Location" required id="req-loc">
                          <select id="req-loc" className="select" value={form.sharingLocation} onChange={(e) => update({ sharingLocation: e.target.value })}>
                            <option value="inside_ksa">Inside KSA</option>
                            <option value="outside_ksa">Outside KSA</option>
                          </select>
                        </FormField>
                      </div>

                      {/* Upload Documents */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 8, letterSpacing: '0.02em' }}>Upload Documents</div>
                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 16px', border: '2px dashed var(--line)', borderRadius: 'var(--r-md)', cursor: 'pointer', background: 'var(--surface-1)', transition: 'all var(--t-fast)' }}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--brand-700)'; e.currentTarget.style.background = 'var(--brand-50)' }}
                          onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--surface-1)' }}
                          onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--surface-1)'; const files = Array.from(e.dataTransfer.files); setUploadedFiles((prev) => [...prev, ...files]) }}>
                          <input type="file" multiple accept=".pdf,.docx,.xlsx" style={{ display: 'none' }}
                            onChange={(e) => { if (e.target.files) setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files!)]) }} />
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)' }}>
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span style={{ fontSize: 13, color: 'var(--ink-600)', fontWeight: 500 }}>Drag and drop files here, or click to browse</span>
                          <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>PDF, DOCX, XLSX up to 20MB</span>
                        </label>
                        {uploadedFiles.length > 0 && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {uploadedFiles.map((f, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontSize: 12.5 }}>
                                <span style={{ flex: 1, color: 'var(--ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                <span style={{ color: 'var(--ink-400)', flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                                <button onClick={() => setUploadedFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Step: Questionnaire / Data Declaration ── */}
          {currentStep === 'declaration' && (
            <section aria-labelledby="step-decl">
              <h2 id="step-decl" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                {requestType === 'vendor_onboarding' ? 'Vendor Data & Compliance Questionnaire' : `${REQUEST_TYPE_LABELS[requestType]} — Questionnaire`}
              </h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 22, fontSize: 13.5 }}>
                {requestType === 'vendor_onboarding'
                  ? 'Complete all sections to enable AI compliance assessment.'
                  : 'Answer the focused questions below. The AI will use them to assess this request.'}
              </p>

              {/* ── vendor_onboarding: 9-section questionnaire ── */}
              {requestType === 'vendor_onboarding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* S1 — Data Usage */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('dataUsage')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 1 — Data Usage</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.dataUsage ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.dataUsage && (
                      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--line)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Will personal data be shared?</div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {([true, false] as const).map((val) => (
                              <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                <input type="radio" name="q-pds" checked={form.qPersonalDataShared === val} onChange={() => update({ qPersonalDataShared: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                {val ? 'Yes' : 'No'}
                              </label>
                            ))}
                          </div>
                        </div>
                        {form.qPersonalDataShared && (
                          <>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Data Types</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {['Customer data', 'Employee data', 'Vendor data'].map((t) => {
                                  const c = form.qDataTypes.includes(t)
                                  return (
                                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '5px 10px', borderRadius: 'var(--r-md)', border: `1px solid ${c ? 'var(--brand-700)' : 'var(--line)'}`, background: c ? 'var(--brand-50)' : 'var(--surface-0)', fontSize: 12.5, transition: 'all var(--t-fast)' }}>
                                      <input type="checkbox" checked={c} style={{ display: 'none' }} onChange={() => update({ qDataTypes: c ? form.qDataTypes.filter((x) => x !== t) : [...form.qDataTypes, t] })} />
                                      {t}
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Data Elements</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {['Names', 'National IDs', 'Contact details', 'Financial data', 'Location data', 'Other'].map((el) => {
                                  const c = form.qDataElements.includes(el)
                                  return (
                                    <label key={el} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '5px 10px', borderRadius: 'var(--r-md)', border: `1px solid ${c ? 'var(--brand-700)' : 'var(--line)'}`, background: c ? 'var(--brand-50)' : 'var(--surface-0)', fontSize: 12.5, transition: 'all var(--t-fast)' }}>
                                      <input type="checkbox" checked={c} style={{ display: 'none' }} onChange={() => update({ qDataElements: c ? form.qDataElements.filter((x) => x !== el) : [...form.qDataElements, el] })} />
                                      {el}
                                    </label>
                                  )
                                })}
                              </div>
                              {form.qDataElements.includes('Other') && (
                                <textarea value={form.qDataElementsOther} onChange={(e) => update({ qDataElementsOther: e.target.value })} placeholder="Describe the other data elements that may be exposed" className="textarea" rows={2} style={{ marginTop: 8, width: '100%', boxSizing: 'border-box' }} />
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is sensitive personal data involved?</div>
                              <div style={{ display: 'flex', gap: 16 }}>
                                {([true, false] as const).map((val) => (
                                  <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                    <input type="radio" name="q-sdi" checked={form.qSensitiveDataInvolved === val} onChange={() => update({ qSensitiveDataInvolved: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                    {val ? 'Yes' : 'No'}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* S2 — Purpose & Necessity */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('purposeNecessity')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 2 — Purpose &amp; Necessity</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.purposeNecessity ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.purposeNecessity && (
                      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--line)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Purpose of data sharing</label>
                          <textarea value={form.qPurpose} onChange={(e) => update({ qPurpose: e.target.value })} className="textarea" rows={3} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Why is the data required?</label>
                          <textarea value={form.qWhyRequired} onChange={(e) => update({ qWhyRequired: e.target.value })} className="textarea" rows={3} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Can service be delivered without personal data?</div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {([true, false] as const).map((val) => (
                              <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                <input type="radio" name="q-cdw" checked={form.qCanDeliverWithout === val} onChange={() => update({ qCanDeliverWithout: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                {val ? 'Yes' : 'No'}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Can data be anonymized or minimized?</div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {(['yes', 'no', 'partially'] as const).map((v) => (
                              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                <input type="radio" name="q-can" checked={form.qCanAnonymize === v} onChange={() => update({ qCanAnonymize: v })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                              </label>
                            ))}
                          </div>
                          {form.qCanAnonymize === 'partially' && (
                            <textarea value={form.qCanAnonymizeDetails} onChange={(e) => update({ qCanAnonymizeDetails: e.target.value })} placeholder="Please provide details..." className="textarea" rows={2} style={{ marginTop: 8, width: '100%', boxSizing: 'border-box' }} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* S3 — Data Processing Roles */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('processingRoles')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 3 — Data Processing Roles</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.processingRoles ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.processingRoles && (
                      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--line)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Who determines purpose of processing?</label>
                            <select className="select" value={form.qDeterminesPurpose} onChange={(e) => update({ qDeterminesPurpose: e.target.value as 'company' | 'vendor' | 'both' })}>
                              <option value="company">Company</option>
                              <option value="vendor">Vendor</option>
                              <option value="both">Both</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Who determines how data is processed?</label>
                            <select className="select" value={form.qDeterminesHow} onChange={(e) => update({ qDeterminesHow: e.target.value as 'company' | 'vendor' | 'both' })}>
                              <option value="company">Company</option>
                              <option value="vendor">Vendor</option>
                              <option value="both">Both</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Will vendor use sub-processors?</div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {([true, false] as const).map((val) => (
                              <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                <input type="radio" name="q-usp" checked={form.qUsesSubProcessors === val} onChange={() => update({ qUsesSubProcessors: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                {val ? 'Yes' : 'No'}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* S4 — Storage & Hosting */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('storageHosting')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 4 — Data Storage &amp; Hosting</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.storageHosting ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.storageHosting && (
                      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--line)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Data storage location</label>
                          <select className="select" value={form.qStorageLocation} onChange={(e) => update({ qStorageLocation: e.target.value as 'inside_ksa' | 'outside_ksa' })}>
                            <option value="inside_ksa">Inside KSA</option>
                            <option value="outside_ksa">Outside KSA</option>
                          </select>
                        </div>
                        {form.qStorageLocation === 'outside_ksa' && (
                          <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Country</label>
                            <select className="select" value={form.qStorageCountry} onChange={(e) => update({ qStorageCountry: e.target.value })}>
                              <option value="">Select country</option>
                              {['UAE', 'Bahrain', 'Kuwait', 'Oman', 'Qatar', 'Jordan', 'Egypt', 'United States', 'United Kingdom', 'Germany', 'France', 'India', 'Singapore', 'Other'].map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is cloud used?</div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {([true, false] as const).map((val) => (
                              <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                <input type="radio" name="q-cu" checked={form.qCloudUsed === val} onChange={() => update({ qCloudUsed: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                {val ? 'Yes' : 'No'}
                              </label>
                            ))}
                          </div>
                        </div>
                        {form.qCloudUsed && (
                          <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Cloud Provider</label>
                            <input className="input" value={form.qCloudProvider} onChange={(e) => update({ qCloudProvider: e.target.value })} placeholder="e.g., AWS, Azure, GCP" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* S5 — Data Access */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('dataAccess')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 5 — Data Access</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.dataAccess ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.dataAccess && (
                      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--line)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Who can access the data?</label>
                          <input className="input" value={form.qWhoCanAccess} onChange={(e) => update({ qWhoCanAccess: e.target.value })} placeholder="e.g., Project team, IT administrators" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Role-based access control?</div>
                            <div style={{ display: 'flex', gap: 16 }}>
                              {([true, false] as const).map((val) => (
                                <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                  <input type="radio" name="q-rbac" checked={form.qRbacEnabled === val} onChange={() => update({ qRbacEnabled: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                  {val ? 'Yes' : 'No'}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Access logging enabled?</div>
                            <div style={{ display: 'flex', gap: 16 }}>
                              {([true, false] as const).map((val) => (
                                <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                  <input type="radio" name="q-al" checked={form.qAccessLogging === val} onChange={() => update({ qAccessLogging: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                  {val ? 'Yes' : 'No'}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* S6 — Security Controls */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('securityControls')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 6 — Security Controls</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.securityControls ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.securityControls && (
                      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--line)' }}>
                        {([
                          { label: 'Encryption at rest?', radioName: 'q-ear', field: 'qEncryptionAtRest' as const, detailField: 'qEncryptionAtRestDetails' as const },
                          { label: 'Encryption in transit?', radioName: 'q-eit', field: 'qEncryptionInTransit' as const, detailField: 'qEncryptionInTransitDetails' as const },
                          { label: 'Access controls implemented?', radioName: 'q-ac', field: 'qAccessControls' as const, detailField: 'qAccessControlsDetails' as const },
                          { label: 'Data masking/anonymization used?', radioName: 'q-dm', field: 'qDataMasking' as const, detailField: 'qDataMaskingDetails' as const },
                        ]).map(({ label, radioName, field, detailField }) => (
                          <div key={field}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>{label}</div>
                            <div style={{ display: 'flex', gap: 16 }}>
                              {(['yes', 'no', 'partially'] as const).map((v) => (
                                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                  <input type="radio" name={radioName} checked={form[field] === v} onChange={() => update({ [field]: v })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                  {v.charAt(0).toUpperCase() + v.slice(1)}
                                </label>
                              ))}
                            </div>
                            {form[field] === 'partially' && (
                              <textarea value={form[detailField] as string} onChange={(e) => update({ [detailField]: e.target.value })} placeholder="Please provide details..." className="textarea" rows={2} style={{ marginTop: 8, width: '100%', boxSizing: 'border-box' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* S7 — Compliance & Governance */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('complianceGovernance')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 7 — Compliance &amp; Governance</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.complianceGovernance ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.complianceGovernance && (
                      <div style={{ padding: '16px 16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid var(--line)' }}>
                        {([
                          { field: 'qPdplCompliant' as const, name: 'q-pc', label: 'Vendor complies with PDPL?' },
                          { field: 'qDataProtectionPolicies' as const, name: 'q-dpp', label: 'Data protection policies exist?' },
                          { field: 'qIso27001' as const, name: 'q-iso', label: 'ISO 27001 or equivalent?' },
                          { field: 'qBreachResponseProcess' as const, name: 'q-brp', label: 'Breach response process exists?' },
                        ]).map(({ field, name, label }) => (
                          <div key={field}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>{label}</div>
                            <div style={{ display: 'flex', gap: 16 }}>
                              {([true, false] as const).map((val) => (
                                <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                  <input type="radio" name={name} checked={form[field] === val} onChange={() => update({ [field]: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                  {val ? 'Yes' : 'No'}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* S8 — Contractual Safeguards */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('contractualSafeguards')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 8 — Contractual Safeguards</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.contractualSafeguards ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.contractualSafeguards && (
                      <div style={{ padding: '16px 16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, borderTop: '1px solid var(--line)' }}>
                        {([
                          { field: 'qNdaSigned' as const, name: 'q-nda', label: 'NDA signed?' },
                          { field: 'qDpaExists' as const, name: 'q-dpa', label: 'Data Processing Agreement (DPA)?' },
                          { field: 'qDataProtectionClauses' as const, name: 'q-dpc', label: 'Contract includes data protection clauses?' },
                        ]).map(({ field, name, label }) => (
                          <div key={field}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>{label}</div>
                            <div style={{ display: 'flex', gap: 16 }}>
                              {([true, false] as const).map((val) => (
                                <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                  <input type="radio" name={name} checked={form[field] === val} onChange={() => update({ [field]: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                  {val ? 'Yes' : 'No'}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* S9 — Data Lifecycle */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggleQSection('dataLifecycle')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'var(--surface-1)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>Section 9 — Data Lifecycle</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-400)', display: 'inline-block', transform: qOpenSections.dataLifecycle ? 'rotate(180deg)' : 'none', transition: 'transform var(--t-fast)' }}>▼</span>
                    </button>
                    {qOpenSections.dataLifecycle && (
                      <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--line)' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Data retention period</label>
                          <input className="input" value={form.qRetentionPeriod} onChange={(e) => update({ qRetentionPeriod: e.target.value })} placeholder="e.g., 12 months, 3 years" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Data deleted after engagement?</div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {([true, false] as const).map((val) => (
                              <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                                <input type="radio" name="q-dae" checked={form.qDeletedAfterEngagement === val} onChange={() => update({ qDeletedAfterEngagement: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                                {val ? 'Yes' : 'No'}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Deletion method</label>
                          <input className="input" value={form.qDeletionMethod} onChange={(e) => update({ qDeletionMethod: e.target.value })} placeholder="e.g., Secure wipe, cryptographic erasure" />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ── other types: typed questionnaire ── */}
              {requestType !== 'vendor_onboarding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* external_document_sharing */}
                  {requestType === 'external_document_sharing' && (
                    <>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Does the document contain personal data?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-pds" checked={form.qPersonalDataShared === val} onChange={() => update({ qPersonalDataShared: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Does it contain sensitive personal data (financial, health, biometric, etc.)?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-sdi" checked={form.qSensitiveDataInvolved === val} onChange={() => update({ qSensitiveDataInvolved: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Document classification</label>
                        <select className="select" value={form.qDocClassification} onChange={(e) => update({ qDocClassification: e.target.value })}>
                          <option value="public">Public</option>
                          <option value="internal">Internal</option>
                          <option value="confidential">Confidential</option>
                          <option value="restricted">Restricted / Secret</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Why is this document being shared?</label>
                        <textarea value={form.qPurpose} onChange={(e) => update({ qPurpose: e.target.value })} className="textarea" rows={3} style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Business justification" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Has the document been redacted or minimized to only what's necessary?</label>
                        <textarea value={form.qCanAnonymizeDetails} onChange={(e) => update({ qCanAnonymizeDetails: e.target.value })} className="textarea" rows={2} style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Describe redactions or minimization steps" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is an NDA in place with the recipient?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-nda" checked={form.qNdaSigned === val} onChange={() => update({ qNdaSigned: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* data_sharing_external */}
                  {requestType === 'data_sharing_external' && (
                    <>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Does the dataset contain personal data?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-pds" checked={form.qPersonalDataShared === val} onChange={() => update({ qPersonalDataShared: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Does it contain sensitive personal data?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-sdi" checked={form.qSensitiveDataInvolved === val} onChange={() => update({ qSensitiveDataInvolved: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Approximate record count / volume</label>
                        <input className="input" value={form.qRetentionPeriod} onChange={(e) => update({ qRetentionPeriod: e.target.value })} placeholder="e.g., ~10,000 customer records" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Lawful basis for sharing</label>
                        <textarea value={form.qWhyRequired} onChange={(e) => update({ qWhyRequired: e.target.value })} className="textarea" rows={3} style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Consent / contract / legitimate interest / regulator request" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is the data minimized to the strict minimum needed?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-min" checked={form.qCanDeliverWithout === !val} onChange={() => update({ qCanDeliverWithout: !val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is the transfer encrypted in transit?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-eit" checked={(form.qEncryptionInTransit === 'yes') === val} onChange={() => update({ qEncryptionInTransit: val ? 'yes' : 'no' })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is a Data Sharing Agreement / DPA signed with the recipient?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-dpa" checked={form.qDpaExists === val} onChange={() => update({ qDpaExists: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* internal_data_access */}
                  {requestType === 'internal_data_access' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Sensitivity level of the dataset</label>
                        <select className="select" value={form.qSensitiveDataInvolved ? 'high' : (form.qDocClassification || 'medium')} onChange={(e) => update({ qSensitiveDataInvolved: e.target.value === 'high', qDocClassification: e.target.value })}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High (sensitive)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Detailed business justification</label>
                        <textarea value={form.qWhyRequired} onChange={(e) => update({ qWhyRequired: e.target.value })} className="textarea" rows={3} style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Why does this user/team need this data?" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Will access follow least-privilege (only required fields &amp; rows)?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-lp" checked={form.qCanDeliverWithout === val} onChange={() => update({ qCanDeliverWithout: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is access logging / audit trail enabled?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-al" checked={form.qAccessLogging === val} onChange={() => update({ qAccessLogging: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is RBAC enforced for this dataset?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-rbac" checked={form.qRbacEnabled === val} onChange={() => update({ qRbacEnabled: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Access duration</label>
                        <input className="input" value={form.qRetentionPeriod} onChange={(e) => update({ qRetentionPeriod: e.target.value })} placeholder="e.g., 6 months, until 2026-04-30" />
                      </div>
                    </>
                  )}

                  {/* cross_border_transfer */}
                  {requestType === 'cross_border_transfer' && (
                    <>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Does the data include sensitive personal data?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-sdi" checked={form.qSensitiveDataInvolved === val} onChange={() => update({ qSensitiveDataInvolved: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Lawful basis for the cross-border transfer</label>
                        <textarea value={form.qWhyRequired} onChange={(e) => update({ qWhyRequired: e.target.value })} className="textarea" rows={3} style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Cite PDPL article and basis" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is the destination country recognized as adequate by SDAIA?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-adq" checked={form.qPdplCompliant === val} onChange={() => update({ qPdplCompliant: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Are SCCs / BCRs in place with the recipient?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-scc" checked={form.qDpaExists === val} onChange={() => update({ qDpaExists: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Has the data subject given explicit consent (where required)?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-cons" checked={form.qDataProtectionClauses === val} onChange={() => update({ qDataProtectionClauses: val })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 8 }}>Is the data encrypted in transit and at rest at destination?</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([true, false] as const).map((val) => (
                            <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
                              <input type="radio" name="qt-enc" checked={(form.qEncryptionInTransit === 'yes' && form.qEncryptionAtRest === 'yes') === val} onChange={() => update({ qEncryptionInTransit: val ? 'yes' : 'no', qEncryptionAtRest: val ? 'yes' : 'no' })} style={{ accentColor: 'var(--brand-700)', width: 14, height: 14 }} />
                              {val ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 6 }}>Retention at destination</label>
                        <input className="input" value={form.qRetentionPeriod} onChange={(e) => update({ qRetentionPeriod: e.target.value })} placeholder="e.g., 12 months, then deletion" />
                      </div>
                    </>
                  )}

                </div>
              )}
            </section>
          )}

          {/* ── Step: AI assessment ── */}
          {currentStep === 'assessment' && (
            <section aria-labelledby="step-assess">

              {/* Section header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                <div>
                  <h2 id="step-assess" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--ink-900)' }}>
                    AI Pre-Submission Assessment
                  </h2>
                  <p style={{ color: 'var(--ink-500)', fontSize: 13.5, margin: 0 }}>
                    Review the AI analysis before submitting your request.
                  </p>
                </div>
                {assessmentData && !assessmentLoading && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => setCurrentStep('initiation')}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 6.5h10M8.5 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Edit answers
                    </button>
                  </div>
                )}
              </div>

              {/* Loading */}
              {assessmentLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    border: '3px solid var(--teal-100)',
                    borderTop: '3px solid var(--teal-600)',
                    animation: 'spin 0.9s linear infinite',
                  }} aria-hidden="true" />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>Analyzing your request…</p>
                    <p style={{ fontSize: 13, color: 'var(--ink-500)', margin: 0 }}>Evaluating PDPL compliance, inferring roles, and identifying risks.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--ink-400)', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {['Evaluating risks', 'Checking compliance', 'Inferring roles', 'Identifying gaps'].map((s, i, arr) => (
                      <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s}{i < arr.length - 1 && <span style={{ color: 'var(--line-strong)' }}>·</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Assessment */}
              {assessmentData && !assessmentLoading && (
                <PresubmitAssessmentView data={assessmentData} requestType={requestType} />
              )}

              {/* Error */}
              {assessmentError && (
                <div style={{
                  padding: '16px 18px', background: 'var(--red-50)',
                  border: '1px solid #FECACA', borderRadius: 'var(--r-lg)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: '#FEE2E2', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L13.5 12.5H.5L7 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7 6v2.5M7 10.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#991B1B', margin: '0 0 2px' }}>Assessment failed</p>
                    <p style={{ fontSize: 13, color: '#B91C1C', margin: 0 }}>{assessmentError}</p>
                  </div>
                  <button className="btn btn-sm" onClick={() => void runAssessment()}>Retry</button>
                </div>
              )}

              {/* Action bar */}
              {!assessmentLoading && (
                <div style={{
                  marginTop: 24, padding: '16px 20px',
                  background: 'var(--surface-1)', border: '1px solid var(--line)',
                  borderRadius: 'var(--r-lg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                }}>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-600)', margin: 0 }}>
                    Review the findings above, then submit or go back to revise your answers.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setCurrentStep('initiation')}>
                      Edit Initiation
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setCurrentStep('declaration')}>
                      Edit My Answers
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowSubmitModal(true)}
                      disabled={submitting || assessmentLoading}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <path d="M1.5 6.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Submit for Review
                    </button>
                  </div>
                </div>
              )}
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
              {currentStep !== 'assessment' && (
                <button className="btn btn-primary" onClick={next}>
                  Continue →
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Submit confirmation modal */}
      {showSubmitModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSubmitModal(false) }}
        >
          <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', width: 460, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 10 }}>Submit for Formal Review</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-600)', marginBottom: 16, lineHeight: 1.6 }}>
              You are about to submit this request for formal compliance review by the Data Management team. Once submitted, it will enter the review queue and you will receive notifications as it progresses.
            </p>

            {(assessmentData as Record<string, unknown>)?.riskLevel === 'high' && (
              <div style={{
                padding: '12px 14px', background: 'var(--red-50)',
                border: '1px solid #FECACA', borderRadius: 'var(--r-md)',
                fontSize: 13, color: 'var(--red-700)', marginBottom: 16, lineHeight: 1.55,
              }}>
                <strong>⚠️ High-Risk Request</strong><br />
                This request has been classified as High Risk. Please ensure all required approvals, documentation, and safeguards are in place before proceeding. The review team will scrutinize this submission closely.
              </div>
            )}

            <div style={{ padding: '12px 14px', background: 'var(--amber-50)', border: '1px solid #FDE68A', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--amber-700)', marginBottom: 22 }}>
              <strong>Submitting is final.</strong> You cannot retract a submitted request; only a reviewer can return it to you.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setShowSubmitModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setShowSubmitModal(false); void submit() }} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
