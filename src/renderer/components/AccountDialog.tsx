import { useEffect, useRef, useState } from 'react'
import { vi } from '../../shared/i18n/vi'
import { ACCOUNT_PALETTE, SOFT_ACCOUNT_LIMIT, type Account } from '../../shared/types'

interface Props {
  mode: 'add' | 'rename'
  account?: Account
  accountCount: number
  onClose: () => void
}

export function AccountDialog({ mode, account, accountCount, onClose }: Props): React.JSX.Element {
  const [name, setName] = useState(account?.name ?? '')
  const [color, setColor] = useState<string>(
    account?.color ?? ACCOUNT_PALETTE[accountCount % ACCOUNT_PALETTE.length],
  )
  const input = useRef<HTMLInputElement>(null)
  const t = vi.dialog

  useEffect(() => input.current?.focus(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (mode === 'add') void window.duochat.addAccount({ name: trimmed, color })
    else if (account) void window.duochat.renameAccount(account.id, trimmed)
    onClose()
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{mode === 'add' ? t.addTitle : t.renameTitle}</h2>
        <label>
          {t.nameLabel}
          <input
            ref={input}
            value={name}
            maxLength={40}
            placeholder={t.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {mode === 'add' && (
          <div className="field">
            <span>{t.colorLabel}</span>
            <div className="palette">
              {ACCOUNT_PALETTE.map((c, i) => (
                <button
                  type="button"
                  key={c}
                  title={vi.colors[i]}
                  aria-pressed={c === color}
                  className={`swatch${c === color ? ' on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        )}
        {mode === 'add' && <p className="hint">{t.autoProfileHint}</p>}
        {mode === 'add' && accountCount >= SOFT_ACCOUNT_LIMIT && (
          <p className="warn">{t.limitWarning}</p>
        )}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            {mode === 'add' ? t.add : t.save}
          </button>
        </div>
      </form>
    </div>
  )
}
