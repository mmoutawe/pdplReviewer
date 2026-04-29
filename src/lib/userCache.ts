import type { User } from '../data/types'
import { USERS } from '../data/seed'

type UserProfile = Pick<User, 'id' | 'fullName' | 'initials' | 'avatarColor'>

const _cache = new Map<string, UserProfile>()

export function cacheUsers(users: UserProfile[]) {
  users.forEach((u) => _cache.set(u.id, u))
}

/** Checks live DB cache first, then falls back to seed (demo mode). */
export function getCachedUser(id: string): UserProfile | undefined {
  return _cache.get(id) ?? USERS.find((u) => u.id === id)
}
