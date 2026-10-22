import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { badgeImageName } from '../src/main/unread'
import { IPC } from '../src/shared/ipc'

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

describe('hợp đồng IPC', () => {
  it('preload view Zalo hardcode đúng tên kênh notify và không import src/shared', () => {
    const src = read('src/preload/service.ts')
    expect(src).toContain(`'${IPC.notify}'`)
    // preload sandbox không được tách chunk dùng chung
    expect(src).not.toMatch(/from '\.\.\/shared/)
  })

  it('preload view Zalo chỉ expose đúng một hàm', () => {
    const src = read('src/preload/service.ts')
    expect(src.match(/exposeInMainWorld/g)).toHaveLength(1)
    expect(src).not.toMatch(/ipcRenderer\s*[,}]\s*$/m)
  })

  it('preload toast hardcode đúng các kênh toast và không import src/shared', () => {
    const src = read('src/preload/toast.ts')
    for (const ch of [IPC.toastData, IPC.toastClick, IPC.toastDismiss, IPC.toastHover]) {
      expect(src).toContain(`'${ch}'`)
    }
    expect(src).not.toMatch(/from '\.\.\/shared/)
  })

  it('tên kênh không trùng nhau', () => {
    const values = Object.values(IPC)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('badge', () => {
  it('1–9 có ảnh riêng, từ 10 là 9+, 0 là không có', () => {
    expect(badgeImageName(0)).toBeNull()
    expect(badgeImageName(1)).toBe('badge-1.png')
    expect(badgeImageName(9)).toBe('badge-9.png')
    expect(badgeImageName(10)).toBe('badge-9plus.png')
    expect(badgeImageName(250)).toBe('badge-9plus.png')
  })

  it('ảnh badge và icon đã được sinh sẵn', () => {
    for (let n = 1; n <= 9; n++) {
      expect(fs.existsSync(path.join(__dirname, '..', 'resources', `badge-${n}.png`))).toBe(true)
    }
    for (const f of ['badge-9plus.png', 'icon.png', 'tray.png', 'tray-unread.png']) {
      expect(fs.existsSync(path.join(__dirname, '..', 'resources', f))).toBe(true)
    }
  })
})
