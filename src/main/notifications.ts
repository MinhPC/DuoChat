import { ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import type { AccountManager } from './accounts'
import { parseNotifyPayload } from './notifyPayload'
import type { ToastManager } from './toast'

/**
 * Nhận thông báo từ shim trong view Zalo và hiện bằng toast của DuoChat:
 * - Account muted thì không hiện (badge vẫn đếm).
 * - Account đang hiển thị và cửa sổ đang focus thì không hiện.
 * - Nhiều tin cùng account được gom thành một toast có số đếm; bấm toast để mở account.
 */
export function setupNotifications(
  manager: AccountManager,
  toasts: ToastManager,
  showPreview: () => boolean,
): void {
  ipcMain.on(IPC.notify, (event, raw: unknown) => {
    const accountId = manager.accountIdForWebContents(event.sender)
    if (!accountId) return // chỉ nhận từ view Zalo của app
    const payload = parseNotifyPayload(raw)
    const account = manager.getAccount(accountId)
    if (!payload || !account) return

    manager.noteNotification(accountId)
    if (account.muted || manager.isSeen(accountId)) return
    toasts.show(account, payload, showPreview())
  })
}
