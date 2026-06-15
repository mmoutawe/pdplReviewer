import type { Vendor } from '../data/types'
import { dvCreate, dvList, T } from '../lib/dataverse'

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
