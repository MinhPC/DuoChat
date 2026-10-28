import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AppState,
  type InvokeMap,
  type NoticeKey,
  type Prefs,
  type ShellApi,
} from '../shared/ipc'

function invoke<K extends keyof InvokeMap>(
  channel: K,
  ...args: InvokeMap[K]['in'] extends void ? [] : [InvokeMap[K]['in']]
): Promise<InvokeMap[K]['out']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<InvokeMap[K]['out']>
}

function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: ShellApi = {
  getState: () => invoke(IPC.getState),
  onState: (cb) => subscribe<AppState>(IPC.stateChanged, cb),
  onNotice: (cb) => subscribe<NoticeKey>(IPC.notice, cb),
  onRequestRename: (cb) => subscribe<string>(IPC.requestRename, cb),
  onRequestDnd: (cb) => subscribe<string>(IPC.requestDnd, cb),
  addAccount: (input) => invoke(IPC.addAccount, input),
  renameAccount: (id, name) => invoke(IPC.renameAccount, { id, name }),
  reorderAccounts: (ids) => invoke(IPC.reorderAccounts, ids),
  selectAccount: (id) => invoke(IPC.selectAccount, id),
  showAccountMenu: (id) => invoke(IPC.showAccountMenu, id),
  setDnd: (id, dnd) => invoke(IPC.setDnd, { id, dnd }),
  toggleSplit: () => invoke(IPC.toggleSplit),
  dragSplit: (x) => invoke(IPC.dragSplit, x),
  resetSplitRatio: () => invoke(IPC.resetSplitRatio),
  setOverlay: (open) => invoke(IPC.setOverlay, open),
  setDragging: (dragging) => invoke(IPC.setDragging, dragging),
  updatePrefs: (prefs: Partial<Prefs>) => invoke(IPC.updatePrefs, prefs),
  getMemory: () => invoke(IPC.getMemory),
  getDisk: () => invoke(IPC.getDisk),
  checkUpdate: () => invoke(IPC.checkUpdate),
  startUpdate: () => invoke(IPC.startUpdate),
  lockNow: () => invoke(IPC.lockNow),
  unlock: (pin) => invoke(IPC.unlock, pin),
  setPin: (pin, current) => invoke(IPC.setPin, { pin, current }),
  removePin: (pin) => invoke(IPC.removePin, pin),
  setAutoLock: (minutes) => invoke(IPC.setAutoLock, minutes),
}

contextBridge.exposeInMainWorld('duochat', api)
