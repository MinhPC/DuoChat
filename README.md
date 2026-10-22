# DuoChat

Đăng nhập nhiều tài khoản Zalo cùng lúc trên một máy Windows. DuoChat là một trình duyệt chuyên dụng: mỗi tài khoản
chạy **Zalo Web chính thức (https://chat.zalo.me)** trong một khung riêng, có vùng lưu trữ riêng (cookie, localStorage,
IndexedDB, cache) nên các phiên đăng nhập không đè lên nhau.

- Không dùng API không chính thức, không tự gửi tin, không đọc nội dung chat.
- Không máy chủ, không telemetry, mọi dữ liệu nằm trên máy bạn.
- Tên và icon không dùng thương hiệu Zalo.

## Cài đặt

Tải từ thư mục `dist/` sau khi build (hoặc từ trang Releases nếu có):

| Tệp | Dùng khi |
|---|---|
| `DuoChat Setup x.y.z.exe` | Cài đặt thông thường, có thể chọn thư mục cài |
| `DuoChat x.y.z.exe` | Bản portable, chạy thẳng không cần cài |

Yêu cầu: Windows 10/11 x64.

> **Cảnh báo SmartScreen:** file `.exe` hiện **chưa được ký số**, nên lần đầu Windows có thể hiện "Windows protected
> your PC". Chọn **More info → Run anyway**. Việc ký số nằm trong danh sách việc sau MVP.

## Cách dùng

1. Bấm **+** ở thanh bên, đặt tên và chọn màu, rồi **quét mã QR** bằng Zalo trên điện thoại để đăng nhập.
2. Lặp lại cho tài khoản thứ hai, thứ ba…
3. Bấm avatar để chuyển tài khoản. Bấm **⇆** để chia đôi màn hình, kéo thanh giữa để chỉnh tỉ lệ
   (nhấp đúp để về 50/50).
4. Bấm chuột phải lên avatar để đổi tên, đổi màu, tắt thông báo, đăng xuất nhanh, hoặc xóa tài khoản.
   Kéo thả avatar để sắp xếp.

### Phím tắt

| Phím | Tác dụng |
|---|---|
| `Ctrl+1` … `Ctrl+9` | Chọn tài khoản theo thứ tự (vào pane đang focus) |
| `Ctrl+\` | Bật/tắt chia đôi |
| `Ctrl+Tab` | Chuyển focus giữa hai pane (chia đôi) hoặc sang tài khoản kế tiếp (chế độ đơn) |
| `Ctrl` `+` / `-` / `0` | Phóng to / thu nhỏ / về 100% (áp cho mọi tài khoản) |
| `Ctrl+R`, `F5` | Tải lại tài khoản đang focus |
| `Ctrl+Shift+I` | DevTools, chỉ ở bản dev |

Các phím khác đi thẳng vào Zalo.

### Thông báo, badge, khay hệ thống

- Thông báo hiện dạng `[Tên tài khoản] tiêu đề`; bấm vào sẽ mở đúng tài khoản. Tài khoản đã tắt thông báo hoặc đang
  hiển thị (khi cửa sổ đang focus) thì không hiện toast, nhưng số chưa đọc vẫn được đếm.
- Số chưa đọc hiện trên avatar, trên icon taskbar và trong tooltip khay hệ thống.
- Bấm X chỉ ẩn xuống khay (có thể tắt trong Cài đặt). Chọn **Thoát** ở menu khay để thoát thật.

## Giới hạn đã biết

- **Có thể phải quét lại QR sau khi tắt app.** Nếu Zalo Web dùng cookie phiên (không có hạn), phiên có thể mất khi
  thoát. DuoChat ghi dữ liệu ra đĩa trước khi thoát và **không** sao chép cookie hay giả lập để vượt cơ chế của Zalo.
  Tình trạng thực tế cần xác nhận bằng cách đăng nhập thật (xem `docs/spike-windows.md`).
- Mỗi tài khoản tốn khoảng 200–400 MB RAM. Giới hạn mềm là 6 tài khoản; thêm tài khoản thứ 7 chỉ bị cảnh báo.
- Màn hình hẹp: mỗi pane nên rộng từ 700px, nếu không Zalo Web có thể bị chật.
- Gọi thoại/video trên Zalo Web chưa được kiểm tra.
- Số chưa đọc đọc từ tiêu đề trang; nếu Zalo không đưa số vào tiêu đề thì DuoChat đếm số thông báo kể từ lần cuối
  bạn xem tài khoản đó.

## Phát triển

```
npm install
npm run dev         # chạy dev + HMR
npm run test        # vitest (logic thuần)
npm run lint
npm run typecheck
npm run build:win   # → dist/ (nsis + portable, x64)
npm run icons       # sinh lại icon trong resources/
npm run e2e         # kiểm thử tự động bản đã build (cần mạng)
npm run e2e:keys    # kiểm thử phím/chuột thật (cần desktop mở khóa, xem scripts/e2e-keys.mjs)
```

> Nếu chạy `electron` từ terminal của VS Code mà báo `Cannot read properties of undefined (reading 'whenReady')`,
> hãy bỏ biến môi trường `ELECTRON_RUN_AS_NODE` (`unset ELECTRON_RUN_AS_NODE`) trước.

Cấu trúc thư mục và các quyết định thiết kế nằm trong [CLAUDE.md](CLAUDE.md). Dữ liệu người dùng nằm trong
`%APPDATA%\DuoChat` (cấu hình `settings.json`, các thư mục `Partitions\acc-<id>`).
