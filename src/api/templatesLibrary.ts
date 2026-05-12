import {
  dvList, dvCreate, dvUpdate, dvDelete, dvUploadFile, dvDownloadFile,
  T,
} from '../lib/dataverse'
import type { ReviewerTemplate } from '../data/types'

type DvRow = Record<string, unknown>

function toReviewerTemplate(r: DvRow): ReviewerTemplate {
  return {
    id:           r['pdplr_reviewertemplateid'] as string,
    title:        r['pdplr_title'] as string,
    description:  (r['pdplr_description'] as string) ?? null,
    file_path:    r['pdplr_filepath'] as string,
    file_type:    r['pdplr_filetype'] as string,
    category:     r['pdplr_category'] as ReviewerTemplate['category'],
    is_active:    !!(r['pdplr_isactive']),
    uploaded_by:  (r['pdplr_uploadedby'] as string) ?? null,
    created_at:   r['createdon'] as string,
    updated_at:   r['modifiedon'] as string,
  }
}

export async function fetchTemplates(): Promise<ReviewerTemplate[]> {
  const rows = await dvList<DvRow>(T.reviewerTemplates, '$orderby=createdon desc')
  return rows.map(toReviewerTemplate)
}

export async function uploadTemplate(
  file: File,
  meta: { title: string; description?: string; category: ReviewerTemplate['category'] },
  uploadedBy: string,
): Promise<ReviewerTemplate> {
  const templateId = crypto.randomUUID()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt'

  const row = await dvCreate<DvRow>(T.reviewerTemplates, {
    pdplr_reviewertemplateid: templateId,
    pdplr_title:              meta.title,
    pdplr_description:        meta.description ?? null,
    pdplr_category:           meta.category,
    pdplr_filepath:           `templates/${templateId}/${file.name}`,
    pdplr_filetype:           ext,
    pdplr_isactive:           true,
    pdplr_uploadedby:         uploadedBy,
  })

  await dvUploadFile(T.reviewerTemplates, templateId, 'pdplr_filecontent', file)

  return toReviewerTemplate(row)
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<void> {
  await dvUpdate(T.reviewerTemplates, id, { pdplr_isactive: isActive })
}

export async function deleteTemplate(template: ReviewerTemplate): Promise<void> {
  await dvDelete(T.reviewerTemplates, template.id)
}

export async function downloadTemplate(template: ReviewerTemplate): Promise<void> {
  const filename = template.file_path.split('/').pop() ?? `${template.title}.${template.file_type}`
  await dvDownloadFile(T.reviewerTemplates, template.id, 'pdplr_filecontent', filename)
}
