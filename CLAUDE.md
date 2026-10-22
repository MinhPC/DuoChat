# CLAUDE.md — DuoChat: App đăng nhập nhiều tài khoản Zalo trên một máy

> Tên dự án tạm: **DuoChat**. Không dùng chữ "Zalo" trong tên app và icon để tránh vấn đề thương hiệu.
> Tài liệu này là đặc tả cho Claude Code. Đọc hết trước khi code. Làm đúng thứ tự ở mục 7 và **dừng lại ở các điểm kiểm tra (⛔)** để báo cáo.
> Phiên bản spec: **v4** (2026-10-22). v4: cho phép đọc tên + ảnh đại diện của chính tài khoản, tự động sau khi đăng nhập hoặc khi người dùng bấm nút (mục 4.3), `schemaVersion` 3. v2 đã thêm: split view vào MVP, chặn và định tuyến thông báo, chống throttle view nền, phím tắt, menu chuột phải, rủi ro mất phiên. v3: app mobile chỉ làm cho **iOS** (bỏ Android), thêm so sánh phương án giống Zalo gốc (mục 3.2); R1 đã kiểm chứng không xảy ra.

---

## 1. Mục tiêu

Zalo PC chỉ cho đăng nhập 1 tài khoản trên một máy. DuoChat là app vỏ bọc hiển thị **Zalo Web chính thức (https://chat.zalo.me)** trong nhiều WebView. Mỗi WebView có **vùng lưu trữ riêng** (cookie, localStorage, IndexedDB, cache), nên mỗi WebView giữ một phiên đăng nhập riêng.

- **Giai đoạn 1:** App Windows. Ưu tiên số một, phải dùng được hằng ngày.
- **Giai đoạn 2:** App **iOS** (iPadOS ưu tiên); Android đã bỏ. Rủi ro kỹ thuật cao và Zalo gốc trên iPhone đã có "Chuyển tài khoản", nên phải spike và so sánh phương án trước (mục 3).

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
  avatar?: string;       // data URL PNG 96x96 lấy từ hồ sơ Zalo (mục 4.3), tùy chọn
  profileName?: string;  // tên Zalo đọc lần gần nhất (để biết tên hiện tại có phải người dùng tự đặt)
  createdAt: string;     // ISO
}

export type LayoutMode = 'single' | 'split';

export interface Settings {
  schemaVersion: 3;
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

## 3. Giai đoạn 2 — App iOS (v3: chỉ iOS, bỏ Android)

> **Quyết định (2026-10-22):** app mobile chỉ làm cho **iOS** (iPadOS ưu tiên). Android dừng; kết quả spike Android đã chạy
> được giữ ở phụ lục [docs/spike-mobile.md](docs/spike-mobile.md) để tham khảo, không phát triển tiếp.
> Chi tiết so sánh phương án và checklist spike nằm ở [docs/spike-mobile.md](docs/spike-mobile.md).

### 3.1 Bối cảnh & sự thật đã biết (ĐỌC KỸ)
1. **Zalo gốc trên iPhone đã hỗ trợ nhiều tài khoản:** Cá nhân → Cài đặt → "Chuyển tài khoản" → "Thêm tài khoản" (theo các bài
   hướng dẫn, chưa kiểm chứng trên máy thật). Vì vậy trên iPhone, phương án giống Zalo gốc nhất là **dùng chính tính năng
   này**, không cần app nào. DuoChat iOS chỉ có lý do tồn tại ở chỗ Zalo gốc không làm được: hai tài khoản **cạnh nhau trên
   màn hình lớn (iPad)**, ghi chú rõ ràng, thông báo/badge gom theo cách DuoChat.
2. **Tách storage cho WebView:** `WKWebsiteDataStore(forIdentifier:)` cho data store persistent riêng, **chỉ từ iOS 17**
   ([WebKit blog](https://webkit.org/blog/14423/building-profiles-with-new-webkit-api/)). Phải lưu lại identifier (UUID) để
   khôi phục sau khi mở lại app; xóa bằng `WKWebsiteDataStore.remove(forIdentifier:)`. **iOS tối thiểu: 17.**
3. **Zalo Web trên WebView di động** chuyển hướng sang trang tải app (đã đo trên Android WebView: UA di động bị đưa tới
   `market://details?id=com.zing.zalo`; iOS chưa đo nhưng giả định tương tự, có thể là `itms-apps://`). Phải dùng **UA
   desktop**; giao diện desktop trên điện thoại dọc bị tràn, hợp hơn với iPad hoặc chế độ ngang.
4. **Đăng nhập trên chính máy đó:** không thể dùng camera quét QR của chính màn hình. Trang đăng nhập có lựa chọn "Với số
   điện thoại" (có thể kèm bước xác minh danh bạ hoặc "Gửi yêu cầu đăng nhập" tới điện thoại, theo các bài hướng dẫn, chưa
   kiểm chứng). Cần kiểm tra khi spike.
5. **Không có push thật:** WKWebView bị hệ điều hành đóng băng khi app xuống nền, websocket đứt, không nhận tin. Web Push của
   iOS (16.4+) chỉ dành cho *web app thêm vào Màn hình chính* và chỉ hoạt động nếu chính trang web đăng ký push; Zalo Web có làm
   vậy hay không **chưa biết**. Phải nói rõ hạn chế này với người dùng; **không làm relay qua máy chủ** (vi phạm local-first).

### 3.2 Các phương án (xếp theo mức giống Zalo gốc)

| | Phương án | Giống Zalo gốc | Thông báo khi app ở nền | Công sức | Rủi ro chính |
|---|---|---|---|---|---|
| P1 | Dùng **"Chuyển tài khoản" của Zalo gốc** (không làm app) | Giống nhất (chính là Zalo gốc) | Có (do Zalo gốc xử lý; việc nhận thông báo của tài khoản không đang dùng chưa kiểm chứng) | 0 | Không xem hai tài khoản cùng lúc |
| P2 | **Web app Màn hình chính**: Safari mở chat.zalo.me → "Thêm vào Màn hình chính", mỗi tài khoản một web app | Trung bình (giao diện Zalo Web) | Chỉ nếu Zalo Web đăng ký Web Push (chưa biết) | ~0 (không code) | UA di động có thể bị chuyển sang App Store; phiên có tách riêng giữa các web app hay không (iOS 17+) cần thử |
| P3 | **DuoChat iOS** (SwiftUI + WKWebView, UA desktop, `forIdentifier:`), iPad ưu tiên | Thấp–trung bình (Zalo Web, bố cục desktop) | **Không** (chỉ khi app đang mở) | Cao nhất | Không push; bố cục desktop; Apple có thể từ chối nếu chỉ là vỏ web (App Review 4.2) |
| P4 | P3 + relay thông báo qua máy chủ | — | Có | — | **Loại**: cần máy chủ và đọc nội dung, vi phạm nguyên tắc ở mục 1 |

**Khuyến nghị:** (1) iPhone: dùng P1, không làm app. (2) Thử **P2 trước** vì không tốn công và có thể cho cả thông báo.
(3) Chỉ làm **P3 hướng iPad** nếu P2 không đạt và bạn chấp nhận không có thông báo khi ở nền. Không làm P4.

### 3.3 Spike iOS ⛔ (cần máy Mac + Xcode + iPad/iPhone chạy iOS 17+; chưa thực hiện)
Thứ tự: P2 trước, rồi P3. Ghi kết quả vào `docs/spike-mobile.md`.
- [ ] **P2:** chat.zalo.me trong Safari có mở được giao diện (không bị đưa sang App Store) không; cần "Yêu cầu trang web cho máy tính"?
- [ ] **P2:** thêm 2 web app, đăng nhập 2 tài khoản khác nhau, phiên có tách riêng không; có hiện hộp thoại xin quyền thông báo không.
- [ ] **P3:** 2 `WKWebsiteDataStore(forIdentifier:)` đăng nhập 2 tài khoản không đá nhau; còn phiên sau khi kill app.
- [ ] **P3:** UA nào cho giao diện dùng được (`customUserAgent` desktop, `WKWebpagePreferences.preferredContentMode = .desktop`).
- [ ] Đăng nhập trên chính máy: "Với số điện thoại" có dùng được không; có quét QR từ ảnh trong thư viện không.
- [ ] Nền: app ở nền bao lâu thì mất kết nối; mở lại có đồng bộ tin đủ không.
- [ ] Thông báo local khi app đang mở (đọc số chưa đọc từ `document.title`, cầu nối `WKScriptMessageHandler`).
- [ ] Gửi ảnh/file (chọn từ thư viện, `WKUIDelegate`), tải file.
- [ ] Liệt kê khác biệt so với Zalo gốc trên cùng máy.

**Giai đoạn 2 chỉ tiếp tục nếu spike cho kết quả "dùng được".** Nếu không, dừng và ghi lý do vào `docs/spike-mobile.md`.
**Dừng lại và báo cáo, chờ quyết định trước khi viết app.**

### 3.4 Stack (nếu làm P3)
- **SwiftUI + WKWebView native**, không dùng Flutter: chỉ nhắm iOS thì Flutter chỉ thêm một lớp cầu nối mà không giúp gì,
  trong khi cần trực tiếp `WKWebsiteDataStore(forIdentifier:)`, `WKScriptMessageHandler`, `WKUIDelegate`.
- Cấu hình dùng chung schema `Account` (JSON) với Windows; `layout` chỉ có `single` (iPad ngang có thể có `split`).
- Port logic `unread` sang Swift và dùng chung bộ test case `tests/fixtures/titles.json`.

### 3.5 Tính năng iOS (nếu spike đạt)
- iPad: thanh bên danh sách account, tùy chọn 2 pane. iPhone: tab bar. Tối đa 3 WebView sống; view cũ nhất được giải phóng và
  reload khi mở lại.
- Badge từ title; thông báo local khi số chưa đọc tăng (chỉ khi app còn chạy).
- Upload/tải file, link ngoài mở bằng Safari, xóa account thì `remove(forIdentifier:)`.
- Nói rõ trong app và README: không có thông báo khi app ở nền; khuyên dùng Zalo gốc cho nhu cầu đó.

---

## 4. Can thiệp tối thiểu vào trang (Windows và iOS)

Chỉ được phép làm ba việc sau:
1. **Đọc `document.title`** từ phía app (qua sự kiện `page-title-updated`, không inject gì).
2. **Shim thông báo** `src/inject/notification-shim.js`:
   - Main gọi `webContents.executeJavaScript(shim)` ở sự kiện `dom-ready` (chạy trong main world, không bị CSP chặn như thẻ `<script>`).
   - Shim thay `window.Notification` bằng một class tương thích: `permission` luôn là `'granted'`, `requestPermission()` resolve `'granted'`, constructor gọi `window.__duochat.notify({ title, body, icon, tag })` và **không** tạo thông báo gốc. Trả về object có `close()`, `onclick` để không làm trang lỗi.
   - Shim phải idempotent (chạy lại khi reload không bị lỗi) và được bọc trong `try/catch`.
   - Trên iOS, cầu nối là `WKScriptMessageHandler`, cùng API `notify`.
3. **Đọc hồ sơ của chính tài khoản đang đăng nhập** (v4): đúng hai thứ là *tên hiển thị* và *URL ảnh đại diện*.
   - Chạy khi: (a) người dùng bấm "Lấy tên và ảnh từ Zalo" (menu chuột phải trên avatar sidebar); (b) tự động, một lần sau khi account đăng nhập ổn định (mỗi lần mở app) và khi tên trong tiêu đề tab (`Zalo - <tên>`) khác tên đã đọc lần trước. Mỗi account tự động tối đa một lần mỗi phút. Không chạy khi chưa đăng nhập.
   - Main chạy `executeJavaScript`, script chỉ trả về `{ name, title, avatarUrl }`. Không đọc danh sách chat, danh bạ hay nội dung tin nhắn.
   - Tự động không giẫm lên thứ người dùng tự đặt: tên chỉ đổi khi còn là tên mặc định, đang trùng tên Zalo lần trước (`Account.profileName`), hoặc là lần đọc đầu của account vừa thêm. Ảnh người dùng đã bỏ thì không tự thêm lại. Bấm nút thủ công thì ghi đè.
   - Ảnh tải qua session của chính partition đó (cấm chuyển hướng), chỉ từ host trong allowlist, thu nhỏ 96x96 và lưu cục bộ (`Account.avatar`, data URL PNG). Không gửi đi đâu.
   - Không đọc được thì giữ nguyên tên và màu người dùng tự đặt.

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
8. Giai đoạn 2: **spike iOS 3.3** (thử P2 trước rồi P3), ghi `docs/spike-mobile.md`. ⛔ **Dừng, báo cáo.** (Spike Android đã chạy xong, kết quả ở phụ lục `docs/spike-mobile.md`, không phát triển tiếp.)
