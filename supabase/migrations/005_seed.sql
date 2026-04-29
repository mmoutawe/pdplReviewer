-- ============================================================
-- PDPL Reviewer — Demo Seed Data
-- Migration: 005_seed
-- Creates realistic demo users, tickets, and supporting data.
-- All demo accounts share password: Pdpl2026!
-- Idempotent: guarded by a user-count check.
-- ============================================================

-- Wrap everything in a function so the guard's RETURN exits
-- the entire seed block, not just the DO block.
create or replace function _run_seed_005() returns void language plpgsql security definer as $fn$
begin
  if exists (select 1 from public.users limit 1) then
    raise notice '005_seed: data already present — skipping.';
    return;
  end if;

-- ═══════════════════════════════════════════════════════════
-- § 1  AUTH USERS
-- UUIDs are fixed so FK references below are stable.
--   a10…001  rana.alotaibi      requester
--   a10…002  faisal.alshahrani  requester
--   a10…003  noura.alqahtani    requester
--   a10…004  mohammed.alharbi   data_management
--   a10…005  aisha.alsaif       data_management
--   a10…006  tariq.aldossari    legal
--   a10…007  lina.alghamdi      legal
--   a10…008  yousef.alzahrani   security
--   a10…009  hala.almutairi     security
--   a10…010  sara.alfaraj       admin
--   a10…011  khalid.alahmadi    external_recipient
-- ═══════════════════════════════════════════════════════════

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data,
  confirmation_token, recovery_token,
  email_change_token_new, email_change,
  is_super_admin, is_sso_user
) values
  -- Requesters ──────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated',
   'rana.alotaibi@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '90 days', now() - interval '90 days', now(),
   '{"full_name":"Rana Al-Otaibi","role":"requester","department":"Product","job_title":"Senior PM","initials":"RO","avatar_color":"#0B5FFF"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated',
   'faisal.alshahrani@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '85 days', now() - interval '85 days', now(),
   '{"full_name":"Faisal Al-Shahrani","role":"requester","department":"Engineering","job_title":"Tech Lead","initials":"FS","avatar_color":"#5B21B6"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated',
   'noura.alqahtani@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '80 days', now() - interval '80 days', now(),
   '{"full_name":"Noura Al-Qahtani","role":"requester","department":"Marketing","job_title":"Growth Manager","initials":"NQ","avatar_color":"#047857"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  -- Data Management ─────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated',
   'mohammed.alharbi@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '120 days', now() - interval '120 days', now(),
   '{"full_name":"Mohammed Al-Harbi","role":"data_management","department":"Privacy Office","job_title":"Senior Data Protection Officer","initials":"MH","avatar_color":"#B45309"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000005',
   'authenticated', 'authenticated',
   'aisha.alsaif@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '115 days', now() - interval '115 days', now(),
   '{"full_name":"Aisha Al-Saif","role":"data_management","department":"Privacy Office","job_title":"Privacy Analyst","initials":"AS","avatar_color":"#0E7490"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  -- Legal ───────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000006',
   'authenticated', 'authenticated',
   'tariq.aldossari@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '110 days', now() - interval '110 days', now(),
   '{"full_name":"Tariq Al-Dossari","role":"legal","department":"Legal","job_title":"Senior Counsel — Privacy","initials":"TD","avatar_color":"#9333EA"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000007',
   'authenticated', 'authenticated',
   'lina.alghamdi@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '108 days', now() - interval '108 days', now(),
   '{"full_name":"Lina Al-Ghamdi","role":"legal","department":"Legal","job_title":"Counsel — Contracts","initials":"LG","avatar_color":"#0891B2"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  -- Security ────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000008',
   'authenticated', 'authenticated',
   'yousef.alzahrani@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '100 days', now() - interval '100 days', now(),
   '{"full_name":"Yousef Al-Zahrani","role":"security","department":"Information Security","job_title":"CISO Office — Privacy Eng.","initials":"YZ","avatar_color":"#BE185D"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000009',
   'authenticated', 'authenticated',
   'hala.almutairi@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '98 days', now() - interval '98 days', now(),
   '{"full_name":"Hala Al-Mutairi","role":"security","department":"Information Security","job_title":"Security Engineer","initials":"HM","avatar_color":"#7C2D12"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  -- Admin ───────────────────────────────────────────────────
  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000010',
   'authenticated', 'authenticated',
   'sara.alfaraj@pdpl-reviewer.sa',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '95 days', now() - interval '95 days', now(),
   '{"full_name":"Sara Al-Faraj","role":"admin","department":"Privacy Office","job_title":"Compliance Lead","initials":"SF","avatar_color":"#1E40AF"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false),

  -- External recipient ──────────────────────────────────────
  ('00000000-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000011',
   'authenticated', 'authenticated',
   'khalid@sahab-cloud.com',
   crypt('Pdpl2026!', gen_salt('bf')),
   now() - interval '30 days', now() - interval '30 days', now(),
   '{"full_name":"Khalid Al-Ahmadi","role":"external_recipient","department":"External — Sahab Cloud","job_title":"Account Director","initials":"KA","avatar_color":"#155E75"}',
   '{"provider":"email","providers":["email"]}',
   '', '', '', '', false, false)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 2  POLICIES
-- ═══════════════════════════════════════════════════════════
insert into public.policies (id, code, title, category, version, effective_date, owner_dept, status, summary, body, embeddings_built, citation_count) values
  ('pol-001', 'POL-DATA-001', 'Data Classification & Handling',
   'internal', '3.2', '2025-09-01', 'Privacy Office', 'active',
   'Defines four data classes (Public, Internal, Confidential, Restricted) and required handling controls per class.',
   'All personal and financial data is to be handled per its classification. Restricted data must be encrypted at rest with KMS-managed keys, accessed only via approved enclaves, and never copied to local storage.',
   true, 142),

  ('pol-002', 'POL-VENDOR-002', 'Vendor & Third-Party Risk Management',
   'internal', '2.1', '2025-06-15', 'Procurement', 'active',
   'Mandatory due diligence before any vendor receives personal or financial data, including SOC 2 / ISO 27001 evidence and a signed DPA.',
   'Tier-1 vendors processing Restricted data require: SOC 2 Type II within 12 months, ISO 27001 certificate, signed Data Processing Agreement (DPA), and annual reassessment.',
   true, 87),

  ('pol-003', 'POL-XBORDER-003', 'Cross-Border Transfer Standard',
   'internal', '1.4', '2025-01-10', 'Privacy Office', 'active',
   'Implements PDPL Article 29 / 30 — adequacy, SCCs, BCRs, residency copy requirements for critical-sector data.',
   'No transfer of Saudi-resident personal data outside the Kingdom is permitted without (a) adequacy decision OR (b) signed SCCs OR (c) BCR-bound recipient. Critical-sector data requires a residency copy retained within KSA per PDPL Article 30.',
   true, 64),

  ('pol-004', 'POL-RETAIN-004', 'Data Retention Schedule',
   'internal', '4.0', '2025-04-01', 'Records Management', 'active',
   'Maximum retention periods per data category. Customer KYC = 7y post-closure; marketing prospects = 18m; logs = 13m.',
   'Retention periods are tied to data categories. Marketing prospect data must be deleted 18 months after last engagement. KYC records must be retained 7 years post account closure per SAMA requirements then securely destroyed.',
   true, 31),

  ('pol-005', 'POL-INCIDENT-005', 'Privacy Incident Response',
   'internal', '2.3', '2025-07-20', 'Privacy Office', 'active',
   'PDPL Article 33: 72-hour breach notification, severity matrix, comms playbook, post-mortem template.',
   'Confirmed personal-data breaches must be reported to the SDAIA within 72 hours of detection. The Privacy Officer is responsible for the regulator notification; the CISO owns containment.',
   true, 22),

  ('pol-006', 'POL-AI-006', 'AI Data Use & Model Governance',
   'internal', '1.0', '2025-10-15', 'AI Governance', 'active',
   'Restricts use of customer personal data in third-party AI models; mandates redaction, on-prem inference for Restricted data.',
   'Personal data classified Confidential or Restricted may not be sent to third-party AI inference endpoints. Approved on-premises models or contractually-bound AI gateways with zero-retention configuration are required.',
   true, 18),

  ('pol-007', 'POL-CONSENT-007', 'Consent Capture & Management',
   'internal', '2.0', '2025-03-12', 'Legal', 'active',
   'Consent must be specific, informed, freely given, withdrawable. Consent records must be timestamped and tied to the version of the privacy notice presented.',
   'Granular consent is required for marketing, profiling, and any sharing with third parties. The consent record stores the user id, the privacy-notice version, the channel, and an immutable timestamp.',
   true, 41)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 3  VENDORS
-- ═══════════════════════════════════════════════════════════
insert into public.vendors (id, legal_name, trade_name, jurisdiction, risk_score, risk_tier, status, category, primary_contact, certifications, has_dpa, last_reviewed_at, notes) values
  ('v-sahab',   'Sahab Cloud Services Ltd.',       'Sahab Cloud',    'KSA',           22, 'low',    'active',  'IaaS / hosting',            'khalid@sahab-cloud.com',     array['SOC 2 Type II','ISO 27001','ISO 27018'], true,  now() - interval '80 days', 'Primary cloud hosting partner. Saudi-resident data centers in Riyadh and Jeddah.'),
  ('v-tasdeer', 'Tasdeer Payments Co.',             'Tasdeer',        'KSA',           41, 'medium', 'active',  'Payments processing',       'compliance@tasdeer.sa',      array['PCI DSS','SAMA Cybersecurity Framework'], true,  now() - interval '98 days', 'Card-not-present settlement; processes payment-card and IBAN data.'),
  ('v-mada',    'MADA Analytics FZ-LLC',            'MADA Analytics', 'UAE',           67, 'high',   'active',  'Marketing analytics',       'privacy@mada-analytics.ae',  array['ISO 27001'],                             true,  now() - interval '147 days', 'Receives aggregated, hashed customer events for funnel analytics. Cross-border transfer scrutiny applies.'),
  ('v-zenith',  'Zenith CRM Inc.',                  'Zenith CRM',     'United States', 78, 'high',   'pending', 'Customer relationship mgmt.','dpo@zenithcrm.com',          array['SOC 2 Type II'],                         false, now() - interval '21 days',  'Onboarding under review. US jurisdiction triggers cross-border transfer evaluation.'),
  ('v-baseera', 'Baseera Insights LLC',             'Baseera',        'KSA',           18, 'low',    'active',  'Survey & research',         'partners@baseera.sa',        array['ISO 27001'],                             true,  now() - interval '58 days',  'Conducts customer satisfaction surveys with explicit user consent.'),
  ('v-falcon',  'Falcon Identity Solutions',        'Falcon ID',      'KSA',           34, 'medium', 'active',  'KYC / identity verification','dpo@falconid.sa',            array['SOC 2 Type II','NIA Approved'],          true,  now() - interval '42 days',  'National ID and IBAN verification. Falls under SAMA financial-data scope.')
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 4  PROJECTS  (owner_id → auth UUIDs above)
-- ═══════════════════════════════════════════════════════════
insert into public.projects (id, code, name, business_unit, owner_id, status, data_inventory_count, description, started_at) values
  ('p-instalend', 'PRJ-2026-0008', 'InstaLend — BNPL launch',        'Consumer Lending', 'a1000000-0000-0000-0000-000000000001'::uuid, 'active',  47, 'Buy-now-pay-later product targeting Saudi residents. KYC + soft credit check + repayments.', '2025-11-04'),
  ('p-velo',      'PRJ-2026-0014', 'Velo — open banking aggregator', 'Open Banking',     'a1000000-0000-0000-0000-000000000002'::uuid, 'active',  38, 'PSD2-style account aggregation under SAMA Open Banking framework.',                          '2026-01-12'),
  ('p-noor',      'PRJ-2025-0102', 'Noor — wealth management',       'Wealth',           'a1000000-0000-0000-0000-000000000003'::uuid, 'on_hold', 21, 'Robo-advisory product. Currently paused pending CMA licensing review.',                      '2025-08-19'),
  ('p-shams',     'PRJ-2026-0021', 'Shams — merchant onboarding',    'SME',              'a1000000-0000-0000-0000-000000000002'::uuid, 'active',  19, 'Merchant onboarding portal with self-service KYB.',                                          '2026-02-28')
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 5  TICKETS
-- ═══════════════════════════════════════════════════════════
-- Note: state transition trigger fires only on UPDATE, so we
-- can INSERT any state directly and set SLA fields manually.

insert into public.tickets (
  id, type, state, title, description,
  requester_id, vendor_id, project_id, tags,
  payload, data_declaration,
  sla_ack_hours, sla_decision_hours,
  sla_started_at, sla_decision_due_at, sla_breached,
  submitted_at, decided_at,
  created_at, updated_at
) values

-- T1: vendor_onboarding → in_data_management (active primary demo ticket)
('PDPL-2026-0042', 'vendor_onboarding', 'in_data_management',
 'Sahab Cloud — primary IaaS hosting',
 'Onboard Sahab Cloud as primary hosting provider for the InstaLend BNPL workload. KSA-resident, SOC 2 Type II, signed DPA. Restricted data class.',
 'a1000000-0000-0000-0000-000000000001', 'v-sahab', 'p-instalend',
 array['restricted-data','tier-1-vendor'],
 '{"vendorName":"Sahab Cloud Services Ltd.","vendorJurisdiction":"KSA","hasDPA":true,"certifications":["SOC 2 Type II","ISO 27001","ISO 27018"]}',
 '{"containsPII":true,"piiCategories":["name","national_id","iban","phone","email"],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":true,"financialCategories":["transaction_history"],"estimatedSubjectCount":240000,"retentionPeriodDays":2555,"consentObtained":true,"consentMechanism":"BNPL onboarding consent banner v3.2","affectedDataSubjectGroups":["customers"],"crossBorderInvolved":false,"encryptionState":"both"}',
 4, 72,
 now() - interval '11 days', now() - interval '11 days' + interval '72 hours', false,
 now() - interval '11 days', null,
 now() - interval '12 days', now() - interval '1 day'),

-- T2: cross_border_transfer → in_legal_review
('PDPL-2026-0050', 'cross_border_transfer', 'in_legal_review',
 'UAE fraud-intel partner — pseudonymized transaction signals',
 'Cross-border transfer of pseudonymized transaction signals to MADA Analytics FZ-LLC (UAE) for fraud detection model. No raw PII; SCCs in flight.',
 'a1000000-0000-0000-0000-000000000001', 'v-mada', 'p-instalend',
 array['cross-border','sccs','pdpl-art29'],
 '{"destinationCountry":"United Arab Emirates","destinationOrg":"MADA Analytics FZ-LLC","transferMechanism":"sccs","hasSaudiResidencyCopy":true}',
 '{"containsPII":false,"piiCategories":[],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":true,"financialCategories":["transaction_signals"],"estimatedSubjectCount":1800000,"retentionPeriodDays":365,"consentObtained":false,"affectedDataSubjectGroups":["customers"],"crossBorderInvolved":true,"encryptionState":"both"}',
 4, 96,
 now() - interval '9 days', now() - interval '9 days' + interval '96 hours', true,
 now() - interval '9 days', null,
 now() - interval '10 days', now() - interval '2 days'),

-- T3: external_document_sharing → approved
('PDPL-2026-0044', 'external_document_sharing', 'approved',
 'MADA Analytics — Q1 retention cohort spec',
 'Share Q1 2026 cohort data specification document with MADA Analytics for analytics model calibration. Document is anonymized and does not contain PII.',
 'a1000000-0000-0000-0000-000000000003', 'v-mada', null,
 array['marketing','analytics','low-risk'],
 '{"recipientOrg":"MADA Analytics FZ-LLC","documentType":"specification","anonymized":true,"expiresAfterDays":30}',
 '{"containsPII":false,"piiCategories":[],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":false,"financialCategories":[],"estimatedSubjectCount":0,"retentionPeriodDays":30,"consentObtained":false,"affectedDataSubjectGroups":[],"crossBorderInvolved":true,"encryptionState":"transit"}',
 4, 48,
 now() - interval '20 days', now() - interval '20 days' + interval '48 hours', false,
 now() - interval '20 days', now() - interval '17 days',
 now() - interval '21 days', now() - interval '17 days'),

-- T4: internal_data_access → returned_to_requester
('PDPL-2026-0045', 'internal_data_access', 'returned_to_requester',
 'Velo team read access — customer KYC store',
 'Velo engineering team requesting read access to the KYC data store for open-banking mandate compliance testing. Production data; 6 engineers.',
 'a1000000-0000-0000-0000-000000000002', null, 'p-velo',
 array['internal-access','prod-data','engineering'],
 '{"accessType":"read","targetSystem":"KYC data store","numberOfUsers":6,"purposeCategory":"compliance_testing","environment":"production"}',
 '{"containsPII":true,"piiCategories":["name","national_id","iban","phone"],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":true,"financialCategories":["iban"],"estimatedSubjectCount":85000,"retentionPeriodDays":90,"consentObtained":true,"affectedDataSubjectGroups":["customers"],"crossBorderInvolved":false,"encryptionState":"both"}',
 4, 72,
 now() - interval '8 days', now() - interval '8 days' + interval '72 hours', false,
 now() - interval '8 days', null,
 now() - interval '9 days', now() - interval '3 days'),

-- T5: data_sharing_external → in_security_review
('PDPL-2026-0046', 'data_sharing_external', 'in_security_review',
 'Tasdeer — merchant settlement reconciliation feed',
 'Share daily settlement reconciliation feed with Tasdeer Payments for merchant payouts. Includes IBAN and transaction amounts.',
 'a1000000-0000-0000-0000-000000000002', 'v-tasdeer', 'p-velo',
 array['payments','iban','tier-2-vendor'],
 '{"recipientOrg":"Tasdeer Payments Co.","dataFrequency":"daily","transferMethod":"sftp_encrypted","hasDPA":true}',
 '{"containsPII":true,"piiCategories":["iban","email"],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":true,"financialCategories":["iban","transaction_history"],"estimatedSubjectCount":12000,"retentionPeriodDays":730,"consentObtained":true,"affectedDataSubjectGroups":["merchants"],"crossBorderInvolved":false,"encryptionState":"both"}',
 4, 72,
 now() - interval '6 days', now() - interval '6 days' + interval '72 hours', false,
 now() - interval '6 days', null,
 now() - interval '7 days', now() - interval '1 day'),

-- T6: vendor_onboarding → rejected
('PDPL-2026-0047', 'vendor_onboarding', 'rejected',
 'Zenith CRM — customer engagement platform',
 'Onboard Zenith CRM (US-based) for customer lifecycle management. No KSA region; no DPA; cross-border transfer required without SCC.',
 'a1000000-0000-0000-0000-000000000001', 'v-zenith', 'p-instalend',
 array['us-vendor','high-risk','no-dpa'],
 '{"vendorName":"Zenith CRM Inc.","vendorJurisdiction":"United States","hasDPA":false,"certifications":["SOC 2 Type II"]}',
 '{"containsPII":true,"piiCategories":["name","email","phone","device_id"],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":false,"financialCategories":[],"estimatedSubjectCount":310000,"retentionPeriodDays":1095,"consentObtained":false,"affectedDataSubjectGroups":["customers"],"crossBorderInvolved":true,"encryptionState":"transit"}',
 4, 72,
 now() - interval '25 days', now() - interval '25 days' + interval '72 hours', false,
 now() - interval '25 days', now() - interval '22 days',
 now() - interval '26 days', now() - interval '22 days'),

-- T7: cross_border_transfer → draft
('PDPL-2026-0048', 'cross_border_transfer', 'draft',
 'Velo — open banking aggregator EU data routing',
 'Potential cross-border routing of EU-resident open-banking session tokens through KSA infrastructure for latency optimization.',
 'a1000000-0000-0000-0000-000000000002', null, 'p-velo',
 array['draft','eu-residents','cross-border'],
 '{"destinationCountry":"European Union","transferMechanism":"pending"}',
 '{"containsPII":true,"piiCategories":["device_id","location"],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":false,"financialCategories":[],"estimatedSubjectCount":4500,"retentionPeriodDays":30,"consentObtained":true,"affectedDataSubjectGroups":["customers"],"crossBorderInvolved":true,"encryptionState":"transit"}',
 4, 72,
 null, null, false,
 null, null,
 now() - interval '3 days', now() - interval '1 day'),

-- T8: internal_data_access → submitted
('PDPL-2026-0049', 'internal_data_access', 'submitted',
 'Noor wealth team — customer risk profile read',
 'Wealth advisory team requesting read access to aggregated customer risk profiles for model back-testing. Data must be pseudonymized before access.',
 'a1000000-0000-0000-0000-000000000003', null, 'p-noor',
 array['wealth','pseudonymized','model-training'],
 '{"accessType":"read","targetSystem":"Customer risk profile store","numberOfUsers":3,"purposeCategory":"model_backtesting","pseudonymized":true}',
 '{"containsPII":false,"piiCategories":[],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":true,"financialCategories":["transaction_history"],"estimatedSubjectCount":55000,"retentionPeriodDays":180,"consentObtained":false,"affectedDataSubjectGroups":["customers"],"crossBorderInvolved":false,"encryptionState":"both"}',
 4, 72,
 now() - interval '1 day', now() - interval '1 day' + interval '72 hours', false,
 now() - interval '1 day', null,
 now() - interval '2 days', now() - interval '12 hours'),

-- T9: vendor_onboarding → in_security_review (SLA breached)
('PDPL-2026-0039', 'vendor_onboarding', 'in_security_review',
 'Falcon ID — KYC identity verification integration',
 'Onboard Falcon Identity Solutions for real-time national-ID and IBAN verification on the InstaLend onboarding flow. SAMA-approved, NIA-certified.',
 'a1000000-0000-0000-0000-000000000001', 'v-falcon', 'p-instalend',
 array['kyc','nia-approved','tier-2-vendor','sama'],
 '{"vendorName":"Falcon Identity Solutions","vendorJurisdiction":"KSA","hasDPA":true,"certifications":["SOC 2 Type II","NIA Approved"]}',
 '{"containsPII":true,"piiCategories":["name","national_id","iban","phone"],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":true,"financialCategories":["iban"],"estimatedSubjectCount":500000,"retentionPeriodDays":2555,"consentObtained":true,"consentMechanism":"KYC consent capture v2.1","affectedDataSubjectGroups":["customers"],"crossBorderInvolved":false,"encryptionState":"both"}',
 4, 72,
 now() - interval '15 days', now() - interval '15 days' + interval '72 hours', true,
 now() - interval '15 days', null,
 now() - interval '16 days', now() - interval '2 days'),

-- T10: data_sharing_external → approved (archived candidate)
('PDPL-2026-0035', 'data_sharing_external', 'approved',
 'Baseera — customer satisfaction survey data',
 'Share anonymized CSAT response data with Baseera Insights for benchmarking study. Consent obtained at survey submission.',
 'a1000000-0000-0000-0000-000000000003', 'v-baseera', null,
 array['survey','anonymized','low-risk'],
 '{"recipientOrg":"Baseera Insights LLC","dataFrequency":"one_time","anonymized":true,"hasDPA":true}',
 '{"containsPII":false,"piiCategories":[],"containsSensitive":false,"sensitiveCategories":[],"containsFinancial":false,"financialCategories":[],"estimatedSubjectCount":1200,"retentionPeriodDays":180,"consentObtained":true,"consentMechanism":"survey consent checkbox","affectedDataSubjectGroups":["customers"],"crossBorderInvolved":false,"encryptionState":"transit"}',
 4, 48,
 now() - interval '35 days', now() - interval '35 days' + interval '48 hours', false,
 now() - interval '35 days', now() - interval '31 days',
 now() - interval '36 days', now() - interval '31 days')

on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 6  REVIEW SLOTS
-- ═══════════════════════════════════════════════════════════
insert into public.review_slots (ticket_id, role, reviewer_id, verdict, decided_at, notes) values
  -- PDPL-2026-0042 (in_data_management)
  ('PDPL-2026-0042', 'data_management', 'a1000000-0000-0000-0000-000000000004', 'pending', null, null),
  ('PDPL-2026-0042', 'legal',           'a1000000-0000-0000-0000-000000000006', 'pending', null, null),
  ('PDPL-2026-0042', 'security',        'a1000000-0000-0000-0000-000000000008', 'pending', null, null),

  -- PDPL-2026-0050 (in_legal_review — DM approved)
  ('PDPL-2026-0050', 'data_management', 'a1000000-0000-0000-0000-000000000004', 'approve', now() - interval '5 days', 'SCCs reviewed and transfer mechanism acceptable under PDPL Art 29.'),
  ('PDPL-2026-0050', 'legal',           'a1000000-0000-0000-0000-000000000006', 'pending', null, null),
  ('PDPL-2026-0050', 'security',        'a1000000-0000-0000-0000-000000000008', 'pending', null, null),

  -- PDPL-2026-0044 (approved — all three approved)
  ('PDPL-2026-0044', 'data_management', 'a1000000-0000-0000-0000-000000000005', 'approve', now() - interval '18 days', 'Low risk. Document is anonymized. Approved.'),
  ('PDPL-2026-0044', 'legal',           'a1000000-0000-0000-0000-000000000007', 'approve', now() - interval '18 days', 'No PII. Sharing compliant.'),
  ('PDPL-2026-0044', 'security',        'a1000000-0000-0000-0000-000000000009', 'approve', now() - interval '17 days', 'Encrypted in transit. No concerns.'),

  -- PDPL-2026-0045 (returned_to_requester)
  ('PDPL-2026-0045', 'data_management', 'a1000000-0000-0000-0000-000000000004', 'return',  now() - interval '5 days', 'Need justification for production access vs. staging. Please clarify DPIA coverage.'),
  ('PDPL-2026-0045', 'legal',           'a1000000-0000-0000-0000-000000000006', 'pending', null, null),
  ('PDPL-2026-0045', 'security',        'a1000000-0000-0000-0000-000000000008', 'pending', null, null),

  -- PDPL-2026-0046 (in_security_review — DM + legal approved)
  ('PDPL-2026-0046', 'data_management', 'a1000000-0000-0000-0000-000000000004', 'approve', now() - interval '4 days', 'DPA in place. Tasdeer is SAMA-compliant.'),
  ('PDPL-2026-0046', 'legal',           'a1000000-0000-0000-0000-000000000006', 'approve', now() - interval '3 days', 'Legal basis: contract. Satisfactory.'),
  ('PDPL-2026-0046', 'security',        'a1000000-0000-0000-0000-000000000008', 'pending', null, null),

  -- PDPL-2026-0047 (rejected)
  ('PDPL-2026-0047', 'data_management', 'a1000000-0000-0000-0000-000000000004', 'reject',  now() - interval '22 days', 'No DPA. US jurisdiction with no SCC in place. Cross-border transfer not permissible under PDPL Art 29.'),
  ('PDPL-2026-0047', 'legal',           'a1000000-0000-0000-0000-000000000006', 'reject',  now() - interval '22 days', 'Rejected. No legal basis for cross-border transfer to US without SCCs or adequacy decision.'),
  ('PDPL-2026-0047', 'security',        'a1000000-0000-0000-0000-000000000008', 'pending', null, null),

  -- PDPL-2026-0039 (in_security_review — DM + legal approved; SLA breached)
  ('PDPL-2026-0039', 'data_management', 'a1000000-0000-0000-0000-000000000005', 'approve', now() - interval '12 days', 'NIA certification confirmed. DPA executed.'),
  ('PDPL-2026-0039', 'legal',           'a1000000-0000-0000-0000-000000000007', 'approve', now() - interval '10 days', 'Legal basis: contract. Approved.'),
  ('PDPL-2026-0039', 'security',        'a1000000-0000-0000-0000-000000000009', 'pending', null, null),

  -- PDPL-2026-0035 (approved)
  ('PDPL-2026-0035', 'data_management', 'a1000000-0000-0000-0000-000000000005', 'approve', now() - interval '32 days', 'Anonymized. Low risk. Approved.'),
  ('PDPL-2026-0035', 'legal',           'a1000000-0000-0000-0000-000000000007', 'approve', now() - interval '32 days', 'Consent obtained at survey. Compliant.'),
  ('PDPL-2026-0035', 'security',        'a1000000-0000-0000-0000-000000000009', 'approve', now() - interval '31 days', 'No PII. Encrypted in transit. Approved.')

on conflict (ticket_id, role) do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 7  RETURN THREAD  (for PDPL-2026-0045 — returned ticket)
-- ═══════════════════════════════════════════════════════════
insert into public.return_thread_entries (ticket_id, by_user_id, by_role, message, attachment_ids, created_at) values
  ('PDPL-2026-0045',
   'a1000000-0000-0000-0000-000000000004',
   'data_management',
   'Two issues need clarification before this can proceed: (1) Justify why production data is required rather than a staging snapshot — the Velo team has access to a near-parity staging environment. (2) Confirm whether a DPIA has been completed for this access pattern under PDPL Art 14(1). Please attach the DPIA or explain why one is not required.',
   '{}',
   now() - interval '5 days')
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 8  ATTACHMENTS
-- ═══════════════════════════════════════════════════════════
insert into public.attachments (id, ticket_id, filename, size_bytes, content_type, uploaded_by, uploaded_at, storage_bucket, storage_path, scan_status, classification, category, extracted_summary) values
  ('att-001', 'PDPL-2026-0042', 'Sahab_DPA_signed_v3.pdf',     1843200, 'application/pdf',
   'a1000000-0000-0000-0000-000000000001', now() - interval '11 days',
   'ticket-attachments', 'PDPL-2026-0042/att-001-Sahab_DPA_signed_v3.pdf',
   'clean', 'restricted', 'dpa',
   'Data Processing Agreement between PDPL Reviewer and Sahab Cloud. Outlines processor obligations, sub-processor flow-down, breach notification (24h), and Saudi-residency commitment.'),

  ('att-002', 'PDPL-2026-0042', 'Sahab_SOC2_2025.pdf',          4218372, 'application/pdf',
   'a1000000-0000-0000-0000-000000000001', now() - interval '11 days',
   'ticket-attachments', 'PDPL-2026-0042/att-002-Sahab_SOC2_2025.pdf',
   'clean', 'confidential', 'soc2',
   'SOC 2 Type II report covering Sahab Cloud Riyadh and Jeddah regions. No qualifications. Period: Apr 2025 – Mar 2026.'),

  ('att-003', 'PDPL-2026-0042', 'Subprocessor_list.xlsx',       38492,   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   'a1000000-0000-0000-0000-000000000001', now() - interval '11 days',
   'ticket-attachments', 'PDPL-2026-0042/att-003-Subprocessor_list.xlsx',
   'clean', 'internal', 'evidence',
   'Eight sub-processors enumerated. Six are KSA-resident; two are GCC-resident with adequacy.'),

  ('att-004', 'PDPL-2026-0044', 'Q1-cohort-spec.pdf',           524288,  'application/pdf',
   'a1000000-0000-0000-0000-000000000003', now() - interval '20 days',
   'ticket-attachments', 'PDPL-2026-0044/att-004-Q1-cohort-spec.pdf',
   'clean', 'confidential', 'evidence',
   'Quarterly retention cohort specification for marketing analytics data sharing.'),

  ('att-005', 'PDPL-2026-0050', 'SCC_draft_v2.docx',            184320,  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'a1000000-0000-0000-0000-000000000001', now() - interval '9 days',
   'ticket-attachments', 'PDPL-2026-0050/att-005-SCC_draft_v2.docx',
   'clean', 'restricted', 'contract',
   'Standard Contractual Clauses draft, modeled on EU Module 1 (controller-to-controller). Awaiting legal review.')

on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 9  NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════
insert into public.notifications (user_id, ts, read, category, title, body, link, action_label, ticket_id) values

  -- Rana (requester) — returned ticket
  ('a1000000-0000-0000-0000-000000000001', now() - interval '5 days', false,
   'ticket', 'Action required — PDPL-2026-0045 returned',
   'Mohammed Al-Harbi has returned your request with comments. Please address the reviewer''s questions and resubmit.',
   '/requests/PDPL-2026-0045/respond', 'Respond', 'PDPL-2026-0045'),

  -- Rana — SLA breach warning
  ('a1000000-0000-0000-0000-000000000001', now() - interval '1 day', false,
   'system', 'SLA breached — PDPL-2026-0050',
   'Decision deadline has passed for PDPL-2026-0050. The ticket has been flagged for escalation.',
   '/requests/PDPL-2026-0050', 'View ticket', 'PDPL-2026-0050'),

  -- Mohammed (DM) — new ticket to review
  ('a1000000-0000-0000-0000-000000000004', now() - interval '11 days', false,
   'review', 'New ticket assigned — PDPL-2026-0042',
   'Rana Al-Otaibi submitted a vendor onboarding request: Sahab Cloud — primary IaaS hosting.',
   '/requests/PDPL-2026-0042', 'Review', 'PDPL-2026-0042'),

  ('a1000000-0000-0000-0000-000000000004', now() - interval '1 day', false,
   'review', 'New ticket submitted — PDPL-2026-0049',
   'Noura Al-Qahtani submitted an internal data access request: Noor wealth team — customer risk profile read.',
   '/requests/PDPL-2026-0049', 'Review', 'PDPL-2026-0049'),

  -- Tariq (legal) — ticket ready for legal review
  ('a1000000-0000-0000-0000-000000000006', now() - interval '5 days', false,
   'review', 'Legal review required — PDPL-2026-0050',
   'PDPL-2026-0050 (UAE fraud-intel cross-border transfer) has been forwarded to legal review.',
   '/requests/PDPL-2026-0050', 'Review', 'PDPL-2026-0050'),

  -- Yousef (security) — ticket in security review
  ('a1000000-0000-0000-0000-000000000008', now() - interval '3 days', false,
   'review', 'Security review required — PDPL-2026-0046',
   'PDPL-2026-0046 (Tasdeer settlement feed) has been forwarded to security review.',
   '/requests/PDPL-2026-0046', 'Review', 'PDPL-2026-0046'),

  -- Sara (admin) — SLA breach
  ('a1000000-0000-0000-0000-000000000010', now() - interval '12 hours', false,
   'system', 'SLA breach — PDPL-2026-0039',
   'Ticket PDPL-2026-0039 (Falcon ID — KYC) has breached its 72-hour SLA in security review.',
   '/requests/PDPL-2026-0039', 'View', 'PDPL-2026-0039');

-- ═══════════════════════════════════════════════════════════
-- § 10  AUDIT EVENTS  (sampled; hash = sha256 of seed id)
-- ═══════════════════════════════════════════════════════════
insert into public.audit_events (
  id, ts, actor_id, actor_role, action,
  target_type, target_id,
  before_snapshot, after_snapshot,
  immutable_hash, prev_hash
) values

  ('aud-seed-001', '2026-04-15T08:30:00Z',
   'a1000000-0000-0000-0000-000000000001', 'requester',
   'ticket.submitted', 'ticket', 'PDPL-2026-0042',
   null,
   '{"state":"submitted"}'::jsonb,
   encode(digest('aud-seed-001', 'sha256'), 'hex'), null),

  ('aud-seed-002', '2026-04-15T09:00:00Z',
   'a1000000-0000-0000-0000-000000000004', 'data_management',
   'ticket.state_changed', 'ticket', 'PDPL-2026-0042',
   '{"state":"submitted"}'::jsonb,
   '{"state":"in_data_management"}'::jsonb,
   encode(digest('aud-seed-002', 'sha256'), 'hex'),
   encode(digest('aud-seed-001', 'sha256'), 'hex')),

  ('aud-seed-003', '2026-04-18T11:02:00Z',
   'a1000000-0000-0000-0000-000000000003', 'requester',
   'ticket.submitted', 'ticket', 'PDPL-2026-0044',
   null,
   '{"state":"submitted"}'::jsonb,
   encode(digest('aud-seed-003', 'sha256'), 'hex'),
   encode(digest('aud-seed-002', 'sha256'), 'hex')),

  ('aud-seed-004', '2026-04-21T14:00:00Z',
   'a1000000-0000-0000-0000-000000000004', 'data_management',
   'review.decision', 'ticket', 'PDPL-2026-0045',
   null,
   '{"verdict":"return","notes":"Need DPIA and justification for prod access."}'::jsonb,
   encode(digest('aud-seed-004', 'sha256'), 'hex'),
   encode(digest('aud-seed-003', 'sha256'), 'hex')),

  ('aud-seed-005', '2026-04-22T09:15:00Z',
   'a1000000-0000-0000-0000-000000000004', 'data_management',
   'review.decision', 'ticket', 'PDPL-2026-0047',
   null,
   '{"verdict":"reject","notes":"No DPA. Cross-border to US without SCCs not permissible."}'::jsonb,
   encode(digest('aud-seed-005', 'sha256'), 'hex'),
   encode(digest('aud-seed-004', 'sha256'), 'hex')),

  ('aud-seed-006', '2026-04-25T08:00:00Z',
   'a1000000-0000-0000-0000-000000000006', 'legal',
   'review.decision', 'ticket', 'PDPL-2026-0046',
   null,
   '{"verdict":"approve","notes":"Legal basis: contract. Satisfactory."}'::jsonb,
   encode(digest('aud-seed-006', 'sha256'), 'hex'),
   encode(digest('aud-seed-005', 'sha256'), 'hex'))

on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- § 11  ADVANCE TICKET SEQUENCE
-- Next generated ID will be PDPL-<year>-1100
-- ═══════════════════════════════════════════════════════════
perform setval('ticket_seq', 1099, true);

end;
$fn$;

select _run_seed_005();
drop function _run_seed_005();
