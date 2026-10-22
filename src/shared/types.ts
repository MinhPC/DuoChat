export interface Account {
  id: string // uuid, cũng là hậu tố partition
  name: string
  color: string // một màu trong ACCOUNT_PALETTE
  order: number
  muted: boolean // tắt thông báo (badge vẫn đếm)
  createdAt: string // ISO
}

export type LayoutMode = 'single' | 'split'
export type Pane = 'left' | 'right'

export interface LayoutSettings {
  mode: LayoutMode
  activeAccountId: string | null // chế độ đơn
  leftAccountId: string | null // chế độ chia đôi
  rightAccountId: string | null
  splitRatio: number // 0.3–0.7, mặc định 0.5
  focusedPane: Pane
}

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

export interface Settings {
  schemaVersion: 2
  accounts: Account[]
  layout: LayoutSettings
  startWithWindows: boolean
  startMinimized: boolean // khi tự khởi động cùng Windows
  minimizeToTray: boolean // bấm X → ẩn xuống tray
  zoomFactor: number // 0.5–2.0, áp cho mọi view Zalo
  window: WindowState
  // id account đã xóa, thư mục partition sẽ được xóa hẳn ở lần khởi động sau (mục 2.5.4)
  pendingPartitionCleanup: string[]
}

export const ACCOUNT_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#4b5563',
] as const

export const SOFT_ACCOUNT_LIMIT = 6
export const MIN_SPLIT_RATIO = 0.3
export const MAX_SPLIT_RATIO = 0.7
export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 2.0
export const NARROW_PANE_WIDTH = 700

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
