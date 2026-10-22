import path from 'node:path'
import { BrowserWindow, ipcMain, screen, type WebContents } from 'electron'
import { IPC } from '../shared/ipc'
import type { Account } from '../shared/types'
import {
  buildToastView,
  pushToast,
  stackPositions,
  TOAST_HEIGHT,
  TOAST_LIFETIME_MS,
  TOAST_WIDTH,
  type ToastView,
} from './toastModel'

interface Entry {
  win: BrowserWindow
  count: number
  timer: NodeJS.Timeout | null
  hovered: boolean
  ready: boolean
  pending: ToastView | null
}

/**
 * Toast riêng của DuoChat: mỗi account một thẻ nhỏ ở góc dưới-phải màn hình, không cướp focus.
 * Nhiều tin cùng account được gom vào một thẻ và tăng số đếm. Bấm thẻ để mở account.
 */
export class ToastManager {
  private readonly entries = new Map<string, Entry>()
  private order: string[] = []
  private readonly accountByWc = new Map<number, string>()

  constructor(private readonly onOpenAccount: (accountId: string) => void) {
    const accountOf = (wc: WebContents): string | null => this.accountByWc.get(wc.id) ?? null
    ipcMain.on(IPC.toastClick, (e) => {
      const id = accountOf(e.sender)
      if (!id) return
      this.dismiss(id)
      this.onOpenAccount(id)
    })
    ipcMain.on(IPC.toastDismiss, (e) => {
      const id = accountOf(e.sender)
      if (id) this.dismiss(id)
    })
    ipcMain.on(IPC.toastHover, (e, hovered: unknown) => {
      const id = accountOf(e.sender)
      const entry = id ? this.entries.get(id) : undefined
      if (!id || !entry) return
      entry.hovered = hovered === true
      if (entry.hovered) this.clearTimer(entry)
      else this.armTimer(id, entry)
    })
  }

  show(
    account: Pick<Account, 'name' | 'color' | 'sound'> & { id: string },
    payload: { title: string; body: string },
    preview: boolean,
    kind: 'message' | 'login' = 'message',
  ): void {
    let entry = this.entries.get(account.id)
    if (!entry) {
      const { order, evicted } = pushToast(this.order, account.id)
      this.order = order
      for (const id of evicted) this.dismiss(id)
      entry = this.create(account.id)
      this.entries.set(account.id, entry)
    }
    entry.count = kind === 'login' ? 1 : entry.count + 1
    const view = buildToastView({
      account,
      count: entry.count,
      preview,
      title: payload.title,
      body: payload.body,
      playSound: true,
      kind,
    })
    if (entry.ready) entry.win.webContents.send(IPC.toastData, view)
    else entry.pending = view
    this.armTimer(account.id, entry)
    this.layout()
  }

  /** Đóng toast của account (hết hạn, bấm, hoặc người dùng đã mở account đó). */
  dismiss(accountId: string): void {
    const entry = this.entries.get(accountId)
    if (!entry) return
    this.clearTimer(entry)
    this.entries.delete(accountId)
    this.order = this.order.filter((id) => id !== accountId)
    for (const [wcId, id] of this.accountByWc) if (id === accountId) this.accountByWc.delete(wcId)
    if (!entry.win.isDestroyed()) entry.win.destroy()
    this.layout()
  }

  has(accountId: string): boolean {
    return this.entries.has(accountId)
  }

  dismissAll(): void {
    for (const id of [...this.entries.keys()]) this.dismiss(id)
  }

  private create(accountId: string): Entry {
    const win = new BrowserWindow({
      width: TOAST_WIDTH,
      height: TOAST_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false, // không cướp focus khi đang gõ ở nơi khác
      show: false,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/toast.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: false,
        // Toast tự phát âm báo bằng WebAudio mà không cần thao tác người dùng.
        autoplayPolicy: 'no-user-gesture-required',
      },
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    const entry: Entry = { win, count: 0, timer: null, hovered: false, ready: false, pending: null }
    this.accountByWc.set(win.webContents.id, accountId)
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (e) => e.preventDefault())
    win.webContents.once('did-finish-load', () => {
      entry.ready = true
      if (entry.pending) win.webContents.send(IPC.toastData, entry.pending)
      entry.pending = null
      if (!win.isDestroyed()) win.showInactive()
    })
    const dev = process.env['ELECTRON_RENDERER_URL']
    if (dev) void win.loadURL(`${dev}/toast.html`)
    else void win.loadFile(path.join(__dirname, '../renderer/toast.html'))
    return entry
  }

  private layout(): void {
    const area = screen.getPrimaryDisplay().workArea
    const positions = stackPositions(area, this.order.length)
    this.order.forEach((id, i) => {
      const entry = this.entries.get(id)
      if (entry && !entry.win.isDestroyed()) entry.win.setPosition(positions[i].x, positions[i].y)
    })
  }

  private clearTimer(entry: Entry): void {
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = null
  }

  private armTimer(accountId: string, entry: Entry): void {
    this.clearTimer(entry)
    if (entry.hovered) return
    entry.timer = setTimeout(() => this.dismiss(accountId), TOAST_LIFETIME_MS)
  }
}
