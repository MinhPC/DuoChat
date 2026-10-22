import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { defaultSettings, migrate } from '../src/main/store'
import {
  cleanName,
  nameFromTitle,
  isAvatarDataUrl,
  parseProfile,
  PROFILE_SCRIPT,
  toAvatarDataUrl,
} from '../src/main/profile'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('parseProfile', () => {
  it('nhận tên và URL ảnh thuộc allowlist', () => {
    expect(
      parseProfile({ name: '  Minh  Phan ', avatarUrl: 'https://s120-ava-talk.zadn.vn/a/b.jpg' }),
    ).toEqual({ name: 'Minh Phan', avatarUrl: 'https://s120-ava-talk.zadn.vn/a/b.jpg' })
  })
  it('loại URL ngoài allowlist, không phải https/http, hoặc quá dài', () => {
    for (const avatarUrl of [
      'https://evil.example/a.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'https://x.zadn.vn/' + 'a'.repeat(3000),
    ]) {
      expect(parseProfile({ name: null, avatarUrl }).avatarUrl).toBeNull()
    }
  })
  it('rác vào thì ra rỗng', () => {
    for (const raw of [null, 5, 'x', [], { name: 3, avatarUrl: {} }]) {
      expect(parseProfile(raw)).toMatchObject({ name: null, avatarUrl: null })
    }
  })
})

describe('nameFromTitle', () => {
  it('lấy tên sau "Zalo - ", bỏ số chưa đọc phía trước', () => {
    expect(nameFromTitle('Zalo - Minh Phan')).toBe('Minh Phan')
    expect(nameFromTitle('(3) Zalo - Kho Đá Phú Sơn')).toBe('Kho Đá Phú Sơn')
    expect(nameFromTitle('[12] zalo -  A  B ')).toBe('A B')
  })
  it('không coi tiêu đề trang đăng nhập hay tiêu đề trơn là tên', () => {
    for (const t of [
      'Zalo',
      '(3) Zalo',
      'Zalo - Đăng nhập Zalo',
      'Đăng nhập tài khoản Zalo',
      '',
      null,
      5,
    ]) {
      expect(nameFromTitle(t)).toBeNull()
    }
  })
  it('parseProfile dùng tiêu đề khi trang không có tên ở alt/title', () => {
    expect(parseProfile({ name: null, title: 'Zalo - Minh Phan', avatarUrl: null }).name).toBe(
      'Minh Phan',
    )
  })
})

describe('cleanName', () => {
  it('bỏ ký tự điều khiển, cắt 40 ký tự, loại chuỗi chung chung', () => {
    expect(cleanName('A\u0000\nB')).toBe('A B')
    expect(cleanName('x'.repeat(100))).toHaveLength(40)
    expect(cleanName('Avatar')).toBeNull()
    expect(cleanName('   ')).toBeNull()
  })
})

describe('avatar data URL', () => {
  it('chỉ nhận PNG base64 hợp lệ và không quá lớn', () => {
    expect(isAvatarDataUrl(PNG)).toBe(true)
    expect(isAvatarDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isAvatarDataUrl('data:image/png;base64,<script>')).toBe(false)
    expect(isAvatarDataUrl(PNG + 'A'.repeat(70_000))).toBe(false)
    expect(isAvatarDataUrl(42)).toBe(false)
  })
  it('toAvatarDataUrl bọc buffer PNG, từ chối buffer quá lớn', () => {
    expect(toAvatarDataUrl(Buffer.from([1, 2, 3]))).toBe('data:image/png;base64,AQID')
    expect(toAvatarDataUrl(Buffer.alloc(50_000))).toBeNull()
  })
})

describe('PROFILE_SCRIPT', () => {
  const run = (document: unknown): unknown =>
    vm.runInNewContext(PROFILE_SCRIPT, { document, getComputedStyle: () => ({}) })

  it('là cú pháp hợp lệ và trả null khi trang không có ảnh phù hợp', () => {
    expect(run({ querySelectorAll: () => [] })).toMatchObject({ name: null, avatarUrl: null })
  })
  it('không ném lỗi khi DOM hỏng', () => {
    expect(
      run({
        querySelectorAll: () => {
          throw new Error('x')
        },
      }),
    ).toMatchObject({ name: null, avatarUrl: null })
  })
  it('lấy ảnh nằm ở góc trên trái, host Zalo, kèm alt làm tên', () => {
    const img = (src: string, left: number, top: number, alt = ''): unknown => ({
      currentSrc: src,
      src,
      getBoundingClientRect: () => ({ width: 48, height: 48, left, top }),
      getAttribute: (a: string) => (a === 'alt' ? alt : null),
      parentElement: null,
    })
    const r = run({
      querySelectorAll: (sel: string) =>
        sel === 'img'
          ? [
              img('https://evil.example/x.png', 10, 10),
              img('https://s1.zadn.vn/far.png', 500, 10),
              img('https://s1.zadn.vn/me.png', 10, 20, 'Minh Phan'),
            ]
          : [],
    })
    expect(r).toMatchObject({ name: 'Minh Phan', avatarUrl: 'https://s1.zadn.vn/me.png' })
  })
})

describe('migrate v2 → v3', () => {
  const acc = { id: 'a', name: 'A', color: '#2563eb', order: 0, createdAt: '2026-01-01T00:00:00Z' }
  it('giữ account cũ, không có avatar, nâng schemaVersion', () => {
    const s = migrate({ ...defaultSettings(), schemaVersion: 2, accounts: [acc] })
    expect(s.schemaVersion).toBe(3)
    expect(s.accounts[0].avatar).toBeUndefined()
  })
  it('giữ avatar hợp lệ, bỏ avatar sai', () => {
    expect(
      migrate({ ...defaultSettings(), accounts: [{ ...acc, avatar: PNG }] }).accounts[0].avatar,
    ).toBe(PNG)
    expect(
      migrate({ ...defaultSettings(), accounts: [{ ...acc, avatar: 'https://evil/x.png' }] })
        .accounts[0].avatar,
    ).toBeUndefined()
  })
})
