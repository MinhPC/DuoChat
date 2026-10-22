import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { LockSettings } from '../shared/types'

/**
 * Khóa app bằng PIN. CHỈ khóa giao diện: dữ liệu đăng nhập trong thư mục dữ liệu vẫn không được mã hóa,
 * nên không bảo vệ trước người có quyền truy cập đĩa. PIN không bao giờ lưu dạng rõ.
 */
export const PIN_RE = /^\d{4,8}$/

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && PIN_RE.test(pin)
}

function derive(pin: string, saltHex: string): Buffer {
  return scryptSync(pin, Buffer.from(saltHex, 'hex'), 32)
}

export function createLock(pin: string, autoLockMinutes: number): LockSettings {
  const salt = randomBytes(16).toString('hex')
  return { enabled: true, salt, hash: derive(pin, salt).toString('hex'), autoLockMinutes }
}

export function verifyPin(lock: LockSettings, pin: unknown): boolean {
  if (!lock.enabled || !isValidPin(pin)) return false
  const expected = Buffer.from(lock.hash, 'hex')
  const actual = derive(pin, lock.salt)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Sai 5 lần đầu không phạt; từ lần thứ 6 chờ 1s, 2s, 4s … tối đa 30s trước khi cho thử tiếp. */
export function retryDelayMs(failures: number): number {
  if (failures < 5) return 0
  return Math.min(30_000, 1000 * 2 ** (failures - 5))
}
