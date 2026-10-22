import { useEffect } from 'react'
import type { Prefs } from '../../shared/ipc'
import { vi } from '../../shared/i18n/vi'
import { MAX_ZOOM, MIN_ZOOM } from '../../shared/types'

interface Props {
  prefs: Prefs
  onClose: () => void
}

export function SettingsDialog({ prefs, onClose }: Props): React.JSX.Element {
  const t = vi.settings
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const check = (key: 'startWithWindows' | 'startMinimized' | 'minimizeToTray', label: string) => (
    <label className="check">
      <input
        type="checkbox"
        checked={prefs[key]}
        onChange={(e) => void window.duochat.updatePrefs({ [key]: e.target.checked })}
      />
      {label}
    </label>
  )

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t.title}</h2>
        {check('startWithWindows', t.startWithWindows)}
        {check('startMinimized', t.startMinimized)}
        {check('minimizeToTray', t.minimizeToTray)}
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
