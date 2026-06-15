import { ClientSecretCredential } from '@azure/identity'

const credential = new ClientSecretCredential(
  process.env.TENANT_ID!,
  process.env.CLIENT_ID!,
  process.env.CLIENT_SECRET!,
)

export const DV_URL = process.env.DATAVERSE_URL!
export const P = process.env.DV_PREFIX ?? 'pdplr_'

async function dvToken(): Promise<string> {
  const t = await credential.getToken(`${DV_URL}/.default`)
  return t.token
}

const BASE_HEADERS = {
  'OData-MaxVersion': '4.0',
  'OData-Version': '4.0',
  'Accept': 'application/json',
}

export async function dvGet<T = unknown>(path: string): Promise<T> {
  const token = await dvToken()
  const res = await fetch(`${DV_URL}/api/data/v9.2/${path}`, {
    headers: { ...BASE_HEADERS, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Dataverse GET ${path} → ${res.status}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

export async function dvPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const token = await dvToken()
  const res = await fetch(`${DV_URL}/api/data/v9.2/${path}`, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Dataverse POST ${path} → ${res.status}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

export async function dvPatch(path: string, body: unknown): Promise<void> {
  const token = await dvToken()
  const res = await fetch(`${DV_URL}/api/data/v9.2/${path}`, {
    method: 'PATCH',
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Dataverse PATCH ${path} → ${res.status}: ${await res.text()}`)
  }
}

export async function graphToken(): Promise<string> {
  const t = await credential.getToken('https://graph.microsoft.com/.default')
  return t.token
}
