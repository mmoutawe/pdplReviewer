import { unzipSync } from 'fflate'
import {
  dvCreate, dvList, dvDelete, dvUpdate, dvUploadFile, dvGetFileBlobUrl,
  T, toAttachment,
} from '../lib/dataverse'
import type { Attachment } from '../data/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

async function extractFileText(file: File): Promise<string> {
  const lower = file.name.toLowerCase()

  // DOCX / XLSX / PPTX — all ZIP-based Office formats
  if (lower.endsWith('.docx') || lower.endsWith('.xlsx') || lower.endsWith('.pptx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const buf = await file.arrayBuffer()
    const unzipped = unzipSync(new Uint8Array(buf))
    const xmlEntry = unzipped['word/document.xml'] ?? unzipped['xl/sharedStrings.xml'] ?? unzipped['ppt/slides/slide1.xml']
    if (xmlEntry) {
      const xml = new TextDecoder().decode(xmlEntry)
      return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    return ''
  }

  // Plain text files (txt, csv, md, json, xml)
  if (
    file.type.startsWith('text/') ||
    lower.endsWith('.txt') || lower.endsWith('.csv') || lower.endsWith('.md') ||
    lower.endsWith('.json') || lower.endsWith('.xml')
  ) {
    return (await file.text()).slice(0, 8000)
  }

  // PDF — try reading as text; works for text-layer PDFs, returns garbage for scanned ones
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    const text = await file.text()
    const printable = (text.match(/[\x20-\x7E\n\r\t]/g) ?? []).length
    if (printable / text.length > 0.4) return text.slice(0, 6000)
    return ''
  }

  return ''
}

async function generateDocumentSummary(file: File): Promise<string | undefined> {
  const apiKey     = viteEnv.VITE_AZURE_OPENAI_KEY
  const base       = viteEnv.VITE_AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const deployment = viteEnv.VITE_AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o'
  if (!apiKey || !base) return undefined

  let contentSnippet = ''
  try {
    const raw = await extractFileText(file)
    contentSnippet = raw.slice(0, 4000)
  } catch { /* ignore */ }

  const prompt = contentSnippet
    ? `You are a PDPL compliance analyst. Given the document content below, write a focused 3–5 sentence summary covering: document type and purpose, parties involved and their roles (controller/processor), data categories processed, key obligations or gaps, and any cross-border transfer details.\n\nFilename: ${file.name}\n\nContent:\n${contentSnippet}`
    : `Based only on the filename, describe in 1–2 sentences what this document likely contains and its purpose in a PDPL compliance context.\n\nFilename: ${file.name}`

  try {
    const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a document analyzer for PDPL compliance. Be concise and factual.' },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 300,
      }),
    })
    if (!res.ok) return undefined
    const data = await res.json()
    return (data?.choices?.[0]?.message?.content as string | undefined)?.trim()
  } catch { return undefined }
}

type DvRow = Record<string, unknown>

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

// ── Upload ────────────────────────────────────────────────

export async function uploadAttachment(
  ticketId: string,
  file: File,
  category: Attachment['category'] = 'evidence',
  onProgress?: (p: UploadProgress) => void,
  uploadedBy?: string,
): Promise<Attachment> {
  onProgress?.({ loaded: 0, total: file.size, percent: 0 })

  const now = new Date().toISOString()
  const attachmentId = crypto.randomUUID()

  // Create the metadata record first so we have an ID for the file column upload
  const row = await dvCreate<DvRow>(T.attachments, {
    pdplr_attachmentid:    attachmentId,
    pdplr_ticketid:        ticketId,
    pdplr_filename:        file.name,
    pdplr_sizebytes:       file.size,
    pdplr_contenttype:     file.type || 'application/octet-stream',
    pdplr_uploadedby:      uploadedBy ?? '',
    pdplr_uploadedat:      now,
    pdplr_storagepath:     `${ticketId}/${attachmentId}/${file.name}`,
    pdplr_scanstatus:      'pending',
    pdplr_classification:  'internal',
    pdplr_category:        category,
  })

  // Upload the file content to the Dataverse file column
  await dvUploadFile(T.attachments, attachmentId, 'pdplr_filecontent', file)

  onProgress?.({ loaded: file.size, total: file.size, percent: 100 })

  // Extract text summary for AI reviewer (non-blocking — failure is silent)
  const extractedSummary = await generateDocumentSummary(file).catch(() => undefined)
  if (extractedSummary) {
    await dvUpdate(T.attachments, attachmentId, { pdplr_extractedsummary: extractedSummary }).catch(() => undefined)
  }

  // Fetch a blob URL for immediate display
  const blobUrl = await dvGetFileBlobUrl(T.attachments, attachmentId, 'pdplr_filecontent').catch(() => undefined)

  return toAttachment({ ...row, pdplr_extractedsummary: extractedSummary ?? null }, blobUrl)
}

// ── Fetch ─────────────────────────────────────────────────

export async function fetchAttachmentsForTicket(ticketId: string): Promise<Attachment[]> {
  const rows = await dvList<DvRow>(
    T.attachments,
    `$filter=pdplr_ticketid eq '${ticketId}'&$orderby=pdplr_uploadedat asc`,
  )
  if (!rows.length) return []

  return Promise.all(
    rows.map(async (r) => {
      const id = r['pdplr_attachmentid'] as string
      const blobUrl = await dvGetFileBlobUrl(T.attachments, id, 'pdplr_filecontent').catch(() => undefined)
      return toAttachment(r, blobUrl)
    }),
  )
}

// ── Refresh blob URL ───────────────────────────────────────

export async function refreshSignedUrl(attachment: Attachment): Promise<string | undefined> {
  return dvGetFileBlobUrl(T.attachments, attachment.id, 'pdplr_filecontent').catch(() => undefined)
}

// ── Delete ────────────────────────────────────────────────

export async function deleteAttachment(attachment: Attachment): Promise<void> {
  await dvDelete(T.attachments, attachment.id)
}
