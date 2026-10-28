import { app, dialog, ipcMain, Menu, type BrowserWindow } from 'electron'
import { IPC, type InvokeMap, type UpdateCheckResult } from '../shared/ipc'
import { vi } from '../shared/i18n/vi'
import { ACCOUNT_PALETTE, ACCOUNT_SOUNDS, AUTO_LOCK_OPTIONS, PREVIEW_MODES } from '../shared/types'
import type { AccountManager } from './accounts'
import { partitionDir } from './cleanup'
import { dirSize } from './diskUsage'
import type { SettingsStore } from './store'

type Handlers = {
  [K in keyof InvokeMap]: (
    arg: InvokeMap[K]['in'],
  ) => InvokeMap[K]['out'] | Promise<InvokeMap[K]['out']>
}

const isString = (v: unknown): v is string => typeof v === 'string'

const LOCKED_ALLOWED: ReadonlySet<string> = new Set([IPC.getState, IPC.unlock])

/** Đăng ký toàn bộ IPC của shell. Chỉ nhận từ webContents của sidebar, không nhận từ view Zalo. */
export function registerIpc(
  win: BrowserWindow,
  manager: AccountManager,
  store: SettingsStore,
  applyLoginItem: () => void,
  checkUpdate: () => Promise<UpdateCheckResult>,
  startUpdate: () => Promise<void>,
): void {
  const shellWc = win.webContents

  const showAccountMenu = (id: string): void => {
    const account = manager.getAccount(id)
    if (!account) return
    const t = vi.accountMenu
    const menu = Menu.buildFromTemplate([
      { label: t.rename, click: () => shellWc.send(IPC.requestRename, id) },
      { label: t.syncProfile, click: () => void manager.syncProfile(id) },
      ...(account.avatar
        ? [{ label: t.clearAvatar, click: () => manager.patchAccount(id, { avatar: null }) }]
        : []),
      { label: t.dnd, click: () => shellWc.send(IPC.requestDnd, id) },
      {
        label: t.color,
        submenu: ACCOUNT_PALETTE.map((color, i) => ({
          label: vi.colors[i],
          type: 'radio' as const,
          checked: account.color === color,
          click: () => manager.patchAccount(id, { color }),
        })),
      },
      {
        label: t.sound,
        submenu: ACCOUNT_SOUNDS.map((sound) => ({
          label: vi.sounds[sound],
          type: 'radio' as const,
          checked: account.sound === sound,
          click: () => manager.patchAccount(id, { sound }),
        })),
      },
      {
        label: t.preview,
        submenu: PREVIEW_MODES.map((preview) => ({
          label: vi.previewModes[preview],
          type: 'radio' as const,
          checked: account.preview === preview,
          click: () => manager.patchAccount(id, { preview }),
        })),
      },
      {
        label: t.mute,
        type: 'checkbox',
        checked: account.muted,
        click: (item) => manager.patchAccount(id, { muted: item.checked }),
      },
      { type: 'separator' },
      { label: t.logout, click: () => void confirmLogout(id) },
      { label: t.remove, click: () => void confirmRemove(id) },
    ])
    menu.popup({ window: win })
  }

  const confirm = async (
    title: string,
    message: string,
    detail: string,
    action: string,
  ): Promise<boolean> => {
    const r = await dialog.showMessageBox(win, {
      type: 'warning',
      title,
      message,
      detail,
      buttons: [action, vi.confirm.cancel],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    })
    return r.response === 0
  }

  const confirmRemove = async (id: string): Promise<void> => {
    const a = manager.getAccount(id)
    if (!a) return
    const c = vi.confirm
    if (await confirm(c.removeTitle, c.removeMessage(a.name), c.removeDetail, c.removeButton)) {
      await manager.removeAccount(id)
    }
  }

  const confirmLogout = async (id: string): Promise<void> => {
    const a = manager.getAccount(id)
    if (!a) return
    const c = vi.confirm
    if (await confirm(c.logoutTitle, c.logoutMessage(a.name), c.logoutDetail, c.logoutButton)) {
      await manager.logout(id)
    }
  }

  const handlers: Handlers = {
    [IPC.getState]: () => manager.getState(),
    [IPC.addAccount]: (input) => {
      if (!input || !isString(input.name) || !isString(input.color)) return
      manager.addAccount(input.name, input.color)
    },
    [IPC.renameAccount]: (input) => {
      if (!input || !isString(input.id) || !isString(input.name)) return
      manager.patchAccount(input.id, { name: input.name })
    },
    [IPC.reorderAccounts]: (ids) => {
      if (Array.isArray(ids) && ids.every(isString)) manager.reorder(ids)
    },
    [IPC.selectAccount]: (id) => {
      if (isString(id)) manager.select(id, { swapIfOther: true })
    },
    [IPC.showAccountMenu]: (id) => {
      if (isString(id)) showAccountMenu(id)
    },
    [IPC.setDnd]: (input) => {
      if (!input || !isString(input.id) || !input.dnd) return
      const { enabled, from, to } = input.dnd
      if (typeof enabled === 'boolean' && isString(from) && isString(to)) {
        manager.setDnd(input.id, { enabled, from, to }) // store.update chuẩn hóa giờ sai về mặc định
      }
    },
    [IPC.toggleSplit]: () => manager.toggleSplit(),
    [IPC.dragSplit]: (x) => {
      if (typeof x === 'number' && Number.isFinite(x)) manager.dragSplitTo(x)
    },
    [IPC.resetSplitRatio]: () => manager.resetSplitRatio(),
    [IPC.setOverlay]: (open) => manager.setOverlay(open === true),
    [IPC.setDragging]: (d) => manager.setDragging(d === true),
    [IPC.getMemory]: () => manager.memoryUsage(),
    [IPC.getDisk]: async () => {
      const userData = app.getPath('userData')
      const out: Record<string, number> = {}
      await Promise.all(
        store.get().accounts.map(async (a) => {
          const dir = partitionDir(userData, a.id)
          out[a.id] = dir ? await dirSize(dir) : 0
        }),
      )
      return out
    },
    [IPC.checkUpdate]: () => checkUpdate(),
    [IPC.startUpdate]: () => startUpdate(),
    [IPC.lockNow]: () => manager.lockNow(),
    [IPC.unlock]: (pin) => manager.unlock(pin),
    [IPC.setPin]: (input) => manager.setPin(input?.pin, input?.current),
    [IPC.removePin]: (pin) => manager.removePin(pin),
    [IPC.setAutoLock]: (minutes) => {
      if ((AUTO_LOCK_OPTIONS as readonly number[]).includes(minutes)) manager.setAutoLock(minutes)
    },
    [IPC.updatePrefs]: (prefs) => {
      if (!prefs || typeof prefs !== 'object') return
      store.update((s) => ({
        ...s,
        startWithWindows:
          typeof prefs.startWithWindows === 'boolean' ? prefs.startWithWindows : s.startWithWindows,
        startMinimized:
          typeof prefs.startMinimized === 'boolean' ? prefs.startMinimized : s.startMinimized,
        minimizeToTray:
          typeof prefs.minimizeToTray === 'boolean' ? prefs.minimizeToTray : s.minimizeToTray,
        notifyPreview:
          typeof prefs.notifyPreview === 'boolean' ? prefs.notifyPreview : s.notifyPreview,
      }))
      if (typeof prefs.zoomFactor === 'number' && Number.isFinite(prefs.zoomFactor)) {
        manager.setZoom(prefs.zoomFactor)
      }
      applyLoginItem()
      manager.relayout()
    },
  }

  for (const channel of Object.keys(handlers) as (keyof InvokeMap)[]) {
    ipcMain.handle(channel, (event, arg: unknown) => {
      if (event.sender !== shellWc) throw new Error('IPC từ nguồn không hợp lệ')
      // Đang khóa: chỉ cho đọc trạng thái và mở khóa.
      if (manager.isLocked() && !LOCKED_ALLOWED.has(channel)) return undefined
      return (handlers[channel] as (a: unknown) => unknown)(arg)
    })
  }
}
