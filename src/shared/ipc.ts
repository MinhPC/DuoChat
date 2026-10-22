import type { Account, DndSchedule, LayoutSettings, Rect, Settings } from './types'

/** Tên kênh IPC. Preload của view Zalo (src/preload/service.ts) hardcode `notify`, có test đối chiếu. */
export const IPC = {
  getState: 'state:get',
  stateChanged: 'state:changed',
  notice: 'ui:notice',
  requestRename: 'account:request-rename',
  requestDnd: 'account:request-dnd',
  addAccount: 'account:add',
  renameAccount: 'account:rename',
  reorderAccounts: 'account:reorder',
  selectAccount: 'account:select',
  showAccountMenu: 'account:menu',
  setDnd: 'account:dnd',
  toggleSplit: 'layout:toggle-split',
  dragSplit: 'layout:drag-split',
  resetSplitRatio: 'layout:reset-ratio',
  setOverlay: 'ui:overlay',
  setDragging: 'ui:dragging',
  updatePrefs: 'settings:update',
  getMemory: 'state:memory',
  getDisk: 'state:disk',
  lockNow: 'lock:now',
  unlock: 'lock:unlock',
  setPin: 'lock:set',
  removePin: 'lock:remove',
  setAutoLock: 'lock:auto',
  notify: 'duochat:notify',
  // Kênh của cửa sổ toast. Preload toast hardcode các chuỗi này (có test đối chiếu).
  toastData: 'toast:data',
  toastClick: 'toast:click',
  toastDismiss: 'toast:dismiss',
  toastHover: 'toast:hover',
} as const

export type Prefs = Pick<
  Settings,
  | 'startWithWindows'
  | 'startMinimized'
  | 'minimizeToTray'
  | 'zoomFactor'
  | 'notifyPreview'
  | 'autoUpdate'
>

export type NoticeKey =
  | 'narrowScreen'
  | 'updateReady'
  | 'profileNotLoggedIn'
  | 'profileNotFound'
  | 'profileDone'
  | 'profilePartial'

/** Kết quả thao tác dùng PIN. `retryAfterMs` > 0: phải chờ trước khi thử tiếp. */
export interface PinResult {
  ok: boolean
  error?: 'invalid' | 'wrong' | 'wait'
  retryAfterMs: number
}

/** Toàn bộ trạng thái mà giao diện sidebar cần để vẽ. */
export interface AppState {
  accounts: Account[]
  layout: LayoutSettings
  unread: Record<string, number>
  /** Account đang ở trang đăng nhập Zalo (chưa đăng nhập hoặc phiên hết hạn). */
  needsLogin: Record<string, boolean>
  /** Account không tải được trang (mất mạng, hoặc view crash liên tục nên đã ngừng tự tải lại). */
  loadFailed: Record<string, boolean>
  totalUnread: number
  frames: { single: Rect | null; left: Rect | null; right: Rect | null }
  divider: Rect | null
  sidebarWidth: number
  prefs: Prefs
  lock: { enabled: boolean; locked: boolean; autoLockMinutes: number }
  /** Đang kéo thanh chia: các view Zalo tạm ẩn để shell nhận được sự kiện chuột. */
  dragging: boolean
}

/** Contract các kênh invoke: kiểu input/output. */
export interface InvokeMap {
  [IPC.getState]: { in: void; out: AppState }
  [IPC.addAccount]: { in: { name: string; color: string }; out: void }
  [IPC.renameAccount]: { in: { id: string; name: string }; out: void }
  [IPC.reorderAccounts]: { in: string[]; out: void }
  [IPC.selectAccount]: { in: string; out: void }
  [IPC.showAccountMenu]: { in: string; out: void }
  [IPC.setDnd]: { in: { id: string; dnd: DndSchedule }; out: void }
  [IPC.toggleSplit]: { in: void; out: void }
  /** `x` là tọa độ chuột theo cửa sổ (px). Main đổi thành tỉ lệ và kẹp 0.3–0.7. */
  [IPC.dragSplit]: { in: number; out: void }
  [IPC.resetSplitRatio]: { in: void; out: void }
  [IPC.setOverlay]: { in: boolean; out: void }
  [IPC.setDragging]: { in: boolean; out: void }
  [IPC.updatePrefs]: { in: Partial<Prefs>; out: void }
  /** RAM (MB, working set) của tiến trình render từng account. */
  [IPC.getMemory]: { in: void; out: Record<string, number> }
  /** Dung lượng ổ đĩa (byte) của thư mục dữ liệu từng account (cookie, bộ nhớ trang, cache). */
  [IPC.getDisk]: { in: void; out: Record<string, number> }
  [IPC.lockNow]: { in: void; out: void }
  [IPC.unlock]: { in: string; out: PinResult }
  [IPC.setPin]: { in: { pin: string; current?: string }; out: PinResult }
  [IPC.removePin]: { in: string; out: PinResult }
  [IPC.setAutoLock]: { in: number; out: void }
}

/** API preload expose cho giao diện sidebar (`window.duochat`). */
export interface ShellApi {
  getState(): Promise<AppState>
  onState(cb: (state: AppState) => void): () => void
  onNotice(cb: (key: NoticeKey) => void): () => void
  onRequestRename(cb: (accountId: string) => void): () => void
  onRequestDnd(cb: (accountId: string) => void): () => void
  addAccount(input: { name: string; color: string }): Promise<void>
  renameAccount(id: string, name: string): Promise<void>
  reorderAccounts(ids: string[]): Promise<void>
  selectAccount(id: string): Promise<void>
  showAccountMenu(id: string): Promise<void>
  setDnd(id: string, dnd: DndSchedule): Promise<void>
  toggleSplit(): Promise<void>
  dragSplit(x: number): Promise<void>
  resetSplitRatio(): Promise<void>
  setOverlay(open: boolean): Promise<void>
  setDragging(dragging: boolean): Promise<void>
  updatePrefs(prefs: Partial<Prefs>): Promise<void>
  getMemory(): Promise<Record<string, number>>
  getDisk(): Promise<Record<string, number>>
  lockNow(): Promise<void>
  unlock(pin: string): Promise<PinResult>
  setPin(pin: string, current?: string): Promise<PinResult>
  removePin(pin: string): Promise<PinResult>
  setAutoLock(minutes: number): Promise<void>
}
