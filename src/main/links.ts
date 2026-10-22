import { shell, type WebContents } from 'electron'
import { attachContextMenu } from './contextMenu'
import { isAllowedUrl, isExternalOpenable } from './service'

/**
 * Link ngoài (mục 2.5.15): URL không thuộc allowlist Zalo thì mở bằng trình duyệt hệ thống
 * (chỉ http/https) và chặn trong app. URL thuộc allowlist cần popup thì mở cửa sổ con CÙNG partition.
 */
export function attachLinkHandling(
  wc: WebContents,
  partition: string,
  isDev: boolean,
  userAgent: string,
): void {
  wc.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || isAllowedUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1000,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            partition,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
            devTools: isDev,
          },
        },
      }
    }
    if (isExternalOpenable(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  wc.on('will-navigate', (event, url) => {
    if (isAllowedUrl(url)) return
    event.preventDefault()
    if (isExternalOpenable(url)) void shell.openExternal(url)
  })

  // will-navigate không nổ với redirect phía máy chủ, nên chặn riêng ở đây.
  wc.on('will-redirect', (event, url) => {
    if (isAllowedUrl(url)) return
    event.preventDefault()
    if (isExternalOpenable(url)) void shell.openExternal(url)
  })

  wc.on('did-create-window', (child) => {
    child.removeMenu()
    child.webContents.setUserAgent(userAgent)
    attachContextMenu(child.webContents)
    attachLinkHandling(child.webContents, partition, isDev, userAgent)
  })
}
