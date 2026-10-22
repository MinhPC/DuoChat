import { useRef } from 'react'
import type { AppState } from '../../shared/ipc'
import { vi } from '../../shared/i18n/vi'
import type { Rect } from '../../shared/types'

const style = (r: Rect): React.CSSProperties => ({
  left: r.x,
  top: r.y,
  width: r.width,
  height: r.height,
})

/**
 * Nền phía sau các view Zalo. Viền focus của pane và thanh kéo được vẽ ở đây (không inject CSS vào Zalo):
 * view Zalo thu vào vài px nên viền shell lộ ra quanh pane đang focus.
 */
export function Stage({ state }: { state: AppState }): React.JSX.Element {
  const { layout, accounts, frames, divider, dragging } = state
  const raf = useRef(0)
  const colorOf = (id: string | null): string =>
    accounts.find((a) => a.id === id)?.color ?? 'var(--accent)'
  const nameOf = (id: string | null): string => accounts.find((a) => a.id === id)?.name ?? ''

  if (accounts.length === 0) {
    return (
      <div className="stage empty">
        <h1>{vi.empty.title}</h1>
        <p>{vi.empty.hint}</p>
      </div>
    )
  }

  // Kéo thanh chia: main ẩn các view Zalo (nếu không chuột bị view nuốt mất) rồi shell nhận pointermove.
  // Nghe ở `window` thay vì dựa vào pointer capture: capture không ổn định khi phần tử bị vẽ lại.
  const startDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    void window.duochat.setDragging(true)
    const move = (ev: PointerEvent): void => {
      const x = ev.clientX
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => void window.duochat.dragSplit(x))
    }
    const end = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
      cancelAnimationFrame(raf.current)
      void window.duochat.setDragging(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
  }

  const pane = (side: 'left' | 'right', rect: Rect | null): React.JSX.Element | null => {
    if (!rect) return null
    const id = side === 'left' ? layout.leftAccountId : layout.rightAccountId
    const focused = layout.focusedPane === side
    return (
      <div
        key={side}
        className={`pane${focused ? ' focused' : ''}${dragging ? ' dragging' : ''}`}
        style={{ ...style(rect), borderColor: focused ? colorOf(id) : undefined }}
      >
        {dragging && <span className="pane-label">{nameOf(id)}</span>}
      </div>
    )
  }

  return (
    <div className="stage">
      {layout.mode === 'split' && (
        <>
          {pane('left', frames.left)}
          {pane('right', frames.right)}
          {divider && (
            <div
              className="divider"
              style={style(divider)}
              onPointerDown={startDrag}
              onDoubleClick={() => void window.duochat.resetSplitRatio()}
            />
          )}
        </>
      )}
    </div>
  )
}
