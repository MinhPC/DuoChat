export const ACCOUNT_SOUNDS = ['default', 'soft', 'off'] as const
export type AccountSound = (typeof ACCOUNT_SOUNDS)[number]

/** Hiện nội dung tin trong thông báo: theo cài đặt chung, luôn hiện, hoặc luôn ẩn. */
export const PREVIEW_MODES = ['default', 'show', 'hide'] as const
export type PreviewMode = (typeof PREVIEW_MODES)[number]

/** Khung giờ không làm phiền (HH:MM, 24h). Có thể qua nửa đêm, vd 22:00 → 07:00. */
export interface DndSchedule {
  enabled: boolean
  from: string
  to: string
}

export interface LockSettings {
  enabled: boolean
  salt: string // hex
  hash: string // scrypt(PIN, salt), hex. Chỉ khóa giao diện, KHÔNG mã hóa dữ liệu.
  autoLockMinutes: number // 0 = không tự khóa
}

export const AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 30] as const

export interface Account {
  id: string // uuid, cũng là hậu tố partition
  name: string
  color: string // một màu trong ACCOUNT_PALETTE
  order: number
  muted: boolean // tắt thông báo (badge vẫn đếm)
  sound: AccountSound // âm báo riêng của account
  preview: PreviewMode // hiện nội dung tin trong thông báo của account này
  dnd: DndSchedule // khung giờ không làm phiền (badge vẫn đếm)
  profileName?: string // tên Zalo đọc lần gần nhất, để biết tên hiện tại có phải do người dùng tự đặt không
  avatar?: string // data URL PNG lấy từ hồ sơ Zalo của chính account (CLAUDE.md mục 4.3)
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
  schemaVersion: 3
  accounts: Account[]
  layout: LayoutSettings
  startWithWindows: boolean
  startMinimized: boolean // khi tự khởi động cùng Windows
  minimizeToTray: boolean // bấm X → ẩn xuống tray
  zoomFactor: number // 0.5–2.0, áp cho mọi view Zalo
  lock: LockSettings
  autoUpdate: boolean // kiểm tra bản cập nhật qua GitHub (mặc định tắt: app cam kết không gửi dữ liệu ra ngoài)
  notifyPreview: boolean // hiện nội dung tin trong thông báo (mặc định ẩn để riêng tư)
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
