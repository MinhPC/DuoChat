import { vi } from '../shared/i18n/vi'
import type { Account, AccountSound, PreviewMode, Rect } from '../shared/types'

export const TOAST_WIDTH = 360
export const TOAST_HEIGHT = 92
export const TOAST_GAP = 4
export const TOAST_MARGIN = 12
export const TOAST_MAX_VISIBLE = 4
export const TOAST_LIFETIME_MS = 7000

/** Dữ liệu gửi sang cửa sổ toast để vẽ. */
export interface ToastView {
  accountName: string
  color: string
  initial: string
  title: string
  body: string
  count: number
  sound: AccountSound
  /** Phát âm báo cho lần cập nhật này (tin mới đến), không phát khi chỉ vẽ lại. */
  playSound: boolean
}

/** Kết hợp tùy chọn của account với cài đặt chung: hiện nội dung tin hay không. */
export function resolvePreview(mode: PreviewMode, globalPreview: boolean): boolean {
  return mode === 'show' ? true : mode === 'hide' ? false : globalPreview
}

export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?'
}

/**
 * Nội dung toast. Mặc định ẨN nội dung tin (riêng tư): chỉ hiện tên account và số tin mới.
 * Bật `preview` thì hiện tiêu đề/nội dung gốc của tin gần nhất.
 */
export function buildToastView(opts: {
  account: Pick<Account, 'name' | 'color' | 'sound'>
  count: number
  preview: boolean
  title: string
  body: string
  playSound: boolean
  /** `login`: thẻ báo phiên hết hạn (không phải tin nhắn). */
  kind?: 'message' | 'login'
}): ToastView {
  const { account, count, preview } = opts
  const hidden = vi.toast
  if (opts.kind === 'login') {
    return {
      accountName: account.name,
      color: account.color,
      initial: initialOf(account.name),
      title: hidden.loginRequired,
      body: '',
      count: 1,
      sound: account.sound,
      playSound: opts.playSound && account.sound !== 'off',
    }
  }
  return {
    accountName: account.name,
    color: account.color,
    initial: initialOf(account.name),
    title:
      preview && opts.title
        ? opts.title
        : count > 1
          ? hidden.newMessages(count)
          : hidden.newMessage,
    body: preview ? opts.body : '',
    count,
    sound: account.sound,
    playSound: opts.playSound && account.sound !== 'off',
  }
}

/**
 * Vị trí các toast xếp dọc từ góc dưới-phải của vùng làm việc; toast đầu danh sách ở dưới cùng.
 */
export function stackPositions(workArea: Rect, n: number): { x: number; y: number }[] {
  const x = workArea.x + workArea.width - TOAST_WIDTH - TOAST_MARGIN
  const bottom = workArea.y + workArea.height - TOAST_MARGIN
  return Array.from({ length: n }, (_, i) => ({
    x,
    y: bottom - (i + 1) * TOAST_HEIGHT - i * TOAST_GAP,
  }))
}

/** Thêm account vào hàng đợi toast (mỗi account tối đa một toast); trả về danh sách mới và account bị đẩy ra. */
export function pushToast(
  order: string[],
  accountId: string,
): { order: string[]; evicted: string[] } {
  const next = order.includes(accountId) ? order : [...order, accountId]
  const evicted =
    next.length > TOAST_MAX_VISIBLE ? next.slice(0, next.length - TOAST_MAX_VISIBLE) : []
  return { order: next.slice(evicted.length), evicted }
}
