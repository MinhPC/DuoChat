# Mobile: chỉ iOS (cập nhật 2026-10-22)

**Quyết định:** app mobile chỉ làm cho **iOS** (iPadOS ưu tiên). Android dừng; kết quả spike Android đã chạy được giữ ở
[Phụ lục A](#phụ-lục-a-spike-android-đã-dừng). Spec: [CLAUDE.md](../CLAUDE.md) mục 3.

**Trạng thái:** mới phân tích phương án, **chưa chạy spike iOS** (cần máy Mac + Xcode + iPad/iPhone iOS 17+, môi trường hiện
tại là Windows). Mọi điều ghi "theo nguồn" là từ bài viết/tài liệu, chưa kiểm chứng trên máy thật.

## 1. Điều quan trọng nhất: Zalo gốc đã hỗ trợ nhiều tài khoản trên iPhone

Zalo trên iPhone có sẵn **Cá nhân → Cài đặt → Chuyển tài khoản → Thêm tài khoản**, đăng nhập bằng số điện thoại và mật khẩu rồi
chuyển qua lại không cần đăng xuất (theo các bài hướng dẫn của [Viettel Store](https://viettelstore.vn/tin-tuc/dung-2-zalo-tren-iphone),
[CellphoneS](https://cellphones.com.vn/sforum/cach-dung-2-zalo-tren-iphone), [FPT Shop](https://fptshop.com.vn/tin-tuc/thu-thuat/cach-dang-nhap-1-zalo-tren-2-dien-thoai-iphone-182209)).
Nên **trên iPhone, phương án giống Zalo gốc nhất là dùng chính tính năng đó**. Điều chưa rõ từ các nguồn: tài khoản không đang
dùng có nhận thông báo đẩy hay không (cần thử trên máy thật).

DuoChat iOS chỉ có lý do tồn tại khi làm được điều Zalo gốc không làm: **hai tài khoản cạnh nhau trên màn hình lớn (iPad)**,
kèm cách gom thông báo/badge và ghi chú của DuoChat.

## 2. Những ràng buộc kỹ thuật trên iOS

| Vấn đề | Điều đã biết | Nguồn / trạng thái |
|---|---|---|
| Tách phiên giữa các tài khoản | `WKWebsiteDataStore(forIdentifier:)` tạo data store persistent riêng, **từ iOS 17**; phải lưu UUID để khôi phục, xóa bằng `remove(forIdentifier:)` | [WebKit blog](https://webkit.org/blog/14423/building-profiles-with-new-webkit-api/), tài liệu Apple |
| UA | UA di động bị Zalo chuyển hướng sang trang tải app (đã đo trên Android WebView: `market://details?id=com.zing.zalo`). iOS giả định tương tự; cần UA desktop | Android: đã đo. iOS: **chưa đo** |
| Bố cục | Giao diện desktop trên điện thoại dọc bị tràn (đã thấy trên Android); hợp hơn iPad hoặc chế độ ngang | Android: đã đo |
| Đăng nhập trên chính máy | QR của chính màn hình không quét được. Trang đăng nhập Zalo Web có "Với số điện thoại", có thể kèm xác minh danh bạ hoặc "Gửi yêu cầu đăng nhập" tới điện thoại | Theo các bài hướng dẫn ([ví dụ](https://viettelstore.vn/tin-tuc/huong-dan-dang-nhap-zalo-web-bang-ma-qr-va-so-dien-thoai)); **chưa kiểm chứng** |
| Thông báo khi app ở nền | WKWebView bị đóng băng ở nền, mất kết nối, **không có push thật**. Web Push (iOS 16.4+) chỉ dành cho *web app thêm vào Màn hình chính*, cần manifest, và phải do chính trang web đăng ký push | [Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications); Zalo Web có đăng ký push hay không: **chưa biết** |
| Lưu trữ web app Màn hình chính | localStorage của web app tách khỏi Safari. Việc **mỗi web app có cookie riêng** (cho phép 2 tài khoản) chưa có nguồn xác nhận | **Chưa kiểm chứng** |

## 3. Các phương án

| | Phương án | Giống Zalo gốc | Thông báo khi ở nền | Công sức | Rủi ro chính |
|---|---|---|---|---|---|
| P1 | **"Chuyển tài khoản" của Zalo gốc**, không làm app | Giống nhất (chính là Zalo gốc) | Có, do Zalo gốc xử lý | 0 | Không xem hai tài khoản cùng lúc |
| P2 | **Web app Màn hình chính**: Safari mở chat.zalo.me → "Thêm vào Màn hình chính", mỗi tài khoản một web app | Trung bình | Chỉ nếu Zalo Web đăng ký Web Push | ~0, không code | UA di động có thể bị chuyển sang App Store; phiên có tách riêng hay không |
| P3 | **DuoChat iOS**: SwiftUI + WKWebView, UA desktop, `forIdentifier:`, iPad ưu tiên | Thấp–trung bình (Zalo Web, bố cục desktop) | **Không** (chỉ khi app đang mở) | Cao nhất | Không push; bố cục desktop; Apple có thể từ chối app chỉ là vỏ web (App Review 4.2) |
| P4 | P3 + relay thông báo qua máy chủ | — | Có | — | **Loại**: cần máy chủ và đọc nội dung, vi phạm nguyên tắc local-first |

### Khuyến nghị

1. **iPhone:** dùng P1, không cần app.
2. **Thử P2 trước:** gần như miễn phí, có thể cho cả thông báo và phiên riêng. Kết quả P2 quyết định có cần P3 hay không.
3. **Chỉ làm P3 (hướng iPad)** nếu P2 không đạt và chấp nhận không có thông báo khi ở nền. Dùng SwiftUI + WKWebView native, không
   dùng Flutter (chỉ nhắm iOS nên Flutter chỉ thêm lớp cầu nối).
4. **Không làm P4.**

## 4. Checklist spike iOS (chưa thực hiện) ⛔

Cần Mac + Xcode + iPad/iPhone iOS 17+. Thứ tự: P2 → P3.

**P2: web app Màn hình chính**
- [ ] chat.zalo.me trong Safari có mở được giao diện (không bị đưa sang App Store) không; có cần "Yêu cầu trang web cho máy tính".
- [ ] Thêm 2 web app, đăng nhập 2 tài khoản khác nhau: phiên có tách riêng, còn sau khi tắt hẳn.
- [ ] Có hộp thoại xin quyền thông báo không; thử gửi tin tới tài khoản khi web app ở nền, có nhận push không.

**P3: DuoChat iOS (dự án Swift thử nghiệm)**
- [ ] 2 `WKWebsiteDataStore(forIdentifier:)`, 2 tài khoản không đá nhau; còn phiên sau khi kill app.
- [ ] UA desktop (`customUserAgent`, `WKWebpagePreferences.preferredContentMode = .desktop`): giao diện dùng được trên iPad/iPhone.
- [ ] App ở nền bao lâu thì mất kết nối; mở lại có đồng bộ đủ tin không.
- [ ] Thông báo local khi app đang mở (đọc `document.title`, cầu nối `WKScriptMessageHandler`).
- [ ] Gửi ảnh/file (`WKUIDelegate`), tải file.

**Chung**
- [ ] Đăng nhập trên chính máy: "Với số điện thoại" có dùng được không; có quét QR từ ảnh trong thư viện không.
- [ ] Zalo gốc: tài khoản không đang dùng có nhận thông báo không (để biết P1 đáng giá đến đâu).
- [ ] Liệt kê khác biệt so với Zalo gốc trên cùng máy.

**Dừng lại và báo cáo, chờ quyết định trước khi viết app.**

---

## Phụ lục A: Spike Android (đã dừng)

Ngày chạy: 2026-10-22. Mã: [spike/android/](../spike/android/) (Kotlin thuần). Môi trường: **emulator** Pixel_6, Android 17
(API 37, google_apis), Android System WebView 145.0.7632.45. **Chưa có thiết bị thật, chưa đăng nhập Zalo.** Giữ lại làm tham
khảo vì hai phát hiện (UA, bố cục) cũng gợi ý cho iOS.

Build: `JAVA_HOME=<Android Studio jbr> ANDROID_HOME=<sdk> gradle :app:assembleDebug` trong `spike/android`
(AGP 8.11.1, Kotlin 2.2.0, androidx.webkit 1.14.0). Chạy:
`adb shell am start -n vn.duochat.spike/.MainActivity --es mode <info|write|read|ua> [--es ua default|chrome-mobile|desktop] [--ez flush true]`,
kết quả ở `adb logcat -s DUOSPIKE:I`.

| Mục | Kết quả |
|---|---|
| Hỗ trợ `MULTI_PROFILE` | Đạt trên WebView 145 |
| 2 profile không đá nhau | Đạt: `localStorage` và cookie tách riêng, profile mặc định sạch |
| Còn phiên sau khi khởi động lại | `localStorage` còn; **cookie mất nếu không gọi `CookieManager.flush()`**, có flush thì còn |
| UA | **UA di động không dùng được** (cả UA WebView lẫn Chrome mobile bị chuyển tới `market://details?id=com.zing.zalo` → `ERR_UNKNOWN_URL_SCHEME`). **UA desktop tải được** trang đăng nhập; giao diện bị tràn phải trên màn hình dọc |
| Đăng nhập trên chính máy | Không kết luận: trang chỉ lộ phương thức quét QR |
| Nền 30 phút, pin | Chưa làm (cần đăng nhập + thiết bị thật) |

**Kết luận Android:** kỹ thuật khả thi (Profile API + UA desktop) nhưng đã **dừng theo quyết định chỉ làm iOS**; không phát triển tiếp.
