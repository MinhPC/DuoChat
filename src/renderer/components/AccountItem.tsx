import { vi } from '../../shared/i18n/vi'
import type { Account } from '../../shared/types'

interface Props {
  account: Account
  index: number
  unread: number
  needsLogin: boolean
  shown: boolean
  focused: boolean
  onSelect: () => void
  onContextMenu: () => void
  onDragStart: () => void
  onDrop: () => void
}

export function AccountItem(p: Props): React.JSX.Element {
  const { account } = p
  const initial = Array.from(account.name.trim())[0]?.toUpperCase() ?? '?'
  const cls = ['account', p.shown ? 'shown' : '', p.focused ? 'focused' : ''].join(' ')
  return (
    <button
      className={cls}
      title={`${account.name} (Ctrl+${p.index + 1})${account.muted ? ' 🔕' : ''}${p.needsLogin ? ` — ${vi.loginMark}` : ''}`}
      draggable
      onClick={p.onSelect}
      onContextMenu={(e) => {
        e.preventDefault()
        p.onContextMenu()
      }}
      onDragStart={p.onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={p.onDrop}
    >
      {account.avatar ? (
        <img className="avatar" src={account.avatar} alt="" draggable={false} />
      ) : (
        <span className="avatar" style={{ background: account.color }}>
          {initial}
        </span>
      )}
      {p.unread > 0 && <span className="badge">{p.unread > 99 ? '99+' : p.unread}</span>}
      {account.muted && <span className="muted-mark">🔕</span>}
      {p.needsLogin && <span className="login-mark">!</span>}
    </button>
  )
}
