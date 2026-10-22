import { isAllowedUrl } from './service'

/**
 * Đọc hồ sơ của CHÍNH tài khoản đang đăng nhập (CLAUDE.md mục 4.3): tên hiển thị và URL ảnh đại diện.
 * Chỉ chạy khi người dùng bấm nút. Không đọc danh sách chat, danh bạ hay nội dung tin nhắn.
 */

export interface Profile {
  name: string | null
  avatarUrl: string | null
}

const MAX_NAME = 40
const MAX_URL = 2048
const MAX_AVATAR_DATA_URL = 60_000
const AVATAR_PREFIX = 'data:image/png;base64,'

/**
 * Script chạy trong main world của trang. Chỉ xét vùng thanh điều hướng bên trái, phía trên cùng
 * (nơi Zalo Web đặt ảnh đại diện của mình), và trả về đúng `{ name, avatarUrl }`.
 * Selector của Zalo bị rút gọn và hay đổi nên dùng vị trí + host ảnh thay vì class.
 */
export const PROFILE_SCRIPT = String.raw`(() => {
  try {
    const HOST = /^https:\/\/([^/]+\.)?(zadn\.vn|zdn\.vn|zalo\.me|zaloapp\.com)\//i
    const inCorner = (r) => r.width >= 24 && r.width <= 96 && Math.abs(r.width - r.height) <= 4 && r.left < 140 && r.top < 180
    const cands = []
    for (const img of document.querySelectorAll('img')) {
      const src = img.currentSrc || img.src
      const r = img.getBoundingClientRect()
      if (src && HOST.test(src) && inCorner(r)) cands.push({ el: img, src, top: r.top })
    }
    if (cands.length === 0) {
      for (const el of document.querySelectorAll('div,span')) {
        const r = el.getBoundingClientRect()
        if (!inCorner(r)) continue
        const m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage || '')
        if (m && HOST.test(m[1])) cands.push({ el, src: m[1], top: r.top })
      }
    }
    cands.sort((a, b) => a.top - b.top)
    const best = cands[0]
    if (!best) return { name: null, title: document.title, avatarUrl: null }
    let name = null
    for (let el = best.el, i = 0; el && i < 3 && !name; el = el.parentElement, i++) {
      for (const attr of ['alt', 'aria-label', 'title']) {
        const v = el.getAttribute && el.getAttribute(attr)
        if (v && v.trim()) { name = v.trim(); break }
      }
    }
    return { name, title: document.title, avatarUrl: best.src }
  } catch (e) {
    return { name: null, title: '', avatarUrl: null }
  }
})()`

/** Kết quả từ trang không đáng tin: kiểm tra kiểu, độ dài, và URL ảnh phải thuộc allowlist Zalo. */
export function parseProfile(raw: unknown): Profile {
  const empty: Profile = { name: null, avatarUrl: null }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return empty
  const r = raw as Record<string, unknown>
  const name = cleanName(r.name) ?? nameFromTitle(r.title)
  const avatarUrl =
    typeof r.avatarUrl === 'string' && r.avatarUrl.length <= MAX_URL && isAllowedUrl(r.avatarUrl)
      ? r.avatarUrl
      : null
  return { name, avatarUrl }
}

// Chuỗi chung chung của giao diện (alt/title của icon), không phải tên người dùng.
const GENERIC = /^(avatar|profile|user|ảnh đại diện|tài khoản|account|zalo)$/i

/**
 * Zalo Web đặt tên chủ tài khoản vào tiêu đề tab: "Zalo - <tên>", có thể kèm số chưa đọc phía trước.
 * Tiêu đề của trang đăng nhập không phải tên người dùng.
 */
export function nameFromTitle(title: unknown): string | null {
  if (typeof title !== 'string') return null
  const m = /^\s*(?:[([]\d+\+?[)\]]\s*)?Zalo\s*-\s*(.+)$/i.exec(title)
  if (!m || /đăng nhập/i.test(m[1])) return null
  return cleanName(m[1])
}

export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const n = v
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
  return n === '' || GENERIC.test(n) ? null : n
}

export function isAvatarDataUrl(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length <= MAX_AVATAR_DATA_URL &&
    v.startsWith(AVATAR_PREFIX) &&
    /^[A-Za-z0-9+/=]+$/.test(v.slice(AVATAR_PREFIX.length))
  )
}

export function toAvatarDataUrl(png: Buffer): string | null {
  const url = AVATAR_PREFIX + png.toString('base64')
  return isAvatarDataUrl(url) ? url : null
}
