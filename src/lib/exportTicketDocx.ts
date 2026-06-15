import type { Ticket } from '../data/types'
import { REQUEST_TYPE_LABELS } from '../data/seed'
import { formatDate, formatDateTime } from './utils'

export function exportTicketDocx(ticket: Ticket): void {
  const stateLabel = ticket.state.replace(/_/g, ' ')

  const reviewRows = ticket.reviews.map((r) => `
    <tr>
      <td style="border:1px solid #e2e8f0;padding:6pt 8pt">${r.role.replace(/_/g, ' ')}</td>
      <td style="border:1px solid #e2e8f0;padding:6pt 8pt">${r.verdict}</td>
      <td style="border:1px solid #e2e8f0;padding:6pt 8pt">${r.decidedAt ? formatDate(r.decidedAt) : '—'}</td>
      <td style="border:1px solid #e2e8f0;padding:6pt 8pt">${r.notes ?? '—'}</td>
    </tr>`).join('')

  const returnRows = ticket.returnThread.map((e) => `
    <tr>
      <td style="border:1px solid #e2e8f0;padding:6pt 8pt">${e.byRole.replace(/_/g, ' ')}</td>
      <td style="border:1px solid #e2e8f0;padding:6pt 8pt">${e.message}</td>
      <td style="border:1px solid #e2e8f0;padding:6pt 8pt">${formatDateTime(e.createdAt)}</td>
    </tr>`).join('')

  const payloadRows = Object.entries(ticket.payload)
    .filter(([k]) => k !== 'kind')
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
      const val = Array.isArray(v) ? (v as string[]).join(', ') || '—' : String(v ?? '—')
      return `<tr>
        <td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b;font-weight:500">${label}</td>
        <td style="border:1px solid #e2e8f0;padding:6pt 8pt">${val}</td>
      </tr>`
    }).join('')

  const d = ticket.dataDeclaration

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <title>${ticket.id}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; margin: 2.5cm; color: #1e293b; }
    h1   { font-size: 18pt; color: #0b5fff; margin-bottom: 4pt; }
    h2   { font-size: 13pt; color: #1e3a5f; border-bottom: 1pt solid #cbd5e1; padding-bottom: 3pt; margin-top: 18pt; }
    p    { margin: 4pt 0; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; }
    th   { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 6pt 8pt; font-weight: 600; text-align: left; }
    .meta { color: #64748b; font-size: 10pt; }
    .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 1pt 6pt; border-radius: 3pt; font-size: 9pt; }
  </style>
</head>
<body>
  <h1>${ticket.id}</h1>
  <p style="font-size:15pt;font-weight:600;color:#1e293b;margin-bottom:8pt">${ticket.title}</p>
  <table style="width:auto">
    <tr><td class="meta" style="padding:3pt 12pt 3pt 0;border:none">Type</td><td style="border:none;font-weight:500">${REQUEST_TYPE_LABELS[ticket.type]}</td></tr>
    <tr><td class="meta" style="padding:3pt 12pt 3pt 0;border:none">State</td><td style="border:none;font-weight:500;text-transform:capitalize">${stateLabel}</td></tr>
    <tr><td class="meta" style="padding:3pt 12pt 3pt 0;border:none">Submitted</td><td style="border:none">${ticket.submittedAt ? formatDateTime(ticket.submittedAt) : '—'}</td></tr>
    <tr><td class="meta" style="padding:3pt 12pt 3pt 0;border:none">SLA due</td><td style="border:none">${formatDateTime(ticket.sla.decisionDueAt)}</td></tr>
    ${ticket.tags.length > 0 ? `<tr><td class="meta" style="padding:3pt 12pt 3pt 0;border:none">Tags</td><td style="border:none">${ticket.tags.join(', ')}</td></tr>` : ''}
  </table>

  <h2>Description</h2>
  <p>${ticket.description}</p>

  <h2>Request details</h2>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    ${payloadRows}
  </table>

  <h2>Data declaration</h2>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b">Contains PII</td><td style="border:1px solid #e2e8f0;padding:6pt 8pt">${d.containsPII ? `Yes — ${d.piiCategories.join(', ')}` : 'No'}</td></tr>
    <tr><td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b">Sensitive data</td><td style="border:1px solid #e2e8f0;padding:6pt 8pt">${d.containsSensitive ? 'Yes' : 'No'}</td></tr>
    <tr><td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b">Financial data</td><td style="border:1px solid #e2e8f0;padding:6pt 8pt">${d.containsFinancial ? `Yes — ${d.financialCategories.join(', ')}` : 'No'}</td></tr>
    <tr><td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b">Est. data subjects</td><td style="border:1px solid #e2e8f0;padding:6pt 8pt">${d.estimatedSubjectCount.toLocaleString()}</td></tr>
    <tr><td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b">Retention (days)</td><td style="border:1px solid #e2e8f0;padding:6pt 8pt">${d.retentionPeriodDays}</td></tr>
    <tr><td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b">Encryption</td><td style="border:1px solid #e2e8f0;padding:6pt 8pt;text-transform:capitalize">${d.encryptionState.replace(/_/g, ' ')}</td></tr>
    <tr><td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b">Cross-border transfer</td><td style="border:1px solid #e2e8f0;padding:6pt 8pt">${d.crossBorderInvolved ? 'Yes' : 'No'}</td></tr>
    <tr><td style="border:1px solid #e2e8f0;padding:6pt 8pt;color:#64748b">Consent obtained</td><td style="border:1px solid #e2e8f0;padding:6pt 8pt">${d.consentObtained ? `Yes — ${d.consentMechanism ?? 'mechanism unspecified'}` : 'No'}</td></tr>
  </table>

  <h2>Review track</h2>
  ${ticket.reviews.length === 0 ? '<p class="meta">No reviews recorded.</p>' : `
  <table>
    <tr><th>Role</th><th>Verdict</th><th>Decided at</th><th>Notes</th></tr>
    ${reviewRows}
  </table>`}

  ${ticket.returnThread.length > 0 ? `
  <h2>Return thread</h2>
  <table>
    <tr><th>Role</th><th>Message</th><th>Date</th></tr>
    ${returnRows}
  </table>` : ''}

  <p class="meta" style="margin-top:28pt;border-top:1pt solid #e2e8f0;padding-top:6pt">
    Generated by PDPL Reviewer · ${formatDateTime(new Date().toISOString())}
  </p>
</body>
</html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ticket.id}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
