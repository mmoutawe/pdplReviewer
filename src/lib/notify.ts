import { apiPost } from './api'
import type { NotificationType } from '../data/types'

export interface NotifyParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
  actionLabel?: string
  ticketId?: string
}

export async function notify(params: NotifyParams): Promise<void> {
  try {
    await apiPost('/notifications', {
      userId:      params.userId,
      category:    'ticket',
      title:       params.title,
      body:        params.body,
      link:        params.link ?? null,
      actionLabel: params.actionLabel ?? null,
      ticketId:    params.ticketId ?? null,
    })
  } catch {
    // Non-fatal — notifications must never break core flows
  }
}

export function notifyMany(recipients: NotifyParams[]): Promise<void[]> {
  return Promise.all(recipients.map(notify))
}
