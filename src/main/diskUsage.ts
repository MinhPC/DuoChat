import fs from 'node:fs/promises'
import path from 'node:path'

/** Tổng dung lượng (byte) của một thư mục, đệ quy. Không theo symlink; lỗi đọc từng mục thì bỏ qua mục đó. */
export async function dirSize(dir: string): Promise<number> {
  let total = 0
  const stack = [dir]
  while (stack.length > 0) {
    const cur = stack.pop() as string
    let entries
    try {
      entries = await fs.readdir(cur, { withFileTypes: true })
    } catch {
      continue
    }
    await Promise.all(
      entries.map(async (e) => {
        const p = path.join(cur, e.name)
        if (e.isDirectory()) stack.push(p)
        else if (e.isFile()) {
          try {
            total += (await fs.stat(p)).size
          } catch {
            /* file vừa bị xóa hoặc đang bị khóa */
          }
        }
      }),
    )
  }
  return total
}
