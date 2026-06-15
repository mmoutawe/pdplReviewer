import type { Project } from '../data/types'
import { dvCreate, dvList, T } from '../lib/dataverse'

type DvRow = Record<string, unknown>

function rowToProject(r: DvRow): Project {
  return {
    id:                 r['pdplr_projectid']          as string,
    code:              (r['pdplr_code']               as string) ?? '',
    name:              (r['pdplr_name']               as string) ?? '',
    businessUnit:      (r['pdplr_businessunit']       as string) ?? '',
    ownerId:           (r['pdplr_ownerid']            as string) ?? '',
    vendorId:          (r['pdplr_vendorref']           as string) || undefined,
    status:            (r['pdplr_status']             as Project['status']) ?? 'active',
    dataInventoryCount:(r['pdplr_datainventorycount'] as number) ?? 0,
    ticketIds:         [],
    description:       (r['pdplr_description']        as string) ?? '',
    startedAt:         (r['pdplr_startedat']          as string) ?? '',
  }
}

export async function fetchProjects(): Promise<Project[]> {
  const rows = await dvList<DvRow>(T.projects, '$orderby=pdplr_name asc')
  return rows.map(rowToProject)
}

export async function createProject(p: Omit<Project, 'id' | 'ticketIds'>): Promise<Project> {
  const body: Record<string, unknown> = {
    pdplr_code:               p.code,
    pdplr_name:               p.name,
    pdplr_businessunit:       p.businessUnit,
    pdplr_ownerid:            p.ownerId,
    pdplr_vendorref:          p.vendorId ?? null,
    pdplr_status:             p.status,
    pdplr_datainventorycount: p.dataInventoryCount,
    pdplr_description:        p.description,
    pdplr_startedat:          p.startedAt,
  }
  const row = await dvCreate<DvRow>(T.projects, body)
  return rowToProject(row)
}
