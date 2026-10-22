import path from 'node:path'
import { app, Notification, shell, type Session } from 'electron'
import { vi } from '../shared/i18n/vi'

/** will-download trên session của từng partition: hộp thoại Save As, mặc định thư mục Downloads. */
export function attachDownloads(ses: Session): void {
  ses.on('will-download', (_event, item) => {
    const name = path.basename(item.getFilename()) || 'download'
    // Không đặt savePath → Electron tự hiện hộp thoại Save As với các tùy chọn này.
    item.setSaveDialogOptions({
      title: vi.download.saveTitle,
      defaultPath: path.join(app.getPath('downloads'), name),
    })
    item.once('done', (_e, state) => {
      if (state !== 'completed') return
      const savePath = item.getSavePath()
      if (!savePath || !Notification.isSupported()) return
      const n = new Notification({
        title: vi.download.done,
        body: vi.download.clickToOpen(path.basename(savePath)),
      })
      n.on('click', () => shell.showItemInFolder(savePath))
      n.show()
    })
  })
}
