/** Toàn bộ chuỗi giao diện (tiếng Việt), dùng chung cho renderer và main. */
export const vi = {
  appName: 'DuoChat',
  sidebar: {
    addAccount: 'Thêm tài khoản',
    toggleSplit: 'Chia đôi màn hình (Ctrl+\\)',
    settings: 'Cài đặt',
  },
  empty: {
    title: 'Chưa có tài khoản nào',
    hint: 'Bấm nút + bên trái để thêm tài khoản, rồi quét mã QR bằng điện thoại để đăng nhập.',
  },
  dialog: {
    addTitle: 'Thêm tài khoản',
    renameTitle: 'Đổi tên tài khoản',
    nameLabel: 'Tên hiển thị',
    namePlaceholder: 'Ví dụ: Cá nhân, Công ty',
    colorLabel: 'Màu',
    cancel: 'Hủy',
    add: 'Thêm',
    save: 'Lưu',
    close: 'Đóng',
    limitWarning:
      'Bạn đang có từ 6 tài khoản trở lên. Mỗi tài khoản tốn khoảng 200–400 MB RAM, máy có thể bị chậm.',
  },
  settings: {
    title: 'Cài đặt',
    startWithWindows: 'Khởi động cùng Windows',
    startMinimized: 'Khi tự khởi động, chỉ hiện ở khay hệ thống',
    minimizeToTray: 'Bấm X chỉ ẩn xuống khay hệ thống',
    notifyPreview: 'Hiện nội dung tin nhắn trong thông báo (mặc định ẩn)',
    zoom: 'Thu phóng nội dung',
    sessionNote:
      'Lưu ý: nếu Zalo Web đăng xuất khi tắt app, bạn cần quét lại mã QR. DuoChat không sao chép cookie hay vượt cơ chế của Zalo.',
  },
  notice: {
    narrowScreen: 'Màn hình hẹp, Zalo Web có thể bị chật.',
  },
  sounds: { default: 'Mặc định', soft: 'Nhẹ', off: 'Không âm' },
  toast: {
    newMessage: 'Có tin nhắn mới',
    newMessages: (n: number) => `${n} tin nhắn mới`,
    close: 'Đóng',
  },
  colors: ['Xanh dương', 'Xanh lá', 'Đỏ', 'Tím', 'Cam', 'Xanh ngọc', 'Hồng', 'Xám'],
  accountMenu: {
    rename: 'Đổi tên…',
    color: 'Đổi màu',
    sound: 'Âm báo',
    mute: 'Tắt thông báo',
    logout: 'Đăng xuất nhanh',
    remove: 'Xóa tài khoản…',
  },
  confirm: {
    removeTitle: 'Xóa tài khoản',
    removeMessage: (name: string) => `Xóa tài khoản "${name}"?`,
    removeDetail:
      'Toàn bộ dữ liệu đăng nhập của tài khoản này trên máy sẽ bị xóa. Bạn cần quét QR để đăng nhập lại.',
    removeButton: 'Xóa',
    logoutTitle: 'Đăng xuất',
    logoutMessage: (name: string) => `Đăng xuất tài khoản "${name}"?`,
    logoutDetail: 'Tài khoản vẫn được giữ trong DuoChat, bạn chỉ cần quét QR để đăng nhập lại.',
    logoutButton: 'Đăng xuất',
    cancel: 'Hủy',
  },
  tray: {
    open: 'Mở DuoChat',
    quit: 'Thoát',
    tooltip: (total: number) => (total > 0 ? `DuoChat: ${total} tin chưa đọc` : 'DuoChat'),
    accountItem: (name: string, unread: number) => (unread > 0 ? `${name} (${unread})` : name),
  },
  badge: {
    overlayDescription: (total: number) => `${total} tin chưa đọc`,
  },
  contextMenu: {
    cut: 'Cắt',
    copy: 'Sao chép',
    paste: 'Dán',
    selectAll: 'Chọn tất cả',
    copyImage: 'Sao chép ảnh',
    saveImage: 'Lưu ảnh…',
    copyLink: 'Sao chép liên kết',
    openInBrowser: 'Mở trong trình duyệt',
  },
  download: {
    saveTitle: 'Lưu tệp',
    done: 'Đã tải xong',
    clickToOpen: (name: string) => `${name} — bấm để mở thư mục`,
  },
} as const
