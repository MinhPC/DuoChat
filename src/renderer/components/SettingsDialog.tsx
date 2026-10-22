import { useEffect, useState } from 'react'
import type { AppState, PinResult, Prefs, UpdateCheckResult } from '../../shared/ipc'
import { formatBytes } from '../../shared/format'
import { vi } from '../../shared/i18n/vi'
import { AUTO_LOCK_OPTIONS, MAX_ZOOM, MIN_ZOOM, type Account } from '../../shared/types'

interface Props {
  prefs: Prefs
  lock: AppState['lock']
  accounts: Account[]
  onClose: () => void
}

type PinMode = 'idle' | 'set' | 'change' | 'remove'

export function SettingsDialog({ prefs, lock, accounts, onClose }: Props): React.JSX.Element {
  const t = vi.settings
  const l = vi.lock
  const [mode, setMode] = useState<PinMode>('idle')
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [memory, setMemory] = useState<Record<string, number>>({})
  const [disk, setDisk] = useState<Record<string, number> | null>(null)
  const [checking, setChecking] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')

  const checkUpdate = async (): Promise<void> => {
    setChecking(true)
    setUpdateMsg('')
    const r: UpdateCheckResult | undefined = await window.duochat
      .checkUpdate()
      .catch(() => undefined)
    setChecking(false)
    const u = t.updateResult
    if (!r) return setUpdateMsg(u.error)
    setUpdateMsg(
      r.status === 'latest' || r.status === 'available'
        ? u[r.status](r.version ?? '')
        : u[r.status],
    )
  }

  // RAM mỗi tài khoản, làm mới 3 giây một lần khi hộp thoại đang mở.
  useEffect(() => {
    const load = (): void => void window.duochat.getMemory().then((m) => m && setMemory(m))
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [])

  // Dung lượng ổ đĩa: quét thư mục tốn I/O nên chỉ làm mới 30 giây một lần.
  useEffect(() => {
    const load = (): void => void window.duochat.getDisk().then((d) => d && setDisk(d))
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const reset = (): void => {
    setMode('idle')
    setCurrent('')
    setPin('')
    setConfirm('')
    setError('')
  }

  const explain = (r: PinResult): string => {
    if (r.error === 'wait') return l.wait(Math.ceil(r.retryAfterMs / 1000))
    if (r.error === 'invalid') return l.invalid
    return l.wrong
  }

  const submitPin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    let r: PinResult
    if (mode === 'remove') {
      r = await window.duochat.removePin(current)
    } else {
      if (pin !== confirm) return setError(l.mismatch)
      r = await window.duochat.setPin(pin, mode === 'change' ? current : undefined)
    }
    if (r.ok) reset()
    else setError(explain(r))
  }

  const check = (
    key: 'startWithWindows' | 'startMinimized' | 'minimizeToTray' | 'notifyPreview' | 'autoUpdate',
    label: string,
  ): React.JSX.Element => (
    <label className="check">
      <input
        type="checkbox"
        checked={prefs[key]}
        onChange={(e) => void window.duochat.updatePrefs({ [key]: e.target.checked })}
      />
      {label}
    </label>
  )

  const pinInput = (
    value: string,
    set: (v: string) => void,
    placeholder: string,
    autoFocus = false,
  ): React.JSX.Element => (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={8}
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        set(e.target.value.replace(/\D/g, ''))
        setError('')
      }}
    />
  )

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t.title}</h2>
        {check('startWithWindows', t.startWithWindows)}
        {check('startMinimized', t.startMinimized)}
        {check('minimizeToTray', t.minimizeToTray)}
        {check('notifyPreview', t.notifyPreview)}
        {check('autoUpdate', t.autoUpdate)}
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={checking}
            onClick={() => void checkUpdate()}
          >
            {checking ? t.checking : t.checkUpdate}
          </button>
        </div>
        {updateMsg && (
          <p className="note" role="status">
            {updateMsg}
          </p>
        )}
        <label>
          {t.zoom}: {Math.round(prefs.zoomFactor * 100)}%
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            value={prefs.zoomFactor}
            onChange={(e) =>
              void window.duochat.updatePrefs({ zoomFactor: Number(e.target.value) })
            }
          />
        </label>

        <div className="section">
          <h3>{t.memory}</h3>
          {accounts.map((a) => (
            <div key={a.id} className="row mem">
              <span>{a.name}</span>
              <span>{memory[a.id] ? `${memory[a.id]} MB` : '…'}</span>
            </div>
          ))}
          <p className="note">{t.memoryNote}</p>
        </div>

        <div className="section">
          <h3>{t.disk}</h3>
          {accounts.map((a) => (
            <div key={a.id} className="row mem">
              <span>{a.name}</span>
              <span>{disk ? formatBytes(disk[a.id] ?? 0) : '…'}</span>
            </div>
          ))}
          <p className="note">{t.diskNote}</p>
        </div>

        <div className="section">
          <h3>{l.section}</h3>
          <p className="note">{l.note}</p>
          {mode === 'idle' && !lock.enabled && (
            <button className="btn" onClick={() => setMode('set')}>
              {l.enable}
            </button>
          )}
          {mode === 'idle' && lock.enabled && (
            <>
              <label>
                {l.autoLock}
                <select
                  value={lock.autoLockMinutes}
                  onChange={(e) => void window.duochat.setAutoLock(Number(e.target.value))}
                >
                  {AUTO_LOCK_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? l.autoLockOff : l.autoLockMinutes(m)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row">
                <button className="btn" onClick={() => setMode('change')}>
                  {l.change}
                </button>
                <button className="btn" onClick={() => setMode('remove')}>
                  {l.disable}
                </button>
              </div>
            </>
          )}
          {mode !== 'idle' && (
            <form className="section" onSubmit={(e) => void submitPin(e)}>
              {(mode === 'change' || mode === 'remove') &&
                pinInput(current, setCurrent, l.currentPin, true)}
              {mode !== 'remove' && pinInput(pin, setPin, l.newPin, mode === 'set')}
              {mode !== 'remove' && pinInput(confirm, setConfirm, l.confirmPin)}
              <p className="lock-error" role="alert">
                {error}
              </p>
              <div className="row">
                <button type="button" className="btn" onClick={reset}>
                  {vi.dialog.cancel}
                </button>
                <button type="submit" className="btn primary">
                  {mode === 'remove' ? l.disable : vi.dialog.save}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="note">{t.sessionNote}</p>
        <div className="actions">
          <button className="btn primary" onClick={onClose}>
            {vi.dialog.close}
          </button>
        </div>
      </div>
    </div>
  )
}
