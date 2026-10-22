/** Chờ trước lần thử tải lại thứ `attempt` (0-based): 5s, 10s, 20s … tối đa 5 phút. */
export function loadRetryDelayMs(attempt: number): number {
  return Math.min(5 * 60_000, 5000 * 2 ** Math.max(0, attempt))
}

const CRASH_WINDOW_MS = 60_000
const MAX_CRASH_RELOADS = 3

/**
 * View crash liên tục (vd crash ngay lúc tải) thì không reload mãi: tối đa 3 lần trong 60 giây.
 * Trả về danh sách mốc thời gian còn hiệu lực (đã gồm `now`) và có được reload lần này không.
 */
export function recordCrash(
  history: readonly number[],
  now: number,
): { history: number[]; reload: boolean } {
  const recent = history.filter((t) => now - t < CRASH_WINDOW_MS)
  return { history: [...recent, now], reload: recent.length < MAX_CRASH_RELOADS }
}
