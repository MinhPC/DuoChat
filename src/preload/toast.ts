import { contextBridge, ipcRenderer } from 'electron'

// Preload của cửa sổ toast. Cố ý không import từ src/shared (preload sandbox không được tách chunk);
// tên kênh phải khớp IPC.toast* (tests/ipc.test.ts kiểm tra).
interface ToastView {
  accountName: string
  color: string
  initial: string
  title: string
  body: string
  count: number
  sound: 'default' | 'soft' | 'off'
  playSound: boolean
}

contextBridge.exposeInMainWorld('duochatToast', {
  onData(cb: (view: ToastView) => void): void {
    ipcRenderer.on('toast:data', (_e, view: ToastView) => cb(view))
  },
  click(): void {
    ipcRenderer.send('toast:click')
  },
  dismiss(): void {
    ipcRenderer.send('toast:dismiss')
  },
  hover(hovered: boolean): void {
    ipcRenderer.send('toast:hover', hovered)
  },
})
