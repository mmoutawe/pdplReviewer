import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api'
import type { Project } from '../data/types'

export async function fetchProjects(): Promise<Project[]> {
  return apiGet<Project[]>('/projects')
}

export async function fetchProjectById(id: string): Promise<Project | null> {
  try { return await apiGet<Project>(`/projects/${id}`) }
  catch { return null }
}

export async function createProject(p: Omit<Project, 'id' | 'ticketIds'>): Promise<Project> {
  return apiPost<Project>('/projects', p)
}

export async function updateProject(id: string, p: Partial<Omit<Project, 'id' | 'ticketIds'>>): Promise<Project> {
  return apiPatch<Project>(`/projects/${id}`, p)
}

export async function deleteProject(id: string): Promise<void> {
  await apiDelete(`/projects/${id}`)
}
