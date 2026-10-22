import { describe, expect, it } from 'vitest'
import fixtures from './fixtures/titles.json'
import {
  applyFocus,
  applyNotification,
  applyTitle,
  displayedUnread,
  emptyTracking,
  parseUnreadFromTitle,
} from '../src/main/unread'

describe('parseUnreadFromTitle', () => {
  for (const group of ['observed', 'assumed'] as const) {
    for (const c of fixtures[group]) {
      it(`${group}: ${JSON.stringify(c.title)} → ${c.unread}`, () => {
        expect(parseUnreadFromTitle(c.title)).toBe(c.unread)
      })
    }
  }
})

describe('unread tracking', () => {
  it('title có số thì dùng số của title và coi null là 0', () => {
    let s = applyTitle(emptyTracking(), '(3) Zalo')
    expect(displayedUnread(s)).toBe(3)
    s = applyTitle(s, 'Zalo')
    expect(displayedUnread(s)).toBe(0)
  })

  it('title không bao giờ có số thì fallback đếm thông báo', () => {
    let s = applyTitle(emptyTracking(), 'Zalo')
    s = applyNotification(applyNotification(s))
    expect(displayedUnread(s)).toBe(2)
  })

  it('focus account thì reset bộ đếm thông báo', () => {
    let s = applyNotification(emptyTracking())
    s = applyFocus(s)
    expect(displayedUnread(s)).toBe(0)
  })

  it('khi title đã có số thì thông báo không cộng thêm', () => {
    let s = applyTitle(emptyTracking(), '(1) Zalo')
    s = applyNotification(s)
    expect(displayedUnread(s)).toBe(1)
  })
})
