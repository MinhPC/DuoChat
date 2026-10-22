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
  addAccount: (input) => invoke(IPC.addAccount, input),
  renameAccount: (id, name) => invoke(IPC.renameAccount, { id, name }),
  reorderAccounts: (ids) => invoke(IPC.reorderAccounts, ids),
  selectAccount: (id) => invoke(IPC.selectAccount, id),
  showAccountMenu: (id) => invoke(IPC.showAccountMenu, id),
  toggleSplit: () => invoke(IPC.toggleSplit),
  dragSplit: (x) => invoke(IPC.dragSplit, x),
  resetSplitRatio: () => invoke(IPC.resetSplitRatio),
  setOverlay: (open) => invoke(IPC.setOverlay, open),
  setDragging: (dragging) => invoke(IPC.setDragging, dragging),
  updatePrefs: (prefs: Partial<Prefs>) => invoke(IPC.updatePrefs, prefs),
}

contextBridge.exposeInMainWorld('duochat', api)
