export interface NotifyPayload {
  title: string
  body: string
  icon: string | null
  tag: string | null
}

const MAX_TITLE = 200
const MAX_BODY = 1000
const MAX_ICON = 2048
const MAX_TAG = 200

/** Payload đến từ trang web nên không tin: kiểm tra kiểu và giới hạn độ dài. */
export function parseNotifyPayload(raw: unknown): NotifyPayload | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.title !== 'string') return null
  const body = typeof r.body === 'string' ? r.body : ''
  const icon = typeof r.icon === 'string' && r.icon.length <= MAX_ICON ? r.icon : null
  const tag = typeof r.tag === 'string' ? r.tag.slice(0, MAX_TAG) : null
  return { title: r.title.slice(0, MAX_TITLE), body: body.slice(0, MAX_BODY), icon, tag }
}

/** Tiêu đề thông báo: `[<tên account>] <tiêu đề gốc>`. */
export function formatNotificationTitle(accountName: string, title: string): string {
  return `[${accountName}] ${title}`
}
