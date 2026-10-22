import { useEffect, useState } from 'react'
import type { AppState, PinResult, Prefs } from '../../shared/ipc'
import { vi } from '../../shared/i18n/vi'
import { AUTO_LOCK_OPTIONS, MAX_ZOOM, MIN_ZOOM } from '../../shared/types'

interface Props {
  prefs: Prefs
  lock: AppState['lock']
  onClose: () => void
}

type PinMode = 'idle' | 'set' | 'change' | 'remove'

export function SettingsDialog({ prefs, lock, onClose }: Props): React.JSX.Element {
  const t = vi.settings
  const l = vi.lock
  const [mode, setMode] = useState<PinMode>('idle')
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

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
    key: 'startWithWindows' | 'startMinimized' | 'minimizeToTray' | 'notifyPreview',
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
