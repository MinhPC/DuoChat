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

- Thông báo là thẻ nhỏ riêng của DuoChat ở góc dưới-phải màn hình (không cướp focus): avatar màu và tên tài khoản, số tin mới.
  Nhiều tin cùng tài khoản được gom vào một thẻ; bấm thẻ để mở đúng tài khoản, rê chuột vào để giữ thẻ lại.
- **Mặc định ẩn nội dung tin** (chỉ hiện "Có tin nhắn mới"); bật "Hiện nội dung tin nhắn trong thông báo" trong Cài đặt nếu muốn.
- **Không làm phiền:** chuột phải avatar → Không làm phiền… để đặt khung giờ (có thể qua nửa đêm, vd 22:00 → 07:00). Trong khung giờ này không hiện thẻ thông báo, số chưa đọc vẫn đếm.
- Âm báo chọn theo từng tài khoản (chuột phải avatar → Âm báo: Mặc định / Nhẹ / Không âm).
- Tài khoản đã tắt thông báo hoặc đang hiển thị (khi cửa sổ đang focus) thì không hiện thẻ, nhưng số chưa đọc vẫn được đếm.
- Số chưa đọc hiện trên avatar, trên icon taskbar và trong tooltip khay hệ thống.
- Bấm X chỉ ẩn xuống khay (có thể tắt trong Cài đặt). Chọn **Thoát** ở menu khay để thoát thật.

### Khóa ứng dụng bằng PIN

Bật trong Cài đặt (PIN 4–8 chữ số, có thể tự khóa khi máy không thao tác 1–30 phút hoặc khi Windows bị khóa; nút 🔒 ở thanh bên để khóa ngay). Khi khóa, các khung Zalo bị ẩn và thẻ thông báo không hiện nội dung. Nhập sai từ lần thứ 6 sẽ phải chờ (1s, 2s, 4s … tối đa 30s). PIN được lưu dạng băm scrypt có salt, không lưu dạng rõ.

> **PIN chỉ khóa giao diện, KHÔNG mã hóa dữ liệu.** Người có quyền truy cập ổ đĩa vẫn đọc được dữ liệu đăng nhập trong `%APPDATA%\DuoChat`.

### Phiên đăng nhập

Phiên Zalo được giữ sau khi tắt app (đã kiểm chứng: cookie xác thực là persistent). Khi Zalo bắt đăng nhập lại (hết hạn phía máy chủ), avatar hiện dấu **!** màu cam và có thẻ báo "Cần đăng nhập lại"; chỉ cần quét lại mã QR.

### Bộ nhớ và cập nhật

Cài đặt hiển thị RAM của từng tài khoản (làm mới mỗi 3 giây). Nội dung tin trong thông báo có thể đặt riêng từng tài
khoản (chuột phải avatar → Nội dung tin trong thông báo).

**Tự cập nhật mặc định tắt** vì DuoChat cam kết không gửi dữ liệu ra ngoài. Bật trong Cài đặt thì app kiểm tra GitHub
Releases (`MinhPC/DuoChat`) mỗi 6 giờ, chỉ tải file `latest.yml`. Chỉ áp dụng cho bản cài đặt, không áp dụng cho bản
portable. Phát hành: đẩy tag `vX.Y.Z` (khớp `version` trong `package.json`), workflow `release.yml` sẽ build và đăng lên GitHub Releases. Bản chưa ký số: bản cập nhật chỉ được tin dựa trên tài khoản GitHub của chủ repo, nên cân nhắc ký số trước khi khuyến khích người dùng bật tự cập nhật.

### Nhật ký lỗi

`%APPDATA%\DuoChat\logs\duochat.log` (xoay vòng ở 1 MB) chỉ ghi sự kiện kỹ thuật như khởi động, lỗi tải trang, khóa/mở khóa. Không bao giờ ghi nội dung tin nhắn, cookie hay PIN; không gửi đi đâu.

## Giới hạn đã biết

- DuoChat **không** sao chép cookie hay giả lập để vượt cơ chế của Zalo. Nếu Zalo hết hạn phiên thì phải quét lại QR.
- Mỗi tài khoản tốn khoảng 200–400 MB RAM. Giới hạn mềm là 6 tài khoản; thêm tài khoản thứ 7 chỉ bị cảnh báo.
- Màn hình hẹp: mỗi pane nên rộng từ 700px, nếu không Zalo Web có thể bị chật.
- Gọi thoại/video trên Zalo Web chưa được kiểm tra.
- Số chưa đọc đọc từ tiêu đề trang; nếu Zalo không đưa số vào tiêu đề thì DuoChat đếm số thông báo kể từ lần cuối
  bạn xem tài khoản đó.

## Mobile

Chỉ có kế hoạch cho **iOS** (Android đã bỏ). Trên iPhone, Zalo gốc đã có "Chuyển tài khoản", nên phương án giống Zalo gốc nhất là dùng chính tính năng đó; DuoChat iOS (nếu làm) hướng tới iPad và **không có thông báo khi app ở nền**. Phân tích phương án và checklist thử nghiệm: [docs/spike-mobile.md](docs/spike-mobile.md).

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
