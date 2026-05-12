import {
  dvCreate, dvList, dvDelete, dvUploadFile, dvGetFileBlobUrl,
  T, toAttachment,
} from '../lib/dataverse'
import type { Attachment } from '../data/types'

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

  // Fetch a blob URL for immediate display
  const blobUrl = await dvGetFileBlobUrl(T.attachments, attachmentId, 'pdplr_filecontent').catch(() => undefined)

  return toAttachment(row, blobUrl)
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
