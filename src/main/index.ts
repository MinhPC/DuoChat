import path from 'node:path'
import { app, BrowserWindow, dialog, Menu, powerMonitor, screen } from 'electron'
import { IPC } from '../shared/ipc'
import { vi } from '../shared/i18n/vi'
import { AccountManager } from './accounts'
import { isInDnd } from './dnd'
import { Logger } from './logger'
import { Updater } from './updater'
import { updateTaskbarBadge } from './badge'
import { cleanupOrphanPartitions } from './cleanup'
import { registerIpc } from './ipc'
import { setupNotifications } from './notifications'
import { attachShortcuts } from './shortcuts'
import { SettingsStore } from './store'
import { ToastManager } from './toast'
import { resolvePreview } from './toastModel'
import { AppTray } from './tray'
import { createMainWindow, showMainWindow } from './window'

const isDev = !app.isPackaged

// Bắt buộc, nếu không toast Windows có thể không hiện hoặc click không hoạt động.
app.setAppUserModelId('vn.duochat.app')

// Chỉ dùng cho kiểm thử tự động: chạy với thư mục dữ liệu riêng.
if (process.env.DUOCHAT_USER_DATA) app.setPath('userData', process.env.DUOCHAT_USER_DATA)

let mainWindow: BrowserWindow | null = null

function showWindow(): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  showMainWindow(win)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  void app.whenReady().then(start)
}

function start(): void {
  Menu.setApplicationMenu(null)

  const userData = app.getPath('userData')
  const store = new SettingsStore(path.join(userData, 'settings.json'))

  // Dọn thư mục partition của account đã xóa ở lần chạy trước (trước khi tạo session nào).
  const initial = store.get()
  if (initial.pendingPartitionCleanup.length > 0) {
    const done = cleanupOrphanPartitions(
      userData,
      initial.pendingPartitionCleanup,
      new Set(initial.accounts.map((a) => a.id)),
    )
    if (done.length > 0) {
      store.update((s) => ({
        ...s,
        pendingPartitionCleanup: s.pendingPartitionCleanup.filter((id) => !done.includes(id)),
      }))
      store.flush()
    }
  }

  const win = createMainWindow(store, isDev)
  mainWindow = win
  const log = new Logger(path.join(userData, 'logs'))
  log.info('app_start', { version: app.getVersion(), electron: process.versions.electron })
  const manager = new AccountManager(win, store, isDev, log)
  let isQuitting = false

  const applyLoginItem = (): void => {
    // Khi chạy dev thì không đăng ký electron.exe vào danh sách khởi động.
    if (!app.isPackaged) return
    app.setLoginItemSettings({ openAtLogin: store.get().startWithWindows, args: ['--hidden'] })
  }

  const openAccount = (id: string): void => {
    showWindow()
    // Từ thông báo/tray: account đã nằm ở pane kia thì chỉ chuyển focus, không đổi chỗ.
    manager.select(id, { swapIfOther: false })
  }

  const quit = (): void => {
    isQuitting = true
    app.quit()
  }

  const toasts = new ToastManager(openAccount)
  const tray = new AppTray({
    onToggleWindow: () => (win.isVisible() && !win.isMinimized() ? win.hide() : showWindow()),
    onOpenWindow: showWindow,
    onOpenAccount: openAccount,
    onQuit: quit,
  })

  // ---- đẩy trạng thái sang sidebar, tray, badge ----
  let lastTotal = -1
  manager.onChange(() => {
    if (win.isDestroyed()) return
    win.webContents.send(IPC.stateChanged, manager.getState())
    const total = manager.totalUnread()
    tray.update(
      total,
      store
        .get()
        .accounts.map((a) => ({ id: a.id, name: a.name, unread: manager.unreadFor(a.id) })),
    )
    // Người dùng đã mở account đó thì thẻ thông báo của nó không còn ý nghĩa.
    for (const a of store.get().accounts) if (manager.isSeen(a.id)) toasts.dismiss(a.id)
    if (total !== lastTotal) {
      lastTotal = total
      updateTaskbarBadge(win, total)
    }
  })
  manager.onNotice((key) => win.webContents.send(IPC.notice, key))

  const ask = async (message: string, yes: string, no: string): Promise<boolean> => {
    const r = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'DuoChat',
      message,
      buttons: [yes, no],
      defaultId: 0,
      cancelId: 1,
    })
    return r.response === 0
  }
  const updater = new Updater(
    log,
    {
      confirmDownload: (v) => ask(vi.update.available(v), vi.update.download, vi.update.later),
      confirmInstall: (v) => ask(vi.update.ready(v), vi.update.restart, vi.update.later),
    },
    {
      packaged: app.isPackaged,
      portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE),
    },
  )
  const applyUpdater = (): void => updater.setEnabled(store.get().autoUpdate)
  registerIpc(win, manager, store, applyLoginItem, applyUpdater, () => updater.checkNow())
  applyUpdater()
  // Đang khóa thì không bao giờ lộ nội dung tin trong toast.
  setupNotifications(
    manager,
    toasts,
    (account) => !manager.isLocked() && resolvePreview(account.preview, store.get().notifyPreview),
  )
  manager.onSessionExpired((id) => {
    const account = manager.getAccount(id)
    if (account && !account.muted && !isInDnd(account.dnd, new Date())) {
      toasts.show(account, { title: '', body: '' }, false, 'login')
    }
  })

  // Tự khóa khi máy không có thao tác đủ lâu, hoặc khi Windows bị khóa.
  setInterval(() => {
    const { enabled, autoLockMinutes } = store.get().lock
    if (
      enabled &&
      autoLockMinutes > 0 &&
      powerMonitor.getSystemIdleTime() >= autoLockMinutes * 60
    ) {
      manager.lockNow()
    }
  }, 15_000)
  powerMonitor.on('lock-screen', () => manager.lockNow())
  attachShortcuts(win.webContents, isDev, (action) => manager.handleShortcut(action))

  // Sidebar chỉ là giao diện của app: không cho điều hướng/mở cửa sổ đi đâu khác.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.on('did-start-loading', () => manager.resetTransientUi())
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => undefined)

  // ---- sự kiện cửa sổ ----
  const relayout = (): void => manager.relayout()
  win.on('resize', relayout)
  win.on('maximize', relayout)
  win.on('unmaximize', relayout)
  win.on('restore', relayout)
  win.on('show', relayout)
  screen.on('display-metrics-changed', () => manager.relayout())
  win.on('focus', () => {
    manager.markSeen()
    // Sau alt-tab, focus bàn phím mặc định nằm ở sidebar; đưa nó về view đang active.
    setTimeout(() => manager.focusActiveView(), 0)
    manager.relayout()
  })
  win.on('close', (e) => {
    if (!isQuitting && store.get().minimizeToTray) {
      e.preventDefault()
      win.hide()
    }
  })

  // ---- thoát: flush cookie/storage của mọi partition (R1) rồi mới thoát thật ----
  let flushed = false
  app.on('before-quit', (e) => {
    isQuitting = true
    toasts.dismissAll()
    if (flushed) return
    e.preventDefault()
    void Promise.race([manager.flushAll(), new Promise((r) => setTimeout(r, 3000))]).finally(() => {
      store.flush()
      flushed = true
      app.quit()
    })
  })

  // ---- nạp giao diện ----
  win.setTitle(vi.appName)
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  const startHidden = process.argv.includes('--hidden') && store.get().startMinimized
  win.once('ready-to-show', () => {
    // Có thể người dùng đã mở từ tray/single-instance trước đó thì không hiện lại.
    if (!startHidden && !win.isVisible()) showMainWindow(win)
  })

  applyLoginItem()
  manager.init()
}
