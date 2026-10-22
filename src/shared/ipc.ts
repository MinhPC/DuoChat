import type { Account, LayoutSettings, Rect, Settings } from './types'

/** Tên kênh IPC. Preload của view Zalo (src/preload/service.ts) hardcode `notify`, có test đối chiếu. */
export const IPC = {
  getState: 'state:get',
  stateChanged: 'state:changed',
  notice: 'ui:notice',
  requestRename: 'account:request-rename',
  addAccount: 'account:add',
  renameAccount: 'account:rename',
  reorderAccounts: 'account:reorder',
  selectAccount: 'account:select',
  showAccountMenu: 'account:menu',
  toggleSplit: 'layout:toggle-split',
  dragSplit: 'layout:drag-split',
  resetSplitRatio: 'layout:reset-ratio',
  setOverlay: 'ui:overlay',
  setDragging: 'ui:dragging',
  updatePrefs: 'settings:update',
  notify: 'duochat:notify',
} as const

export type Prefs = Pick<
  Settings,
  'startWithWindows' | 'startMinimized' | 'minimizeToTray' | 'zoomFactor'
>

export type NoticeKey = 'narrowScreen'

/** Toàn bộ trạng thái mà giao diện sidebar cần để vẽ. */
export interface AppState {
  accounts: Account[]
  layout: LayoutSettings
  unread: Record<string, number>
  totalUnread: number
  frames: { single: Rect | null; left: Rect | null; right: Rect | null }
  divider: Rect | null
  sidebarWidth: number
  prefs: Prefs
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
  [IPC.toggleSplit]: { in: void; out: void }
  /** `x` là tọa độ chuột theo cửa sổ (px). Main đổi thành tỉ lệ và kẹp 0.3–0.7. */
  [IPC.dragSplit]: { in: number; out: void }
  [IPC.resetSplitRatio]: { in: void; out: void }
  [IPC.setOverlay]: { in: boolean; out: void }
  [IPC.setDragging]: { in: boolean; out: void }
  [IPC.updatePrefs]: { in: Partial<Prefs>; out: void }
}

/** API preload expose cho giao diện sidebar (`window.duochat`). */
export interface ShellApi {
  getState(): Promise<AppState>
  onState(cb: (state: AppState) => void): () => void
  onNotice(cb: (key: NoticeKey) => void): () => void
  onRequestRename(cb: (accountId: string) => void): () => void
  addAccount(input: { name: string; color: string }): Promise<void>
  renameAccount(id: string, name: string): Promise<void>
  reorderAccounts(ids: string[]): Promise<void>
  selectAccount(id: string): Promise<void>
  showAccountMenu(id: string): Promise<void>
  toggleSplit(): Promise<void>
  dragSplit(x: number): Promise<void>
  resetSplitRatio(): Promise<void>
  setOverlay(open: boolean): Promise<void>
  setDragging(dragging: boolean): Promise<void>
  updatePrefs(prefs: Partial<Prefs>): Promise<void>
}
