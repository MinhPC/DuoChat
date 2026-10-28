import path from 'node:path'
import { BrowserWindow, ipcMain, screen } from 'electron'
import { IPC } from '../shared/ipc'

export interface UpdatePromptView {
  title: string
  body: string
  note: string
  primary: string
  secondary: string
}

const WIDTH = 460
const HEIGHT = 300

const open = new Map<number, (yes: boolean) => void>()
let registered = false

function register(): void {
  if (registered) return
  registered = true
  ipcMain.on(IPC.updatePromptChoice, (e, yes: unknown) => {
    if (typeof yes === 'boolean') open.get(e.sender.id)?.(yes)
  })
}

/**
 * Hộp thoại hỏi cập nhật của DuoChat (thay cho hộp thoại hệ thống). Là cửa sổ riêng, không gắn với cửa sổ chính
 * nên vẫn hiện được khi app đang ẩn dưới tray. Đóng cửa sổ hoặc bấm Esc nghĩa là "Để sau".
 */
export function askUpdate(view: UpdatePromptView, near: BrowserWindow | null): Promise<boolean> {
  register()
  return new Promise((resolve) => {
    const anchor =
      near && !near.isDestroyed() && near.isVisible()
        ? screen.getDisplayMatching(near.getBounds())
        : screen.getPrimaryDisplay()
    const a = anchor.workArea
    const win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      x: Math.round(a.x + (a.width - WIDTH) / 2),
      y: Math.round(a.y + (a.height - HEIGHT) / 2),
      frame: false,
      transparent: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      show: false,
      hasShadow: false,
      title: 'DuoChat',
      webPreferences: {
        preload: path.join(__dirname, '../preload/updatePrompt.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: false,
      },
    })
    const id = win.webContents.id
    let settled = false
    const finish = (yes: boolean): void => {
      if (settled) return
      settled = true
      open.delete(id)
      if (!win.isDestroyed()) win.destroy()
      resolve(yes)
    }
    open.set(id, finish)
    win.on('closed', () => finish(false))
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (e) => e.preventDefault())
    win.webContents.once('did-finish-load', () => {
      if (win.isDestroyed()) return
      win.webContents.send(IPC.updatePromptData, view)
      win.show()
    })
    const dev = process.env['ELECTRON_RENDERER_URL']
    if (dev) void win.loadURL(`${dev}/update.html`)
    else void win.loadFile(path.join(__dirname, '../renderer/update.html'))
  })
}
