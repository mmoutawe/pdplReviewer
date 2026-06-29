import type { Project } from '../data/types'
import { dvCreate, dvList, dvUpdate, T } from '../lib/dataverse'

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

export async function updateProject(id: string, patch: Partial<Omit<Project, 'id' | 'ticketIds'>>): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.code               !== undefined) body.pdplr_code               = patch.code
  if (patch.name               !== undefined) body.pdplr_name               = patch.name
  if (patch.businessUnit       !== undefined) body.pdplr_businessunit       = patch.businessUnit
  if (patch.ownerId            !== undefined) body.pdplr_ownerid            = patch.ownerId
  if (patch.vendorId           !== undefined) body.pdplr_vendorref          = patch.vendorId
  if (patch.status             !== undefined) body.pdplr_status             = patch.status
  if (patch.dataInventoryCount !== undefined) body.pdplr_datainventorycount = patch.dataInventoryCount
  if (patch.description        !== undefined) body.pdplr_description        = patch.description
  if (patch.startedAt          !== undefined) body.pdplr_startedat          = patch.startedAt
  await dvUpdate(T.projects, id, body)
}
