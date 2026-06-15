import type { PreSubmissionAssessment } from '../data/types'

/**
 * Open a printable HTML window with the assessment content.
 * The browser's native "Save as PDF" prints it cleanly.
 */
export function exportAssessmentPdf(
  ticketId: string,
  assessment: PreSubmissionAssessment,
  ticketTitle: string,
): void {
  const RISK_COLOR: Record<string, string> = {
    low: '#065F46', medium: '#92400E', high: '#991B1B', critical: '#7F1D1D',
  }
  const RISK_BG: Record<string, string> = {
    low: '#D1FAE5', medium: '#FEF3C7', high: '#FEE2E2', critical: '#FEE2E2',
  }
  const SEV_COLOR: Record<string, string> = {
    info: '#1D4ED8', low: '#065F46', medium: '#92400E', high: '#991B1B', critical: '#7F1D1D',
  }

  const findingsHtml = assessment.findings.map((f) => `
    <div class="finding">
      <div class="finding-header">
        <span class="sev-badge" style="background:${RISK_BG[f.severity] ?? '#F3F4F6'};color:${SEV_COLOR[f.severity] ?? '#374151'}">${f.severity.toUpperCase()}</span>
        <strong>${escHtml(f.title)}</strong>
        <span class="category">${escHtml(f.category)}</span>
      </div>
      <p class="detail">${escHtml(f.detail)}</p>
      ${f.remediation ? `<p class="remediation"><strong>Remediation:</strong> ${escHtml(f.remediation)}</p>` : ''}
    </div>
  `).join('')

  const citationsHtml = assessment.citations.length > 0
    ? `<section>
        <h2>Citations</h2>
        <ul class="citations">
          ${assessment.citations.map((c) => `<li><strong>${escHtml(c.ref)}</strong> — ${escHtml(c.excerpt)}</li>`).join('')}
        </ul>
      </section>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Assessment — ${escHtml(ticketId)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; margin: 32px; max-width: 800px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 700; color: #374151; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; margin: 24px 0 12px; }
    .meta { font-size: 12px; color: #6B7280; margin-bottom: 20px; }
    .risk-row { display: flex; gap: 10px; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .summary { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px; line-height: 1.6; margin-bottom: 16px; }
    .finding { border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; }
    .finding-header { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; flex-wrap: wrap; }
    .sev-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .category { font-size: 11px; color: #9CA3AF; }
    .detail { color: #374151; line-height: 1.6; margin: 4px 0; }
    .remediation { color: #065F46; font-size: 12px; margin-top: 6px; }
    .citations li { margin-bottom: 6px; line-height: 1.5; font-size: 12px; }
    .footer { margin-top: 40px; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 12px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>AI Pre-Submission Assessment</h1>
  <div class="meta">
    ${escHtml(ticketId)} · ${escHtml(ticketTitle)}<br/>
    Generated ${new Date(assessment.generatedAt).toLocaleString()} · Confidence ${Math.round(assessment.confidence * 100)}%
  </div>

  <section>
    <div class="risk-row">
      <span class="badge" style="background:${RISK_BG[assessment.overallRisk]};color:${RISK_COLOR[assessment.overallRisk]}">
        Risk: ${assessment.overallRisk.toUpperCase()}
      </span>
      <span class="badge" style="background:${assessment.pdplAlignment === 'aligned' ? '#D1FAE5' : assessment.pdplAlignment === 'misaligned' ? '#FEE2E2' : '#FEF3C7'};color:${assessment.pdplAlignment === 'aligned' ? '#065F46' : assessment.pdplAlignment === 'misaligned' ? '#991B1B' : '#92400E'}">
        PDPL: ${assessment.pdplAlignment.toUpperCase()}
      </span>
    </div>

    <h2>Executive Summary</h2>
    <div class="summary">${escHtml(assessment.summary)}</div>
  </section>

  <section>
    <h2>Findings (${assessment.findings.length})</h2>
    ${findingsHtml || '<p style="color:#6B7280">No findings.</p>'}
  </section>

  ${citationsHtml}

  <div class="footer">
    PDPL Reviewer · AI assessment — not legal advice. Review findings with a qualified compliance professional.
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Please allow popups to export the assessment.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
