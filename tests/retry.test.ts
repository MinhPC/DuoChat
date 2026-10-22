import { describe, expect, it } from 'vitest'
import { loadRetryDelayMs, recordCrash } from '../src/main/retry'

describe('loadRetryDelayMs', () => {
  it('tăng gấp đôi và chặn ở 5 phút', () => {
    expect([0, 1, 2, 3].map(loadRetryDelayMs)).toEqual([5000, 10000, 20000, 40000])
    expect(loadRetryDelayMs(20)).toBe(300000)
    expect(loadRetryDelayMs(-1)).toBe(5000)
  })
})

describe('recordCrash', () => {
  it('cho reload 3 lần trong 60s rồi dừng', () => {
    let h: number[] = []
    const results: boolean[] = []
    for (const t of [0, 1000, 2000, 3000]) {
      const r = recordCrash(h, t)
      h = r.history
      results.push(r.reload)
    }
    expect(results).toEqual([true, true, true, false])
  })
  it('crash cũ quá 60s không tính', () => {
    const r = recordCrash([0, 1000, 2000], 70_000)
    expect(r.reload).toBe(true)
    expect(r.history).toEqual([70_000])
  })
})
