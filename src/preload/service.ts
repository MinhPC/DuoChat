import { contextBridge, ipcRenderer } from 'electron'

// Preload của view Zalo: chỉ expose ĐÚNG MỘT hàm. Không expose Node, ipcRenderer hay thứ gì khác.
// Cố ý không import từ src/shared: preload chạy trong sandbox nên không được tách chunk dùng chung.
// Tên kênh phải khớp IPC.notify (tests/ipc.test.ts kiểm tra).
const NOTIFY_CHANNEL = 'duochat:notify'

contextBridge.exposeInMainWorld('__duochat', {
  notify(payload: unknown): void {
    ipcRenderer.send(NOTIFY_CHANNEL, payload)
  },
})
