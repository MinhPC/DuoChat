import { useState } from 'react'
import type { AppState } from '../../shared/ipc'
import { vi } from '../../shared/i18n/vi'
import { AccountItem } from './AccountItem'

interface Props {
  state: AppState
  onAdd: () => void
  onSettings: () => void
}

export function Sidebar({ state, onAdd, onSettings }: Props): React.JSX.Element {
  const { accounts, layout, unread } = state
  const [dragId, setDragId] = useState<string | null>(null)
  const split = layout.mode === 'split'
  const canSplit = split || accounts.length >= 2

  const drop = (targetId: string): void => {
    if (!dragId || dragId === targetId) return
    const ids = accounts.map((a) => a.id).filter((id) => id !== dragId)
    ids.splice(ids.indexOf(targetId), 0, dragId)
    void window.duochat.reorderAccounts(ids)
    setDragId(null)
  }

  return (
    <nav className="sidebar" style={{ width: state.sidebarWidth }}>
      <div className="sidebar-list">
        {accounts.map((a, i) => {
          const pane =
            split && a.id === layout.leftAccountId
              ? 'left'
              : split && a.id === layout.rightAccountId
                ? 'right'
                : null
          const shown = split ? pane !== null : a.id === layout.activeAccountId
          return (
            <AccountItem
              key={a.id}
              account={a}
              index={i}
              unread={unread[a.id] ?? 0}
              shown={shown}
              focused={shown && (!split || pane === layout.focusedPane)}
              onSelect={() => void window.duochat.selectAccount(a.id)}
              onContextMenu={() => void window.duochat.showAccountMenu(a.id)}
              onDragStart={() => setDragId(a.id)}
              onDrop={() => drop(a.id)}
            />
          )
        })}
        <button className="side-btn" title={vi.sidebar.addAccount} onClick={onAdd}>
          +
        </button>
      </div>
      <div className="sidebar-bottom">
        <button
          className={`side-btn${split ? ' on' : ''}`}
          title={vi.sidebar.toggleSplit}
          disabled={!canSplit}
          onClick={() => void window.duochat.toggleSplit()}
        >
          ⇆
        </button>
        <button className="side-btn" title={vi.sidebar.settings} onClick={onSettings}>
          ⚙
        </button>
      </div>
    </nav>
  )
}
