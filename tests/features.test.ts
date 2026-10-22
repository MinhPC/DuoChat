import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isInDnd } from '../src/main/dnd'
import { createLock, isValidPin, retryDelayMs, verifyPin } from '../src/main/lock'
import { Logger, formatLogLine } from '../src/main/logger'
import { defaultSettings, migrate } from '../src/main/store'
import { isLoginPage, isLoginTitle, isLoginUrl } from '../src/main/session'

const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m)

describe('isInDnd', () => {
  const night = { enabled: true, from: '22:00', to: '07:00' }
  it('khung qua nửa đêm', () => {
    expect(isInDnd(night, at(23))).toBe(true)
    expect(isInDnd(night, at(2, 30))).toBe(true)
    expect(isInDnd(night, at(6, 59))).toBe(true)
    expect(isInDnd(night, at(7))).toBe(false)
    expect(isInDnd(night, at(12))).toBe(false)
    expect(isInDnd(night, at(21, 59))).toBe(false)
    expect(isInDnd(night, at(22))).toBe(true)
  })
  it('khung trong ngày', () => {
    const work = { enabled: true, from: '12:00', to: '13:30' }
    expect(isInDnd(work, at(12))).toBe(true)
    expect(isInDnd(work, at(13, 29))).toBe(true)
    expect(isInDnd(work, at(13, 30))).toBe(false)
  })
  it('tắt hoặc khung rỗng thì không áp dụng', () => {
    expect(isInDnd({ ...night, enabled: false }, at(23))).toBe(false)
    expect(isInDnd({ enabled: true, from: '08:00', to: '08:00' }, at(8))).toBe(false)
  })
})

describe('khóa PIN', () => {
  it('chỉ nhận PIN 4–8 chữ số', () => {
    for (const ok of ['1234', '12345678']) expect(isValidPin(ok)).toBe(true)
    for (const bad of ['123', '123456789', 'abcd', '12 34', '', 1234, null])
      expect(isValidPin(bad)).toBe(false)
  })
  it('tạo rồi xác minh; sai PIN bị từ chối; PIN không nằm trong dữ liệu lưu', () => {
    const lock = createLock('4821', 5)
    expect(lock.enabled).toBe(true)
    expect(verifyPin(lock, '4821')).toBe(true)
    expect(verifyPin(lock, '4822')).toBe(false)
    expect(verifyPin(lock, 'abcd')).toBe(false)
    expect(JSON.stringify(lock)).not.toContain('4821')
  })
  it('mỗi lần tạo dùng salt khác nhau', () => {
    expect(createLock('1234', 5).salt).not.toBe(createLock('1234', 5).salt)
    expect(createLock('1234', 5).hash).not.toBe(createLock('1234', 5).hash)
  })
  it('chưa bật thì không xác minh được', () => {
    expect(verifyPin(defaultSettings().lock, '1234')).toBe(false)
  })
  it('làm chậm khi nhập sai nhiều lần', () => {
    expect(retryDelayMs(0)).toBe(0)
    expect(retryDelayMs(4)).toBe(0)
    expect(retryDelayMs(5)).toBe(1000)
    expect(retryDelayMs(7)).toBe(4000)
    expect(retryDelayMs(50)).toBe(30000)
  })
})

describe('chuẩn hóa dnd và lock trong settings', () => {
  const acc = {
    id: 'a',
    name: 'A',
    color: '#2563eb',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  it('thiếu hoặc sai thì dùng mặc định', () => {
    const s = migrate({
      ...defaultSettings(),
      accounts: [{ ...acc, dnd: { enabled: true, from: '25:99', to: 'x' } }],
    })
    expect(s.accounts[0].dnd).toEqual({ enabled: true, from: '22:00', to: '07:00' })
    expect(migrate({ ...defaultSettings(), accounts: [acc] }).accounts[0].dnd.enabled).toBe(false)
  })
  it('bật khóa mà thiếu hash thì coi như chưa bật', () => {
    const s = migrate({
      ...defaultSettings(),
      lock: { enabled: true, salt: '', hash: '', autoLockMinutes: 5 },
    })
    expect(s.lock.enabled).toBe(false)
  })
  it('giữ khóa hợp lệ; thời gian tự khóa lạ thì về 5 phút', () => {
    const lock = { ...createLock('1234', 15) }
    expect(migrate({ ...defaultSettings(), lock }).lock).toEqual(lock)
    expect(
      migrate({ ...defaultSettings(), lock: { ...lock, autoLockMinutes: 7 } }).lock.autoLockMinutes,
    ).toBe(5)
  })
})

describe('nhật ký', () => {
  it('chỉ giữ giá trị đơn giản, bỏ object/mảng, cắt chuỗi dài', () => {
    const line = formatLogLine(
      'view_load_failed',
      {
        code: -105,
        main: true,
        id: 'abcd',
        nested: { body: 'bí mật' },
        list: ['x'],
        long: 'y'.repeat(500),
      },
      new Date(0),
    )
    expect(line.startsWith('1970-01-01T00:00:00.000Z view_load_failed ')).toBe(true)
    expect(line).not.toContain('bí mật')
    expect(line).not.toContain('nested')
    expect(line.length).toBeLessThan(400)
  })
  it('ghi file và xoay vòng khi quá 1 MB', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duochat-log-'))
    try {
      const log = new Logger(dir)
      log.info('start', { v: 1 })
      expect(fs.readFileSync(path.join(dir, 'duochat.log'), 'utf8')).toContain('start')
      const big = 'z'.repeat(110)
      for (let i = 0; i < 12_000; i++) log.info('x', { big })
      expect(fs.existsSync(path.join(dir, 'duochat.log.1'))).toBe(true)
      expect(fs.statSync(path.join(dir, 'duochat.log')).size).toBeLessThanOrEqual(1024 * 1024)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('isLoginUrl', () => {
  it('nhận diện trang đăng nhập Zalo', () => {
    expect(isLoginUrl('https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F')).toBe(
      true,
    )
    expect(isLoginUrl('https://chat.zalo.me/')).toBe(false)
    expect(isLoginUrl('https://zalo.me/')).toBe(false)
    expect(isLoginUrl('not a url')).toBe(false)
  })
})

describe('isLoginTitle / isLoginPage', () => {
  it('nhận diện các tiêu đề đăng nhập đã quan sát', () => {
    for (const t of ['Zalo - Đăng nhập Zalo', 'Đăng nhập tài khoản Zalo', 'Log in to Zalo']) {
      expect(isLoginTitle(t)).toBe(true)
    }
  })
  it('tiêu đề thường và tiêu đề có số chưa đọc không phải trang đăng nhập', () => {
    for (const t of ['Zalo', '(3) Zalo', '', 'Nhóm gia đình']) expect(isLoginTitle(t)).toBe(false)
  })
  it('chat.zalo.me với tiêu đề đăng nhập vẫn là trang đăng nhập; id.zalo.me luôn là đăng nhập', () => {
    expect(isLoginPage('https://chat.zalo.me/', 'Zalo - Đăng nhập Zalo')).toBe(true)
    expect(isLoginPage('https://id.zalo.me/account', 'Zalo')).toBe(true)
    expect(isLoginPage('https://chat.zalo.me/', 'Zalo')).toBe(false)
  })
})
