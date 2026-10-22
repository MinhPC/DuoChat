import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { dirSize } from '../src/main/diskUsage'
import { formatBytes } from '../src/shared/format'

describe('formatBytes', () => {
  it('chọn đơn vị phù hợp', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 ** 2)).toBe('5 MB')
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB')
  })
  it('giá trị xấu thì về 0 B', () => {
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(NaN)).toBe('0 B')
  })
})

describe('dirSize', () => {
  let tmp = ''
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

  it('cộng dồn file ở mọi cấp thư mục', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'duochat-disk-'))
    fs.mkdirSync(path.join(tmp, 'a', 'b'), { recursive: true })
    fs.writeFileSync(path.join(tmp, 'x.bin'), Buffer.alloc(100))
    fs.writeFileSync(path.join(tmp, 'a', 'y.bin'), Buffer.alloc(250))
    fs.writeFileSync(path.join(tmp, 'a', 'b', 'z.bin'), Buffer.alloc(1000))
    expect(await dirSize(tmp)).toBe(1350)
  })
  it('thư mục không tồn tại thì là 0', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'duochat-disk-'))
    expect(await dirSize(path.join(tmp, 'khong-co'))).toBe(0)
  })
})
