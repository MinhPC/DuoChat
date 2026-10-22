import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SettingsStore,
  defaultSettings,
  migrate,
  readSettingsFile,
  writeSettingsFile,
} from '../src/main/store'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const acc = (id: string, order: number, extra = {}) => ({
  id,
  name: id.slice(0, 2),
  color: '#2563eb',
  order,
  muted: false,
  sound: 'default' as const,
  preview: 'default' as const,
  dnd: { enabled: false, from: '22:00', to: '07:00' },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
})

const tmpDirs: string[] = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'duochat-store-'))
  tmpDirs.push(d)
  return d
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

describe('migrate', () => {
  it('rác / null / mảng → mặc định', () => {
    for (const bad of [null, undefined, 42, 'x', []])
      expect(migrate(bad)).toEqual(defaultSettings())
  })

  it('v1 → v2: thêm layout, muted, zoom, startMinimized, pendingPartitionCleanup', () => {
    const v1 = {
      schemaVersion: 1,
      accounts: [
        {
          id: A,
          name: 'Cá nhân',
          color: '#2563eb',
          order: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: B,
          name: 'Công ty',
          color: '#16a34a',
          order: 1,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      activeAccountId: B,
      startWithWindows: true,
      minimizeToTray: false,
      window: { x: 10, y: 20, width: 900, height: 700, maximized: true },
    }
    const s = migrate(v1)
    expect(s.schemaVersion).toBe(3)
    expect(s.accounts.map((a) => a.muted)).toEqual([false, false])
    expect(s.layout.mode).toBe('single')
    expect(s.layout.activeAccountId).toBe(B)
    expect(s.layout.splitRatio).toBe(0.5)
    expect(s.zoomFactor).toBe(1)
    expect(s.startMinimized).toBe(true)
    expect(s.startWithWindows).toBe(true)
    expect(s.minimizeToTray).toBe(false)
    expect(s.window).toEqual({ x: 10, y: 20, width: 900, height: 700, maximized: true })
    expect(s.pendingPartitionCleanup).toEqual([])
  })

  it('thiếu schemaVersion được coi là v1', () => {
    const s = migrate({ accounts: [acc(A, 0)], activeAccountId: A })
    expect(s.schemaVersion).toBe(3)
    expect(s.layout.activeAccountId).toBe(A)
  })

  it('v2 hợp lệ giữ nguyên (idempotent)', () => {
    const s1 = migrate({
      ...defaultSettings(),
      accounts: [acc(A, 0), acc(B, 1)],
      layout: {
        mode: 'split',
        activeAccountId: A,
        leftAccountId: A,
        rightAccountId: B,
        splitRatio: 0.4,
        focusedPane: 'right',
      },
    })
    expect(migrate(JSON.parse(JSON.stringify(s1)))).toEqual(s1)
    expect(s1.layout.mode).toBe('split')
    expect(s1.layout.splitRatio).toBe(0.4)
  })
})

describe('quy tắc toàn vẹn', () => {
  const split = (over: object) => ({
    ...defaultSettings(),
    accounts: [acc(A, 0), acc(B, 1), acc(C, 2)],
    layout: {
      mode: 'split',
      activeAccountId: A,
      leftAccountId: A,
      rightAccountId: B,
      splitRatio: 0.5,
      focusedPane: 'left',
      ...over,
    },
  })

  it('left === right → sửa lại thành hai account khác nhau', () => {
    const s = migrate(split({ rightAccountId: A }))
    expect(s.layout.leftAccountId).toBe(A)
    expect(s.layout.rightAccountId).not.toBe(A)
    expect(s.layout.rightAccountId).not.toBeNull()
  })

  it('chỉ có 1 account thì không cho split', () => {
    const s = migrate({ ...split({}), accounts: [acc(A, 0)] })
    expect(s.layout.mode).toBe('single')
  })

  it('id trỏ tới account đã xóa → gán lại account hợp lệ đầu tiên', () => {
    const s = migrate(
      split({ activeAccountId: 'ghost', leftAccountId: 'ghost', rightAccountId: 'ghost2' }),
    )
    expect(s.layout.activeAccountId).toBe(A)
    expect(s.layout.leftAccountId).toBe(A)
    expect(s.layout.rightAccountId).toBe(B)
  })

  it('không còn account nào → các id là null', () => {
    const s = migrate({
      ...defaultSettings(),
      layout: { ...defaultSettings().layout, activeAccountId: 'x' },
    })
    expect(s.layout.activeAccountId).toBeNull()
  })

  it('kẹp splitRatio, zoom; sửa màu lạ; bỏ account trùng id', () => {
    const s = migrate({
      ...defaultSettings(),
      accounts: [acc(A, 0, { color: 'pink' }), acc(A, 1)],
      zoomFactor: 9,
      layout: { ...defaultSettings().layout, splitRatio: 5 },
    })
    expect(s.accounts).toHaveLength(1)
    expect(s.accounts[0].color).toBe('#2563eb')
    expect(s.zoomFactor).toBe(2)
    expect(s.layout.splitRatio).toBe(0.7)
  })

  it('sắp xếp theo order và đánh số lại liên tục', () => {
    const s = migrate({ ...defaultSettings(), accounts: [acc(A, 5), acc(B, 2), acc(C, 9)] })
    expect(s.accounts.map((a) => a.id)).toEqual([B, A, C])
    expect(s.accounts.map((a) => a.order)).toEqual([0, 1, 2])
  })

  it('pendingPartitionCleanup không bao giờ chứa id của account còn sống', () => {
    const s = migrate({
      ...defaultSettings(),
      accounts: [acc(A, 0)],
      pendingPartitionCleanup: [A, B, B],
    })
    expect(s.pendingPartitionCleanup).toEqual([B])
  })
})

describe('file IO', () => {
  it('ghi rồi đọc lại, không để lại file tạm', () => {
    const dir = tmp()
    const file = path.join(dir, 'settings.json')
    const s = migrate({ ...defaultSettings(), accounts: [acc(A, 0)] })
    writeSettingsFile(file, s)
    expect(readSettingsFile(file)).toEqual(s)
    expect(fs.readdirSync(dir)).toEqual(['settings.json'])
  })

  it('file không tồn tại → mặc định', () => {
    expect(readSettingsFile(path.join(tmp(), 'nope.json'))).toEqual(defaultSettings())
  })

  it('file hỏng → mặc định và giữ bản sao .corrupt', () => {
    const dir = tmp()
    const file = path.join(dir, 'settings.json')
    fs.writeFileSync(file, '{ not json')
    expect(readSettingsFile(file)).toEqual(defaultSettings())
    expect(fs.readdirSync(dir).some((f) => f.includes('.corrupt-'))).toBe(true)
  })

  it('SettingsStore.update chuẩn hóa, báo listener và flush ra đĩa', () => {
    const file = path.join(tmp(), 'settings.json')
    const store = new SettingsStore(file, 10_000)
    let calls = 0
    store.onChange(() => calls++)
    store.update((d) => ({ ...d, zoomFactor: 99, accounts: [acc(A, 0)] }))
    expect(calls).toBe(1)
    expect(store.get().zoomFactor).toBe(2)
    store.flush()
    expect(readSettingsFile(file).accounts[0].id).toBe(A)
  })
})
