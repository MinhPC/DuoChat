interface UpdatePromptView {
  title: string
  body: string
  note: string
  primary: string
  secondary: string
}

declare global {
  interface Window {
    duochatUpdate: {
      onData(cb: (view: UpdatePromptView) => void): void
      choose(yes: boolean): void
    }
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

window.duochatUpdate.onData((view) => {
  $('title').textContent = view.title
  $('body').textContent = view.body
  $('note').textContent = view.note
  $('primary').textContent = view.primary
  $('later').textContent = view.secondary
  $('card').hidden = false
  $('primary').focus()
})

$('primary').addEventListener('click', () => window.duochatUpdate.choose(true))
$('later').addEventListener('click', () => window.duochatUpdate.choose(false))
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.duochatUpdate.choose(false)
})

export {}
