import { autoUpdater } from 'electron-updater'
import type { UpdateCheckResult } from '../shared/ipc'
import type { Logger } from './logger'
import { canAutoUpdate } from './updatePolicy'

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const FIRST_CHECK_DELAY_MS = 30_000

/**
 * Kiểm tra bản mới qua GitHub Releases. Mặc định TẮT vì app cam kết không gửi dữ liệu ra ngoài; khi bật, mỗi lần
 * kiểm tra chỉ là một request tải file `latest.yml` (không gửi nội dung hay danh tính người dùng).
 */
export class Updater {
  private timer: NodeJS.Timeout | null = null
  private first: NodeJS.Timeout | null = null
  private wired = false

  constructor(
    private readonly log: Logger,
    private readonly onDownloaded: (version: string) => void,
    private readonly env: { packaged: boolean; portable: boolean },
  ) {}

  private wire(): void {
    if (this.wired) return
    this.wired = true
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-downloaded', (info) => {
      this.log.info('update_downloaded', { version: info.version })
      this.onDownloaded(info.version)
    })
    autoUpdater.on('error', (e) => this.log.info('update_error', { message: String(e.message) }))
  }

  /**
   * Người dùng bấm "Kiểm tra ngay": chạy một lần, độc lập với cài đặt tự kiểm tra. Bản dev và bản portable
   * không cập nhật được nên trả `unsupported` mà không kết nối ra ngoài.
   */
  async checkNow(): Promise<UpdateCheckResult> {
    if (!canAutoUpdate({ enabled: true, ...this.env })) return { status: 'unsupported' }
    this.wire()
    try {
      const r = await autoUpdater.checkForUpdates()
      const info = r?.updateInfo
      if (r?.isUpdateAvailable && info) return { status: 'available', version: info.version }
      return { status: 'latest', version: info?.version ?? autoUpdater.currentVersion.version }
    } catch (e) {
      const message = String((e as Error).message)
      this.log.info('update_check_failed', { message: message.slice(0, 200) })
      return { status: message.includes('404') ? 'notFound' : 'error' }
    }
  }

  setEnabled(enabled: boolean): void {
    this.stop()
    if (!canAutoUpdate({ enabled, ...this.env })) return
    this.wire()
    const check = (): void => {
      autoUpdater
        .checkForUpdates()
        .catch((e: Error) => this.log.info('update_check_failed', { message: String(e.message) }))
    }
    this.first = setTimeout(check, FIRST_CHECK_DELAY_MS)
    this.timer = setInterval(check, CHECK_EVERY_MS)
  }

  stop(): void {
    if (this.first) clearTimeout(this.first)
    if (this.timer) clearInterval(this.timer)
    this.first = null
    this.timer = null
  }
}
