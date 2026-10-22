import path from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { vi } from '../shared/i18n/vi'
import type { Settings } from '../shared/types'
import type { SettingsStore } from './store'
import { loadImage } from './resources'

/** Vị trí đã lưu có còn nằm trong một màn hình đang cắm không (tránh cửa sổ mất tích khi rút màn hình). */
function isVisibleOnSomeDisplay(w: Settings['window']): boolean {
  if (w.x === undefined || w.y === undefined) return false
  const x = w.x
  const y = w.y
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return (
      x + 100 < a.x + a.width && x + w.width - 100 > a.x && y + 50 < a.y + a.height && y > a.y - 50
    )
  })
}

export function createMainWindow(store: SettingsStore, isDev: boolean): BrowserWindow {
  const saved = store.get().window
  const placed = isVisibleOnSomeDisplay(saved)
  const win = new BrowserWindow({
    ...(placed ? { x: saved.x, y: saved.y } : {}),
    width: saved.width,
    height: saved.height,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: vi.appName,
    backgroundColor: '#111827',
    icon: loadImage('icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/shell.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: isDev,
    },
  })
  win.removeMenu()
  if (saved.maximized) win.maximize()

  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
      const b = win.getNormalBounds()
      store.update((s) => ({
        ...s,
        window: { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() },
      }))
    }, 400)
  }
  win.on('resize', save)
  win.on('move', save)
  win.on('maximize', save)
  win.on('unmaximize', save)
  return win
}
