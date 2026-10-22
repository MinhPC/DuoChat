import { Menu, Tray } from 'electron'
import { vi } from '../shared/i18n/vi'
import { loadImage } from './resources'

export interface TrayAccount {
  id: string
  name: string
  unread: number
}

export interface TrayHandlers {
  onToggleWindow: () => void
  onOpenWindow: () => void
  onOpenAccount: (id: string) => void
  onQuit: () => void
}

/** Tray: chuột trái hiện/ẩn cửa sổ; chuột phải có Mở, danh sách account, Thoát. */
export class AppTray {
  private readonly tray: Tray

  constructor(private readonly handlers: TrayHandlers) {
    this.tray = new Tray(loadImage('tray.png'))
    this.tray.on('click', () => handlers.onToggleWindow())
    this.update(0, [])
  }

  update(total: number, accounts: TrayAccount[]): void {
    this.tray.setImage(loadImage(total > 0 ? 'tray-unread.png' : 'tray.png'))
    this.tray.setToolTip(vi.tray.tooltip(total))
    const menu = Menu.buildFromTemplate([
      { label: vi.tray.open, click: () => this.handlers.onOpenWindow() },
      { type: 'separator' },
      ...accounts.map((a) => ({
        label: vi.tray.accountItem(a.name, a.unread),
        click: () => this.handlers.onOpenAccount(a.id),
      })),
      ...(accounts.length > 0 ? [{ type: 'separator' as const }] : []),
      { label: vi.tray.quit, click: () => this.handlers.onQuit() },
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    this.tray.destroy()
  }
}
