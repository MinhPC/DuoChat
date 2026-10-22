import type { BrowserWindow } from 'electron'
import { vi } from '../shared/i18n/vi'
import { loadImage } from './resources'
import { badgeImageName } from './unread'

/** Overlay icon trên taskbar Windows. */
export function updateTaskbarBadge(win: BrowserWindow, total: number): void {
  const name = badgeImageName(total)
  if (!name) {
    win.setOverlayIcon(null, '')
    return
  }
  win.setOverlayIcon(loadImage(name), vi.badge.overlayDescription(total))
}
