import { supabase } from '../lib/supabase'
import type { ReviewerTemplate } from '../data/types'

export async function fetchTemplates(): Promise<ReviewerTemplate[]> {
  if (!supabase) return []
  const { data, error } = await (supabase as any).from('reviewer_templates').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ReviewerTemplate[]
}

export async function uploadTemplate(
  file: File,
  meta: { title: string; description?: string; category: ReviewerTemplate['category'] },
  uploadedBy: string,
): Promise<ReviewerTemplate> {
  if (!supabase) throw new Error('Supabase not configured')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt'
  const path = `templates/${Date.now()}_${file.name}`
  const { error: uploadErr } = await supabase.storage.from('policy-documents').upload(path, file)
  if (uploadErr) throw uploadErr
  const { data, error } = await (supabase as any).from('reviewer_templates').insert({
    title: meta.title,
    description: meta.description ?? null,
    category: meta.category,
    file_path: path,
    file_type: ext,
    uploaded_by: uploadedBy,
  }).select().single()
  if (error) throw error
  return data as ReviewerTemplate
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await (supabase as any).from('reviewer_templates').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(template: ReviewerTemplate): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.storage.from('policy-documents').remove([template.file_path])
  const { error } = await (supabase as any).from('reviewer_templates').delete().eq('id', template.id)
  if (error) throw error
}

export async function downloadTemplate(template: ReviewerTemplate): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.storage.from('policy-documents').download(template.file_path)
  if (error || !data) throw error ?? new Error('No file data')
  const fileName = template.file_path.split('/').pop() ?? `${template.title}.${template.file_type}`
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
