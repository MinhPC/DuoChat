interface ToastView {
  accountName: string
  color: string
  initial: string
  title: string
  body: string
  count: number
  sound: 'default' | 'soft' | 'off'
  playSound: boolean
  senderAvatar: string | null
}

declare global {
  interface Window {
    duochatToast: {
      onData(cb: (view: ToastView) => void): void
      click(): void
      dismiss(): void
      hover(hovered: boolean): void
    }
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

let audio: AudioContext | null = null

/** Âm báo tạo bằng WebAudio để không phải đóng gói file âm thanh. */
function playTone(kind: 'default' | 'soft'): void {
  try {
    audio ??= new AudioContext()
    const notes =
      kind === 'soft'
        ? [{ f: 660, t: 0, d: 0.16, g: 0.05 }]
        : [
            { f: 880, t: 0, d: 0.11, g: 0.12 },
            { f: 1175, t: 0.12, d: 0.16, g: 0.12 },
          ]
    const now = audio.currentTime
    for (const n of notes) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = n.f
      gain.gain.setValueAtTime(0, now + n.t)
      gain.gain.linearRampToValueAtTime(n.g, now + n.t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d)
      osc.connect(gain).connect(audio.destination)
      osc.start(now + n.t)
      osc.stop(now + n.t + n.d + 0.02)
    }
  } catch {
    /* không có thiết bị âm thanh: bỏ qua */
  }
}

function render(v: ToastView): void {
  const avatar = $('avatar')
  if (v.senderAvatar) {
    avatar.style.background = `center / cover url("${v.senderAvatar}")`
    avatar.textContent = ''
  } else {
    avatar.style.background = v.color
    avatar.textContent = v.initial
  }
  $('account').textContent = v.accountName
  $('title').textContent = v.title
  $('body').textContent = v.body
  $('body').hidden = v.body === ''
  const count = $('count')
  count.hidden = v.count <= 1
  count.textContent = v.count > 99 ? '99+' : String(v.count)
  $('card').hidden = false
  if (v.playSound && v.sound !== 'off') playTone(v.sound)
}

window.duochatToast.onData(render)
const card = $('card')
card.addEventListener('click', () => window.duochatToast.click())
card.addEventListener('mouseenter', () => window.duochatToast.hover(true))
card.addEventListener('mouseleave', () => window.duochatToast.hover(false))
$('close').addEventListener('click', (e) => {
  e.stopPropagation()
  window.duochatToast.dismiss()
})

export {}
