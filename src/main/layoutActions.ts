import type { LayoutSettings, Pane } from '../shared/types'
import { clampRatio } from './layout'

const other = (p: Pane): Pane => (p === 'left' ? 'right' : 'left')
const idOf = (l: LayoutSettings, p: Pane): string | null =>
  p === 'left' ? l.leftAccountId : l.rightAccountId

/** Account đang nằm trên màn hình. */
export function visibleAccountIds(l: LayoutSettings): string[] {
  const ids = l.mode === 'single' ? [l.activeAccountId] : [l.leftAccountId, l.rightAccountId]
  return ids.filter((x): x is string => x !== null)
}

export function focusedAccountId(l: LayoutSettings): string | null {
  return l.mode === 'single' ? l.activeAccountId : idOf(l, l.focusedPane)
}

function withPane(l: LayoutSettings, pane: Pane, id: string | null): LayoutSettings {
  return pane === 'left' ? { ...l, leftAccountId: id } : { ...l, rightAccountId: id }
}

/**
 * Chọn account.
 * - Chế độ đơn: thành account active.
 * - Chia đôi: vào pane đang focus. Nếu account đang ở pane kia thì `swapIfOther` quyết định
 *   đổi chỗ (click avatar) hay chỉ chuyển focus sang pane kia (click thông báo).
 */
export function selectAccount(
  l: LayoutSettings,
  id: string,
  opts: { swapIfOther: boolean },
): LayoutSettings {
  if (l.mode === 'single') return { ...l, activeAccountId: id }
  const pane = l.focusedPane
  const op = other(pane)
  if (idOf(l, pane) === id) return l
  if (idOf(l, op) === id) {
    if (!opts.swapIfOther) return { ...l, focusedPane: op, activeAccountId: id }
    const prev = idOf(l, pane)
    return { ...withPane(withPane(l, pane, id), op, prev), activeAccountId: id }
  }
  return { ...withPane(l, pane, id), activeAccountId: id }
}

export function selectByIndex(
  l: LayoutSettings,
  orderedIds: string[],
  index: number,
): LayoutSettings {
  const id = orderedIds[index]
  return id ? selectAccount(l, id, { swapIfOther: true }) : l
}

export function toggleSplit(l: LayoutSettings, orderedIds: string[]): LayoutSettings {
  if (l.mode === 'split') {
    return { ...l, mode: 'single', activeAccountId: focusedAccountId(l) ?? l.activeAccountId }
  }
  if (orderedIds.length < 2) return l
  const left =
    l.activeAccountId && orderedIds.includes(l.activeAccountId) ? l.activeAccountId : orderedIds[0]
  const i = orderedIds.indexOf(left)
  const right = orderedIds[(i + 1) % orderedIds.length]
  return {
    ...l,
    mode: 'split',
    leftAccountId: left,
    rightAccountId: right,
    focusedPane: 'left',
    activeAccountId: left,
  }
}

/** Ctrl+Tab: đổi focus giữa hai pane, hoặc sang account kế tiếp ở chế độ đơn. */
export function cycleFocus(l: LayoutSettings, orderedIds: string[]): LayoutSettings {
  if (l.mode === 'split') return setFocusedPane(l, other(l.focusedPane))
  if (orderedIds.length === 0) return l
  const i = l.activeAccountId ? orderedIds.indexOf(l.activeAccountId) : -1
  return { ...l, activeAccountId: orderedIds[(i + 1) % orderedIds.length] }
}

export function setFocusedPane(l: LayoutSettings, pane: Pane): LayoutSettings {
  if (l.mode !== 'split' || l.focusedPane === pane) return l
  return { ...l, focusedPane: pane, activeAccountId: idOf(l, pane) ?? l.activeAccountId }
}

export function setSplitRatio(l: LayoutSettings, ratio: number): LayoutSettings {
  return { ...l, splitRatio: clampRatio(ratio) }
}
