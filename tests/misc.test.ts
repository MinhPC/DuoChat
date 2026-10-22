import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanupOrphanPartitions, partitionDir } from '../src/main/cleanup'
import { formatNotificationTitle, parseNotifyPayload } from '../src/main/notifyPayload'
import { isPermissionAllowed } from '../src/main/permissions'
import { buildUserAgent, isAllowedUrl, isExternalOpenable, partitionFor } from '../src/main/service'
import { matchShortcut, type KeyInput } from '../src/main/shortcuts'

const key = (k: string, over: Partial<KeyInput> = {}): KeyInput => ({
  type: 'keyDown',
  key: k,
  control: false,
  shift: false,
  alt: false,
  meta: false,
  ...over,
})
const ctrl = (k: string, over: Partial<KeyInput> = {}) => key(k, { control: true, ...over })

describe('service allowlist', () => {
  it.each([
    'https://chat.zalo.me/',
    'https://id.zalo.me/account?continue=x',
    'https://zalo-chat-static.zadn.vn/a.js',
    'https://stc-chat.zdn.vn/x',
    'https://zalo.me',
  ])('cho phép %s', (u) => expect(isAllowedUrl(u)).toBe(true))

  it.each([
    'https://evil.com/',
    'https://zalo.me.evil.com/',
    'https://notzalo.me/',
    'https://www.google-analytics.com/',
    'file:///C:/x',
    'javascript:alert(1)',
    'not a url',
  ])('chặn %s', (u) => expect(isAllowedUrl(u)).toBe(false))

  it('chỉ http/https được mở bằng trình duyệt ngoài', () => {
    expect(isExternalOpenable('https://example.com')).toBe(true)
    expect(isExternalOpenable('file:///C:/Windows/System32/calc.exe')).toBe(false)
    expect(isExternalOpenable('ms-msdt:/id')).toBe(false)
  })

  it('UA bỏ Electron/x và tên app', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) duochat/0.1.0 Chrome/156.0.0.0 Electron/45.0.0 Safari/537.36'
    expect(buildUserAgent(ua, 'duochat')).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
    )
  })

  it('partition có tiền tố persist:acc-', () => {
    expect(partitionFor('abc')).toBe('persist:acc-abc')
  })
})

describe('permissions', () => {
  it('cấp quyền cho origin Zalo', () => {
    for (const p of ['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen'])
      expect(isPermissionAllowed(p, 'https://chat.zalo.me/')).toBe(true)
  })
  it('từ chối quyền khác hoặc origin lạ', () => {
    expect(isPermissionAllowed('geolocation', 'https://chat.zalo.me/')).toBe(false)
    expect(isPermissionAllowed('clipboard-read', 'https://chat.zalo.me/')).toBe(false)
    expect(isPermissionAllowed('media', 'https://evil.com/')).toBe(false)
  })
})

describe('notify payload', () => {
  it('chấp nhận payload hợp lệ và cắt độ dài', () => {
    const p = parseNotifyPayload({ title: 'x'.repeat(500), body: 'y'.repeat(5000), tag: 't' })
    expect(p?.title).toHaveLength(200)
    expect(p?.body).toHaveLength(1000)
    expect(p?.icon).toBeNull()
  })
  it('từ chối kiểu sai', () => {
    for (const bad of [null, 1, 'x', [], {}, { title: 5 }])
      expect(parseNotifyPayload(bad)).toBeNull()
  })
  it('bỏ icon quá dài', () => {
    expect(parseNotifyPayload({ title: 't', icon: 'a'.repeat(3000) })?.icon).toBeNull()
  })
  it('định dạng tiêu đề', () => {
    expect(formatNotificationTitle('Công ty', 'Nam')).toBe('[Công ty] Nam')
  })
})

describe('shortcuts', () => {
  it('Ctrl+1..9 chọn account', () => {
    expect(matchShortcut(ctrl('1'), false)).toEqual({ type: 'selectIndex', index: 0 })
    expect(matchShortcut(ctrl('9'), false)).toEqual({ type: 'selectIndex', index: 8 })
  })
  it('Ctrl+\\, Ctrl+Tab, Ctrl+R, F5, zoom', () => {
    expect(matchShortcut(ctrl('\\'), false)).toEqual({ type: 'toggleSplit' })
    expect(matchShortcut(ctrl('Tab'), false)).toEqual({ type: 'cycleFocus' })
    expect(matchShortcut(ctrl('r'), false)).toEqual({ type: 'reload' })
    expect(matchShortcut(key('F5'), false)).toEqual({ type: 'reload' })
    expect(matchShortcut(ctrl('='), false)).toEqual({ type: 'zoomIn' })
    expect(matchShortcut(ctrl('-'), false)).toEqual({ type: 'zoomOut' })
    expect(matchShortcut(ctrl('0'), false)).toEqual({ type: 'zoomReset' })
  })
  it('DevTools chỉ ở bản dev', () => {
    expect(matchShortcut(ctrl('I', { shift: true }), true)).toEqual({ type: 'devtools' })
    expect(matchShortcut(ctrl('I', { shift: true }), false)).toBeNull()
  })
  it('các phím khác đi tiếp vào Zalo', () => {
    const others = [
      key('a'),
      ctrl('c'),
      ctrl('v'),
      ctrl('a'),
      ctrl('f'),
      ctrl('Tab', { shift: true }),
      ctrl('1', { alt: true }),
      key('1'),
      key('Tab'),
    ]
    for (const k of others) expect(matchShortcut(k, false)).toBeNull()
  })
  it('bỏ qua keyUp', () => {
    expect(matchShortcut(ctrl('1', { type: 'keyUp' }), false)).toBeNull()
  })
})

describe('cleanup partition mồ côi', () => {
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  it('xóa thư mục của account đã xóa, giữ account còn sống, bỏ qua id rác', () => {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'duochat-clean-'))
    try {
      for (const id of [A, B]) {
        const d = partitionDir(ud, id)!
        fs.mkdirSync(path.join(d, 'Local Storage'), { recursive: true })
        fs.writeFileSync(path.join(d, 'Cookies'), 'x')
      }
      const done = cleanupOrphanPartitions(ud, [A, '../../etc', B], new Set([B]))
      expect(done).toEqual([A, '../../etc'])
      expect(fs.existsSync(partitionDir(ud, A)!)).toBe(false)
      expect(fs.existsSync(partitionDir(ud, B)!)).toBe(true)
    } finally {
      fs.rmSync(ud, { recursive: true, force: true })
    }
  })

  it('thư mục vốn không tồn tại vẫn coi là xong', () => {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'duochat-clean-'))
    try {
      expect(cleanupOrphanPartitions(ud, [A], new Set())).toEqual([A])
    } finally {
      fs.rmSync(ud, { recursive: true, force: true })
    }
  })

  it('chặn path traversal', () => {
    expect(partitionDir('/ud', '../x')).toBeNull()
  })
})
