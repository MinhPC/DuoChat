import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '../shared/ipc'
import { vi } from '../shared/i18n/vi'
import { AccountDialog } from './components/AccountDialog'
import { DndDialog } from './components/DndDialog'
import { LockScreen } from './components/LockScreen'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { Stage } from './components/Stage'

type Dialog =
  | { kind: 'add' }
  | { kind: 'rename'; accountId: string }
  | { kind: 'dnd'; accountId: string }
  | { kind: 'settings' }
  | null

export function App(): React.JSX.Element | null {
  const [state, setState] = useState<AppState | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    void window.duochat.getState().then(setState)
    const offState = window.duochat.onState(setState)
    const offNotice = window.duochat.onNotice((key) => setToast(vi.notice[key]))
    const offRename = window.duochat.onRequestRename((accountId) =>
      setDialog({ kind: 'rename', accountId }),
    )
    const offDnd = window.duochat.onRequestDnd((accountId) => setDialog({ kind: 'dnd', accountId }))
    return () => {
      offDnd()
      offState()
      offNotice()
      offRename()
    }
  }, [])

  // Dialog nằm trong shell nên bị các view Zalo che mất: báo main ẩn view khi có dialog.
  useEffect(() => {
    void window.duochat.setOverlay(dialog !== null)
  }, [dialog])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const closeDialog = useCallback(() => setDialog(null), [])

  if (!state) return null

  return (
    <div className="app">
      <Sidebar
        state={state}
        onAdd={() => setDialog({ kind: 'add' })}
        onSettings={() => setDialog({ kind: 'settings' })}
      />
      <Stage state={state} />
      {dialog?.kind === 'add' && (
        <AccountDialog mode="add" accountCount={state.accounts.length} onClose={closeDialog} />
      )}
      {dialog?.kind === 'rename' && (
        <AccountDialog
          mode="rename"
          account={state.accounts.find((a) => a.id === dialog.accountId)}
          accountCount={state.accounts.length}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'dnd' && (
        <DndDialog
          account={state.accounts.find((a) => a.id === dialog.accountId)}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'settings' && (
        <SettingsDialog prefs={state.prefs} lock={state.lock} onClose={closeDialog} />
      )}
      {state.lock.locked && <LockScreen />}
      {toast && (
        <div className="toast" role="status" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  )
}
