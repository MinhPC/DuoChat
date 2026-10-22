# Spike Windows (bước 0)

Ngày chạy: 2026-10-22. Script: [spike/main.cjs](../spike/main.cjs). Chạy lại: `npx electron spike/main.cjs`
(biến `SPIKE_MS` chỉnh thời gian chạy, kết quả ghi vào `spike/output/result.json`).

Môi trường: Windows 11, Electron 45.0.0 (Chromium 156.0.8078.48).

> **Lưu ý khi chạy Electron từ terminal của VS Code:** biến `ELECTRON_RUN_AS_NODE=1` đang được đặt sẵn,
> khiến `electron` chạy như Node thường và báo `Cannot read properties of undefined (reading 'whenReady')`.
> Chạy `unset ELECTRON_RUN_AS_NODE` (bash) hoặc `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell) trước.

Spike chạy tự động, **chưa đăng nhập tài khoản Zalo nào** (việc quét QR cần điện thoại thật). Vì vậy mục nào cần
đăng nhập được đánh dấu **CHƯA KIỂM CHỨNG** và cần người dùng làm tay theo checklist cuối file.

## Kết quả đo được

| Mục | Kết quả |
|---|---|
| 2 view / 2 partition tải được chat.zalo.me | **Đạt.** Cả hai chuyển hướng sang `https://id.zalo.me/account?continue=https://chat.zalo.me/` (trang đăng nhập), không lỗi tải. |
| UA đã bỏ `Electron/x` và tên app | **Đạt.** `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.48 Safari/537.36`. Zalo không chặn (R2 chưa thấy dấu hiệu, nhưng mới chỉ xét trang đăng nhập). |
| `document.title` khi **chưa đăng nhập** | `Zalo - Đăng nhập Zalo` → `Zalo` → `Đăng nhập tài khoản Zalo` (đổi 3 lần khi tải). |
| `document.title` khi đã đăng nhập, có/không tin chưa đọc | **CHƯA KIỂM CHỨNG.** Parser `unread.ts` đang dựa trên giả định, xem phần "Giả định". |
| Cookie trên trang đăng nhập | Toàn bộ là **persistent**: `_zlang`, `__zi`, `__zi-legacy` (.zalo.me); `zpdid`, `zlogin_session` (.id.zalo.me); `_ga`, `_gid`, `_gat`, `_ga_*` (analytics). Cookie xác thực sau đăng nhập **chưa quan sát được** nên R1 chưa kết luận. |
| RAM (60 giây, 2 view, chưa đăng nhập) | Tổng khoảng 800–910 MB gồm Browser 105, GPU 150, Utility 60, 3 Tab 51/214/217 MB. Con số ~200 MB/view khi chưa đăng nhập; spec ước 200–400 MB khi đăng nhập. Chưa đo 30 phút. |

### Danh sách domain quan sát được (tab Network, tải trang đăng nhập)

Thuộc Zalo (đưa vào allowlist):

- `*.zalo.me`: `chat.zalo.me`, `id.zalo.me`, `jr.zalo.me`, `jr.chat.zalo.me`, `wpa.chat.zalo.me`, `za.zalo.me`
- `*.zadn.vn`: `zalo-chat-static.zadn.vn`, `stc-sp.zadn.vn`
- `*.zdn.vn`: `za.zdn.vn`, `stc-chat.zdn.vn`, `zalo-captcha.zdn.vn`, `stc-zlogin.zdn.vn` (**spec chưa dự kiến domain này**)

Bên thứ ba (KHÔNG đưa vào allowlist, chỉ là tài nguyên con của trang, không ảnh hưởng điều hướng):
`www.google-analytics.com`, `www.googletagmanager.com`, `stats.g.doubleclick.net`, `www.google.com.vn`, `analytics.google.com`.

Allowlist trong [src/main/service.ts](../src/main/service.ts) dùng `zalo.me`, `zadn.vn`, `zdn.vn` kèm subdomain.
Cần bổ sung khi đăng nhập xong nếu thấy thêm domain (ví dụ domain tải file, ảnh, gọi video).

## Giả định (chưa kiểm chứng, cần xác nhận sau khi đăng nhập)

1. Title có tin chưa đọc dạng `(N) Zalo` hoặc `[N] Zalo`... `unread.ts` nhận cả hai kiểu, ngoài ra
   có **fallback đếm thông báo** (mục 10) nếu title chưa từng chứa số. Fixture trong
   [tests/fixtures/titles.json](../tests/fixtures/titles.json) là **giả định**, cần thay bằng title thật.
2. Shim thông báo (R4) bắt được `new Notification(...)`: chưa thử vì cần Zalo gửi thông báo thật.

## Checklist cho người dùng (cần 2 tài khoản Zalo + điện thoại)

Chạy `npm run dev`, thêm 2 account, quét QR, rồi ghi kết quả vào đây:

- [ ] Hai tài khoản đăng nhập cùng lúc, không đá nhau.
- [ ] Tắt hẳn app rồi mở lại vẫn còn đăng nhập (R1). Ghi cookie xác thực là persistent hay session.
- [ ] Thông báo hiện từ cả hai view, kể cả view đang ẩn 10 phút (R4).
- [ ] Title khi có/không có tin chưa đọc: ______ / ______ (sửa fixture + `unread.ts` nếu khác giả định).
- [ ] Gửi/nhận ảnh, file, dán ảnh clipboard, kéo thả file, tải file về.
- [ ] Gọi thoại/video (R5): ______
- [ ] RAM mỗi view sau 30 phút: ______
- [ ] Domain mới xuất hiện sau đăng nhập (bổ sung allowlist): ______
