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

interface ShowState {
  /** `maximized` đã lưu lúc khởi động, chụp trước khi sự kiện resize/move kịp ghi đè. */
  wasMaximized: boolean
  shown: boolean
}
const showStates = new WeakMap<BrowserWindow, ShowState>()

/**
 * Mọi đường hiện cửa sổ chính (khởi động, tray, single-instance) đều đi qua đây.
 * Lần hiện đầu, nếu lần trước đang phóng to thì phóng to trước khi hiện để không chớp khung nhỏ.
 */
export function showMainWindow(win: BrowserWindow): void {
  const state = showStates.get(win)
  if (state && !state.shown) {
    state.shown = true
    if (state.wasMaximized) win.maximize()
  }
  win.show()
  win.focus()
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
  // Không maximize ở đây: trên Windows, maximize() cửa sổ đang ẩn có thể làm nó hiện ra khung nhỏ rồi mới phóng to.
  // Việc phóng to + hiện làm ở `showMainWindow`.
  const state: ShowState = { wasMaximized: saved.maximized, shown: false }
  showStates.set(win, state)

  // Theo dõi bằng sự kiện thay vì isMaximized(), vì khi đang minimize giá trị đó không đáng tin.
  let maximized = saved.maximized
  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      // Chưa hiện lần nào thì isMaximized() chắc chắn false, ghi vào sẽ mất trạng thái phóng to đã lưu.
      if (!state.shown) return
      if (win.isDestroyed() || win.isFullScreen()) return
      // getNormalBounds() vẫn đúng khi đang thu nhỏ, nên không bỏ qua lần lưu đang chờ khi minimize.
      const b = win.getNormalBounds()
      store.update((s) => ({
        ...s,
        window: { x: b.x, y: b.y, width: b.width, height: b.height, maximized },
      }))
    }, 400)
  }
  win.on('resize', save)
  win.on('move', save)
  win.on('maximize', () => {
    maximized = true
    save()
  })
  win.on('unmaximize', () => {
    maximized = false
    save()
  })
  return win
}
