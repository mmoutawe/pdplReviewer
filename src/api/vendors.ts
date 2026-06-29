import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api'
import type { Vendor } from '../data/types'

export async function fetchVendors(): Promise<Vendor[]> {
  return apiGet<Vendor[]>('/vendors')
}

export async function fetchVendorById(id: string): Promise<Vendor | null> {
  try { return await apiGet<Vendor>(`/vendors/${id}`) }
  catch { return null }
}

export async function createVendor(v: Omit<Vendor, 'id' | 'ticketIds'>): Promise<Vendor> {
  return apiPost<Vendor>('/vendors', v)
}

export async function updateVendor(id: string, v: Partial<Omit<Vendor, 'id' | 'ticketIds'>>): Promise<Vendor> {
  return apiPatch<Vendor>(`/vendors/${id}`, v)
}

export async function deleteVendor(id: string): Promise<void> {
  await apiDelete(`/vendors/${id}`)
}
