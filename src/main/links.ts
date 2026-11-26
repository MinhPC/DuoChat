import { BrowserWindow, session, shell, type WebContents } from 'electron'
import { attachContextMenu } from './contextMenu'
import { applyPermissionHandlers } from './permissions'
import { isAllowedUrl, isExternalOpenable, isMapUrl, MAP_PARTITION } from './service'

let mapSessionReady = false
function prepareMapSession(userAgent: string): void {
  if (mapSessionReady) return
  mapSessionReady = true
  const ses = session.fromPartition(MAP_PARTITION)
  ses.setUserAgent(userAgent)
  applyPermissionHandlers(ses) // origin bản đồ không thuộc allowlist Zalo nên mọi quyền bị từ chối
}

function childOptions(partition: string, isDev: boolean) {
  return {
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
  }
}

/** Mở link bản đồ trong cửa sổ con của app, phiên riêng ở bộ nhớ (không dùng cookie Zalo). */
function openMapWindow(url: string, isDev: boolean, userAgent: string): void {
  prepareMapSession(userAgent)
  const win = new BrowserWindow(childOptions(MAP_PARTITION, isDev))
  win.removeMenu()
  win.webContents.setUserAgent(userAgent)
  attachLinkHandling(win.webContents, MAP_PARTITION, isDev, userAgent)
  void win.loadURL(url)
}

/**
 * Link ngoài (mục 2.5.15): URL không thuộc allowlist Zalo thì mở bằng trình duyệt hệ thống
 * (chỉ http/https) và chặn trong app. URL thuộc allowlist cần popup thì mở cửa sổ con CÙNG partition.
 * Ngoại lệ: link bản đồ (vị trí gửi trong chat) mở cửa sổ con trong app, phiên riêng ở bộ nhớ;
 * cửa sổ bản đồ chỉ được ở lại trên các domain bản đồ.
 */
export function attachLinkHandling(
  wc: WebContents,
  partition: string,
  isDev: boolean,
  userAgent: string,
): void {
  const inMapWindow = partition === MAP_PARTITION
  const allow = inMapWindow ? isMapUrl : isAllowedUrl

  wc.setWindowOpenHandler(({ url }) => {
    if (isMapUrl(url)) {
      prepareMapSession(userAgent)
      return { action: 'allow', overrideBrowserWindowOptions: childOptions(MAP_PARTITION, isDev) }
    }
    if (!inMapWindow && (url === 'about:blank' || isAllowedUrl(url))) {
      return { action: 'allow', overrideBrowserWindowOptions: childOptions(partition, isDev) }
    }
    if (isExternalOpenable(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // will-redirect: will-navigate không nổ với redirect phía máy chủ nên chặn riêng.
  const guard = (event: { preventDefault(): void }, url: string): void => {
    if (allow(url)) return
    event.preventDefault()
    // Trang Zalo tự điều hướng sang bản đồ: mở cửa sổ bản đồ trong app thay vì trình duyệt.
    if (!inMapWindow && isMapUrl(url)) return openMapWindow(url, isDev, userAgent)
    if (isExternalOpenable(url)) void shell.openExternal(url)
  }
  wc.on('will-navigate', guard)
  wc.on('will-redirect', guard)

  wc.on('did-create-window', (child, details) => {
    child.removeMenu()
    child.webContents.setUserAgent(userAgent)
    attachContextMenu(child.webContents)
    // Cửa sổ do link bản đồ mở ra thuộc phiên bản đồ, còn lại thừa hưởng partition của account.
    const childPartition = isMapUrl(details.url) ? MAP_PARTITION : partition
    attachLinkHandling(child.webContents, childPartition, isDev, userAgent)
  })
}
