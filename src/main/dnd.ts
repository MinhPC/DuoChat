import type { DndSchedule } from '../shared/types'

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Giờ `now` có nằm trong khung không làm phiền không. Hỗ trợ khung qua nửa đêm (vd 22:00 → 07:00). */
export function isInDnd(dnd: DndSchedule, now: Date): boolean {
  if (!dnd.enabled) return false
  const from = toMinutes(dnd.from)
  const to = toMinutes(dnd.to)
  if (from === to) return false // khung rỗng
  const cur = now.getHours() * 60 + now.getMinutes()
  return from < to ? cur >= from && cur < to : cur >= from || cur < to
}
