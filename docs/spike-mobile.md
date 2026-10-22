# Spike mobile (Android, bước 3.3)

Ngày chạy: 2026-10-22. Mã: [spike/android/](../spike/android/) (Kotlin thuần, chưa dùng Flutter).
Môi trường: **emulator** Pixel_6, Android 17 (API 37, google_apis), Android System WebView **145.0.7632.45**.
**Chưa có thiết bị thật, chưa đăng nhập Zalo.** Kết quả chỉ có giá trị cho các mục ghi "Đạt/Không đạt" dưới đây.

Build: `JAVA_HOME=<Android Studio jbr> ANDROID_HOME=<sdk> gradle :app:assembleDebug` trong `spike/android`
(AGP 8.11.1, Kotlin 2.2.0, androidx.webkit 1.14.0). Chạy:
`adb shell am start -n vn.duochat.spike/.MainActivity --es mode <info|write|read|ua> [--es ua default|chrome-mobile|desktop] [--ez flush true]`,
kết quả ở `adb logcat -s DUOSPIKE:I`.

## Kết quả

| Mục 3.3 | Kết quả |
|---|---|
| Hỗ trợ `MULTI_PROFILE` | **Đạt** trên WebView 145 (`WebViewFeature.isFeatureSupported(MULTI_PROFILE)` = true). Hướng (a) Profile API khả thi; chưa cần hướng (b) multi-process. Các máy cũ/WebView cũ phải kiểm tra lúc chạy. |
| 2 profile không đá nhau | **Đạt.** `acc_a` và `acc_b` ghi cùng key `localStorage` và cookie với giá trị khác nhau (A/B), mỗi bên đọc lại đúng giá trị của mình, key riêng không lộ sang bên kia, profile mặc định không thấy gì. |
| Còn phiên sau khi khởi động lại | **Đạt có điều kiện.** `localStorage` còn sau `force-stop`. **Cookie thì mất nếu không gọi `Profile.cookieManager.flush()`**; có `flush()` thì còn đúng giá trị A/B. Bắt buộc flush từng profile ở `onPause/onStop` và sau khi đăng nhập (tương tự R1 trên Windows). |
| UA | **UA di động không dùng được**: cả UA mặc định của WebView lẫn UA Chrome mobile đều bị Zalo chuyển hướng tới `market://details?id=com.zing.zalo` → `net::ERR_UNKNOWN_URL_SCHEME`, trang trắng báo lỗi. **UA desktop (Windows Chrome) tải được** trang đăng nhập `id.zalo.me`, tiêu đề "Đăng nhập tài khoản Zalo". Với `useWideViewPort` + `loadWithOverviewMode` giao diện desktop vẫn bị tràn phải trên màn hình dọc (viewport 545×1211 CSS px, nút menu ngoài khung): hợp với lưu ý ở 3.1.2 rằng nên ưu tiên tablet/ngang. |
| Cách đăng nhập khi chạy trên chính máy đó | **Chưa kết luận.** Trang chỉ lộ phương thức quét QR (không thể quét QR của chính màn hình mình). Chưa kiểm tra: menu ☰ có đăng nhập bằng số điện thoại/mật khẩu không, và app Zalo có quét QR từ ảnh thư viện không. |
| Nền 30 phút với foreground service, hao pin | **Chưa làm** (cần đăng nhập + thiết bị thật để đo pin). |
| Hướng (b) multi-process | Không cần vì (a) đạt. |

## Kết luận tạm và đề xuất

Nền tảng kỹ thuật cho nhiều tài khoản trên Android là **khả thi** (Profile API + UA desktop), nhưng **chưa đủ điều kiện
sang Flutter** vì hai câu hỏi quyết định chưa trả lời được trên emulator:

1. Đăng nhập được trên chính máy đó bằng cách nào (menu ☰ của trang đăng nhập; QR từ thư viện ảnh).
2. Giao diện desktop có dùng được hằng ngày trên điện thoại không (nhiều khả năng chỉ hợp tablet/chế độ ngang).

Việc cần người dùng làm trên thiết bị thật: chạy lại APK trong `spike/android`, bấm ☰ ở trang đăng nhập, thử đăng nhập,
đo pin 30 phút với foreground service. **Dừng ở đây và chờ quyết định trước khi làm Flutter** (đúng điểm ⛔ của spec).
