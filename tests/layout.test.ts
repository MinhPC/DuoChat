import { describe, expect, it } from 'vitest'
import {
  DIVIDER_WIDTH,
  PANE_BORDER,
  SIDEBAR_WIDTH,
  clampRatio,
  computeLayout,
  ratioFromPointer,
} from '../src/main/layout'

const base = { windowWidth: 1600, windowHeight: 900, splitRatio: 0.5 }

describe('computeLayout', () => {
  it('chế độ đơn: view chiếm toàn bộ phần còn lại', () => {
    const l = computeLayout({ ...base, mode: 'single' })
    expect(l.sidebar).toEqual({ x: 0, y: 0, width: SIDEBAR_WIDTH, height: 900 })
    expect(l.views.single).toEqual({
      x: SIDEBAR_WIDTH,
      y: 0,
      width: 1600 - SIDEBAR_WIDTH,
      height: 900,
    })
    expect(l.views.left).toBeNull()
    expect(l.divider).toBeNull()
  })

  it('chia đôi: hai pane + thanh kéo lấp kín phần còn lại, không chồng lấn', () => {
    const l = computeLayout({ ...base, mode: 'split' })
    const { left, right } = l.frames
    expect(left && right && l.divider).toBeTruthy()
    expect(left!.x).toBe(SIDEBAR_WIDTH)
    expect(l.divider!.x).toBe(left!.x + left!.width)
    expect(right!.x).toBe(l.divider!.x + DIVIDER_WIDTH)
    expect(right!.x + right!.width).toBe(1600)
  })

  it('view thu vào PANE_BORDER để lộ viền focus', () => {
    const l = computeLayout({ ...base, mode: 'split' })
    expect(l.views.left!.x).toBe(l.frames.left!.x + PANE_BORDER)
    expect(l.views.left!.width).toBe(l.frames.left!.width - 2 * PANE_BORDER)
    expect(l.views.right!.height).toBe(900 - 2 * PANE_BORDER)
  })

  it('splitRatio được kẹp 0.3–0.7', () => {
    const lo = computeLayout({ ...base, mode: 'split', splitRatio: 0.01 })
    const hi = computeLayout({ ...base, mode: 'split', splitRatio: 0.99 })
    const usable = 1600 - SIDEBAR_WIDTH - DIVIDER_WIDTH
    expect(lo.frames.left!.width).toBe(Math.round(usable * 0.3))
    expect(hi.frames.left!.width).toBe(Math.round(usable * 0.7))
  })

  it('cảnh báo narrow khi mỗi pane < 700px', () => {
    expect(computeLayout({ ...base, windowWidth: 1400, mode: 'split' }).narrow).toBe(true)
    expect(computeLayout({ ...base, windowWidth: 1700, mode: 'split' }).narrow).toBe(false)
    expect(computeLayout({ ...base, windowWidth: 1000, mode: 'single' }).narrow).toBe(false)
  })

  it('cửa sổ rất nhỏ không tạo kích thước âm', () => {
    const l = computeLayout({ windowWidth: 50, windowHeight: 10, splitRatio: 0.5, mode: 'split' })
    for (const r of [l.views.left!, l.views.right!, l.frames.left!, l.frames.right!]) {
      expect(r.width).toBeGreaterThanOrEqual(0)
      expect(r.height).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('clampRatio / ratioFromPointer', () => {
  it('kẹp và xử lý NaN', () => {
    expect(clampRatio(0.1)).toBe(0.3)
    expect(clampRatio(0.9)).toBe(0.7)
    expect(clampRatio(0.5)).toBe(0.5)
    expect(clampRatio(NaN)).toBe(0.5)
  })

  it('chuột ở giữa vùng nội dung → 0.5', () => {
    const mid = SIDEBAR_WIDTH + (1600 - SIDEBAR_WIDTH) / 2
    expect(ratioFromPointer(mid, 1600)).toBeCloseTo(0.5, 2)
  })

  it('chuột kéo sát mép bị kẹp', () => {
    expect(ratioFromPointer(0, 1600)).toBe(0.3)
    expect(ratioFromPointer(5000, 1600)).toBe(0.7)
  })
})
