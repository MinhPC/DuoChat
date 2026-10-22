import {
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  NARROW_PANE_WIDTH,
  type LayoutMode,
  type Rect,
} from '../shared/types'

export const SIDEBAR_WIDTH = 72
export const DIVIDER_WIDTH = 6
export const PANE_BORDER = 2

export interface LayoutInput {
  windowWidth: number
  windowHeight: number
  mode: LayoutMode
  splitRatio: number
  sidebarWidth?: number
  dividerWidth?: number
  border?: number
}

export interface LayoutResult {
  sidebar: Rect
  /** Khung ngoài của từng pane (shell vẽ viền focus ở đây). Chế độ đơn chỉ có `single`. */
  frames: { single: Rect | null; left: Rect | null; right: Rect | null }
  /** Bounds thật của WebContentsView = khung thu vào `border` px (chỉ ở chế độ chia đôi). */
  views: { single: Rect | null; left: Rect | null; right: Rect | null }
  divider: Rect | null
  /** Mỗi pane hẹp hơn NARROW_PANE_WIDTH (chỉ có nghĩa ở chế độ chia đôi). */
  narrow: boolean
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio))
}

function inset(r: Rect, n: number): Rect {
  return {
    x: r.x + n,
    y: r.y + n,
    width: Math.max(0, r.width - 2 * n),
    height: Math.max(0, r.height - 2 * n),
  }
}

export function computeLayout(input: LayoutInput): LayoutResult {
  const sidebarWidth = input.sidebarWidth ?? SIDEBAR_WIDTH
  const dividerWidth = input.dividerWidth ?? DIVIDER_WIDTH
  const border = input.border ?? PANE_BORDER
  const w = Math.max(0, Math.round(input.windowWidth))
  const h = Math.max(0, Math.round(input.windowHeight))
  const sbw = Math.min(sidebarWidth, w)
  const sidebar: Rect = { x: 0, y: 0, width: sbw, height: h }
  const content: Rect = { x: sbw, y: 0, width: w - sbw, height: h }

  if (input.mode === 'single') {
    return {
      sidebar,
      frames: { single: content, left: null, right: null },
      views: { single: content, left: null, right: null },
      divider: null,
      narrow: false,
    }
  }

  const ratio = clampRatio(input.splitRatio)
  const usable = Math.max(0, content.width - dividerWidth)
  const leftW = Math.round(usable * ratio)
  const rightW = usable - leftW
  const left: Rect = { x: content.x, y: 0, width: leftW, height: h }
  const divider: Rect = { x: content.x + leftW, y: 0, width: dividerWidth, height: h }
  const right: Rect = { x: divider.x + dividerWidth, y: 0, width: rightW, height: h }
  return {
    sidebar,
    frames: { single: null, left, right },
    views: { single: null, left: inset(left, border), right: inset(right, border) },
    divider,
    narrow: Math.min(leftW, rightW) < NARROW_PANE_WIDTH,
  }
}

/** Đổi vị trí chuột (x theo cửa sổ) thành splitRatio, đã kẹp 0.3–0.7. */
export function ratioFromPointer(
  pointerX: number,
  windowWidth: number,
  sidebarWidth = SIDEBAR_WIDTH,
  dividerWidth = DIVIDER_WIDTH,
): number {
  const usable = windowWidth - sidebarWidth - dividerWidth
  if (usable <= 0) return 0.5
  return clampRatio((pointerX - sidebarWidth - dividerWidth / 2) / usable)
}
