import { describe, expect, it } from 'vitest'
import {
  cycleFocus,
  focusedAccountId,
  selectAccount,
  selectByIndex,
  setFocusedPane,
  setSplitRatio,
  toggleSplit,
  visibleAccountIds,
} from '../src/main/layoutActions'
import { defaultSettings } from '../src/main/store'
import type { LayoutSettings } from '../src/shared/types'

const ids = ['a', 'b', 'c']
const single = (active: string): LayoutSettings => ({
  ...defaultSettings().layout,
  activeAccountId: active,
})
const split = (
  left: string,
  right: string,
  pane: 'left' | 'right' = 'left',
): LayoutSettings => ({
  ...defaultSettings().layout,
  mode: 'split',
  activeAccountId: pane === 'left' ? left : right,
  leftAccountId: left,
  rightAccountId: right,
  focusedPane: pane,
})

describe('toggleSplit', () => {
  it('bật lần đầu: trái = active, phải = account kế tiếp', () => {
    const l = toggleSplit(single('b'), ids)
    expect(l).toMatchObject({
      mode: 'split',
      leftAccountId: 'b',
      rightAccountId: 'c',
      focusedPane: 'left',
    })
  })
  it('account cuối thì vòng về đầu', () => {
    expect(toggleSplit(single('c'), ids).rightAccountId).toBe('a')
  })
  it('chỉ có 1 account thì không bật được', () => {
    expect(toggleSplit(single('a'), ['a']).mode).toBe('single')
  })
  it('tắt split: active = account ở pane đang focus', () => {
    const l = toggleSplit(split('a', 'b', 'right'), ids)
    expect(l).toMatchObject({ mode: 'single', activeAccountId: 'b' })
  })
})

describe('selectAccount', () => {
  it('chế độ đơn: đổi active', () => {
    expect(selectAccount(single('a'), 'c', { swapIfOther: true }).activeAccountId).toBe('c')
  })
  it('split: account mới vào pane đang focus', () => {
    const l = selectAccount(split('a', 'b', 'right'), 'c', { swapIfOther: true })
    expect(l).toMatchObject({ leftAccountId: 'a', rightAccountId: 'c' })
  })
  it('split: account đang ở pane kia thì hai pane đổi chỗ (click avatar)', () => {
    const l = selectAccount(split('a', 'b', 'left'), 'b', { swapIfOther: true })
    expect(l).toMatchObject({ leftAccountId: 'b', rightAccountId: 'a', focusedPane: 'left' })
  })
  it('split: click thông báo của account ở pane kia → chỉ chuyển focus', () => {
    const l = selectAccount(split('a', 'b', 'left'), 'b', { swapIfOther: false })
    expect(l).toMatchObject({ leftAccountId: 'a', rightAccountId: 'b', focusedPane: 'right' })
  })
  it('chọn account đã ở pane đang focus thì không đổi gì', () => {
    const l = split('a', 'b')
    expect(selectAccount(l, 'a', { swapIfOther: true })).toBe(l)
  })
  it('không bao giờ tạo trạng thái left === right', () => {
    for (const pane of ['left', 'right'] as const) {
      for (const id of ids) {
        const l = selectAccount(split('a', 'b', pane), id, { swapIfOther: true })
        expect(l.leftAccountId).not.toBe(l.rightAccountId)
      }
    }
  })
})

describe('selectByIndex / cycleFocus / setFocusedPane', () => {
  it('Ctrl+2 chọn account thứ hai; vượt quá thì bỏ qua', () => {
    expect(selectByIndex(single('a'), ids, 1).activeAccountId).toBe('b')
    const l = single('a')
    expect(selectByIndex(l, ids, 8)).toBe(l)
  })
  it('Ctrl+Tab ở split đổi pane focus', () => {
    expect(cycleFocus(split('a', 'b', 'left'), ids).focusedPane).toBe('right')
  })
  it('Ctrl+Tab ở chế độ đơn sang account kế tiếp, vòng lại', () => {
    expect(cycleFocus(single('a'), ids).activeAccountId).toBe('b')
    expect(cycleFocus(single('c'), ids).activeAccountId).toBe('a')
  })
  it('setFocusedPane bỏ qua ở chế độ đơn', () => {
    const l = single('a')
    expect(setFocusedPane(l, 'right')).toBe(l)
  })
})

describe('khác', () => {
  it('visibleAccountIds / focusedAccountId', () => {
    expect(visibleAccountIds(single('a'))).toEqual(['a'])
    expect(visibleAccountIds(split('a', 'b'))).toEqual(['a', 'b'])
    expect(focusedAccountId(split('a', 'b', 'right'))).toBe('b')
  })
  it('setSplitRatio kẹp 0.3–0.7', () => {
    expect(setSplitRatio(split('a', 'b'), 0.99).splitRatio).toBe(0.7)
  })
})
