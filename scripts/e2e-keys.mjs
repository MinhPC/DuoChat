// Kiểm thử phím tắt bằng phím thật của hệ điều hành (SendKeys) và chụp ảnh cửa sổ.
// Cần desktop tương tác. Chỉ gửi phím khi cửa sổ DuoChat đang ở foreground (xem send-keys.ps1).
// Chạy: npm run build && node scripts/e2e-keys.mjs [thư-mục-lưu-ảnh]
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const PORT = 9335
const shotDir = process.argv[2] || os.tmpdir()
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'duochat-keys-'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (name, ok, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`)
}

const env = { ...process.env, DUOCHAT_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electronPath, [root, `--remote-debugging-port=${PORT}`], { env, stdio: 'ignore' })

const targets = async () => (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
async function connect(url) {
  const ws = new WebSocket(url)
  let id = 0
  const p = new Map()
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    p.get(m.id)?.(m)
  }
  await new Promise((r) => (ws.onopen = r))
  return {
    send: (method, params = {}) =>
      new Promise((r) => {
        const i = ++id
        p.set(i, r)
        ws.send(JSON.stringify({ id: i, method, params }))
      }),
  }
}
const ev = async (c, e) => {
  const r = await c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
  return r.result.result.value
}

const keys = (seq) => {
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'send-keys.ps1'), '-ProcId', String(child.pid), '-Keys', seq], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`không gửi được phím ${seq}: ${r.stdout || r.stderr}`)
}
const shot = (name) => {
  const out = path.join(shotDir, name)
  spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'screenshot.ps1'), '-ProcId', String(child.pid), '-Out', out], { encoding: 'utf8' })
  console.log('INFO  ảnh:', out)
}

try {
  let shell
  for (let i = 0; i < 60 && !shell; i++) {
    await sleep(500)
    try {
      shell = (await targets()).find((t) => t.url.includes('renderer/index.html'))
    } catch {
      /* chưa sẵn sàng */
    }
  }
  const sh = await connect(shell.webSocketDebuggerUrl)
  const api = (e) => ev(sh, `window.duochat.${e}`)
  const state = () => api('getState()')
  await api(`addAccount({ name: 'Cá nhân', color: '#2563eb' })`)
  await api(`addAccount({ name: 'Công ty', color: '#16a34a' })`)
  await sleep(12000) // chờ trang tải
  let s = await state()
  const [A, B] = s.accounts
  check('khởi đầu: chế độ đơn, account active là "Công ty"', s.layout.mode === 'single' && s.layout.activeAccountId === B.id)
  shot('single.png')

  keys('^\\')
  await sleep(600)
  s = await state()
  check('Ctrl+\\ bật split', s.layout.mode === 'split', JSON.stringify([s.layout.leftAccountId === B.id, s.layout.rightAccountId === A.id]))
  shot('split.png')

  keys('^{TAB}')
  await sleep(500)
  s = await state()
  check('Ctrl+Tab ở split chuyển focus sang pane phải', s.layout.focusedPane === 'right')

  keys('^2') // "Công ty" đang ở pane trái, pane focus là phải (đang giữ "Cá nhân") → đổi chỗ
  await sleep(500)
  s = await state()
  check('Ctrl+2 đưa account thứ 2 vào pane focus (đổi chỗ với pane kia)', s.layout.rightAccountId === B.id && s.layout.leftAccountId === A.id, JSON.stringify(s.layout))

  keys('^{ADD}')
  await sleep(400)
  s = await state()
  check('Ctrl++ tăng zoom', s.prefs.zoomFactor > 1, String(s.prefs.zoomFactor))
  keys('^0')
  await sleep(400)
  s = await state()
  check('Ctrl+0 về 100%', s.prefs.zoomFactor === 1, String(s.prefs.zoomFactor))
  keys('^{SUBTRACT}')
  await sleep(400)
  s = await state()
  check('Ctrl+- giảm zoom', s.prefs.zoomFactor < 1, String(s.prefs.zoomFactor))
  keys('^0')
  await sleep(300)

  keys('^\\')
  await sleep(600)
  s = await state()
  check('Ctrl+\\ tắt split, active = account ở pane đang focus', s.layout.mode === 'single' && s.layout.activeAccountId === B.id)

  keys('^{TAB}')
  await sleep(500)
  s = await state()
  check('Ctrl+Tab ở chế độ đơn sang account kế tiếp', s.layout.activeAccountId === A.id)
  keys('^1')
  await sleep(400)
  s = await state()
  check('Ctrl+1 chọn account đầu', s.layout.activeAccountId === A.id)

  // Phím thường phải đi tiếp vào trang: gõ chữ vào một ô nhập do ta tạo, kiểm tra nhận được.
  const views = (await targets()).filter((t) => /zalo\.me/.test(t.url))
  let received = false
  for (const v of views) {
    const c = await connect(v.webSocketDebuggerUrl)
    const focused = await ev(c, `document.hasFocus()`)
    if (!focused) continue
    await ev(c, `(() => { window.__typed = ''; document.addEventListener('keydown', e => { window.__typed += e.key }, true); return 1 })()`)
    keys('xyz')
    await sleep(400)
    received = (await ev(c, 'window.__typed')).includes('xyz')
  }
  check('phím thường (xyz) vẫn đi tiếp vào trang Zalo', received)

  // ---------- chuột thật ----------
  const dpr = await ev(sh, 'window.devicePixelRatio')
  const mouse = (action, x, y, x2 = 0, y2 = 0) => {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'send-mouse.ps1'), '-ProcId', String(child.pid), '-Action', action, '-X', String(x), '-Y', String(y), '-X2', String(x2), '-Y2', String(y2), '-Dpr', String(dpr)], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`không gửi được chuột ${action}: ${r.stdout || r.stderr}`)
  }
  keys('^\\')
  await sleep(700)
  s = await state()
  check('(chuột) vào split để thử', s.layout.mode === 'split')
  const L = s.frames.left
  const R = s.frames.right
  mouse('click', R.x + R.width / 2, 400)
  await sleep(500)
  s = await state()
  check('bấm chuột vào view bên phải → pane phải được focus', s.layout.focusedPane === 'right', s.layout.focusedPane)
  mouse('click', L.x + L.width / 2, 400)
  await sleep(500)
  s = await state()
  check('bấm chuột vào view bên trái → pane trái được focus', s.layout.focusedPane === 'left', s.layout.focusedPane)
  const split0 = s.layout.leftAccountId
  const [winW] = await ev(sh, '[window.innerWidth]')
  const target = 72 + (winW - 72) * 0.62
  mouse('drag', s.divider.x + s.divider.width / 2, 400, target, 400)
  await sleep(700)
  s = await state()
  check('kéo thanh chia bằng chuột thật → ratio ≈ 0.62, kết thúc kéo', Math.abs(s.layout.splitRatio - 0.62) < 0.03 && s.dragging === false, `ratio=${s.layout.splitRatio} dragging=${s.dragging}`)
  shot('split-dragged.png')
  check('kéo thanh chia không làm đổi account ở các pane', s.layout.leftAccountId === split0)

  // ---------- xóa account qua menu chuột phải + hộp thoại xác nhận gốc ----------
  keys('^\\') // về chế độ đơn
  await sleep(600)
  await api(`updatePrefs({ minimizeToTray: false })`)
  s = await state()
  const victim = s.accounts[s.accounts.length - 1]
  const victimDir = path.join(userData, 'Partitions', `acc-${victim.id}`)
  mouse('rightclick', 36, 40 + (s.accounts.length - 1) * 60) // avatar thứ n trong sidebar
  await sleep(700)
  shot('menu.png')
  keys('{UP}{ENTER}') // mục cuối của menu = "Xóa tài khoản…"
  await sleep(1000)
  shot('dialog.png')
  keys('{TAB}{ENTER}') // hộp thoại xác nhận: nút mặc định là "Hủy", Tab sang "Xóa"
  await sleep(2500)
  s = await state()
  check('xóa account qua menu chuột phải: còn 1 account', s.accounts.length === 1 && !s.accounts.some((a) => a.id === victim.id), s.accounts.map((a) => a.name).join(','))
  const afterRemove = JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8'))
  check('id được ghi vào pendingPartitionCleanup', afterRemove.pendingPartitionCleanup.includes(victim.id))
  keys('%{F4}') // đóng cửa sổ → thoát thật vì minimizeToTray đã tắt
  await sleep(4000)
  console.log('INFO  thư mục partition còn tồn tại sau khi thoát:', fs.existsSync(victimDir))
  // mở lại: cleanup xóa hẳn
  const child2 = spawn(electronPath, [root, `--remote-debugging-port=${PORT + 1}`], { env, stdio: 'ignore' })
  await sleep(8000)
  check('mở lại: thư mục Partitions/acc-<id> của account đã xóa không còn', !fs.existsSync(victimDir))
  const final = JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8'))
  check('mở lại: pendingPartitionCleanup rỗng', final.pendingPartitionCleanup.length === 0)
  child2.kill()
} catch (e) {
  failures++
  console.log('FAIL  lỗi:', e.message)
} finally {
  child.kill()
  await sleep(500)
  fs.rmSync(userData, { recursive: true, force: true })
}
console.log(failures === 0 ? '\nTẤT CẢ ĐẠT' : `\n${failures} MỤC LỖI`)
process.exit(failures === 0 ? 0 : 1)
