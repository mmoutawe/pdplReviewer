import {
  dvList, dvCreate, dvUpdate, dvDelete, dvUploadFile, dvDownloadFile,
  T,
} from '../lib/dataverse'
import type { ProjectDocument } from '../data/types'

type DvRow = Record<string, unknown>

function toProjectDocument(r: DvRow): ProjectDocument {
  return {
    id:                 r['pdplr_projectdocumentid'] as string,
    project_id:         (r['pdplr_projectid'] as string) ?? null,
    vendor_id:          (r['pdplr_vendorid'] as string) ?? null,
    parent_document_id: (r['pdplr_parentdocumentid'] as string) ?? null,
    title:              r['pdplr_title'] as string,
    document_type:      r['pdplr_documenttype'] as ProjectDocument['document_type'],
    version:            r['pdplr_version'] as number ?? 1,
    status:             r['pdplr_status'] as ProjectDocument['status'],
    file_path:          r['pdplr_filepath'] as string,
    file_type:          r['pdplr_filetype'] as string,
    file_size:          r['pdplr_filesize'] as number ?? 0,
    description:        (r['pdplr_description'] as string) ?? null,
    tags:               r['pdplr_tags'] ? (r['pdplr_tags'] as string).split(',').filter(Boolean) : null,
    effective_date:     (r['pdplr_effectivedate'] as string) ?? null,
    expiry_date:        (r['pdplr_expirydate'] as string) ?? null,
    uploaded_by:        (r['pdplr_uploadedby'] as string) ?? null,
    created_at:         r['createdon'] as string,
    updated_at:         r['modifiedon'] as string,
  }
}

export async function fetchDocuments(filters?: { projectId?: string; vendorId?: string }): Promise<ProjectDocument[]> {
  const parts: string[] = []
  if (filters?.projectId) parts.push(`pdplr_projectid eq '${filters.projectId}'`)
  if (filters?.vendorId)  parts.push(`pdplr_vendorid eq '${filters.vendorId}'`)

  const query = `$orderby=createdon desc${parts.length ? `&$filter=${parts.join(' and ')}` : ''}`
  const rows = await dvList<DvRow>(T.projectDocuments, query)
  return rows.map(toProjectDocument)
}

export async function uploadDocument(
  file: File,
  meta: {
    title: string
    document_type: ProjectDocument['document_type']
    description?: string
    project_id?: string
    vendor_id?: string
  },
  uploadedBy?: string,
): Promise<ProjectDocument> {
  const docId = crypto.randomUUID()

  const row = await dvCreate<DvRow>(T.projectDocuments, {
    pdplr_projectdocumentid: docId,
    pdplr_title:             meta.title,
    pdplr_documenttype:      meta.document_type,
    pdplr_description:       meta.description ?? null,
    pdplr_projectid:         meta.project_id ?? null,
    pdplr_vendorid:          meta.vendor_id ?? null,
    pdplr_filepath:          `${meta.project_id ?? 'general'}/${docId}/${file.name}`,
    pdplr_filetype:          file.type || 'application/octet-stream',
    pdplr_filesize:          file.size,
    pdplr_version:           1,
    pdplr_status:            'draft',
    pdplr_uploadedby:        uploadedBy ?? null,
  })

  await dvUploadFile(T.projectDocuments, docId, 'pdplr_filecontent', file)

  return toProjectDocument(row)
}

export async function downloadDocument(doc: ProjectDocument): Promise<void> {
  await dvDownloadFile(T.projectDocuments, doc.id, 'pdplr_filecontent', doc.file_path.split('/').pop() ?? doc.title)
}

export async function deleteDocument(doc: ProjectDocument): Promise<void> {
  await dvDelete(T.projectDocuments, doc.id)
}

export async function updateDocumentStatus(id: string, status: ProjectDocument['status']): Promise<void> {
  await dvUpdate(T.projectDocuments, id, { pdplr_status: status })
}
