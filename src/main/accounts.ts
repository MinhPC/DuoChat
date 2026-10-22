import { randomUUID } from 'node:crypto'
import path from 'node:path'
import {
  app,
  WebContentsView,
  session,
  type BrowserWindow,
  type Session,
  type WebContents,
} from 'electron'
// ?raw: shim được đóng gói thành chuỗi và main tự chạy bằng executeJavaScript (mục 4).
import shimSource from '../inject/notification-shim.js?raw'
import type { AppState, NoticeKey, Prefs } from '../shared/ipc'
import {
  ACCOUNT_PALETTE,
  MAX_ZOOM,
  MIN_ZOOM,
  type Account,
  type LayoutSettings,
  type Pane,
  type Rect,
} from '../shared/types'
import { attachContextMenu } from './contextMenu'
import { attachDownloads } from './downloads'
import { computeLayout, ratioFromPointer, SIDEBAR_WIDTH } from './layout'
import {
  cycleFocus,
  focusedAccountId,
  selectAccount,
  selectByIndex,
  setFocusedPane,
  setSplitRatio,
  toggleSplit,
  visibleAccountIds,
} from './layoutActions'
import { attachLinkHandling } from './links'
import { applyPermissionHandlers } from './permissions'
import { buildUserAgent, partitionFor, ZALO_SERVICE } from './service'
import { attachShortcuts, type ShortcutAction } from './shortcuts'
import type { SettingsStore } from './store'
import {
  applyFocus,
  applyNotification,
  applyTitle,
  displayedUnread,
  emptyTracking,
  type UnreadTracking,
} from './unread'

const ZOOM_STEP = 0.1
const MAX_NAME = 40

/**
 * Giữ một WebContentsView sống cho mỗi account (không destroy khi đổi tab để vẫn nhận tin),
 * ẩn/hiện bằng setVisible/setBounds. Toàn bộ thao tác thay đổi layout đi qua đây.
 */
export class AccountManager {
  private readonly views = new Map<string, WebContentsView>()
  private readonly accountByWc = new Map<number, string>()
  private readonly unread = new Map<string, UnreadTracking>()
  private readonly preparedSessions = new Set<string>()
  private overlayOpen = false
  private dragging = false
  private narrowWarned = false
  private readonly userAgent = buildUserAgent(session.defaultSession.getUserAgent(), app.getName())
  private changeListeners = new Set<() => void>()
  private noticeListeners = new Set<(key: NoticeKey) => void>()

  constructor(
    private readonly win: BrowserWindow,
    private readonly store: SettingsStore,
    private readonly isDev: boolean,
  ) {}

  // ---------- đăng ký lắng nghe ----------

  onChange(cb: () => void): void {
    this.changeListeners.add(cb)
  }

  onNotice(cb: (key: NoticeKey) => void): void {
    this.noticeListeners.add(cb)
  }

  private emit(): void {
    for (const cb of this.changeListeners) cb()
  }

  // ---------- vòng đời ----------

  init(): void {
    for (const account of this.store.get().accounts) this.createView(account)
    this.applyLayout()
    this.focusActiveView()
  }

  private createView(account: Account): void {
    const partition = partitionFor(account.id)
    this.prepareSession(partition)

    const view = new WebContentsView({
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // Bắt buộc: nếu để mặc định, Chromium throttle timer/websocket của view bị ẩn → tin và thông báo trễ.
        backgroundThrottling: false,
        spellcheck: false,
        preload: path.join(__dirname, '../preload/service.js'),
        devTools: this.isDev,
      },
    })
    const wc = view.webContents
    // Đặt tường minh trước khi tải: UA giống Chrome cùng phiên bản Chromium, không có Electron/x.y và tên app (R2).
    wc.setUserAgent(this.userAgent)
    this.views.set(account.id, view)
    this.accountByWc.set(wc.id, account.id)
    this.unread.set(account.id, emptyTracking())
    this.win.contentView.addChildView(view)
    view.setVisible(false)

    wc.on('page-title-updated', (_e, title) => this.onTitle(account.id, title))
    wc.on('dom-ready', () => {
      // Chạy trong main world, không bị CSP chặn như thẻ <script>.
      wc.executeJavaScript(shimSource).catch(() => undefined)
      wc.setZoomFactor(this.store.get().zoomFactor)
    })
    // Pane focus chỉ đổi khi người dùng bấm chuột vào view. Không dùng sự kiện 'focus' của webContents vì nó
    // cũng nổ khi view vừa hiện ra hoặc cửa sổ lấy lại focus (không phải ý định của người dùng).
    wc.on('before-mouse-event', (_e, mouse) => {
      if (mouse.type === 'mouseDown') this.onViewFocus(account.id)
    })
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      // -3 = bị hủy do điều hướng khác. Mất mạng thì thử lại thay vì để khung trắng.
      if (isMainFrame && code !== -3) {
        setTimeout(() => {
          if (!wc.isDestroyed()) void wc.loadURL(ZALO_SERVICE.url)
        }, 5000)
      }
    })
    wc.on('render-process-gone', () => {
      setTimeout(() => {
        if (!wc.isDestroyed()) wc.reload()
      }, 1000)
    })

    attachShortcuts(wc, this.isDev, (action) => this.handleShortcut(action))
    attachLinkHandling(wc, partition, this.isDev, this.userAgent)
    attachContextMenu(wc)
    void wc.loadURL(ZALO_SERVICE.url)
  }

  private prepareSession(partition: string): Session {
    const ses = session.fromPartition(partition)
    if (!this.preparedSessions.has(partition)) {
      this.preparedSessions.add(partition)
      ses.setUserAgent(this.userAgent) // phủ cả request không đi qua webContents (vd tải icon, tải file)
      applyPermissionHandlers(ses)
      attachDownloads(ses)
    }
    return ses
  }

  private destroyView(id: string): void {
    const view = this.views.get(id)
    if (!view) return
    this.accountByWc.delete(view.webContents.id)
    this.views.delete(id)
    this.unread.delete(id)
    this.win.contentView.removeChildView(view)
    if (!view.webContents.isDestroyed()) view.webContents.close()
  }

  /** Gọi trước khi thoát: ghi cookie/storage ra đĩa cho mọi partition (rủi ro R1). */
  async flushAll(): Promise<void> {
    await Promise.all(
      [...this.preparedSessions].map(async (partition) => {
        const ses = session.fromPartition(partition)
        ses.flushStorageData()
        await ses.cookies.flushStore().catch(() => undefined)
      }),
    )
  }

  // ---------- truy vấn ----------

  accountIdForWebContents(wc: WebContents): string | null {
    return this.accountByWc.get(wc.id) ?? null
  }

  getAccount(id: string): Account | undefined {
    return this.store.get().accounts.find((a) => a.id === id)
  }

  /** Account đang hiển thị trên màn hình và cửa sổ đang focus → người dùng đang nhìn thấy. */
  isSeen(id: string): boolean {
    if (this.overlayOpen) return false
    if (!this.win.isVisible() || this.win.isMinimized() || !this.win.isFocused()) return false
    return visibleAccountIds(this.store.get().layout).includes(id)
  }

  totalUnread(): number {
    let n = 0
    for (const t of this.unread.values()) n += displayedUnread(t)
    return n
  }

  unreadFor(id: string): number {
    const t = this.unread.get(id)
    return t ? displayedUnread(t) : 0
  }

  getState(): AppState {
    const s = this.store.get()
    const [w, h] = this.win.getContentSize()
    const L = computeLayout({
      windowWidth: w,
      windowHeight: h,
      mode: s.layout.mode,
      splitRatio: s.layout.splitRatio,
    })
    const unread: Record<string, number> = {}
    for (const a of s.accounts) unread[a.id] = this.unreadFor(a.id)
    const prefs: Prefs = {
      startWithWindows: s.startWithWindows,
      startMinimized: s.startMinimized,
      minimizeToTray: s.minimizeToTray,
      zoomFactor: s.zoomFactor,
    }
    return {
      accounts: s.accounts,
      layout: s.layout,
      unread,
      totalUnread: this.totalUnread(),
      frames: L.frames,
      divider: L.divider,
      sidebarWidth: SIDEBAR_WIDTH,
      prefs,
      dragging: this.dragging,
    }
  }

  // ---------- unread & thông báo ----------

  private onTitle(id: string, title: string): void {
    const cur = this.unread.get(id)
    if (!cur) return
    this.unread.set(id, applyTitle(cur, title))
    this.emit()
  }

  /** Thông báo mới từ trang: tăng bộ đếm fallback (kể cả account muted). */
  noteNotification(id: string): void {
    const cur = this.unread.get(id)
    if (!cur) return
    this.unread.set(id, applyNotification(cur))
    this.markSeen()
    this.emit()
  }

  /** Account đang được nhìn thấy thì reset bộ đếm fallback (kể từ lần cuối được focus). */
  markSeen(): void {
    for (const id of visibleAccountIds(this.store.get().layout)) {
      const cur = this.unread.get(id)
      if (cur && cur.notificationCount > 0 && this.isSeen(id)) {
        this.unread.set(id, applyFocus(cur))
      }
    }
  }

  // ---------- layout ----------

  private applyLayout(): void {
    const s = this.store.get()
    const [w, h] = this.win.getContentSize()
    const L = computeLayout({
      windowWidth: w,
      windowHeight: h,
      mode: s.layout.mode,
      splitRatio: s.layout.splitRatio,
    })
    const hidden = this.overlayOpen || this.dragging
    for (const [id, view] of this.views) {
      let rect: Rect | null = null
      if (!hidden) {
        if (s.layout.mode === 'single') {
          rect = id === s.layout.activeAccountId ? L.views.single : null
        } else if (id === s.layout.leftAccountId) {
          rect = L.views.left
        } else if (id === s.layout.rightAccountId) {
          rect = L.views.right
        }
      }
      if (rect) {
        view.setBounds(rect)
        view.setVisible(true)
      } else {
        view.setVisible(false)
      }
    }
    if (s.layout.mode === 'split' && L.narrow && !this.narrowWarned) {
      this.narrowWarned = true
      for (const cb of this.noticeListeners) cb('narrowScreen')
    }
  }

  /** Gọi khi cửa sổ đổi kích thước / DPI. */
  relayout(): void {
    this.applyLayout()
    this.emit()
  }

  focusActiveView(): void {
    if (this.overlayOpen || this.dragging) return
    const id = focusedAccountId(this.store.get().layout)
    const view = id ? this.views.get(id) : undefined
    if (view && !view.webContents.isDestroyed()) view.webContents.focus()
  }

  private mutateLayout(fn: (l: LayoutSettings) => LayoutSettings, refocus = true): void {
    this.store.update((s) => ({ ...s, layout: fn(s.layout) }))
    this.applyLayout()
    if (refocus) this.focusActiveView()
    this.markSeen()
    this.emit()
  }

  private orderedIds(): string[] {
    return this.store.get().accounts.map((a) => a.id)
  }

  private onViewFocus(id: string): void {
    const l = this.store.get().layout
    if (l.mode !== 'split') return
    const pane: Pane | null =
      l.leftAccountId === id ? 'left' : l.rightAccountId === id ? 'right' : null
    if (!pane || pane === l.focusedPane) return
    this.mutateLayout((cur) => setFocusedPane(cur, pane), false)
  }

  select(id: string, opts: { swapIfOther: boolean }): void {
    if (!this.views.has(id)) return
    this.mutateLayout((l) => selectAccount(l, id, opts))
  }

  selectIndex(index: number): void {
    this.mutateLayout((l) => selectByIndex(l, this.orderedIds(), index))
  }

  toggleSplit(): void {
    this.mutateLayout((l) => toggleSplit(l, this.orderedIds()))
  }

  cycleFocus(): void {
    this.mutateLayout((l) => cycleFocus(l, this.orderedIds()))
  }

  dragSplitTo(pointerX: number): void {
    const [w] = this.win.getContentSize()
    this.mutateLayout((l) => setSplitRatio(l, ratioFromPointer(pointerX, w)), false)
  }

  resetSplitRatio(): void {
    this.mutateLayout((l) => setSplitRatio(l, 0.5), false)
  }

  /** Giao diện shell tải lại (HMR, crash): bỏ các trạng thái tạm để view Zalo không bị ẩn vĩnh viễn. */
  resetTransientUi(): void {
    if (!this.overlayOpen && !this.dragging) return
    this.overlayOpen = false
    this.dragging = false
    this.applyLayout()
    this.emit()
  }

  /** Mở dialog trong shell: ẩn các view Zalo để dialog không bị che. */
  setOverlay(open: boolean): void {
    this.overlayOpen = open
    this.applyLayout()
    if (!open) this.focusActiveView()
    this.emit()
  }

  /** Đang kéo thanh chia: ẩn view để chuột không bị view nuốt mất. */
  setDragging(dragging: boolean): void {
    this.dragging = dragging
    this.applyLayout()
    if (!dragging) this.focusActiveView()
    this.emit()
  }

  // ---------- quản lý account ----------

  addAccount(name: string, color: string): Account {
    const s = this.store.get()
    const account: Account = {
      id: randomUUID(),
      name: name.trim().slice(0, MAX_NAME) || 'Tài khoản',
      color: (ACCOUNT_PALETTE as readonly string[]).includes(color) ? color : ACCOUNT_PALETTE[0],
      order: s.accounts.length,
      muted: false,
      createdAt: new Date().toISOString(),
    }
    this.store.update((d) => ({ ...d, accounts: [...d.accounts, account] }))
    this.createView(account)
    this.select(account.id, { swapIfOther: true })
    return account
  }

  patchAccount(id: string, patch: Partial<Pick<Account, 'name' | 'color' | 'muted'>>): void {
    this.store.update((s) => ({
      ...s,
      accounts: s.accounts.map((a) => {
        if (a.id !== id) return a
        const next = { ...a }
        if (typeof patch.name === 'string')
          next.name = patch.name.trim().slice(0, MAX_NAME) || a.name
        if (typeof patch.color === 'string') next.color = patch.color
        if (typeof patch.muted === 'boolean') next.muted = patch.muted
        return next
      }),
    }))
    this.emit()
  }

  reorder(ids: string[]): void {
    this.store.update((s) => {
      const byId = new Map(s.accounts.map((a) => [a.id, a]))
      const ordered = ids.map((id) => byId.get(id)).filter((a): a is Account => !!a)
      const rest = s.accounts.filter((a) => !ids.includes(a.id))
      return { ...s, accounts: [...ordered, ...rest].map((a, i) => ({ ...a, order: i })) }
    })
    this.emit()
  }

  /** Đăng xuất nhanh (giữ account): xóa storage + cache của partition rồi tải lại. */
  async logout(id: string): Promise<void> {
    const view = this.views.get(id)
    if (!view) return
    const ses = session.fromPartition(partitionFor(id))
    await ses.clearStorageData()
    await ses.clearCache()
    this.unread.set(id, emptyTracking())
    if (!view.webContents.isDestroyed()) void view.webContents.loadURL(ZALO_SERVICE.url)
    this.emit()
  }

  /**
   * Xóa account: destroy view, xóa storage + cache, bỏ khỏi config và ghi id vào
   * pendingPartitionCleanup. Thư mục partition được xóa hẳn ở lần khởi động sau (cleanup.ts),
   * vì Windows khóa file khi app đang chạy.
   */
  async removeAccount(id: string): Promise<void> {
    if (!this.views.has(id)) return
    this.destroyView(id)
    this.store.update((s) => ({
      ...s,
      accounts: s.accounts.filter((a) => a.id !== id),
      pendingPartitionCleanup: [...s.pendingPartitionCleanup, id],
    }))
    this.store.flush()
    this.applyLayout()
    this.focusActiveView()
    this.emit()
    const ses = session.fromPartition(partitionFor(id))
    await ses.clearStorageData().catch(() => undefined)
    await ses.clearCache().catch(() => undefined)
    this.preparedSessions.delete(partitionFor(id))
  }

  // ---------- zoom, reload, phím tắt ----------

  setZoom(factor: number): void {
    const z = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, factor)) * 100) / 100
    this.store.update((s) => ({ ...s, zoomFactor: z }))
    for (const view of this.views.values()) {
      if (!view.webContents.isDestroyed()) view.webContents.setZoomFactor(z)
    }
    this.emit()
  }

  private focusedView(): WebContentsView | undefined {
    const id = focusedAccountId(this.store.get().layout)
    return id ? this.views.get(id) : undefined
  }

  handleShortcut(action: ShortcutAction): void {
    const zoom = this.store.get().zoomFactor
    switch (action.type) {
      case 'selectIndex':
        return this.selectIndex(action.index)
      case 'toggleSplit':
        return this.toggleSplit()
      case 'cycleFocus':
        return this.cycleFocus()
      case 'reload':
        return this.focusedView()?.webContents.reload()
      case 'zoomIn':
        return this.setZoom(zoom + ZOOM_STEP)
      case 'zoomOut':
        return this.setZoom(zoom - ZOOM_STEP)
      case 'zoomReset':
        return this.setZoom(1)
      case 'devtools': {
        const wc = this.focusedView()?.webContents
        if (wc && this.isDev) wc.openDevTools({ mode: 'detach' })
        return
      }
    }
  }
}
