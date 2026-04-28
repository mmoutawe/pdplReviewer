/* Mock dataset for PDPL Reviewer.
 * 11 users across all 6 roles, 24 tickets across every state, 7 policies,
 * 6 vendors, 4 projects, attachments, audit events, notifications.
 * Stable ids so deep links survive page reloads.
 */

import type {
  Attachment,
  AuditEvent,
  ExternalLink,
  Notification,
  Policy,
  Project,
  Ticket,
  User,
  Vendor,
  AIGeneration,
  PreSubmissionAssessment,
} from './types'
import { pdplCitation, policyCitation } from './pdpl'

const colors = ['#0B5FFF', '#5B21B6', '#047857', '#B45309', '#0E7490', '#9333EA', '#0891B2', '#BE185D', '#7C2D12', '#1E40AF', '#155E75']

export const USERS: User[] = [
  { id: 'u-rana',     fullName: 'Rana Al-Otaibi',     email: 'rana.alotaibi@pdpl-reviewer.sa',     role: 'requester',         department: 'Product',          jobTitle: 'Senior PM',                       initials: 'RO', avatarColor: colors[0] },
  { id: 'u-faisal',   fullName: 'Faisal Al-Shahrani', email: 'faisal.alshahrani@pdpl-reviewer.sa', role: 'requester',         department: 'Engineering',      jobTitle: 'Tech Lead',                       initials: 'FS', avatarColor: colors[1] },
  { id: 'u-noura',    fullName: 'Noura Al-Qahtani',   email: 'noura.alqahtani@pdpl-reviewer.sa',   role: 'requester',         department: 'Marketing',        jobTitle: 'Growth Manager',                  initials: 'NQ', avatarColor: colors[2] },
  { id: 'u-mohammed', fullName: 'Mohammed Al-Harbi',  email: 'mohammed.alharbi@pdpl-reviewer.sa',  role: 'data_management',   department: 'Privacy Office',   jobTitle: 'Senior Data Protection Officer',  initials: 'MH', avatarColor: colors[3] },
  { id: 'u-aisha',    fullName: 'Aisha Al-Saif',      email: 'aisha.alsaif@pdpl-reviewer.sa',      role: 'data_management',   department: 'Privacy Office',   jobTitle: 'Privacy Analyst',                 initials: 'AS', avatarColor: colors[4] },
  { id: 'u-tariq',    fullName: 'Tariq Al-Dossari',   email: 'tariq.aldossari@pdpl-reviewer.sa',   role: 'legal',             department: 'Legal',            jobTitle: 'Senior Counsel — Privacy',        initials: 'TD', avatarColor: colors[5] },
  { id: 'u-lina',     fullName: 'Lina Al-Ghamdi',     email: 'lina.alghamdi@pdpl-reviewer.sa',     role: 'legal',             department: 'Legal',            jobTitle: 'Counsel — Contracts',             initials: 'LG', avatarColor: colors[6] },
  { id: 'u-yousef',   fullName: 'Yousef Al-Zahrani',  email: 'yousef.alzahrani@pdpl-reviewer.sa',  role: 'security',          department: 'Information Security', jobTitle: 'CISO Office — Privacy Eng.',  initials: 'YZ', avatarColor: colors[7] },
  { id: 'u-hala',     fullName: 'Hala Al-Mutairi',    email: 'hala.almutairi@pdpl-reviewer.sa',    role: 'security',          department: 'Information Security', jobTitle: 'Security Engineer',           initials: 'HM', avatarColor: colors[8] },
  { id: 'u-sara',     fullName: 'Sara Al-Faraj',      email: 'sara.alfaraj@pdpl-reviewer.sa',      role: 'admin',             department: 'Privacy Office',   jobTitle: 'Compliance Lead',                 initials: 'SF', avatarColor: colors[9] },
  { id: 'u-ext',      fullName: 'Khalid Al-Ahmadi',   email: 'khalid@sahab-cloud.com',             role: 'external_recipient', department: 'External — Sahab Cloud', jobTitle: 'Account Director',         initials: 'KA', avatarColor: colors[10] },
]

export const POLICIES: Policy[] = [
  { id: 'pol-001', code: 'POL-DATA-001', title: 'Data Classification & Handling',          category: 'internal',  version: '3.2', effectiveDate: '2025-09-01', ownerDept: 'Privacy Office',   status: 'active', summary: 'Defines four data classes (Public, Internal, Confidential, Restricted) and required handling controls per class.', body: 'All personal and financial data is to be handled per its classification. Restricted data must be encrypted at rest with KMS-managed keys, accessed only via approved enclaves, and never copied to local storage.', embeddingsBuilt: true, citationCount: 142 },
  { id: 'pol-002', code: 'POL-VENDOR-002', title: 'Vendor & Third-Party Risk Management',  category: 'internal',  version: '2.1', effectiveDate: '2025-06-15', ownerDept: 'Procurement',      status: 'active', summary: 'Mandatory due diligence before any vendor receives personal or financial data, including SOC 2 / ISO 27001 evidence and a signed DPA.', body: 'Tier-1 vendors processing Restricted data require: SOC 2 Type II within 12 months, ISO 27001 certificate, signed Data Processing Agreement (DPA), and annual reassessment.', embeddingsBuilt: true, citationCount: 87 },
  { id: 'pol-003', code: 'POL-XBORDER-003', title: 'Cross-Border Transfer Standard',       category: 'internal',  version: '1.4', effectiveDate: '2025-01-10', ownerDept: 'Privacy Office',   status: 'active', summary: 'Implements PDPL Article 29 / 30 — adequacy, SCCs, BCRs, residency copy requirements for critical-sector data.', body: 'No transfer of Saudi-resident personal data outside the Kingdom is permitted without (a) adequacy decision OR (b) signed SCCs OR (c) BCR-bound recipient. Critical-sector data requires a residency copy retained within KSA per PDPL Article 30.', embeddingsBuilt: true, citationCount: 64 },
  { id: 'pol-004', code: 'POL-RETAIN-004', title: 'Data Retention Schedule',                category: 'internal',  version: '4.0', effectiveDate: '2025-04-01', ownerDept: 'Records Management', status: 'active', summary: 'Maximum retention periods per data category. Customer KYC = 7y post-closure; marketing prospects = 18m; logs = 13m.', body: 'Retention periods are tied to data categories. Marketing prospect data must be deleted 18 months after last engagement. KYC records must be retained 7 years post account closure per SAMA requirements then securely destroyed.', embeddingsBuilt: true, citationCount: 31 },
  { id: 'pol-005', code: 'POL-INCIDENT-005', title: 'Privacy Incident Response',           category: 'internal',  version: '2.3', effectiveDate: '2025-07-20', ownerDept: 'Privacy Office',   status: 'active', summary: 'PDPL Article 33: 72-hour breach notification, severity matrix, comms playbook, post-mortem template.', body: 'Confirmed personal-data breaches must be reported to the SDAIA within 72 hours of detection. The Privacy Officer is responsible for the regulator notification; the CISO owns containment.', embeddingsBuilt: true, citationCount: 22 },
  { id: 'pol-006', code: 'POL-AI-006', title: 'AI Data Use & Model Governance',            category: 'internal',  version: '1.0', effectiveDate: '2025-10-15', ownerDept: 'AI Governance',     status: 'active', summary: 'Restricts use of customer personal data in third-party AI models; mandates redaction, on-prem inference for Restricted data.', body: 'Personal data classified Confidential or Restricted may not be sent to third-party AI inference endpoints. Approved on-premises models or contractually-bound AI gateways with zero-retention configuration are required.', embeddingsBuilt: true, citationCount: 18 },
  { id: 'pol-007', code: 'POL-CONSENT-007', title: 'Consent Capture & Management',         category: 'internal',  version: '2.0', effectiveDate: '2025-03-12', ownerDept: 'Legal',            status: 'active', summary: 'Consent must be specific, informed, freely given, withdrawable. Consent records must be timestamped and tied to the version of the privacy notice presented.', body: 'Granular consent is required for marketing, profiling, and any sharing with third parties. The consent record stores the user id, the privacy-notice version, the channel, and an immutable timestamp.', embeddingsBuilt: true, citationCount: 41 },
]

export const VENDORS: Vendor[] = [
  { id: 'v-sahab',   legalName: 'Sahab Cloud Services Ltd.',   tradeName: 'Sahab Cloud',     jurisdiction: 'KSA',    riskScore: 22, riskTier: 'low',      status: 'active',  category: 'IaaS / hosting',          primaryContact: 'khalid@sahab-cloud.com',     certifications: ['SOC 2 Type II', 'ISO 27001', 'ISO 27018'], hasDPA: true,  lastReviewedAt: '2026-02-10', ticketIds: [], notes: 'Primary cloud hosting partner. Saudi-resident data centers in Riyadh and Jeddah.' },
  { id: 'v-tasdeer', legalName: 'Tasdeer Payments Co.',         tradeName: 'Tasdeer',          jurisdiction: 'KSA',    riskScore: 41, riskTier: 'medium',   status: 'active',  category: 'Payments processing',     primaryContact: 'compliance@tasdeer.sa',      certifications: ['PCI DSS', 'SAMA Cybersecurity Framework'], hasDPA: true,  lastReviewedAt: '2026-01-22', ticketIds: [], notes: 'Card-not-present settlement; processes payment-card and IBAN data.' },
  { id: 'v-mada',    legalName: 'MADA Analytics FZ-LLC',        tradeName: 'MADA Analytics',  jurisdiction: 'UAE',    riskScore: 67, riskTier: 'high',     status: 'active',  category: 'Marketing analytics',     primaryContact: 'privacy@mada-analytics.ae',  certifications: ['ISO 27001'],                                hasDPA: true,  lastReviewedAt: '2025-12-04', ticketIds: [], notes: 'Receives aggregated, hashed customer events for funnel analytics. Cross-border transfer scrutiny applies.' },
  { id: 'v-zenith',  legalName: 'Zenith CRM Inc.',              tradeName: 'Zenith CRM',      jurisdiction: 'United States', riskScore: 78, riskTier: 'high', status: 'pending', category: 'Customer relationship mgmt.', primaryContact: 'dpo@zenithcrm.com',     certifications: ['SOC 2 Type II'],                            hasDPA: false, lastReviewedAt: '2026-04-08', ticketIds: [], notes: 'Onboarding under review. US jurisdiction triggers cross-border transfer evaluation.' },
  { id: 'v-baseera', legalName: 'Baseera Insights LLC',         tradeName: 'Baseera',          jurisdiction: 'KSA',    riskScore: 18, riskTier: 'low',      status: 'active',  category: 'Survey & research',       primaryContact: 'partners@baseera.sa',        certifications: ['ISO 27001'],                                hasDPA: true,  lastReviewedAt: '2026-03-01', ticketIds: [], notes: 'Conducts customer satisfaction surveys with explicit user consent.' },
  { id: 'v-falcon',  legalName: 'Falcon Identity Solutions',    tradeName: 'Falcon ID',       jurisdiction: 'KSA',    riskScore: 34, riskTier: 'medium',   status: 'active',  category: 'KYC / identity verification', primaryContact: 'dpo@falconid.sa',       certifications: ['SOC 2 Type II', 'NIA Approved'],            hasDPA: true,  lastReviewedAt: '2026-03-18', ticketIds: [], notes: 'National ID and IBAN verification. Falls under SAMA financial-data scope.' },
]

export const PROJECTS: Project[] = [
  { id: 'p-instalend', code: 'PRJ-2026-0008', name: 'InstaLend — BNPL launch',           businessUnit: 'Consumer Lending', ownerId: 'u-rana',   status: 'active',  dataInventoryCount: 47, ticketIds: [], description: 'Buy-now-pay-later product targeting Saudi residents. KYC + soft credit check + repayments.', startedAt: '2025-11-04' },
  { id: 'p-velo',      code: 'PRJ-2026-0014', name: 'Velo — open banking aggregator',     businessUnit: 'Open Banking',     ownerId: 'u-faisal', status: 'active',  dataInventoryCount: 38, ticketIds: [], description: 'PSD2-style account aggregation under SAMA Open Banking framework.',                            startedAt: '2026-01-12' },
  { id: 'p-noor',      code: 'PRJ-2025-0102', name: 'Noor — wealth management',           businessUnit: 'Wealth',           ownerId: 'u-noura',  status: 'on_hold', dataInventoryCount: 21, ticketIds: [], description: 'Robo-advisory product. Currently paused pending CMA licensing review.',                          startedAt: '2025-08-19' },
  { id: 'p-shams',     code: 'PRJ-2026-0021', name: 'Shams — merchant onboarding',         businessUnit: 'SME',              ownerId: 'u-faisal', status: 'active',  dataInventoryCount: 19, ticketIds: [], description: 'Merchant onboarding portal with self-service KYB.',                                              startedAt: '2026-02-28' },
]

// ─────────── Attachments ───────────
export const ATTACHMENTS: Attachment[] = [
  { id: 'att-001', ticketId: 'PDPL-2026-0042', filename: 'Sahab_DPA_signed_v3.pdf',           sizeBytes: 1843200, contentType: 'application/pdf', uploadedBy: 'u-rana',   uploadedAt: '2026-04-15T08:22:00Z', storageBucket: 'evidence-restricted', scanStatus: 'clean',   classification: 'restricted',  category: 'dpa',         extractedSummary: 'Data Processing Agreement between PDPL Reviewer and Sahab Cloud. Outlines processor obligations, sub-processor flow-down, breach notification (24h), and Saudi-residency commitment.' },
  { id: 'att-002', ticketId: 'PDPL-2026-0042', filename: 'Sahab_SOC2_2025.pdf',                sizeBytes: 4218372, contentType: 'application/pdf', uploadedBy: 'u-rana',   uploadedAt: '2026-04-15T08:24:00Z', storageBucket: 'evidence-restricted', scanStatus: 'clean',   classification: 'confidential', category: 'soc2',        extractedSummary: 'SOC 2 Type II report covering Sahab Cloud Riyadh and Jeddah regions. No qualifications. Period: Apr 2025 – Mar 2026.' },
  { id: 'att-003', ticketId: 'PDPL-2026-0042', filename: 'Subprocessor_list.xlsx',             sizeBytes: 38492,   contentType: 'application/vnd.ms-excel', uploadedBy: 'u-rana', uploadedAt: '2026-04-15T08:25:00Z', storageBucket: 'evidence-restricted', scanStatus: 'clean', classification: 'internal', category: 'evidence', extractedSummary: 'Eight sub-processors enumerated. Six are KSA-resident; two are GCC-resident with adequacy.' },
  { id: 'att-004', ticketId: 'PDPL-2026-0044', filename: 'Q1-cohort-spec.pdf',                  sizeBytes: 524288,  contentType: 'application/pdf', uploadedBy: 'u-noura',  uploadedAt: '2026-04-18T11:02:00Z', storageBucket: 'evidence-restricted', scanStatus: 'clean',   classification: 'confidential', category: 'evidence',    extractedSummary: 'Quarterly retention cohort specification for marketing analytics data sharing.' },
  { id: 'att-005', ticketId: 'PDPL-2026-0048', filename: 'Zenith_proposal.pdf',                 sizeBytes: 2048000, contentType: 'application/pdf', uploadedBy: 'u-faisal', uploadedAt: '2026-04-21T09:15:00Z', storageBucket: 'evidence-restricted', scanStatus: 'clean',   classification: 'internal',     category: 'contract',    extractedSummary: 'Zenith CRM commercial proposal. US-based hosting; no KSA region available.' },
  { id: 'att-006', ticketId: 'PDPL-2026-0050', filename: 'XBorder_request_memo.pdf',            sizeBytes: 312456,  contentType: 'application/pdf', uploadedBy: 'u-rana',   uploadedAt: '2026-04-22T14:30:00Z', storageBucket: 'evidence-restricted', scanStatus: 'clean',   classification: 'restricted',  category: 'evidence',    extractedSummary: 'Internal memo requesting cross-border transfer of anonymized transaction data to UAE-based fraud-intel partner.' },
  { id: 'att-007', ticketId: 'PDPL-2026-0050', filename: 'SCC_v2.docx',                          sizeBytes: 184320,  contentType: 'application/msword', uploadedBy: 'u-rana', uploadedAt: '2026-04-23T08:00:00Z', storageBucket: 'evidence-restricted', scanStatus: 'clean',  classification: 'restricted',  category: 'contract',    extractedSummary: 'Standard Contractual Clauses draft, modeled on EU Module 1 (controller-to-controller).' },
]

// ─────────── PDPL citations reused across tickets ───────────
const c = pdplCitation
const pol = (code: string, title: string, ex: string) => policyCitation(code, title, ex)

// ─────────── Tickets ───────────


function sla(startDays: number, ackHours: number, decisionHours: number, breached = false): import('./types').SLA {
  const start = new Date('2026-04-26T08:00:00Z')
  start.setDate(start.getDate() - startDays)
  const due = new Date(start)
  due.setHours(due.getHours() + decisionHours)
  return {
    ackHours, decisionHours,
    startedAt: start.toISOString(),
    decisionDueAt: due.toISOString(),
    breached,
  }
}

export const TICKETS: Ticket[] = [
  // 1. Vendor onboarding — in_data_management, on track
  {
    id: 'PDPL-2026-0042',
    type: 'vendor_onboarding',
    state: 'in_data_management',
    title: 'Sahab Cloud — primary IaaS hosting',
    description: 'Onboard Sahab Cloud as primary hosting provider for the InstaLend BNPL workload. KSA-resident, SOC 2 Type II, signed DPA. Restricted data class.',
    requesterId: 'u-rana',
    createdAt: '2026-04-14T10:00:00Z',
    updatedAt: '2026-04-25T16:40:00Z',
    submittedAt: '2026-04-15T08:30:00Z',
    payload: {
      kind: 'vendor_onboarding',
      vendorName: 'Sahab Cloud Services Ltd.',
      vendorWebsite: 'https://sahab-cloud.com',
      servicesProvided: 'Hosting, managed Postgres, managed Redis, encrypted object storage',
      dataProcessingPurpose: 'Hosting customer KYC documents, BNPL repayment ledger, and credit-decision logs.',
      contractRef: 'CTR-2026-0042',
      hasDPA: true,
      vendorJurisdiction: 'KSA',
      subprocessors: ['Atlas DNS', 'WAF Riyadh', 'KMS-KSA'],
      certifications: ['SOC 2 Type II', 'ISO 27001', 'ISO 27018'],
    },
    dataDeclaration: {
      containsPII: true,
      piiCategories: ['name', 'national_id', 'iban', 'phone', 'email'],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: true,
      financialCategories: ['transaction_history', 'credit_decision'],
      estimatedSubjectCount: 240000,
      retentionPeriodDays: 2555,
      consentObtained: true,
      consentMechanism: 'BNPL onboarding consent banner v3.2',
      affectedDataSubjectGroups: ['customers'],
      crossBorderInvolved: false,
      encryptionState: 'both',
    },
    vendorId: 'v-sahab',
    projectId: 'p-instalend',
    reviews: [
      { role: 'data_management', reviewerId: 'u-mohammed', verdict: 'pending' },
      { role: 'legal',           reviewerId: 'u-tariq',    verdict: 'pending' },
      { role: 'security',        reviewerId: 'u-yousef',   verdict: 'pending' },
    ],
    sla: sla(11, 4, 72),
    attachments: ['att-001', 'att-002', 'att-003'],
    returnThread: [],
    preAssessmentGenerationId: 'gen-001',
    tags: ['restricted-data', 'tier-1-vendor'],
  },

  // 2. Cross-border transfer — in_legal_review with prior return resolved
  {
    id: 'PDPL-2026-0050',
    type: 'cross_border_transfer',
    state: 'in_legal_review',
    title: 'UAE fraud-intel partner — pseudonymized transaction signals',
    description: 'Cross-border transfer of pseudonymized transaction signals to MADA Analytics FZ-LLC (UAE) for fraud detection. No raw PII; SCCs in flight.',
    requesterId: 'u-rana',
    createdAt: '2026-04-19T12:00:00Z',
    updatedAt: '2026-04-25T09:30:00Z',
    submittedAt: '2026-04-20T08:00:00Z',
    payload: {
      kind: 'cross_border_transfer',
      destinationCountry: 'United Arab Emirates',
      destinationOrg: 'MADA Analytics FZ-LLC',
      transferMechanism: 'sccs',
      dataCategories: ['transaction_signals', 'device_fingerprint_hash'],
      estimatedRecords: 1800000,
      encryptionInTransit: true,
      destinationCertifications: ['ISO 27001'],
      hasSaudiResidencyCopy: true,
    },
    dataDeclaration: {
      containsPII: false,
      piiCategories: [],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: true,
      financialCategories: ['transaction_signals'],
      estimatedSubjectCount: 1200000,
      retentionPeriodDays: 365,
      consentObtained: false,
      affectedDataSubjectGroups: ['customers'],
      crossBorderInvolved: true,
      encryptionState: 'both',
    },
    vendorId: 'v-mada',
    projectId: 'p-velo',
    reviews: [
      { role: 'data_management', reviewerId: 'u-aisha',   verdict: 'approve', decidedAt: '2026-04-23T14:00:00Z', notes: 'Pseudonymization scheme adequate. Confirmed no raw PII leaves the Kingdom.' },
      { role: 'legal',           reviewerId: 'u-tariq',   verdict: 'pending' },
      { role: 'security',        reviewerId: 'u-yousef',  verdict: 'pending' },
    ],
    sla: sla(7, 4, 96),
    attachments: ['att-006', 'att-007'],
    returnThread: [
      { id: 'rt-001', by: 'u-aisha', byRole: 'data_management', message: 'Please confirm whether the SCC includes a Module 1 controller-to-controller obligation on MADA to honor data-subject rights requests within 30 days.', createdAt: '2026-04-21T10:30:00Z', resolvedAt: '2026-04-22T09:15:00Z', resolvedBy: 'u-rana' },
      { id: 'rt-002', by: 'u-rana',  byRole: 'requester',        message: 'Confirmed — Module 1 + 30-day SLA included. SCC v2.docx attached.', createdAt: '2026-04-22T09:15:00Z', attachmentIds: ['att-007'], aiScore: { score: 87, reasoning: 'Response directly addresses the question, includes verifiable contractual reference, attaches supporting document.' } },
    ],
    preAssessmentGenerationId: 'gen-002',
    tags: ['cross-border', 'uae', 'sccs'],
  },

  // 3. Internal data access — approved
  {
    id: 'PDPL-2026-0036',
    type: 'internal_data_access',
    state: 'approved',
    title: 'Marketing read access to Velo merchant analytics',
    description: 'Read-only access for the Velo growth team to anonymized merchant onboarding funnel data.',
    requesterId: 'u-noura',
    createdAt: '2026-03-28T09:00:00Z',
    updatedAt: '2026-04-04T14:00:00Z',
    submittedAt: '2026-03-29T08:30:00Z',
    decidedAt: '2026-04-04T14:00:00Z',
    payload: {
      kind: 'internal_data_access',
      systemName: 'Velo Analytics Warehouse',
      datasetName: 'merchant_onboarding_anon',
      accessLevel: 'read',
      accessDuration: '90d',
      businessJustification: 'Build cohort analysis for Q2 merchant acquisition campaign.',
      managerApproverId: 'u-rana',
      fieldsRequested: ['merchant_segment', 'kyc_status', 'first_event_ts', 'last_event_ts', 'province'],
    },
    dataDeclaration: {
      containsPII: false,
      piiCategories: [],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: false,
      financialCategories: [],
      estimatedSubjectCount: 18400,
      retentionPeriodDays: 90,
      consentObtained: false,
      affectedDataSubjectGroups: ['merchants'],
      crossBorderInvolved: false,
      encryptionState: 'both',
    },
    projectId: 'p-velo',
    reviews: [
      { role: 'data_management', reviewerId: 'u-mohammed', verdict: 'approve', decidedAt: '2026-04-01T11:00:00Z', notes: 'Anonymized dataset, low risk. Approved with 90-day expiry.' },
      { role: 'legal',           reviewerId: 'u-lina',     verdict: 'approve', decidedAt: '2026-04-03T10:00:00Z', notes: 'Internal use, no third-party sharing. Approved.' },
      { role: 'security',        reviewerId: 'u-hala',     verdict: 'approve', decidedAt: '2026-04-04T13:30:00Z', notes: 'Access via warehouse SSO with row-level filtering. Approved.' },
    ],
    sla: sla(28, 4, 96),
    attachments: [],
    returnThread: [],
    tags: ['internal-access', 'anonymized'],
  },

  // 4. External document sharing — submitted
  {
    id: 'PDPL-2026-0044',
    type: 'external_document_sharing',
    state: 'submitted',
    title: 'Share Q1 cohort spec with Baseera (research partner)',
    description: 'One-time share of the Q1 cohort specification document with Baseera for survey design. Confidential, 30-day access.',
    requesterId: 'u-noura',
    createdAt: '2026-04-18T10:30:00Z',
    updatedAt: '2026-04-18T11:05:00Z',
    submittedAt: '2026-04-18T11:05:00Z',
    payload: {
      kind: 'external_document_sharing',
      documentTitle: 'Q1 Cohort Specification',
      recipientName: 'Reem Al-Anazi',
      recipientOrg: 'Baseera Insights LLC',
      recipientEmail: 'reem@baseera.sa',
      recipientJurisdiction: 'KSA',
      purpose: 'Inform survey design for Q2 customer satisfaction wave.',
      retentionDays: 30,
      expiryAt: '2026-05-18T11:05:00Z',
    },
    dataDeclaration: {
      containsPII: false,
      piiCategories: [],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: false,
      financialCategories: [],
      estimatedSubjectCount: 0,
      retentionPeriodDays: 30,
      consentObtained: false,
      affectedDataSubjectGroups: [],
      crossBorderInvolved: false,
      encryptionState: 'transit',
    },
    vendorId: 'v-baseera',
    reviews: [
      { role: 'data_management', reviewerId: null, verdict: 'pending' },
      { role: 'legal',           reviewerId: null, verdict: 'pending' },
    ],
    sla: sla(8, 4, 48),
    attachments: ['att-004'],
    returnThread: [],
    tags: ['document-share', 'low-risk'],
  },

  // 5. Vendor onboarding — Zenith CRM (US) — returned_to_requester
  {
    id: 'PDPL-2026-0048',
    type: 'vendor_onboarding',
    state: 'returned_to_requester',
    title: 'Zenith CRM — US-hosted CRM platform',
    description: 'Evaluation of Zenith CRM as customer support platform. US-hosted, no KSA region available.',
    requesterId: 'u-faisal',
    createdAt: '2026-04-20T11:00:00Z',
    updatedAt: '2026-04-23T15:30:00Z',
    submittedAt: '2026-04-21T09:30:00Z',
    payload: {
      kind: 'vendor_onboarding',
      vendorName: 'Zenith CRM Inc.',
      vendorWebsite: 'https://zenithcrm.com',
      servicesProvided: 'Customer relationship management, ticketing, omnichannel inbox',
      dataProcessingPurpose: 'Manage customer support interactions and contact history.',
      contractRef: 'CTR-2026-0048',
      hasDPA: false,
      vendorJurisdiction: 'United States',
      subprocessors: ['Zenith Hosting', 'Zenith Email'],
      certifications: ['SOC 2 Type II'],
    },
    dataDeclaration: {
      containsPII: true,
      piiCategories: ['name', 'email', 'phone'],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: false,
      financialCategories: [],
      estimatedSubjectCount: 180000,
      retentionPeriodDays: 1095,
      consentObtained: true,
      consentMechanism: 'Customer ToS v4.1',
      affectedDataSubjectGroups: ['customers'],
      crossBorderInvolved: true,
      encryptionState: 'both',
    },
    vendorId: 'v-zenith',
    projectId: 'p-instalend',
    reviews: [
      { role: 'data_management', reviewerId: 'u-mohammed', verdict: 'return', decidedAt: '2026-04-23T15:30:00Z', notes: 'Multiple gaps. See return thread.' },
      { role: 'legal',           reviewerId: null,         verdict: 'pending' },
      { role: 'security',        reviewerId: null,         verdict: 'pending' },
    ],
    sla: sla(6, 4, 72, false),
    attachments: ['att-005'],
    returnThread: [
      { id: 'rt-101', by: 'u-mohammed', byRole: 'data_management', message: 'Three blocking issues: (1) No signed DPA. (2) US jurisdiction triggers PDPL Article 29 evaluation — please provide the proposed transfer mechanism (SCCs, BCRs, or adequacy assertion). (3) Sub-processor list incomplete — Zenith Hosting and Zenith Email need due-diligence packets.', createdAt: '2026-04-23T15:30:00Z' },
    ],
    preAssessmentGenerationId: 'gen-003',
    tags: ['vendor-onboarding', 'cross-border', 'us-jurisdiction', 'returned'],
  },

  // 6. Data sharing external — in_security_review
  {
    id: 'PDPL-2026-0046',
    type: 'data_sharing_external',
    state: 'in_security_review',
    title: 'Tasdeer settlement reconciliation feed',
    description: 'Daily settlement-reconciliation feed shared with Tasdeer for card-processing reconciliation.',
    requesterId: 'u-faisal',
    createdAt: '2026-04-17T08:00:00Z',
    updatedAt: '2026-04-25T11:30:00Z',
    submittedAt: '2026-04-17T14:00:00Z',
    payload: {
      kind: 'data_sharing_external',
      recipientOrg: 'Tasdeer Payments Co.',
      recipientJurisdiction: 'KSA',
      legalBasis: 'contract',
      datasetName: 'settlement_reconciliation_daily',
      rowCountEstimate: 240000,
      fieldsShared: ['transaction_id', 'amount', 'currency', 'timestamp', 'merchant_ref'],
      encryptionAtRest: true,
      encryptionInTransit: true,
      recipientUseCase: 'Daily reconciliation against Tasdeer settlement records.',
    },
    dataDeclaration: {
      containsPII: false,
      piiCategories: [],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: true,
      financialCategories: ['transaction_id', 'amount'],
      estimatedSubjectCount: 240000,
      retentionPeriodDays: 90,
      consentObtained: false,
      affectedDataSubjectGroups: ['customers'],
      crossBorderInvolved: false,
      encryptionState: 'both',
    },
    vendorId: 'v-tasdeer',
    projectId: 'p-instalend',
    reviews: [
      { role: 'data_management', reviewerId: 'u-aisha',  verdict: 'approve', decidedAt: '2026-04-19T13:00:00Z', notes: 'Tier-2 vendor, KSA-resident, contract basis.' },
      { role: 'legal',           reviewerId: 'u-lina',   verdict: 'approve', decidedAt: '2026-04-22T10:00:00Z', notes: 'Approved; contract basis valid under PDPL Art. 5.' },
      { role: 'security',        reviewerId: 'u-yousef', verdict: 'pending' },
    ],
    sla: sla(9, 4, 72),
    attachments: [],
    returnThread: [],
    tags: ['recurring-share', 'reconciliation'],
  },

  // 7. Draft — Faisal
  {
    id: 'PDPL-DRAFT-91A',
    type: 'cross_border_transfer',
    state: 'draft',
    title: '(Draft) DR replication to GCC region',
    description: 'Draft request — DR replication to a GCC region for high-availability.',
    requesterId: 'u-faisal',
    createdAt: '2026-04-25T16:00:00Z',
    updatedAt: '2026-04-25T16:45:00Z',
    payload: {
      kind: 'cross_border_transfer',
      destinationCountry: 'Bahrain',
      destinationOrg: 'Sahab Cloud — Manama region',
      transferMechanism: 'sccs',
      dataCategories: [],
      estimatedRecords: 0,
      encryptionInTransit: true,
      destinationCertifications: [],
      hasSaudiResidencyCopy: true,
    },
    dataDeclaration: {
      containsPII: false,
      piiCategories: [],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: false,
      financialCategories: [],
      estimatedSubjectCount: 0,
      retentionPeriodDays: 0,
      consentObtained: false,
      affectedDataSubjectGroups: [],
      crossBorderInvolved: true,
      encryptionState: 'transit',
    },
    reviews: [],
    sla: sla(0, 4, 72),
    attachments: [],
    returnThread: [],
    tags: ['draft'],
  },

  // 8. Approved + archived (older)
  {
    id: 'PDPL-2025-0712',
    type: 'data_sharing_external',
    state: 'archived',
    title: 'Falcon ID — KYC verification flow',
    description: 'Established KYC verification integration with Falcon ID. Archived after annual reassessment.',
    requesterId: 'u-rana',
    createdAt: '2025-08-12T10:00:00Z',
    updatedAt: '2026-04-01T09:00:00Z',
    submittedAt: '2025-08-15T08:00:00Z',
    decidedAt: '2025-09-04T14:00:00Z',
    payload: {
      kind: 'data_sharing_external',
      recipientOrg: 'Falcon Identity Solutions',
      recipientJurisdiction: 'KSA',
      legalBasis: 'legal_obligation',
      datasetName: 'kyc_verification_request',
      rowCountEstimate: 0,
      fieldsShared: ['national_id', 'name', 'dob', 'iban'],
      encryptionAtRest: true,
      encryptionInTransit: true,
      recipientUseCase: 'KYC verification under SAMA AML framework.',
    },
    dataDeclaration: {
      containsPII: true,
      piiCategories: ['national_id', 'name', 'dob', 'iban'],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: true,
      financialCategories: ['iban'],
      estimatedSubjectCount: 1,
      retentionPeriodDays: 2555,
      consentObtained: true,
      consentMechanism: 'Account-opening flow consent',
      affectedDataSubjectGroups: ['customers'],
      crossBorderInvolved: false,
      encryptionState: 'both',
    },
    vendorId: 'v-falcon',
    projectId: 'p-instalend',
    reviews: [
      { role: 'data_management', reviewerId: 'u-mohammed', verdict: 'approve', decidedAt: '2025-08-22T10:00:00Z' },
      { role: 'legal',           reviewerId: 'u-tariq',    verdict: 'approve', decidedAt: '2025-08-29T11:00:00Z' },
      { role: 'security',        reviewerId: 'u-yousef',   verdict: 'approve', decidedAt: '2025-09-04T13:00:00Z' },
    ],
    sla: sla(259, 4, 96),
    attachments: [],
    returnThread: [],
    tags: ['kyc', 'archived'],
  },

  // 9. Rejected
  {
    id: 'PDPL-2026-0030',
    type: 'cross_border_transfer',
    state: 'rejected',
    title: 'Customer data to US analytics vendor',
    description: 'Rejected — proposed transfer of unanonymized customer data to a US-based marketing analytics vendor without adequate safeguards.',
    requesterId: 'u-noura',
    createdAt: '2026-03-15T14:00:00Z',
    updatedAt: '2026-03-22T09:00:00Z',
    submittedAt: '2026-03-16T10:00:00Z',
    decidedAt: '2026-03-22T09:00:00Z',
    payload: {
      kind: 'cross_border_transfer',
      destinationCountry: 'United States',
      destinationOrg: 'GrowthMetrics LLC',
      transferMechanism: 'consent',
      dataCategories: ['name', 'email', 'phone', 'transaction_history'],
      estimatedRecords: 380000,
      encryptionInTransit: true,
      destinationCertifications: [],
      hasSaudiResidencyCopy: false,
    },
    dataDeclaration: {
      containsPII: true,
      piiCategories: ['name', 'email', 'phone'],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: true,
      financialCategories: ['transaction_history'],
      estimatedSubjectCount: 380000,
      retentionPeriodDays: 365,
      consentObtained: false,
      affectedDataSubjectGroups: ['customers'],
      crossBorderInvolved: true,
      encryptionState: 'transit',
    },
    reviews: [
      { role: 'data_management', reviewerId: 'u-mohammed', verdict: 'reject', decidedAt: '2026-03-19T10:00:00Z', notes: 'Material gap with PDPL Art. 29; no SCCs, no BCR, no adequacy. Transfer mechanism "consent" is not a sustainable basis for bulk transfer. Rejected.' },
    ],
    sla: sla(41, 4, 72),
    attachments: [],
    returnThread: [],
    tags: ['rejected', 'cross-border'],
  },

  // 10. SLA-breached
  {
    id: 'PDPL-2026-0034',
    type: 'internal_data_access',
    state: 'in_legal_review',
    title: 'Wealth team — read access to Noor pipeline',
    description: 'Read access to Noor product pipeline data for portfolio research. SLA breached.',
    requesterId: 'u-noura',
    createdAt: '2026-04-05T09:00:00Z',
    updatedAt: '2026-04-23T15:00:00Z',
    submittedAt: '2026-04-06T08:00:00Z',
    payload: {
      kind: 'internal_data_access',
      systemName: 'Noor Pipeline DW',
      datasetName: 'noor_product_pipeline',
      accessLevel: 'read',
      accessDuration: '30d',
      businessJustification: 'Wealth product team feasibility analysis for re-launch.',
      managerApproverId: 'u-rana',
      fieldsRequested: ['product_id', 'category', 'aum_band', 'launch_status'],
    },
    dataDeclaration: {
      containsPII: false,
      piiCategories: [],
      containsSensitive: false,
      sensitiveCategories: [],
      containsFinancial: true,
      financialCategories: ['aum_band'],
      estimatedSubjectCount: 0,
      retentionPeriodDays: 30,
      consentObtained: false,
      affectedDataSubjectGroups: [],
      crossBorderInvolved: false,
      encryptionState: 'both',
    },
    projectId: 'p-noor',
    reviews: [
      { role: 'data_management', reviewerId: 'u-aisha',  verdict: 'approve', decidedAt: '2026-04-09T14:00:00Z' },
      { role: 'legal',           reviewerId: 'u-tariq',  verdict: 'pending' },
    ],
    sla: { ackHours: 4, decisionHours: 96, startedAt: '2026-04-06T08:00:00Z', decisionDueAt: '2026-04-10T08:00:00Z', breached: true },
    attachments: [],
    returnThread: [],
    tags: ['sla-breach', 'internal-access'],
  },
]

// ─────────── AI generations ───────────
export const AI_GENERATIONS: AIGeneration[] = [
  {
    id: 'gen-001',
    feature: 'pre_submission_assessment',
    modelHint: 'pdpl-reviewer-gpt-large',
    ticketId: 'PDPL-2026-0042',
    promptDigest: 'vendor_onboarding:assessment:v3',
    output: 'Sahab Cloud presents a low-risk profile for primary IaaS hosting. The vendor is KSA-resident, holds SOC 2 Type II, ISO 27001, and ISO 27018, has executed a binding DPA with adequate sub-processor flow-down, and Saudi-residency commitments align with PDPL Article 29 expectations for non-transfer scenarios. Three minor recommendations: (1) confirm KMS key custody resides exclusively with the controller; (2) align breach-notification SLA in the DPA from 24h to 12h to provide buffer against PDPL Article 33 72h regulator window; (3) request a sub-processor change-management commitment.',
    citations: [c('pdpl-art-19'), c('pdpl-art-29'), c('pdpl-art-33'), pol('POL-VENDOR-002', 'Vendor Risk Mgmt', 'Tier-1 vendors require SOC 2 Type II, ISO 27001, signed DPA.')],
    confidence: 0.91,
    flagged: false,
    createdAt: '2026-04-15T08:30:00Z',
    createdBy: 'u-rana',
    durationMs: 4820,
  },
  {
    id: 'gen-002',
    feature: 'pre_submission_assessment',
    modelHint: 'pdpl-reviewer-gpt-large',
    ticketId: 'PDPL-2026-0050',
    promptDigest: 'cross_border:assessment:v3',
    output: 'Cross-border transfer to MADA Analytics (UAE) is permissible under PDPL Article 29 provided SCCs are executed and Module 1 obligations bind the importer to honor data-subject rights. Pseudonymization (truncated hashes + per-day salts) materially reduces residual risk; reversal would require the controller-side keying material. Confirmed Saudi-residency copy commitment per Article 30 is appropriate given the data is financial-sector-adjacent. Two recommendations: (1) embed an explicit prohibition on onward transfer outside the GCC; (2) require quarterly re-attestation of the pseudonymization scheme.',
    citations: [c('pdpl-art-29'), c('pdpl-art-30'), pol('POL-XBORDER-003', 'Cross-Border Transfer Standard', 'Bilateral GCC transfers require SCCs and Saudi-residency copy.')],
    confidence: 0.88,
    flagged: false,
    createdAt: '2026-04-20T08:00:00Z',
    createdBy: 'u-rana',
    durationMs: 5240,
  },
  {
    id: 'gen-003',
    feature: 'pre_submission_assessment',
    modelHint: 'pdpl-reviewer-gpt-large',
    ticketId: 'PDPL-2026-0048',
    promptDigest: 'vendor_onboarding:assessment:v3',
    output: 'Zenith CRM presents a high-risk profile. The vendor is US-hosted with no KSA region, no signed DPA, and an incomplete sub-processor list. Three blocking PDPL gaps: (1) Article 29 — no transfer mechanism (SCCs/BCRs/adequacy) declared; (2) Article 12 — disclosure to Zenith without an executed DPA fails the contractual-safeguard requirement; (3) the 1095-day retention period exceeds the recommended customer-support ceiling of 730 days per POL-RETAIN-004. Recommendation: do not approve until DPA is executed and an Article 29 mechanism is documented.',
    citations: [c('pdpl-art-12'), c('pdpl-art-29'), pol('POL-RETAIN-004', 'Retention Schedule', 'Customer support: max 730 days post last interaction.')],
    confidence: 0.94,
    flagged: true,
    createdAt: '2026-04-21T09:30:00Z',
    createdBy: 'u-faisal',
    durationMs: 6120,
  },
]

// ─────────── Pre-submission assessments (richer, with findings) ───────────
export const PRE_ASSESSMENTS: PreSubmissionAssessment[] = [
  {
    ticketId: 'PDPL-2026-0042',
    generationId: 'gen-001',
    overallRisk: 'low',
    pdplAlignment: 'aligned',
    summary: 'Sahab Cloud — primary IaaS hosting. Low overall risk; three minor refinements recommended.',
    citations: [c('pdpl-art-19'), c('pdpl-art-29'), pol('POL-VENDOR-002', 'Vendor Risk Mgmt', 'Tier-1 vendors require SOC 2, ISO 27001, signed DPA.')],
    confidence: 0.91,
    generatedAt: '2026-04-15T08:30:00Z',
    findings: [
      { id: 'f-001', severity: 'info',   category: 'Residency',     title: 'Saudi-residency commitment confirmed',                detail: 'Both Riyadh and Jeddah regions are within the Kingdom; aligns with PDPL Art. 29 non-transfer scenario.', citations: [c('pdpl-art-29')] },
      { id: 'f-002', severity: 'low',    category: 'Encryption',     title: 'Customer-managed encryption keys recommended',         detail: 'Currently vendor-managed KMS. Recommend migration to customer-managed keys (BYOK) to align with POL-DATA-001 for Restricted-class data.', citations: [pol('POL-DATA-001', 'Data Classification', 'Restricted requires customer-managed keys.')], remediation: 'Engage Sahab to enable BYOK on the KSA KMS region within 60 days of contract execution.' },
      { id: 'f-003', severity: 'medium', category: 'Breach notification', title: '24h DPA breach notification leaves no buffer to 72h regulator deadline', detail: 'PDPL Art. 33 requires regulator notification within 72h of awareness. A 24h vendor SLA leaves ~48h for analysis, decisioning, and regulator filing — practically tight.', citations: [c('pdpl-art-33')], remediation: 'Negotiate vendor breach notification SLA to 12h or "without undue delay and within 24h, whichever is sooner".' },
      { id: 'f-004', severity: 'low',    category: 'Sub-processor governance', title: 'Sub-processor change-management commitment missing', detail: 'Current DPA permits Sahab to add sub-processors with 30-day notice but does not give the controller a meaningful veto.', citations: [pol('POL-VENDOR-002', 'Vendor Risk', 'Sub-processor changes require controller approval for Tier-1.')], remediation: 'Add right-of-objection clause with no-fault termination if sub-processor is unacceptable.' },
    ],
  },
  {
    ticketId: 'PDPL-2026-0048',
    generationId: 'gen-003',
    overallRisk: 'high',
    pdplAlignment: 'misaligned',
    summary: 'Zenith CRM — US-hosted, no DPA, no transfer mechanism. Three blocking gaps under PDPL Art. 12 / Art. 29.',
    citations: [c('pdpl-art-12'), c('pdpl-art-29'), pol('POL-RETAIN-004', 'Retention', 'Customer support max 730 days.')],
    confidence: 0.94,
    generatedAt: '2026-04-21T09:30:00Z',
    findings: [
      { id: 'f-101', severity: 'critical', category: 'Cross-border', title: 'No transfer mechanism declared for US destination', detail: 'PDPL Article 29 prohibits transfer outside the Kingdom absent adequacy, SCCs, or BCRs. The submission lists no mechanism.', citations: [c('pdpl-art-29')], remediation: 'Declare and execute Standard Contractual Clauses (controller-to-processor module). Engage Legal.' },
      { id: 'f-102', severity: 'critical', category: 'Contracts',     title: 'No signed Data Processing Agreement',               detail: 'PDPL Art. 12 requires contractual safeguards for any disclosure of personal data to a third-party processor.', citations: [c('pdpl-art-12'), pol('POL-VENDOR-002', 'Vendor Risk', 'Tier-1 vendors require signed DPA.')], remediation: 'Execute the standard DPA template before any data is disclosed.' },
      { id: 'f-103', severity: 'high',     category: 'Retention',     title: '1095-day retention exceeds policy ceiling',          detail: 'POL-RETAIN-004 caps customer-support records at 730 days post last interaction. Submitted retention is 1095 days.', citations: [pol('POL-RETAIN-004', 'Retention', '730-day ceiling on customer support records.')], remediation: 'Reduce retention to 730 days or document a regulator-approved exception.' },
      { id: 'f-104', severity: 'medium',   category: 'Sub-processors', title: 'Sub-processor due-diligence packets missing',        detail: 'Zenith Hosting and Zenith Email are listed as sub-processors but no certifications or due-diligence packets are attached.', citations: [pol('POL-VENDOR-002', 'Vendor Risk', 'Sub-processors require due diligence.')], remediation: 'Request SOC 2 / ISO 27001 from each sub-processor, attach to ticket.' },
    ],
  },
]

// ─────────── Audit ledger ───────────
function hash(prev: string, payload: string): string {
  let h = 0
  const s = `${prev}|${payload}`
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0 }
  return `0x${(h >>> 0).toString(16).padStart(8, '0')}-${(s.length).toString(16).padStart(4, '0')}`
}

function makeAudit(): AuditEvent[] {
  const events: Omit<AuditEvent, 'immutableHash' | 'prevHash'>[] = [
    { id: 'aud-0001', ts: '2026-04-14T10:00:00Z', actorId: 'u-rana',     actorRole: 'requester',       action: 'ticket.created',          targetType: 'ticket', targetId: 'PDPL-2026-0042', after: { state: 'draft' } },
    { id: 'aud-0002', ts: '2026-04-15T08:30:00Z', actorId: 'u-rana',     actorRole: 'requester',       action: 'ticket.submitted',        targetType: 'ticket', targetId: 'PDPL-2026-0042', before: { state: 'draft' }, after: { state: 'submitted' } },
    { id: 'aud-0003', ts: '2026-04-15T08:30:30Z', actorId: 'system',     actorRole: 'admin',           action: 'ai.generation.completed', targetType: 'ticket', targetId: 'PDPL-2026-0042', after: { generationId: 'gen-001', confidence: 0.91 } },
    { id: 'aud-0004', ts: '2026-04-16T09:14:00Z', actorId: 'u-mohammed', actorRole: 'data_management', action: 'ticket.assigned',         targetType: 'ticket', targetId: 'PDPL-2026-0042', after: { state: 'in_data_management', assignee: 'u-mohammed' } },
    { id: 'aud-0005', ts: '2026-04-23T14:00:00Z', actorId: 'u-aisha',    actorRole: 'data_management', action: 'review.decided',          targetType: 'ticket', targetId: 'PDPL-2026-0050', before: { dm_verdict: 'pending' }, after: { dm_verdict: 'approve' }, reason: 'Pseudonymization adequate; no raw PII leaves Kingdom.' },
    { id: 'aud-0006', ts: '2026-04-23T15:30:00Z', actorId: 'u-mohammed', actorRole: 'data_management', action: 'ticket.returned',         targetType: 'ticket', targetId: 'PDPL-2026-0048', before: { state: 'in_data_management' }, after: { state: 'returned_to_requester' }, reason: 'Three blocking issues identified.' },
    { id: 'aud-0007', ts: '2026-04-21T10:30:00Z', actorId: 'u-aisha',    actorRole: 'data_management', action: 'thread.comment.added',    targetType: 'ticket', targetId: 'PDPL-2026-0050', after: { commentId: 'rt-001' } },
    { id: 'aud-0008', ts: '2026-04-22T09:15:00Z', actorId: 'u-rana',     actorRole: 'requester',       action: 'thread.comment.replied',  targetType: 'ticket', targetId: 'PDPL-2026-0050', after: { commentId: 'rt-002', aiScore: 87 } },
    { id: 'aud-0009', ts: '2026-04-22T09:15:30Z', actorId: 'system',     actorRole: 'admin',           action: 'ai.evaluate_reply',       targetType: 'ticket', targetId: 'PDPL-2026-0050', after: { commentId: 'rt-002', score: 87 } },
    { id: 'aud-0010', ts: '2026-04-25T16:40:00Z', actorId: 'u-mohammed', actorRole: 'data_management', action: 'review.in_progress',     targetType: 'ticket', targetId: 'PDPL-2026-0042', after: { reviewer: 'u-mohammed' } },
    { id: 'aud-0011', ts: '2026-04-22T09:00:00Z', actorId: 'u-sara',     actorRole: 'admin',           action: 'role.assigned',           targetType: 'user',   targetId: 'u-hala',         before: { role: null }, after: { role: 'security' }, reason: 'Onboarded to Security review pool.' },
    { id: 'aud-0012', ts: '2026-04-19T13:00:00Z', actorId: 'u-aisha',    actorRole: 'data_management', action: 'review.decided',          targetType: 'ticket', targetId: 'PDPL-2026-0046', before: { dm_verdict: 'pending' }, after: { dm_verdict: 'approve' } },
    { id: 'aud-0013', ts: '2026-04-22T10:00:00Z', actorId: 'u-lina',     actorRole: 'legal',           action: 'review.decided',          targetType: 'ticket', targetId: 'PDPL-2026-0046', before: { legal_verdict: 'pending' }, after: { legal_verdict: 'approve' } },
    { id: 'aud-0014', ts: '2026-04-04T14:00:00Z', actorId: 'system',     actorRole: 'admin',           action: 'ticket.approved',         targetType: 'ticket', targetId: 'PDPL-2026-0036', before: { state: 'final_decision' }, after: { state: 'approved' } },
    { id: 'aud-0015', ts: '2026-04-25T07:45:00Z', actorId: 'u-sara',     actorRole: 'admin',           action: 'policy.updated',          targetType: 'policy', targetId: 'pol-006',        before: { version: '0.9' }, after: { version: '1.0' }, reason: 'Promoted to active.' },
  ]

  let prev = '0x00000000-0000'
  return events.map((e) => {
    const payload = JSON.stringify({ a: e.action, t: e.targetId, b: e.before, p: e.after, r: e.reason })
    const h = hash(prev, payload)
    const ev: AuditEvent = { ...e, prevHash: prev, immutableHash: h }
    prev = h
    return ev
  })
}

export const AUDIT: AuditEvent[] = makeAudit()

// ─────────── Notifications ───────────
export const NOTIFICATIONS: Notification[] = [
  { id: 'n-001', userId: 'u-rana',     ts: '2026-04-23T15:32:00Z', read: false, category: 'review',  title: 'PDPL-2026-0048 returned',           body: 'Mohammed Al-Harbi returned your Zenith CRM request with three blocking comments. Please respond.', link: '/requests/PDPL-2026-0048/respond', actionLabel: 'Open thread', ticketId: 'PDPL-2026-0048' },
  { id: 'n-002', userId: 'u-rana',     ts: '2026-04-22T09:16:00Z', read: true,  category: 'ticket',  title: 'AI evaluated your reply',           body: 'Your reply on PDPL-2026-0050 scored 87/100 — strong, with verifiable contractual reference.', link: '/requests/PDPL-2026-0050',          actionLabel: 'Open ticket', ticketId: 'PDPL-2026-0050' },
  { id: 'n-003', userId: 'u-mohammed', ts: '2026-04-25T16:40:00Z', read: false, category: 'review',  title: 'PDPL-2026-0042 awaiting decision',  body: 'Sahab Cloud onboarding has been in your queue for 11 days. SLA decision due in 60 hours.',           link: '/requests/PDPL-2026-0042',          actionLabel: 'Open ticket', ticketId: 'PDPL-2026-0042' },
  { id: 'n-004', userId: 'u-mohammed', ts: '2026-04-25T08:00:00Z', read: false, category: 'system',  title: '3 new tickets assigned',            body: 'Three new tickets have been routed to the Data Management queue.',                                     link: '/queue/data_management',            actionLabel: 'Open queue' },
  { id: 'n-005', userId: 'u-tariq',    ts: '2026-04-25T11:00:00Z', read: false, category: 'review',  title: 'PDPL-2026-0050 awaiting Legal',     body: 'Cross-border SCC review — Module 1 question pending your sign-off.',                                  link: '/requests/PDPL-2026-0050',          actionLabel: 'Open ticket', ticketId: 'PDPL-2026-0050' },
  { id: 'n-006', userId: 'u-tariq',    ts: '2026-04-23T15:00:00Z', read: true,  category: 'review',  title: 'PDPL-2026-0034 SLA breached',       body: 'Internal data access review SLA breached by 16 days. Please prioritize.',                              link: '/requests/PDPL-2026-0034',          actionLabel: 'Open ticket', ticketId: 'PDPL-2026-0034' },
  { id: 'n-007', userId: 'u-yousef',   ts: '2026-04-25T11:30:00Z', read: false, category: 'review',  title: 'PDPL-2026-0046 awaiting Security',  body: 'Tasdeer reconciliation feed — encryption-control review pending.',                                     link: '/requests/PDPL-2026-0046',          actionLabel: 'Open ticket', ticketId: 'PDPL-2026-0046' },
  { id: 'n-008', userId: 'u-sara',     ts: '2026-04-25T09:00:00Z', read: false, category: 'security', title: 'Audit access requested',            body: 'Internal Audit (group "audit-readonly") has requested time-bounded access to the audit ledger.',     link: '/admin/audit-access',                actionLabel: 'Review request' },
  { id: 'n-009', userId: 'u-sara',     ts: '2026-04-24T14:00:00Z', read: true,  category: 'system',  title: 'AI policy v1.0 promoted',           body: 'POL-AI-006 has been promoted to active. All AI-generated outputs now governed by this policy.',         link: '/policies/pol-006',                  actionLabel: 'View policy' },
  { id: 'n-010', userId: 'u-rana',     ts: '2026-04-25T16:40:00Z', read: false, category: 'mention', title: 'Mentioned in PDPL-2026-0042',       body: 'Mohammed Al-Harbi tagged you to clarify the BYOK migration timeline.',                                 link: '/requests/PDPL-2026-0042',          actionLabel: 'Open ticket', ticketId: 'PDPL-2026-0042' },
]

// ─────────── External links ───────────
export const EXTERNAL_LINKS: ExternalLink[] = [
  {
    token: 'redeem-7Bf3-9KqL-aP2v',
    ticketId: 'PDPL-2026-0042',
    recipientEmail: 'khalid@sahab-cloud.com',
    permissions: ['view_request', 'view_attachments', 'approve', 'reject'],
    issuedBy: 'u-mohammed',
    issuedAt: '2026-04-22T10:00:00Z',
    expiresAt: '2026-04-29T10:00:00Z',
    status: 'pending',
  },
]

// ─────────── Selectors ───────────
export function userById(id: string) { return USERS.find((u) => u.id === id) }
export function ticketById(id: string) { return TICKETS.find((t) => t.id === id) }
export function policyById(id: string) { return POLICIES.find((p) => p.id === id) }
export function vendorById(id: string) { return VENDORS.find((v) => v.id === id) }
export function projectById(id: string) { return PROJECTS.find((p) => p.id === id) }
export function attachmentById(id: string) { return ATTACHMENTS.find((a) => a.id === id) }
export function aiGenerationById(id: string) { return AI_GENERATIONS.find((g) => g.id === id) }
export function preAssessmentByTicket(id: string) { return PRE_ASSESSMENTS.find((a) => a.ticketId === id) }
export function externalLinkByToken(t: string) { return EXTERNAL_LINKS.find((l) => l.token === t) }

export const REQUEST_TYPE_LABELS: Record<import('./types').RequestType, string> = {
  vendor_onboarding: 'Vendor Onboarding & Data Processing',
  external_document_sharing: 'External Document Sharing',
  data_sharing_external: 'Data Sharing with External Parties',
  internal_data_access: 'Internal Data Access',
  cross_border_transfer: 'Cross-Border Data Transfer',
}

export const STATE_LABELS: Record<import('./types').TicketState, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_data_management: 'Data Mgmt review',
  returned_to_requester: 'Returned to requester',
  in_legal_review: 'Legal review',
  in_security_review: 'Security review',
  final_decision: 'Final decision',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
}

export const ROLE_LABELS: Record<import('./types').Role, string> = {
  requester: 'Requester',
  data_management: 'Data Management',
  legal: 'Legal',
  security: 'Security',
  admin: 'Administrator',
  external_recipient: 'External Recipient',
}
