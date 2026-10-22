import { describe, expect, it } from 'vitest'
import {
  TOAST_GAP,
  TOAST_HEIGHT,
  TOAST_MARGIN,
  TOAST_MAX_VISIBLE,
  TOAST_WIDTH,
  buildToastView,
  initialOf,
  pushToast,
  stackPositions,
} from '../src/main/toastModel'

const account = { name: 'Công ty', color: '#16a34a', sound: 'default' as const }

describe('buildToastView', () => {
  it('mặc định ẩn nội dung tin: chỉ có tên account và số tin', () => {
    const v = buildToastView({
      account,
      count: 1,
      preview: false,
      title: 'Trần Văn Bình',
      body: 'Mật khẩu là 123',
      playSound: true,
    })
    expect(v.title).toBe('Có tin nhắn mới')
    expect(v.body).toBe('')
    expect(JSON.stringify(v)).not.toContain('Trần Văn Bình')
    expect(JSON.stringify(v)).not.toContain('Mật khẩu')
    expect(v.accountName).toBe('Công ty')
    expect(v.initial).toBe('C')
    expect(v.color).toBe('#16a34a')
  })

  it('nhiều tin cùng account được gom: hiện số tin', () => {
    const v = buildToastView({
      account,
      count: 3,
      preview: false,
      title: 'x',
      body: 'y',
      playSound: true,
    })
    expect(v.title).toBe('3 tin nhắn mới')
    expect(v.count).toBe(3)
  })

  it('bật preview thì hiện tiêu đề và nội dung gốc', () => {
    const v = buildToastView({
      account,
      count: 2,
      preview: true,
      title: 'Trần Văn Bình',
      body: 'Xin chào',
      playSound: true,
    })
    expect(v.title).toBe('Trần Văn Bình')
    expect(v.body).toBe('Xin chào')
  })

  it('preview bật nhưng tiêu đề rỗng thì quay về chữ chung', () => {
    expect(
      buildToastView({ account, count: 1, preview: true, title: '', body: 'a', playSound: true })
        .title,
    ).toBe('Có tin nhắn mới')
  })

  it('âm báo: tắt theo account thì không phát; đổi kiểu theo account', () => {
    const off = buildToastView({
      account: { ...account, sound: 'off' },
      count: 1,
      preview: false,
      title: '',
      body: '',
      playSound: true,
    })
    expect(off.playSound).toBe(false)
    const soft = buildToastView({
      account: { ...account, sound: 'soft' },
      count: 1,
      preview: false,
      title: '',
      body: '',
      playSound: true,
    })
    expect(soft.playSound).toBe(true)
    expect(soft.sound).toBe('soft')
    expect(
      buildToastView({ account, count: 1, preview: false, title: '', body: '', playSound: false })
        .playSound,
    ).toBe(false)
  })

  it('chữ cái avatar', () => {
    expect(initialOf('  an')).toBe('A')
    expect(initialOf('Đức')).toBe('Đ')
    expect(initialOf('')).toBe('?')
  })
})

describe('stackPositions / pushToast', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 }

  it('xếp từ góc dưới-phải lên trên, không chồng nhau', () => {
    const p = stackPositions(area, 3)
    expect(p[0].x).toBe(1920 - TOAST_WIDTH - TOAST_MARGIN)
    expect(p[0].y).toBe(1040 - TOAST_MARGIN - TOAST_HEIGHT)
    expect(p[0].y - p[1].y).toBe(TOAST_HEIGHT + TOAST_GAP)
    expect(p[1].y - p[2].y).toBe(TOAST_HEIGHT + TOAST_GAP)
  })

  it('tôn trọng vùng làm việc lệch (taskbar bên trái/trên)', () => {
    const p = stackPositions({ x: 48, y: 30, width: 1000, height: 600 }, 1)
    expect(p[0]).toEqual({
      x: 48 + 1000 - TOAST_WIDTH - TOAST_MARGIN,
      y: 30 + 600 - TOAST_MARGIN - TOAST_HEIGHT,
    })
  })

  it('mỗi account tối đa một toast', () => {
    const r = pushToast(['a', 'b'], 'a')
    expect(r.order).toEqual(['a', 'b'])
    expect(r.evicted).toEqual([])
  })

  it('quá giới hạn thì đẩy toast cũ nhất ra', () => {
    let order: string[] = []
    const evictedAll: string[] = []
    for (let i = 0; i < TOAST_MAX_VISIBLE + 2; i++) {
      const r = pushToast(order, `acc${i}`)
      order = r.order
      evictedAll.push(...r.evicted)
    }
    expect(order).toHaveLength(TOAST_MAX_VISIBLE)
    expect(evictedAll).toEqual(['acc0', 'acc1'])
    expect(order[order.length - 1]).toBe(`acc${TOAST_MAX_VISIBLE + 1}`)
  })
})
