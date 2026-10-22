import { useEffect, useState } from 'react'
import { vi } from '../../shared/i18n/vi'
import type { Account } from '../../shared/types'

export function DndDialog({
  account,
  onClose,
}: {
  account?: Account
  onClose: () => void
}): React.JSX.Element | null {
  const [enabled, setEnabled] = useState(account?.dnd.enabled ?? false)
  const [from, setFrom] = useState(account?.dnd.from ?? '22:00')
  const [to, setTo] = useState(account?.dnd.to ?? '07:00')
  const t = vi.dndDialog

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!account) return null

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (from && to) void window.duochat.setDnd(account.id, { enabled, from, to })
    onClose()
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>
          {t.title}: {account.name}
        </h2>
        <label className="check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t.enable}
        </label>
        <div className="row">
          <label>
            {t.from}
            <input
              type="time"
              value={from}
              disabled={!enabled}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            {t.to}
            <input
              type="time"
              value={to}
              disabled={!enabled}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <p className="note">{t.hint}</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {vi.dialog.cancel}
          </button>
          <button type="submit" className="btn primary">
            {vi.dialog.save}
          </button>
        </div>
      </form>
    </div>
  )
}
