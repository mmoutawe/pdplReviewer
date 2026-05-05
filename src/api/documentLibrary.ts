import { supabase } from '../lib/supabase'
import type { ProjectDocument } from '../data/types'

export async function fetchDocuments(filters?: { projectId?: string; vendorId?: string }): Promise<ProjectDocument[]> {
  if (!supabase) return []
  let q = supabase.from('project_documents' as never).select('*').order('created_at', { ascending: false })
  if (filters?.projectId) q = (q as any).eq('project_id', filters.projectId)
  if (filters?.vendorId)  q = (q as any).eq('vendor_id',  filters.vendorId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ProjectDocument[]
}

export async function uploadDocument(
  file: File,
  meta: { title: string; document_type: ProjectDocument['document_type']; description?: string; project_id?: string; vendor_id?: string },
): Promise<ProjectDocument> {
  if (!supabase) throw new Error('Supabase not configured')
  const path = `projects/${meta.project_id ?? 'general'}/${Date.now()}_${file.name}`
  const { error: uploadErr } = await supabase.storage.from('policy-documents').upload(path, file)
  if (uploadErr) throw uploadErr
  const { data, error } = await (supabase as any).from('project_documents').insert({
    ...meta,
    file_path: path,
    file_type: file.type || 'application/octet-stream',
    file_size: file.size,
    version: 1,
    status: 'draft',
  }).select().single()
  if (error) throw error
  return data as ProjectDocument
}

export async function downloadDocument(filePath: string, filename: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.storage.from('policy-documents').download(filePath)
  if (error || !data) throw error ?? new Error('No file data')
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function deleteDocument(doc: ProjectDocument): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.storage.from('policy-documents').remove([doc.file_path])
  const { error } = await (supabase as any).from('project_documents').delete().eq('id', doc.id)
  if (error) throw error
}

export async function updateDocumentStatus(id: string, status: ProjectDocument['status']): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await (supabase as any).from('project_documents').update({ status }).eq('id', id)
  if (error) throw error
}
