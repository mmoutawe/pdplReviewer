import { apiGet, apiPostForm, apiPatch, apiDelete } from '../lib/api'
import type { ProjectDocument } from '../data/types'

export async function fetchDocuments(filters?: { projectId?: string; vendorId?: string }): Promise<ProjectDocument[]> {
  const params = new URLSearchParams()
  if (filters?.projectId) params.set('projectId', filters.projectId)
  if (filters?.vendorId)  params.set('vendorId',  filters.vendorId)
  const qs = params.toString()
  return apiGet<ProjectDocument[]>(`/documents${qs ? `?${qs}` : ''}`)
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
  _uploadedBy?: string,
): Promise<ProjectDocument> {
  const form = new FormData()
  form.append('file', file)
  form.append('title', meta.title)
  form.append('document_type', meta.document_type)
  if (meta.description) form.append('description', meta.description)
  if (meta.project_id)  form.append('project_id',  meta.project_id)
  if (meta.vendor_id)   form.append('vendor_id',   meta.vendor_id)
  return apiPostForm<ProjectDocument>('/documents', form)
}

export async function downloadDocument(doc: ProjectDocument): Promise<void> {
  const a = document.createElement('a')
  a.href = `/api/documents/${doc.id}/download`
  a.download = doc.title
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function deleteDocument(doc: ProjectDocument): Promise<void> {
  await apiDelete(`/documents/${doc.id}`)
}

export async function updateDocumentStatus(id: string, status: ProjectDocument['status']): Promise<void> {
  await apiPatch(`/documents/${id}`, { status })
}
