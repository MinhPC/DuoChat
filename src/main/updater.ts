import { autoUpdater } from 'electron-updater'
import type { UpdateCheckResult, UpdateState } from '../shared/ipc'
import type { Logger } from './logger'
import { canAutoUpdate } from './updatePolicy'

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const FIRST_CHECK_DELAY_MS = 30_000

/**
 * Kiểm tra bản mới qua GitHub Releases. Mỗi lần kiểm tra chỉ là một request tải file `latest.yml`
 * (không gửi nội dung hay danh tính người dùng).
 *
 * Có bản mới thì chỉ đổi trạng thái (sidebar hiện chấm trên nút Cài đặt). Hộp thoại xác nhận chỉ hiện khi người
 * dùng chủ động bấm cập nhật (`startUpdate`), không tự bật lên làm gián đoạn lúc đang chat.
 */
export class Updater {
  private timer: NodeJS.Timeout | null = null
  private first: NodeJS.Timeout | null = null
  private wired = false

  private state: UpdateState = { status: 'none' }
  private asking = false

  constructor(
    private readonly log: Logger,
    private readonly ui: {
      /** Hỏi người dùng có tải bản mới không. */
      confirmDownload(version: string): Promise<boolean>
      /** Hỏi người dùng có khởi động lại để cài ngay không (không thì cài khi thoát). */
      confirmInstall(version: string): Promise<boolean>
    },
    private readonly env: { packaged: boolean; portable: boolean },
    private readonly onState: (state: UpdateState) => void,
  ) {}

  private setState(state: UpdateState): void {
    this.state = state
    this.onState(state)
  }

  private wire(): void {
    if (this.wired) return
    this.wired = true
    autoUpdater.autoDownload = false // chỉ tải khi người dùng đồng ý
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-available', (info) => {
      // Đang tải hoặc đã tải xong thì không lùi về "có bản mới".
      if (this.state.status === 'none' || this.state.version !== info.version) {
        this.setState({ status: 'available', version: info.version })
      }
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.log.info('update_downloaded', { version: info.version })
      this.setState({ status: 'ready', version: info.version })
    })
    autoUpdater.on('error', (e) => this.log.info('update_error', { message: String(e.message) }))
  }

  /** Người dùng bấm nút cập nhật: hỏi xác nhận, rồi tải hoặc cài tùy trạng thái hiện tại. */
  async startUpdate(): Promise<void> {
    const { status, version } = this.state
    if (this.asking || !version) return
    this.asking = true
    try {
      if (status === 'ready') {
        if (await this.ui.confirmInstall(version)) autoUpdater.quitAndInstall()
      } else if (status === 'available') {
        if (!(await this.ui.confirmDownload(version))) return
        this.setState({ status: 'downloading', version })
        await autoUpdater.downloadUpdate()
        this.setState({ status: 'ready', version })
        this.asking = false
        // Tải xong là kết quả của thao tác vừa rồi nên hỏi cài ngay.
        if (await this.ui.confirmInstall(version)) autoUpdater.quitAndInstall()
      }
    } catch (e) {
      this.log.info('update_download_failed', {
        message: String((e as Error).message).slice(0, 200),
      })
      if (this.state.status === 'downloading') this.setState({ status: 'available', version })
    } finally {
      this.asking = false
    }
  }

  /**
   * Người dùng bấm "Kiểm tra ngay": chạy một lần ngoài lịch tự kiểm tra. Bản dev và bản portable
   * không cập nhật được nên trả `unsupported` mà không kết nối ra ngoài.
   */
  async checkNow(): Promise<UpdateCheckResult> {
    if (!canAutoUpdate(this.env)) return { status: 'unsupported' }
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

  /** Luôn tự kiểm tra (không có tùy chọn tắt): sau 30 giây, rồi mỗi 6 giờ. Bản dev/portable thì bỏ qua. */
  start(): void {
    this.stop()
    if (!canAutoUpdate(this.env)) return
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
