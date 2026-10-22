/** Zalo đưa người dùng về trang đăng nhập (id.zalo.me) khi phiên hết hạn hoặc chưa đăng nhập. */
export function isLoginUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'id.zalo.me'
  } catch {
    return false
  }
}

/**
 * Có lúc trang đăng nhập hiện ngay trên chat.zalo.me (không đổi URL), nên xét thêm tiêu đề trang.
 * Các tiêu đề đã quan sát: "Zalo - Đăng nhập Zalo", "Đăng nhập tài khoản Zalo".
 */
export function isLoginTitle(title: string): boolean {
  return /đăng\s*nhập|log\s?in|sign\s?in/i.test(title.normalize('NFC'))
}

/** Trang hiện tại có phải màn hình đăng nhập không (chỉ dựa trên URL và tiêu đề, không đọc DOM). */
export function isLoginPage(url: string, title: string): boolean {
  return isLoginUrl(url) || isLoginTitle(title)
}
