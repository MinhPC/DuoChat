import fs from 'node:fs'
import path from 'node:path'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Thư mục partition của một account trong userData (Chromium lưu persist:acc-<id> ở đây). */
export function partitionDir(userDataPath: string, accountId: string): string | null {
  // Chặn path traversal: id luôn là UUID do app tự sinh.
  if (!UUID_RE.test(accountId)) return null
  return path.join(userDataPath, 'Partitions', `acc-${accountId}`)
}

/**
 * Xóa hẳn thư mục partition của account đã xóa. Gọi lúc khởi động, trước khi tạo session,
 * vì Windows khóa file khi app đang chạy. Trả về các id đã dọn xong (hoặc vốn không còn thư mục).
 */
export function cleanupOrphanPartitions(
  userDataPath: string,
  pendingIds: readonly string[],
  liveIds: ReadonlySet<string>,
): string[] {
  const done: string[] = []
  for (const id of pendingIds) {
    if (liveIds.has(id)) continue // không bao giờ xóa partition của account còn sống
    const dir = partitionDir(userDataPath, id)
    if (!dir) {
      done.push(id) // id rác, bỏ khỏi danh sách
      continue
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
      done.push(id)
    } catch {
      /* còn bị khóa: thử lại lần khởi động sau */
    }
  }
  return done
}
