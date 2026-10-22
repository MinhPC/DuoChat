import { useEffect, useRef, useState } from 'react'
import { vi } from '../../shared/i18n/vi'

export function LockScreen(): React.JSX.Element {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [waitUntil, setWaitUntil] = useState(0)
  const [, tick] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const t = vi.lock

  useEffect(() => input.current?.focus(), [])
  // Đếm ngược thời gian chờ khi nhập sai nhiều lần.
  useEffect(() => {
    if (waitUntil <= Date.now()) return
    const id = setInterval(() => {
      tick((n) => n + 1)
      if (Date.now() >= waitUntil) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [waitUntil])

  const remaining = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000))

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (remaining > 0 || pin === '') return
    const r = await window.duochat.unlock(pin)
    setPin('')
    if (r.ok) return
    if (r.retryAfterMs > 0) setWaitUntil(Date.now() + r.retryAfterMs)
    setError(r.error === 'wait' ? '' : t.wrong)
    input.current?.focus()
  }

  return (
    <div className="lock-screen">
      <form className="lock-box" onSubmit={(e) => void submit(e)}>
        <h1>🔒 {t.title}</h1>
        <p>{t.hint}</p>
        <input
          ref={input}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          placeholder={t.pinPlaceholder}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <p className="lock-error" role="alert">
          {remaining > 0 ? t.wait(remaining) : error}
        </p>
        <button type="submit" className="btn primary" disabled={pin === '' || remaining > 0}>
          {t.unlock}
        </button>
      </form>
    </div>
  )
}
