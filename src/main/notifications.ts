import { ipcMain, nativeImage, Notification, session, type NativeImage } from 'electron'
import { IPC } from '../shared/ipc'
import type { AccountManager } from './accounts'
import { formatNotificationTitle, parseNotifyPayload } from './notifyPayload'
import { isAllowedUrl, partitionFor } from './service'

const MAX_ICON_BYTES = 1024 * 1024

/** Icon lấy từ trang: data URL hoặc https thuộc allowlist. Lỗi/quá lớn thì bỏ qua icon. */
async function loadIcon(accountId: string, icon: string | null): Promise<NativeImage | undefined> {
  if (!icon) return undefined
  try {
    if (icon.startsWith('data:image/')) {
      const img = nativeImage.createFromDataURL(icon)
      return img.isEmpty() ? undefined : img
    }
    if (!icon.startsWith('https:') || !isAllowedUrl(icon)) return undefined
    const res = await session
      .fromPartition(partitionFor(accountId))
      .fetch(icon, { signal: AbortSignal.timeout(3000), credentials: 'omit' })
    if (!res.ok) return undefined
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_ICON_BYTES) return undefined
    const img = nativeImage.createFromBuffer(buf)
    return img.isEmpty() ? undefined : img
  } catch {
    return undefined
  }
}

/**
 * Nhận thông báo từ shim trong view Zalo và hiện bằng Notification của Electron:
 * - Tiêu đề `[tên account] tiêu đề gốc`.
 * - Account muted thì không hiện (badge vẫn đếm).
 * - Account đang hiển thị và cửa sổ đang focus thì không hiện.
 * - Click: hiện cửa sổ và đưa account lên màn hình.
 */
export function setupNotifications(
  manager: AccountManager,
  openAccount: (accountId: string) => void,
): void {
  // Giữ tham chiếu để Notification không bị GC trước khi người dùng bấm.
  const alive = new Set<Notification>()

  ipcMain.on(IPC.notify, (event, raw: unknown) => {
    const accountId = manager.accountIdForWebContents(event.sender)
    if (!accountId) return // chỉ nhận từ view Zalo của app
    const payload = parseNotifyPayload(raw)
    const account = manager.getAccount(accountId)
    if (!payload || !account) return

    manager.noteNotification(accountId)
    if (account.muted || manager.isSeen(accountId)) return
    if (!Notification.isSupported()) return

    void loadIcon(accountId, payload.icon).then((icon) => {
      const n = new Notification({
        title: formatNotificationTitle(account.name, payload.title),
        body: payload.body,
        icon,
      })
      alive.add(n)
      n.on('click', () => openAccount(accountId))
      n.on('close', () => alive.delete(n))
      n.on('failed', () => alive.delete(n))
      n.show()
    })
  })
}
