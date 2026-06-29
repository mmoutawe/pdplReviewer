import type { Vendor } from '../data/types'
import { dvCreate, dvList, dvUpdate, T } from '../lib/dataverse'

type DvRow = Record<string, unknown>

function rowToVendor(r: DvRow): Vendor {
  return {
    id:            r['pdplr_vendorid'] as string,
    legalName:     (r['pdplr_legalname']      as string) ?? '',
    tradeName:     (r['pdplr_tradename']      as string) ?? '',
    jurisdiction:  (r['pdplr_jurisdiction']   as string) ?? '',
    riskScore:     (r['pdplr_riskscore']      as number) ?? 50,
    riskTier:      (r['pdplr_risktier']       as Vendor['riskTier']) ?? 'medium',
    status:        (r['pdplr_status']         as Vendor['status'])   ?? 'pending',
    category:      (r['pdplr_category']       as string) ?? '',
    primaryContact:(r['pdplr_primarycontact'] as string) ?? '',
    certifications:((r['pdplr_certifications'] as string) ?? '').split(',').filter(Boolean),
    hasDPA:        !!(r['pdplr_hasdpa']),
    lastReviewedAt:(r['pdplr_lastreviewedat'] as string) ?? '',
    ticketIds:     [],
    notes:         (r['pdplr_notes']          as string) ?? '',
  }
}

export async function fetchVendors(): Promise<Vendor[]> {
  const rows = await dvList<DvRow>(T.vendors, '$orderby=pdplr_tradename asc')
  return rows.map(rowToVendor)
}

export async function createVendor(v: Omit<Vendor, 'id' | 'ticketIds'>): Promise<Vendor> {
  const body: Record<string, unknown> = {
    pdplr_legalname:      v.legalName,
    pdplr_tradename:      v.tradeName,
    pdplr_jurisdiction:   v.jurisdiction,
    pdplr_riskscore:      v.riskScore,
    pdplr_risktier:       v.riskTier,
    pdplr_status:         v.status,
    pdplr_category:       v.category,
    pdplr_primarycontact: v.primaryContact,
    pdplr_certifications: v.certifications.join(','),
    pdplr_hasdpa:         v.hasDPA,
    pdplr_lastreviewedat: v.lastReviewedAt,
    pdplr_notes:          v.notes,
  }
  const row = await dvCreate<DvRow>(T.vendors, body)
  return rowToVendor(row)
}

export async function updateVendor(id: string, patch: Partial<Omit<Vendor, 'id' | 'ticketIds'>>): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.legalName      !== undefined) body.pdplr_legalname      = patch.legalName
  if (patch.tradeName      !== undefined) body.pdplr_tradename      = patch.tradeName
  if (patch.jurisdiction   !== undefined) body.pdplr_jurisdiction   = patch.jurisdiction
  if (patch.riskScore      !== undefined) body.pdplr_riskscore      = patch.riskScore
  if (patch.riskTier       !== undefined) body.pdplr_risktier       = patch.riskTier
  if (patch.status         !== undefined) body.pdplr_status         = patch.status
  if (patch.category       !== undefined) body.pdplr_category       = patch.category
  if (patch.primaryContact !== undefined) body.pdplr_primarycontact = patch.primaryContact
  if (patch.certifications !== undefined) body.pdplr_certifications = patch.certifications.join(',')
  if (patch.hasDPA         !== undefined) body.pdplr_hasdpa         = patch.hasDPA
  if (patch.lastReviewedAt !== undefined) body.pdplr_lastreviewedat = patch.lastReviewedAt
  if (patch.notes          !== undefined) body.pdplr_notes          = patch.notes
  await dvUpdate(T.vendors, id, body)
}
