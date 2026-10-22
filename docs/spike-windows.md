# Spike Windows (bước 0)

Ngày chạy: 2026-10-22. Môi trường: Windows 11, Electron 45.0.0 (Chromium 156.0.8078.48).

Script:

- [spike/main.cjs](../spike/main.cjs): 2 `WebContentsView` cạnh nhau, 2 partition, `backgroundThrottling: false`; ghi tên miền,
  title, tên cookie + loại (không ghi giá trị), RAM. Chạy: `npx electron spike/main.cjs` (`SPIKE_MS` chỉnh thời gian).
- [spike/ua-check.cjs](../spike/ua-check.cjs): kiểm tra UA thật sự gửi đi.
- Kiểm thử bản app hoàn chỉnh: [scripts/e2e.mjs](../scripts/e2e.mjs), [scripts/e2e-keys.mjs](../scripts/e2e-keys.mjs).

> **Chạy Electron từ terminal của VS Code:** biến `ELECTRON_RUN_AS_NODE=1` đang được đặt sẵn, khiến `electron` chạy như
> Node thường và báo `Cannot read properties of undefined (reading 'whenReady')`. Chạy `unset ELECTRON_RUN_AS_NODE` trước.

**Phạm vi:** spike chạy tự động, **chưa đăng nhập tài khoản Zalo nào** (cần quét QR bằng điện thoại thật). Mọi mục cần
đăng nhập được đánh dấu **CHƯA KIỂM CHỨNG** và nằm trong checklist cuối file.

## Đã kiểm chứng

| Mục | Kết quả |
|---|---|
| 2 view / 2 partition tải chat.zalo.me | **Đạt.** Cả hai chuyển hướng tới `https://id.zalo.me/account?continue=https://chat.zalo.me/` (trang đăng nhập QR), không lỗi tải. |
| Hai phiên tách biệt về lưu trữ | **Đạt ở mức thư mục:** mỗi account có `Partitions/acc-<id>` riêng trên đĩa. Chưa kiểm chứng "hai tài khoản đăng nhập thật cùng lúc không đá nhau". |
| UA | **Đạt.** `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.48 Safari/537.36`. Kiểm tra bằng `spike/ua-check.cjs`: header `User-Agent` của request đầu tiên tới `chat.zalo.me` và `navigator.userAgent` ở `dom-ready` đầu tiên đều sạch (không `Electron/`, không tên app). `navigator.userAgentData.brands` = `Not:A-Brand`, `Chromium` (không có brand "Electron"). Zalo không chặn trang đăng nhập (R2 chưa thấy dấu hiệu, mới chỉ xét trang đăng nhập). |
| `document.title` khi **chưa đăng nhập** | `Zalo - Đăng nhập Zalo` → `Zalo` → `Đăng nhập tài khoản Zalo` (đổi 3 lần khi tải). |
| Cookie trên trang đăng nhập | Toàn bộ **persistent**: `_zlang`, `__zi`, `__zi-legacy` (.zalo.me); `zpdid`, `zlogin_session` (.id.zalo.me); `_ga`, `_gid`, `_gat`, `_ga_*`. Cookie xác thực sau đăng nhập **chưa quan sát được** nên R1 chưa kết luận. |
| View bị ẩn không bị throttle | `document.visibilityState` của view ẩn bằng `setVisible(false)` vẫn là `visible` khi `backgroundThrottling: false` (đúng ý đồ: timer/websocket không bị Chromium hạ tốc). Chưa đo "10 phút nhận thông báo" vì cần đăng nhập. |
| Shim thông báo (R4) | **Cầu nối đạt, thông báo thật của Zalo chưa thử.** Trong trang thật: `window.Notification` là lớp của shim, `permission = 'granted'`, `requestPermission()` resolve `granted`, và `new Notification(...)` đi qua `window.__duochat.notify` → main → tăng badge đúng account. Cầu nối chỉ expose đúng một hàm `notify`, trang không thấy `require`/`process`/`ipcRenderer`. Shim chạy ở `dom-ready`; nếu Zalo giữ tham chiếu `Notification` gốc trước thời điểm đó thì có thể trượt (R4), cách khắc phục dự phòng: chạy shim sớm hơn từ preload bằng `webFrame.executeJavaScript`. |
| Quyền (permission) | `geolocation` bị từ chối (`getCurrentPosition` → lỗi mã 1, `permissions.query` → `denied`). Quyền được cấp chỉ gồm `notifications`, `media`, `clipboard-sanitized-write`, `fullscreen` cho origin trong allowlist. |
| RAM (60 giây, 2 view, chưa đăng nhập) | Tổng khoảng 800–910 MB: Browser 105, GPU 150, Utility 60, 3 Tab 51/214/217 MB (≈ 200 MB/view khi chưa đăng nhập; spec ước 200–400 MB khi đã đăng nhập). Chưa đo 30 phút. |

### Danh sách domain quan sát được (tab Network, trang đăng nhập)

Thuộc Zalo (đã đưa vào allowlist ở [src/main/service.ts](../src/main/service.ts)):

- `*.zalo.me`: `chat.zalo.me`, `id.zalo.me`, `jr.zalo.me`, `jr.chat.zalo.me`, `wpa.chat.zalo.me`, `za.zalo.me`
- `*.zadn.vn`: `zalo-chat-static.zadn.vn`, `stc-sp.zadn.vn`
- `*.zdn.vn`: `za.zdn.vn`, `stc-chat.zdn.vn`, `zalo-captcha.zdn.vn`, `stc-zlogin.zdn.vn` (**spec chưa dự kiến domain này**)

Bên thứ ba (KHÔNG đưa vào allowlist; chỉ là tài nguyên con của trang, allowlist chỉ áp cho điều hướng, popup và quyền):
`www.google-analytics.com`, `www.googletagmanager.com`, `stats.g.doubleclick.net`, `www.google.com.vn`, `analytics.google.com`.

Cần bổ sung allowlist khi đăng nhập xong nếu thấy thêm domain (tải file, ảnh, gọi video).

## Phát hiện trong quá trình làm (đã sửa)

- `webContents.on('focus')` **không** dùng để xác định pane đang focus như spec gợi ý: sự kiện này cũng nổ khi view vừa
  hiện ra hoặc cửa sổ lấy lại focus, làm `focusedPane` tự nhảy sang pane phải ngay sau khi bật split. Thay bằng
  `before-mouse-event` (`mouseDown`) để chỉ phản ứng khi người dùng bấm chuột vào view.
- Kéo thanh chia: view Zalo là cửa sổ con gốc nên nuốt sự kiện chuột. Giải pháp: lúc kéo, main tạm ẩn các view; shell
  nghe `pointermove`/`pointerup` ở `window` (pointer capture không ổn định).
- Dialog React nằm trong shell nên bị view Zalo che; khi mở dialog, main tạm ẩn các view.

## Giả định (chưa kiểm chứng, cần xác nhận sau khi đăng nhập)

1. Title có tin chưa đọc dạng `(N) Zalo` hoặc `[N] Zalo`. `unread.ts` nhận cả hai kiểu và có **fallback đếm thông báo**
   (mục 10) nếu title chưa từng chứa số. Fixture trong [tests/fixtures/titles.json](../tests/fixtures/titles.json) nhóm
   `assumed` là **giả định**, cần thay bằng title thật.
2. R1 (mất phiên khi tắt app) chưa kết luận; app đã flush storage + cookie của mọi partition trước khi thoát.

## Checklist cho người dùng (cần 2 tài khoản Zalo + điện thoại)

Chạy `npm run dev` (hoặc cài bản trong `dist/`), thêm 2 account, quét QR, rồi ghi kết quả vào đây:

- [ ] Hai tài khoản đăng nhập cùng lúc, không đá nhau.
- [ ] Tắt hẳn app (Thoát ở khay) rồi mở lại vẫn còn đăng nhập (R1). Ghi cookie xác thực là persistent hay session.
- [ ] Thông báo hiện từ cả hai view, kể cả view đang ẩn 10 phút (R4): ______
- [ ] Title khi có/không có tin chưa đọc: ______ / ______ (sửa fixture + `unread.ts` nếu khác giả định).
- [ ] Gửi/nhận ảnh, file, dán ảnh clipboard, kéo thả file, tải file về (hộp thoại Save As + toast).
- [ ] Menu chuột phải (cắt/chép/dán, sao chép ảnh, lưu ảnh, link).
- [ ] Gọi thoại/video (R5): ______
- [ ] RAM mỗi view sau 30 phút: ______
- [ ] Domain mới xuất hiện sau đăng nhập (bổ sung allowlist): ______
