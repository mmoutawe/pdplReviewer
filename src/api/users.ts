import { dvList, dvCreate, dvUpdate, T, toUser } from '../lib/dataverse'
import type { User, Role } from '../data/types'

const AVATAR_COLORS = ['#0B5FFF', '#5B21B6', '#047857', '#B45309', '#0E7490', '#9333EA']

function pickColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}
function initials(fullName: string): string {
  return fullName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export async function fetchAllUsers(): Promise<User[]> {
  const rows = await dvList<Record<string, unknown>>(T.users, '$orderby=createdon asc')
  return rows.map(toUser)
}

export async function inviteUser(fields: {
  fullName: string
  email: string
  role: Role
  department: string
  jobTitle: string
}): Promise<User> {
  const row = await dvCreate<Record<string, unknown>>(T.users, {
    pdplr_fullname:   fields.fullName.trim(),
    pdplr_email:      fields.email.trim().toLowerCase(),
    pdplr_role:       fields.role,
    pdplr_department: fields.department.trim(),
    pdplr_jobtitle:   fields.jobTitle.trim(),
    pdplr_initials:   initials(fields.fullName),
    pdplr_avatarcolor: pickColor(),
  })
  return toUser(row)
}

export async function updateUserAdmin(id: string, fields: {
  role: Role
  department: string
  jobTitle: string
}): Promise<void> {
  await dvUpdate(T.users, id, {
    pdplr_role:       fields.role,
    pdplr_department: fields.department.trim(),
    pdplr_jobtitle:   fields.jobTitle.trim(),
  })
}
