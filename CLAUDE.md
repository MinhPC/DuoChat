# CLAUDE.md — DuoChat: App đăng nhập nhiều tài khoản Zalo trên một máy

> Tên dự án tạm: **DuoChat**. Không dùng chữ "Zalo" trong tên app và icon để tránh vấn đề thương hiệu.
> Tài liệu này là đặc tả cho Claude Code. Đọc hết trước khi code. Làm đúng thứ tự ở mục 7 và **dừng lại ở các điểm kiểm tra (⛔)** để báo cáo.
> Phiên bản spec: **v2** (2026-10-22). Đã thêm: split view vào MVP, chặn và định tuyến thông báo, chống throttle view nền, phím tắt, menu chuột phải, rủi ro mất phiên.

---

## 1. Mục tiêu

Zalo PC chỉ cho đăng nhập 1 tài khoản trên một máy. DuoChat là app vỏ bọc hiển thị **Zalo Web chính thức (https://chat.zalo.me)** trong nhiều WebView. Mỗi WebView có **vùng lưu trữ riêng** (cookie, localStorage, IndexedDB, cache), nên mỗi WebView giữ một phiên đăng nhập riêng.

- **Giai đoạn 1:** App Windows. Ưu tiên số một, phải dùng được hằng ngày.
- **Giai đoạn 2:** App mobile, Android trước rồi đến iOS. Rủi ro kỹ thuật cao nên phải spike trước.

### Nguyên tắc bắt buộc
1. **Chỉ dùng Zalo Web chính thức.** KHÔNG reverse-engineer API. KHÔNG dùng thư viện API Zalo không chính thức (zca-js…). KHÔNG tự động gửi tin, KHÔNG scrape nội dung chat. App chỉ là một trình duyệt chuyên dụng.
2. **Local-first:** không server, không telemetry, không gửi dữ liệu ra ngoài.
3. Chỉ can thiệp vào trang ở mức tối thiểu ghi trong mục 4.

### Ngoài phạm vi
- Gom các mạng khác (Messenger, Telegram…). Tuy vậy kiến trúc nên để ngỏ: một "service" = URL + tên + icon + danh sách domain cho phép.
- Đồng bộ cấu hình giữa các máy.
- Bot, tự động trả lời.

---

## 2. Giai đoạn 1 — App Windows

### 2.1 Stack
- **Electron** bản stable mới nhất (≥ 30, vì cần `WebContentsView` và `View.setVisible`) + **TypeScript** (`strict: true`).
- UI vỏ (sidebar, settings, dialog): **React + Vite**, scaffold bằng `electron-vite`.
- Đóng gói: **electron-builder**, target `nsis` (installer) + `portable`, kiến trúc x64.
- Cấu hình: file JSON trong `app.getPath('userData')`, có `schemaVersion` và hàm migrate. Ghi file kiểu atomic (ghi file tạm rồi rename).
- Test: **Vitest** cho logic thuần (store, parser unread, tính layout). Lint: ESLint + Prettier.

> Lý do chọn Electron thay vì Tauri: `partition: 'persist:<id>'` cho từng view đã ổn định, có sẵn Notification, `setWindowOpenHandler`, `will-download`, `before-input-event`. Multi-webview của Tauri v2 vẫn đang unstable. Bản cài nặng hơn là chấp nhận được.

### 2.2 Kiến trúc

```
Chế độ ĐƠN                                  Chế độ CHIA ĐÔI
┌──────┬──────────────────────────┐        ┌──────┬────────────┬┬────────────┐
│ [A]3 │                          │        │ [A]3 │  View A    ││  View B    │
│ [B]  │  View đang active        │        │ [B]1 │  (trái)    ││  (phải)    │
│ [C]  │                          │        │ [+]  │            ││            │
│ [+]  │  (view khác: sống, ẩn)   │        │ [⇆]  │ ◀focus     ││            │
│ [⚙]  │                          │        │ [⚙]  │            ││ ← thanh kéo│
└──────┴──────────────────────────┘        └──────┴────────────┴┴────────────┘
```

- **Main process** giữ `AccountManager`, mỗi account có một `WebContentsView`. KHÔNG dùng `BrowserView` (đã deprecated).
- **Sidebar** là `WebContentsView` (hoặc `webContents` của chính BrowserWindow) chạy trang React của app. Giao tiếp với main qua `contextBridge` + `ipcRenderer.invoke`, theo các contract có kiểu khai báo trong `src/shared/ipc.ts`.
- **Tất cả view đều sống liên tục.** Không destroy khi đổi tab, để tiếp tục nhận tin và thông báo. Ẩn/hiện bằng `view.setVisible()` và `setBounds()`.
- **`backgroundThrottling: false`** cho mọi view Zalo. Nếu để mặc định, Chromium sẽ throttle timer và websocket của view bị ẩn, dẫn tới tin và thông báo bị trễ. Đây là điểm bắt buộc.
- **Layout engine** (`layout.ts`) là hàm thuần: nhận vào kích thước cửa sổ, chế độ, tỉ lệ chia, độ rộng sidebar và trả về bounds của từng view. Có unit test.
- Mỗi account có `id` (UUID) cố định, partition là `persist:acc-<id>`. **Không bao giờ dùng lại id hoặc partition của account đã xóa.**
- Giới hạn mềm **6 account**. Mỗi view tốn khoảng 200–400 MB RAM. Khi thêm account thứ 7 thì cảnh báo nhưng không chặn.

### 2.3 Cấu trúc thư mục

```
duochat/
├─ CLAUDE.md
├─ package.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ docs/
│  ├─ spike-windows.md       # kết quả bước 0
│  └─ spike-mobile.md
├─ src/
│  ├─ main/
│  │  ├─ index.ts            # lifecycle, single-instance, AppUserModelId
│  │  ├─ window.ts           # BrowserWindow, lưu/khôi phục vị trí
│  │  ├─ accounts.ts         # AccountManager: tạo/xóa/ẩn/hiện view
│  │  ├─ layout.ts           # tính bounds (hàm thuần)
│  │  ├─ store.ts            # config JSON + migrate
│  │  ├─ service.ts          # định nghĩa service Zalo: URL, domain allowlist, UA
│  │  ├─ permissions.ts      # permission request/check handler
│  │  ├─ notifications.ts    # nhận thông báo từ view → Electron Notification
│  │  ├─ unread.ts           # parser title → số chưa đọc (hàm thuần)
│  │  ├─ badge.ts            # tray + overlay icon taskbar
│  │  ├─ tray.ts
│  │  ├─ shortcuts.ts        # before-input-event cho mọi webContents
│  │  ├─ contextMenu.ts      # menu chuột phải cho view Zalo
│  │  ├─ links.ts            # window.open / will-navigate
│  │  ├─ downloads.ts        # will-download
│  │  ├─ cleanup.ts          # xóa thư mục partition mồ côi khi khởi động
│  │  └─ ipc.ts
│  ├─ preload/
│  │  ├─ shell.ts            # preload sidebar
│  │  └─ service.ts          # preload view Zalo: chỉ expose cầu nối thông báo
│  ├─ inject/
│  │  └─ notification-shim.js# script chạy trong main world của trang (mục 4)
│  ├─ renderer/
│  │  ├─ App.tsx
│  │  ├─ components/         # Sidebar, AccountItem, AddAccountDialog, Settings
│  │  ├─ i18n/vi.ts          # toàn bộ chuỗi giao diện tiếng Việt
│  │  └─ styles/
│  └─ shared/
│     ├─ types.ts
│     └─ ipc.ts              # contract IPC có kiểu
├─ resources/                # icon app, icon tray, icon badge
└─ tests/
```

### 2.4 Mô hình dữ liệu

```ts
// src/shared/types.ts
export interface Account {
  id: string;            // uuid, cũng là hậu tố partition
  name: string;          // vd "Cá nhân", "Công ty"
  color: string;         // màu avatar sidebar (chọn từ palette 8 màu)
  order: number;
  muted: boolean;        // tắt thông báo (badge vẫn đếm)
  createdAt: string;     // ISO
}

export type LayoutMode = 'single' | 'split';

export interface Settings {
  schemaVersion: 2;
  accounts: Account[];
  layout: {
    mode: LayoutMode;
    activeAccountId: string | null;   // chế độ đơn
    leftAccountId: string | null;     // chế độ chia đôi
    rightAccountId: string | null;
    splitRatio: number;               // 0.3–0.7, mặc định 0.5
    focusedPane: 'left' | 'right';
  };
  startWithWindows: boolean;
  startMinimized: boolean;            // khi tự khởi động cùng Windows
  minimizeToTray: boolean;            // bấm X → ẩn xuống tray
  zoomFactor: number;                 // 0.5–2.0, áp cho mọi view Zalo
  window: { x?: number; y?: number; width: number; height: number; maximized: boolean };
}
```

Quy tắc toàn vẹn (kiểm tra mỗi lần load và mỗi lần sửa config):
- `leftAccountId !== rightAccountId`. Nếu chỉ có 1 account thì không cho bật split.
- id tham chiếu tới account đã xóa thì gán lại account đầu tiên hợp lệ, hoặc `null`.
- Migrate từ `schemaVersion` cũ hơn phải có test.

### 2.5 Tính năng MVP (bắt buộc, làm theo nhóm ở mục 7)

**Quản lý account**
1. **Thêm account:** bấm `+`, nhập tên, chọn màu, tạo view, load chat.zalo.me. Người dùng tự đăng nhập bằng cách quét QR bằng điện thoại.
2. **Đổi tên / đổi màu / kéo thả sắp xếp / bật-tắt muted** (menu chuột phải trên avatar sidebar).
3. **Đăng xuất nhanh** (giữ account): `clearStorageData()` + `clearCache()` của partition, sau đó reload.
4. **Xóa account:** hỏi xác nhận, destroy view, `clearStorageData()` + `clearCache()`, bỏ khỏi config, ghi id vào danh sách `pendingPartitionCleanup`. Lần khởi động sau, `cleanup.ts` xóa hẳn thư mục `userData/Partitions/acc-<id>` (Windows có thể khóa file khi app đang chạy nên phải xóa ở lần sau).
5. **Giữ phiên đăng nhập** sau khi tắt/mở lại app. Trước khi thoát gọi `session.flushStorageData()` cho mọi partition (xem rủi ro R1).

**Hiển thị**
6. **Chế độ đơn:** sidebar + 1 view chiếm phần còn lại. Click avatar để chuyển account.
7. **Chế độ chia đôi:** 2 view trái/phải, có **thanh kéo** để chỉnh `splitRatio` (giới hạn 0.3–0.7, double-click để về 0.5).
   - Nút `⇆` trên sidebar để bật/tắt split. Khi bật lần đầu: trái là account đang active, phải là account kế tiếp.
   - Ở chế độ split, click avatar sẽ đưa account đó vào **pane đang focus**. Nếu account đó đang nằm ở pane kia thì hai pane đổi chỗ cho nhau.
   - Pane đang focus có viền màu mảnh (vẽ bằng một view hoặc layer phía sau, không inject CSS vào Zalo). Focus đổi khi người dùng click vào view (`webContents.on('focus')`).
   - Các account không nằm trên màn hình vẫn sống và ẩn.
   - Nếu chiều rộng mỗi pane < 700px thì hiện cảnh báo nhẹ một lần ("Màn hình hẹp, Zalo Web có thể bị chật").
8. **Zoom** `Ctrl + / - / 0` cho view đang focus, lưu chung `zoomFactor`. **Reload** `Ctrl+R` / `F5`.

**Phím tắt** (xử lý bằng `before-input-event` trên **mọi** webContents, gồm sidebar và các view Zalo, vì khi focus nằm trong view Zalo thì sidebar không nhận được phím)
9. `Ctrl+1..9`: chọn account theo thứ tự (vào pane đang focus). `Ctrl+\`: bật/tắt split. `Ctrl+Tab`: chuyển focus giữa hai pane khi split, hoặc sang account kế tiếp khi ở chế độ đơn. `Ctrl+Shift+I`: mở DevTools cho view đang focus, chỉ trong bản dev.
   - Chỉ chặn đúng các tổ hợp trên. Các phím khác phải đi tiếp vào Zalo bình thường.

**Tin chưa đọc & thông báo**
10. **Badge:** số chưa đọc từng account hiện trên avatar sidebar. Tổng số hiện trên tray tooltip/icon và overlay icon taskbar (`win.setOverlayIcon`, ảnh tạo sẵn cho 1–9 và "9+"). Nguồn: `page-title-updated` → `unread.ts` parse. Format title thực tế lấy từ kết quả bước 0. Nếu title không có số thì fallback: đếm số thông báo nhận được kể từ lần cuối account được focus.
11. **Thông báo desktop:** chặn Web Notification của trang (mục 4), rồi main hiển thị `new Notification()` của Electron:
    - Tiêu đề: `[<tên account>] <tiêu đề gốc>`. Nội dung giữ nguyên. Icon lấy từ trang nếu có.
    - Click: hiện và focus cửa sổ, đưa account đó lên màn hình (vào pane đang focus nếu split, trừ khi account đã nằm sẵn ở pane kia).
    - Account `muted` thì không hiện thông báo, badge vẫn đếm.
    - Không hiện thông báo nếu account đang hiển thị **và** cửa sổ đang focus.
    - Bắt buộc gọi `app.setAppUserModelId('vn.duochat.app')` khi khởi động, nếu không toast Windows có thể không hiện hoặc click không hoạt động.

**Tích hợp hệ thống**
12. **Tray:** chuột trái để hiện/ẩn cửa sổ. Menu chuột phải gồm Mở, danh sách account (click để mở account đó), Thoát. `minimizeToTray`: bấm X chỉ ẩn cửa sổ. "Thoát" thật thì set cờ `isQuitting` rồi mới `app.quit()`.
13. **Khởi động cùng Windows:** `app.setLoginItemSettings({ openAtLogin, args: ['--hidden'] })`. Khi có `--hidden` và `startMinimized` thì chỉ hiện tray.
14. **Single instance:** `app.requestSingleInstanceLock()`. Lần mở thứ hai sẽ focus cửa sổ cũ.
15. **Link ngoài:** `setWindowOpenHandler` + `will-navigate`. URL không thuộc allowlist Zalo thì mở bằng `shell.openExternal` (chỉ với `http/https`) và chặn trong app. URL thuộc allowlist mà cần popup thì mở cửa sổ con dùng **cùng partition**.
16. **Tải file:** `will-download` trên session của từng partition. Hiện hộp thoại Save As, mặc định thư mục Downloads. Xong thì hiện thông báo nhỏ, click để mở thư mục.
17. **Menu chuột phải trong view Zalo** (Electron không có sẵn): Cắt / Sao chép / Dán / Chọn tất cả; với ảnh có "Sao chép ảnh", "Lưu ảnh"; với link có "Sao chép liên kết", "Mở trong trình duyệt". Có thể dùng `electron-context-menu` hoặc tự viết bằng sự kiện `context-menu`.
18. **Spellcheck:** tắt (`spellcheck: false`) để không bị gạch đỏ tiếng Việt.
19. **Kéo-thả và dán ảnh/file** vào khung chat phải hoạt động (Chromium mặc định đã hỗ trợ, chỉ cần kiểm tra lại).

### 2.6 Sau MVP
- Khóa app bằng PIN (chỉ khóa UI, nói rõ là không mã hóa dữ liệu).
- "Không làm phiền" theo khung giờ cho từng account.
- Split dọc (trên/dưới), hoặc 3 pane cho màn hình siêu rộng.
- Tự cập nhật (electron-updater + GitHub Releases).
- Ký số file `.exe`. Chưa ký thì Windows SmartScreen sẽ cảnh báo lần đầu; ghi chú điều này trong README.

### 2.7 Bảo mật & cấu hình WebView
- `webPreferences` cho view Zalo: `partition: 'persist:acc-<id>'`, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `backgroundThrottling: false`, `spellcheck: false`, `preload: service.js`.
- Preload `service.ts` chỉ expose **đúng một** hàm qua `contextBridge.exposeInMainWorld('__duochat', { notify(payload) })`. Payload được validate kiểu và giới hạn độ dài ở main. Không expose Node, `ipcRenderer` hay bất kỳ thứ gì khác.
- **Allowlist domain** khai báo một chỗ duy nhất trong `service.ts`. Danh sách lấy từ tab Network ở bước 0, **không đoán**. Dự kiến gồm `*.zalo.me`, `*.zadn.vn` và các domain khác tìm thấy.
- **Permission:** `setPermissionRequestHandler` + `setPermissionCheckHandler` trên từng session. Chỉ cấp `notifications`, `media`, `clipboard-sanitized-write`, `fullscreen` cho origin trong allowlist. Mọi quyền khác bị từ chối.
- **User-Agent:** mặc định dùng UA của Electron đã **bỏ đoạn `Electron/x.y` và tên app**, để giống Chrome cùng phiên bản Chromium. Đặt qua `session.setUserAgent`. Ghi lý do trong comment.
- Không log nội dung trang, tin nhắn, cookie. Log app (main) chỉ ghi sự kiện kỹ thuật.
- Trong bản production không mở DevTools.

### 2.8 Rủi ro đã biết

| # | Rủi ro | Cách xử lý |
|---|---|---|
| R1 | Zalo Web dùng **session cookie** (không có hạn) nên mất đăng nhập khi tắt app | Bước 0 kiểm tra. Nếu bị: thử `flushStorageData()` trước khi thoát. Nếu vẫn mất thì chấp nhận đăng nhập lại bằng QR, ghi vào README và báo lại. **Không** tự chép cookie hay giả lập để vượt qua cơ chế của Zalo. |
| R2 | Zalo phát hiện client lạ, chặn hoặc giới hạn | Dùng UA giống Chrome (2.7). Nếu vẫn bị chặn thì dừng, báo lại. |
| R3 | Title không chứa số chưa đọc | Fallback đếm thông báo (mục 10). |
| R4 | Shim thông báo không hoạt động (trang giữ tham chiếu `Notification` gốc, CSP…) | Fallback: để Electron tự hiện thông báo gốc của trang (không có tên account, click không chuyển account). Ghi lại trong spike. |
| R5 | Gọi thoại/video trên Zalo Web không hoạt động | Kiểm tra ở bước 0. Không phải mục tiêu của MVP, chỉ ghi lại kết quả. |
| R6 | RAM cao khi nhiều account | Giới hạn mềm 6 account. Ghi số đo RAM thực tế vào spike. |

### 2.9 Bước 0 — Spike Windows ⛔
Prototype tối thiểu: 2 `WebContentsView` cố định đặt cạnh nhau, 2 partition, `backgroundThrottling: false`. Xác nhận các điểm sau và ghi vào `docs/spike-windows.md`:
- [ ] Hai tài khoản khác nhau đăng nhập cùng lúc, không đá nhau.
- [ ] Tắt hẳn app rồi mở lại vẫn còn đăng nhập (R1). Ghi lại cookie quan trọng là persistent hay session (chỉ ghi tên và loại, **không ghi giá trị**).
- [ ] Thông báo hiện ra từ cả hai view, kể cả view đang bị ẩn (`setVisible(false)`) trong 10 phút.
- [ ] Format `document.title` khi có và không có tin chưa đọc.
- [ ] Shim thông báo (mục 4) bắt được thông báo (R4).
- [ ] Danh sách domain trong tab Network.
- [ ] Gửi/nhận ảnh, file, dán ảnh từ clipboard, kéo thả file, tải file về.
- [ ] Gọi thoại/video (R5).
- [ ] RAM của mỗi view sau 30 phút.

**Dừng lại và báo cáo trước khi làm tiếp.**

### 2.10 Tiêu chí hoàn thành giai đoạn 1
- File `.exe` cài được và portable chạy được trên Windows 10/11 x64 sạch.
- Dùng thật 2+ account song song trong 1 tuần: không mất tin, thông báo đúng account, click thông báo mở đúng account.
- Split view hoạt động ổn khi resize, maximize, kéo thanh chia, đổi màn hình có DPI khác nhau.
- Xóa account thì sau lần khởi động kế tiếp không còn thư mục `Partitions/acc-<id>`.
- Unit test pass cho `layout`, `unread`, `store` (bao gồm migrate).
- README có hướng dẫn cài, giới hạn đã biết, ghi chú SmartScreen.

---

## 3. Giai đoạn 2 — App mobile

### 3.1 Bối cảnh & rủi ro (ĐỌC KỸ)
1. **Tách storage cho WebView:**
   - **Android:** WebView mặc định dùng chung storage cho cả process. `setDataDirectorySuffix` chỉ đặt được một lần mỗi process. Có hai hướng:
     - (a) **AndroidX WebKit Profile API** (`androidx.webkit`: `ProfileStore`, `WebViewCompat.setProfile`). Nhiều profile trong một process, cần WebView đủ mới. Kiểm tra bằng `WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)`.
     - (b) Mỗi account một process (`android:process=":accN"` cho Activity riêng) + `setDataDirectorySuffix`. Số account bị giới hạn bởi số Activity khai báo sẵn (vd 5).
   - **iOS:** `WKWebsiteDataStore(forIdentifier:)` cho data store persistent riêng, **chỉ có từ iOS 17+**.
2. **Zalo Web trên WebView mobile** có thể chuyển hướng sang trang tải app. Nhiều khả năng phải dùng UA desktop, và giao diện desktop trên màn hình nhỏ có thể khó dùng. Phù hợp hơn với tablet hoặc chế độ ngang.
3. **Đăng nhập QR trên chính máy đó:** không thể dùng camera điện thoại quét màn hình của chính nó. Cần kiểm tra: app Zalo có quét QR từ ảnh trong thư viện được không; Zalo Web còn cho đăng nhập bằng số điện thoại/mật khẩu không; hoặc phải dùng một điện thoại khác.
4. **Không có push thật:** WebView không chạy khi app bị kill. Android có thể giữ bằng foreground service (tốn pin). iOS gần như không làm được. Phải nói rõ hạn chế này với người dùng.
5. Nhiều máy Android đã có sẵn **Dual Apps / Dual Messenger** (Samsung, Xiaomi, Oppo…). README phải gợi ý dùng tính năng đó trước.

**Giai đoạn 2 chỉ tiếp tục nếu spike 3.3 cho kết quả "dùng được".** Nếu không, dừng và ghi lý do vào `docs/spike-mobile.md`.

### 3.2 Stack mobile
- **Flutter** cho giao diện vỏ (danh sách account, settings).
- WebView: trước hết kiểm tra `flutter_inappwebview` bản mới nhất xem đã hỗ trợ multi-profile (Android) và `WKWebsiteDataStore(forIdentifier:)` (iOS) chưa. Nếu chưa thì viết **platform view native** (Kotlin/Swift) qua platform channel.
- Cấu hình dùng chung schema `Account` với Windows. `layout` trên mobile chỉ có `single` (tablet ngang có thể bật `split` ở bản sau).
- Port logic `unread` sang Dart và tái sử dụng bộ test case (đưa test case vào file JSON dùng chung `tests/fixtures/titles.json`).

### 3.3 Spike mobile (Android, Kotlin native, chưa cần Flutter) ⛔
- [ ] Máy test có hỗ trợ `MULTI_PROFILE` không (ghi phiên bản Android System WebView).
- [ ] 2 profile đăng nhập 2 tài khoản khác nhau, không đá nhau, còn phiên sau khi khởi động lại app.
- [ ] UA nào cho giao diện Zalo Web dùng được.
- [ ] Cách đăng nhập nào khả thi khi chạy trên chính máy đó (3.1.3).
- [ ] Để app ở nền 30 phút có foreground service: còn nhận tin không, hao bao nhiêu % pin.
- [ ] Nếu (a) không hỗ trợ: thử hướng (b) multi-process.

**Dừng lại và báo cáo, chờ quyết định trước khi làm Flutter.**

### 3.4 Tính năng mobile (nếu spike đạt)
- Danh sách account dạng drawer hoặc tab dưới. Tối đa 3 WebView sống đồng thời. View cũ nhất sẽ được giải phóng và reload khi mở lại.
- Badge từ title, thông báo local khi số chưa đọc tăng (chỉ khi app còn sống).
- Upload file (`onShowFileChooser` / `WKUIDelegate`), tải file về máy, link ngoài mở bằng trình duyệt hệ thống.
- Xóa account thì xóa profile hoặc data store tương ứng.

---

## 4. Can thiệp tối thiểu vào trang (cả hai nền tảng)

Chỉ được phép làm hai việc sau:
1. **Đọc `document.title`** từ phía app (qua sự kiện `page-title-updated`, không inject gì).
2. **Shim thông báo** `src/inject/notification-shim.js`:
   - Main gọi `webContents.executeJavaScript(shim)` ở sự kiện `dom-ready` (chạy trong main world, không bị CSP chặn như thẻ `<script>`).
   - Shim thay `window.Notification` bằng một class tương thích: `permission` luôn là `'granted'`, `requestPermission()` resolve `'granted'`, constructor gọi `window.__duochat.notify({ title, body, icon, tag })` và **không** tạo thông báo gốc. Trả về object có `close()`, `onclick` để không làm trang lỗi.
   - Shim phải idempotent (chạy lại khi reload không bị lỗi) và được bọc trong `try/catch`.
   - Trên mobile, cầu nối là JS bridge của WebView (`addJavascriptInterface` / `WKScriptMessageHandler`), cùng API `notify`.

Không đọc DOM tin nhắn, không gửi tin, không sửa CSS hay giao diện Zalo.

---

## 5. Quy ước code
- TypeScript `strict: true`. Không dùng `any` trừ khi có comment giải thích.
- Mọi IPC khai báo trong `src/shared/ipc.ts` (tên kênh + kiểu input/output). Component React không gọi `ipcRenderer` trực tiếp mà đi qua API do preload expose.
- Logic thuần (layout, unread, store/migrate) không import `electron`, để test được bằng Vitest.
- Chuỗi giao diện tiếng Việt, gom hết vào `src/renderer/i18n/vi.ts`. Thông báo trong main lấy từ cùng file (đặt ở `src/shared/i18n`, nếu cần thì chuyển file).
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`). Mỗi nhóm ở mục 7 có thể chia thành nhiều commit nhỏ.
- Không thêm dependency nặng nếu không cần. Mỗi dependency mới phải ghi lý do trong commit message.

## 6. Lệnh (giai đoạn 1)
```
npm install
npm run dev         # dev + HMR
npm run test        # vitest
npm run lint
npm run typecheck
npm run build:win   # electron-builder → dist/ (nsis + portable, x64)
```

## 7. Thứ tự làm việc cho Claude Code
1. Scaffold electron-vite + React + TS, thiết lập lint/test/typecheck. Làm **spike 2.9**, ghi `docs/spike-windows.md`. ⛔ **Dừng, báo cáo.**
2. `store` + migrate + test; `layout` + test; `unread` + test (fixture lấy từ kết quả spike).
3. AccountManager, sidebar, chế độ đơn, thêm/sửa/xóa/đăng xuất account, cleanup partition (MVP 1–6).
4. Chế độ chia đôi + thanh kéo + focus pane (MVP 7), zoom/reload (8), phím tắt (9).
5. Badge (10), shim + thông báo (11), tray (12), khởi động cùng Windows (13), single instance (14).
6. Link ngoài (15), download (16), menu chuột phải (17), spellcheck (18), kiểm tra kéo thả/dán (19), permission handler.
7. Đóng gói, test trên máy sạch, viết README. Đối chiếu tiêu chí 2.10.
8. Giai đoạn 2: **spike Android 3.3**, ghi `docs/spike-mobile.md`. ⛔ **Dừng, báo cáo.**
