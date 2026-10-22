import type { WebContents } from 'electron'

export type ShortcutAction =
  | { type: 'selectIndex'; index: number }
  | { type: 'toggleSplit' }
  | { type: 'cycleFocus' }
  | { type: 'devtools' }
  | { type: 'reload' }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'zoomReset' }

export interface KeyInput {
  type: string
  key: string
  code?: string
  control: boolean
  shift: boolean
  alt: boolean
  meta: boolean
}

/**
 * Chỉ khớp đúng các tổ hợp trong spec (mục 2.5.9, 2.5.8). Mọi phím khác trả null để đi tiếp vào Zalo.
 */
export function matchShortcut(i: KeyInput, isDev: boolean): ShortcutAction | null {
  if (i.type !== 'keyDown') return null
  if (i.alt || i.meta) return null

  if (!i.control) return i.key === 'F5' && !i.shift ? { type: 'reload' } : null

  if (i.shift) {
    if (i.key.toLowerCase() === 'i' && isDev) return { type: 'devtools' }
    // Ctrl+Shift+= chính là Ctrl++ trên bàn phím US.
    if (i.key === '+') return { type: 'zoomIn' }
    return null
  }

  if (/^[1-9]$/.test(i.key)) return { type: 'selectIndex', index: Number(i.key) - 1 }
  switch (i.key) {
    case '\\':
      return { type: 'toggleSplit' }
    case 'Tab':
      return { type: 'cycleFocus' }
    case 'r':
    case 'R':
      return { type: 'reload' }
    case '=':
    case '+':
      return { type: 'zoomIn' }
    case '-':
      return { type: 'zoomOut' }
    case '0':
      return { type: 'zoomReset' }
  }
  if (i.code === 'Backslash') return { type: 'toggleSplit' }
  return null
}

/**
 * Gắn xử lý phím tắt cho một webContents. Phải gắn cho MỌI webContents (sidebar và các view Zalo),
 * vì khi focus nằm trong view Zalo thì sidebar không nhận được phím.
 */
export function attachShortcuts(
  wc: WebContents,
  isDev: boolean,
  run: (action: ShortcutAction, source: WebContents) => void,
): void {
  wc.on('before-input-event', (event, input) => {
    const action = matchShortcut(input, isDev)
    if (!action) return
    event.preventDefault()
    run(action, wc)
  })
}
