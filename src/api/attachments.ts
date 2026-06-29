import { unzipSync } from 'fflate'
import { apiPostForm, apiGet, apiPatch, apiDelete } from '../lib/api'
import type { Attachment } from '../data/types'

async function extractFileText(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.docx') || lower.endsWith('.xlsx') || lower.endsWith('.pptx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const buf      = await file.arrayBuffer()
    const unzipped = unzipSync(new Uint8Array(buf))
    const xmlEntry = unzipped['word/document.xml'] ?? unzipped['xl/sharedStrings.xml'] ?? unzipped['ppt/slides/slide1.xml']
    if (xmlEntry) return new TextDecoder().decode(xmlEntry).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return ''
  }
  if (file.type.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.csv') ||
      lower.endsWith('.md') || lower.endsWith('.json') || lower.endsWith('.xml')) {
    return (await file.text()).slice(0, 8000)
  }
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    const text     = await file.text()
    const printable = (text.match(/[\x20-\x7E\n\r\t]/g) ?? []).length
    if (printable / text.length > 0.4) return text.slice(0, 6000)
  }
  return ''
}

export interface UploadProgress { loaded: number; total: number; percent: number }

export async function uploadAttachment(
  ticketId: string,
  file: File,
  category: Attachment['category'] = 'evidence',
  onProgress?: (p: UploadProgress) => void,
  uploadedBy?: string,
): Promise<Attachment> {
  onProgress?.({ loaded: 0, total: file.size, percent: 0 })

  const form = new FormData()
  form.append('file', file)
  form.append('ticketId', ticketId)
  form.append('category', category)
  if (uploadedBy) form.append('uploadedBy', uploadedBy)

  const att = await apiPostForm<Attachment>('/attachments', form)

  onProgress?.({ loaded: file.size, total: file.size, percent: 100 })

  // Extract text and update summary on backend (non-blocking)
  extractFileText(file).then((text) => {
    if (text) {
      apiPatch(`/attachments/${att.id}`, { extractedSummary: text.slice(0, 4000) }).catch(() => {})
    }
  }).catch(() => {})

  return att
}

export async function fetchAttachmentsForTicket(ticketId: string): Promise<Attachment[]> {
  return apiGet<Attachment[]>(`/attachments?ticketId=${encodeURIComponent(ticketId)}`)
}

export async function refreshSignedUrl(attachment: Attachment): Promise<string | undefined> {
  return `/api/attachments/${attachment.id}/download`
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
  await apiDelete(`/attachments/${attachment.id}`)
}
