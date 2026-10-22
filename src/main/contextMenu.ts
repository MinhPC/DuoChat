import { clipboard, Menu, shell, type MenuItemConstructorOptions, type WebContents } from 'electron'
import { vi } from '../shared/i18n/vi'
import { isExternalOpenable } from './service'

/** Menu chuột phải cho view Zalo (Electron không có sẵn). */
export function attachContextMenu(wc: WebContents): void {
  wc.on('context-menu', (_event, params) => {
    const t = vi.contextMenu
    const items: MenuItemConstructorOptions[] = []
    const sep = (): void => {
      if (items.length > 0 && items[items.length - 1].type !== 'separator') {
        items.push({ type: 'separator' })
      }
    }

    if (params.linkURL) {
      items.push({ label: t.copyLink, click: () => clipboard.writeText(params.linkURL) })
      if (isExternalOpenable(params.linkURL)) {
        items.push({ label: t.openInBrowser, click: () => void shell.openExternal(params.linkURL) })
      }
    }

    if (params.mediaType === 'image') {
      sep()
      items.push({ label: t.copyImage, click: () => wc.copyImageAt(params.x, params.y) })
      if (params.srcURL) {
        // downloadURL đi qua will-download nên có hộp thoại Save As.
        items.push({ label: t.saveImage, click: () => wc.downloadURL(params.srcURL) })
      }
    }

    const flags = params.editFlags
    if (params.isEditable) {
      sep()
      items.push(
        { label: t.cut, enabled: flags.canCut, click: () => wc.cut() },
        { label: t.copy, enabled: flags.canCopy, click: () => wc.copy() },
        { label: t.paste, enabled: flags.canPaste, click: () => wc.paste() },
        { label: t.selectAll, enabled: flags.canSelectAll, click: () => wc.selectAll() },
      )
    } else if (params.selectionText) {
      sep()
      items.push(
        { label: t.copy, click: () => wc.copy() },
        { label: t.selectAll, click: () => wc.selectAll() },
      )
    }

    if (items.length > 0) Menu.buildFromTemplate(items).popup()
  })
}
