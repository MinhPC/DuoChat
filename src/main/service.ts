/**
 * Định nghĩa service Zalo. Allowlist domain khai báo MỘT chỗ duy nhất ở đây.
 * Danh sách lấy từ tab Network của spike (docs/spike-windows.md), không đoán.
 * Để ngỏ kiến trúc: một service = URL + tên + icon + danh sách domain cho phép.
 */
export interface ServiceDefinition {
  id: string
  name: string
  url: string
  /** Domain gốc cho phép, gồm cả subdomain (vd 'zalo.me' khớp 'chat.zalo.me'). */
  allowedDomains: readonly string[]
}

export const ZALO_SERVICE: ServiceDefinition = {
  id: 'zalo',
  name: 'Zalo',
  url: 'https://chat.zalo.me',
  allowedDomains: ['zalo.me', 'zadn.vn', 'zdn.vn', 'zaloapp.com'],
}

export function isAllowedHost(hostname: string, svc: ServiceDefinition = ZALO_SERVICE): boolean {
  const h = hostname.toLowerCase()
  return svc.allowedDomains.some((d) => h === d || h.endsWith(`.${d}`))
}

/** Chỉ https (hoặc http) tới host nằm trong allowlist. */
export function isAllowedUrl(url: string, svc: ServiceDefinition = ZALO_SERVICE): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    return isAllowedHost(u.hostname, svc)
  } catch {
    return false
  }
}

/**
 * Phiên riêng, chỉ trong bộ nhớ (không có `persist:`), cho cửa sổ xem vị trí. Tách khỏi partition của
 * account để Google/OSM không thấy cookie Zalo, và không lưu gì xuống đĩa.
 */
export const MAP_PARTITION = 'map-viewer'

const MAP_HOSTS = new Set([
  'maps.google.com',
  'maps.app.goo.gl',
  'consent.google.com', // trang đồng ý cookie Google, có thể chen giữa khi mở bản đồ
  'openstreetmap.org',
  'www.openstreetmap.org',
])
const GOOGLE_HOSTS = /^(www\.)?google\.com(\.[a-z]{2})?$/i

/** Link bản đồ (vị trí gửi trong chat): Google Maps hoặc OpenStreetMap, chỉ https. */
export function isMapUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (MAP_HOSTS.has(h)) return true
    return (GOOGLE_HOSTS.test(h) || h === 'goo.gl') && /^\/maps(\/|$)/.test(u.pathname)
  } catch {
    return false
  }
}

export function isExternalOpenable(url: string): boolean {
  try {
    const p = new URL(url).protocol
    return p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

/**
 * User-Agent mặc định của Electron chứa `Electron/x.y` và tên app. Bỏ hai đoạn này để UA giống
 * Chrome cùng phiên bản Chromium, tránh bị Zalo coi là client lạ (rủi ro R2).
 */
export function buildUserAgent(electronUa: string, appName: string): string {
  const escaped = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return electronUa.replace(/\s+Electron\/\S+/, '').replace(new RegExp(`\\s+${escaped}/\\S+`), '')
}

export function partitionFor(accountId: string): string {
  return `persist:acc-${accountId}`
}
