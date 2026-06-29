import { apiGet, apiPostForm, apiPatch, apiDelete } from '../lib/api'
import type { ReviewerTemplate } from '../data/types'

export async function fetchTemplates(): Promise<ReviewerTemplate[]> {
  return apiGet<ReviewerTemplate[]>('/templates')
}

export async function uploadTemplate(
  file: File,
  meta: { title: string; description?: string; category: ReviewerTemplate['category'] },
  _uploadedBy: string,
): Promise<ReviewerTemplate> {
  const form = new FormData()
  form.append('file', file)
  form.append('title', meta.title)
  form.append('category', meta.category)
  if (meta.description) form.append('description', meta.description)
  return apiPostForm<ReviewerTemplate>('/templates', form)
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<void> {
  await apiPatch(`/templates/${id}`, { isActive })
}

export async function deleteTemplate(template: ReviewerTemplate): Promise<void> {
  await apiDelete(`/templates/${template.id}`)
}

export async function downloadTemplate(template: ReviewerTemplate): Promise<void> {
  const a = document.createElement('a')
  a.href = `/api/templates/${template.id}/download`
  a.download = `${template.title}.${template.file_type}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
