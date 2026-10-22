import fs from 'node:fs'
import path from 'node:path'

const MAX_BYTES = 1024 * 1024
const MAX_VALUE = 120

type Value = string | number | boolean | null

/**
 * Nhật ký kỹ thuật cục bộ (không gửi đi đâu). CHỈ ghi tên sự kiện và các giá trị đơn giản (số, cờ, chuỗi ngắn
 * như mã lỗi hoặc id account). Không bao giờ ghi nội dung trang, tin nhắn hay cookie: giá trị lạ bị bỏ.
 */
export function formatLogLine(
  event: string,
  data: Record<string, unknown> = {},
  now = new Date(),
): string {
  const safe: Record<string, Value> = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) safe[k] = v
    else if (typeof v === 'string') safe[k] = v.length > MAX_VALUE ? `${v.slice(0, MAX_VALUE)}…` : v
  }
  const tail = Object.keys(safe).length > 0 ? ` ${JSON.stringify(safe)}` : ''
  return `${now.toISOString()} ${event.replace(/\s+/g, '_')}${tail}\n`
}

/** Ghi file nhật ký, xoay vòng khi quá 1 MB (giữ 1 bản cũ). Lỗi ghi file không bao giờ làm app lỗi. */
export class Logger {
  private readonly file: string

  constructor(dir: string) {
    this.file = path.join(dir, 'duochat.log')
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch {
      /* bỏ qua */
    }
  }

  info(event: string, data?: Record<string, unknown>): void {
    try {
      const line = formatLogLine(event, data)
      if (fs.existsSync(this.file) && fs.statSync(this.file).size + line.length > MAX_BYTES) {
        fs.renameSync(this.file, `${this.file}.1`)
      }
      fs.appendFileSync(this.file, line, 'utf8')
    } catch {
      /* bỏ qua */
    }
  }
}
