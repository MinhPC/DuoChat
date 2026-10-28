import { contextBridge, ipcRenderer } from 'electron'

// Preload của cửa sổ hỏi cập nhật. Cố ý không import từ src/shared (preload sandbox không được tách chunk);
// tên kênh phải khớp IPC.updatePrompt* (tests/ipc.test.ts kiểm tra).
interface UpdatePromptView {
  title: string
  body: string
  note: string
  primary: string
  secondary: string
}

contextBridge.exposeInMainWorld('duochatUpdate', {
  onData(cb: (view: UpdatePromptView) => void): void {
    ipcRenderer.on('updatePrompt:data', (_e, view: UpdatePromptView) => cb(view))
  },
  choose(yes: boolean): void {
    ipcRenderer.send('updatePrompt:choice', yes)
  },
})
