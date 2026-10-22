// Kiểm thử tự động bản đã build: chạy app thật với thư mục dữ liệu tạm, điều khiển qua CDP.
// Cần mạng (tải chat.zalo.me, chưa đăng nhập). Chạy: npm run build && node scripts/e2e.mjs
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 9333
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'duochat-e2e-'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (name, ok, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`)
}

function launch() {
  const env = { ...process.env, DUOCHAT_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE
  // DUOCHAT_EXE: chạy bản đã đóng gói (dist/win-unpacked/DuoChat.exe) thay vì chạy từ mã nguồn.
  const exe = process.env.DUOCHAT_EXE
  const child = spawn(exe || electronPath, [...(exe ? [] : [root]), `--remote-debugging-port=${PORT}`], { env, stdio: process.env.E2E_VERBOSE ? 'inherit' : 'ignore' })
  return child
}

async function targets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json`)
  return res.json()
}

async function waitFor(fn, timeoutMs = 30000, label = '') {
  const t0 = Date.now()
  for (;;) {
    try {
      const v = await fn()
      if (v) return v
    } catch {
      /* chưa sẵn sàng */
    }
    if (Date.now() - t0 > timeoutMs) throw new Error('hết thời gian chờ ' + label)
    await sleep(300)
  }
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) pending.get(m.id)(m)
    }
    ws.onerror = reject
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((r) => {
            const i = ++id
            pending.set(i, r)
            ws.send(JSON.stringify({ id: i, method, params }))
          }),
        close: () => ws.close(),
      })
  })
}

async function evalIn(c, expression) {
  // Có thời hạn: nếu đích CDP đã đóng (vd cửa sổ toast bị hủy) thì báo lỗi thay vì treo vô hạn.
  const r = await Promise.race([
    c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
    sleep(15000).then(() => {
      throw new Error('evalIn quá thời hạn (đích CDP có thể đã đóng): ' + expression.slice(0, 60))
    }),
  ])
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
  return r.result.result.value
}

const shellTarget = async () =>
  (await targets()).find((t) => t.type === 'page' && t.url.includes('renderer/index.html'))
const viewTargets = async () =>
  (await targets()).filter((t) => t.type === 'page' && /zalo\.me/.test(t.url))

async function stop(child) {
  const exited = new Promise((r) => child.once('exit', r))
  // Thoát "mềm" bằng đóng cửa sổ (minimizeToTray đã tắt) để chạy luôn đường before-quit → flush.
  try {
    const c = await connect((await shellTarget()).webSocketDebuggerUrl)
    await Promise.race([c.send('Browser.close'), sleep(2000)])
  } catch {
    child.kill()
  }
  await Promise.race([exited, sleep(10000)])
  child.kill()
}

console.log('userData:', userData)
let app = launch()
try {
  // ---------- 1. khởi động, sidebar ----------
  const shell = await waitFor(shellTarget, 30000, 'shell')
  const sh = await connect(shell.webSocketDebuggerUrl)
  const api = (expr) => evalIn(sh, `window.duochat.${expr}`)
  const state = () => api('getState()')

  let s = await waitFor(state, 10000, 'getState')
  check('shell tải được và expose window.duochat', s && Array.isArray(s.accounts))
  check('ban đầu chưa có account, chế độ đơn', s.accounts.length === 0 && s.layout.mode === 'single')
  check('shell không lộ require/process (sandbox)', (await evalIn(sh, `typeof require + typeof process`)) === 'undefinedundefined')
  check('shell chỉ expose ShellApi (không có ipcRenderer)', (await evalIn(sh, `typeof window.ipcRenderer`)) === 'undefined')

  // ---------- 2. thêm 2 account ----------
  await api(`addAccount({ name: 'Cá nhân', color: '#2563eb' })`)
  await api(`addAccount({ name: 'Công ty', color: '#16a34a' })`)
  s = await state()
  check('thêm 2 account', s.accounts.length === 2, s.accounts.map((a) => a.name).join(', '))
  const [A, B] = s.accounts
  check('account mới nhất đang active (chế độ đơn)', s.layout.activeAccountId === B.id)

  const views = await waitFor(async () => {
    const v = await viewTargets()
    return v.length >= 2 ? v : null
  }, 40000, '2 view Zalo')
  check('có 2 WebContentsView riêng tải chat.zalo.me', views.length === 2, views.map((v) => new URL(v.url).host).join(', '))
  const vc = []
  for (const v of views) vc.push(await connect(v.webSocketDebuggerUrl))

  // ---------- 3. UA, quyền, shim ----------
  // Đọc UA ngay khi document đầu tiên của zalo.me được commit (target mới tạo còn là about:blank).
  await waitFor(() => evalIn(vc[0], `/zalo\\.me$/.test(location.hostname)`), 40000, 'document zalo.me đầu tiên')
  const earlyUa = await evalIn(vc[0], 'navigator.userAgent')
  check('UA của document zalo.me đầu tiên không chứa Electron hoặc tên app', !/Electron|duochat/i.test(earlyUa), earlyUa)
  for (const c of vc) {
    await waitFor(
      () => evalIn(c, `/zalo\\.me$/.test(location.hostname) && document.readyState === 'complete' && window.__duochatShimInstalled === true`),
      40000,
      'trang Zalo tải xong + shim',
    )
  }
  const ua = await evalIn(vc[0], 'navigator.userAgent')
  check('UA sau khi tải xong không chứa Electron hoặc tên app', !/Electron|duochat/i.test(ua), ua)
  const brands = await evalIn(vc[0], `JSON.stringify(navigator.userAgentData?.brands ?? null)`)
  console.log('INFO  userAgentData.brands =', brands)
  const geo = await evalIn(
    vc[0],
    `new Promise(r => navigator.geolocation.getCurrentPosition(() => r('granted'), e => r('denied:' + e.code)))`,
  )
  check('quyền geolocation bị từ chối', String(geo).startsWith('denied'), geo)
  const perm = await evalIn(vc[0], `navigator.permissions.query({ name: 'geolocation' }).then(p => p.state)`)
  check('permissions.query geolocation = denied', perm === 'denied', perm)
  const bridge = await evalIn(vc[0], `Object.keys(window.__duochat || {}).join(',')`)
  check('cầu nối __duochat chỉ có đúng một hàm notify', bridge === 'notify', bridge)
  const leak = await evalIn(vc[0], `typeof require + '/' + typeof process + '/' + typeof window.ipcRenderer`)
  check('trang Zalo không thấy Node/ipcRenderer', leak === 'undefined/undefined/undefined', leak)
  await waitFor(() => evalIn(vc[0], 'window.__duochatShimInstalled === true'), 15000, 'shim')
  check('shim thông báo đã được cài (dom-ready)', true)
  check('Notification.permission luôn là granted', (await evalIn(vc[0], 'Notification.permission')) === 'granted')
  check('requestPermission resolve granted', (await evalIn(vc[0], `Notification.requestPermission()`)) === 'granted')

  // ---------- 4. shim → main → badge ----------
  for (let i = 0; i < vc.length; i++) {
    console.log(`INFO  view ${i} visibilityState = ${await evalIn(vc[i], 'document.visibilityState')}`)
  }
  // Thứ tự đích CDP không cố định: xác định view nào thuộc A bằng cách bắn thử, chỉ view của A mới làm unread[A] tăng.
  await evalIn(vc[0], `new Notification('Nam', { body: 'Xin chào' }); 1`)
  await sleep(800)
  s = await state()
  const hiddenIdx = s.unread[A.id] > 0 ? 0 : 1 // view của account A (đang ở nền)
  await evalIn(vc[1], `new Notification('Nam', { body: 'Xin chào' }); 1`) // view còn lại cũng bắn một lần
  await sleep(800)
  s = await state()
  console.log('INFO  unread sau thông báo =', JSON.stringify(s.unread), '| hiddenIdx =', hiddenIdx)
  check('thông báo từ view ẩn tăng badge fallback đúng account', s.unread[A.id] === 1, JSON.stringify(s.unread))
  // Account đang hiển thị: 0 nếu cửa sổ đang focus (đã xem), 1 nếu cửa sổ không focus. Cả hai đều đúng thiết kế.
  check('account đang hiển thị: 0 (đang xem) hoặc 1 (cửa sổ không focus)', s.unread[B.id] === 0 || s.unread[B.id] === 1, JSON.stringify(s.unread))
  check('tổng chưa đọc = tổng từng account', s.totalUnread === s.unread[A.id] + s.unread[B.id], String(s.totalUnread))

  // ---------- toast riêng của DuoChat ----------
  const toastList = async () => (await targets()).filter((x) => x.type === 'page' && x.url.includes('toast.html'))
  const toastTargets = await waitFor(async () => {
    const t = await toastList()
    return t.length ? t : null
  }, 10000, 'cửa sổ toast')
  check('có toast cho account ở nền (mỗi account một thẻ)', toastTargets.length >= 1, `${toastTargets.length} toast`)
  // Tìm thẻ của account A theo tên hiển thị; giữ thẻ lại (hover) để hẹn giờ 7s không đóng nó giữa chừng.
  let tc = null
  for (const t of toastTargets) {
    const c = await connect(t.webSocketDebuggerUrl)
    await sleep(300)
    if (/Cá nhân/.test(await evalIn(c, 'document.getElementById("card").innerText'))) { tc = c; break }
    c.close()
  }
  if (!tc) throw new Error('không tìm thấy thẻ toast của account A')
  await evalIn(tc, 'window.duochatToast.hover(true); 1')
  const toastText = await evalIn(tc, 'document.getElementById("card").innerText')
  console.log('INFO  nội dung toast =', JSON.stringify(toastText))
  check('toast hiện tên account, chữ cái avatar và "Có tin nhắn mới"', /Có tin nhắn mới/.test(toastText) && /(Cá nhân|Công ty)/.test(toastText))
  check('toast mặc định ẨN nội dung tin (không lộ "Xin chào" / tên người gửi)', !/Xin chào|Nam/.test(toastText), toastText)
  // gom tin: bắn thêm 2 thông báo từ view ẩn → vẫn một thẻ, số đếm tăng
  for (let i = 0; i < 2; i++) await evalIn(vc[hiddenIdx], `new Notification('Nam', { body: 'Tin tiếp' }); 1`)
  await sleep(800)
  const same = (await targets()).filter((x) => x.type === 'page' && x.url.includes('toast.html'))
  check('nhiều tin cùng account gom vào cùng một thẻ (không sinh thêm thẻ)', same.length === toastTargets.length, `${same.length} thẻ`)
  const merged = await evalIn(tc, 'document.getElementById("card").innerText')
  check('thẻ gom hiện "3 tin nhắn mới" và số đếm 3', /3 tin nhắn mới/.test(merged) && /\b3\b/.test(merged), JSON.stringify(merged))
  tc.close()

  // ---------- phát hiện cần đăng nhập (chỉ xét URL) ----------
  const loginState = await waitFor(async () => {
    const st = await state()
    return st.needsLogin[A.id] && st.needsLogin[B.id] ? st : null
  }, 20000, 'needsLogin').catch(() => null)
  s = loginState || (await state())
  check('trang đăng nhập → needsLogin = true cho cả hai account', s.needsLogin[A.id] === true && s.needsLogin[B.id] === true, JSON.stringify(s.needsLogin))

  // ---------- không làm phiền theo khung giờ ----------
  const pad = (n) => String(n).padStart(2, '0')
  const nowD = new Date()
  const hhmm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes())
  const dndOn = { enabled: true, from: hhmm(new Date(nowD.getTime() - 3600e3)), to: hhmm(new Date(nowD.getTime() + 3600e3)) }
  // đóng thẻ toast đang có (bấm nút ×) rồi bật DND cho account ở nền
  for (const t of (await targets()).filter((x) => x.type === 'page' && x.url.includes('toast.html'))) {
    try {
      const c = await connect(t.webSocketDebuggerUrl)
      await Promise.race([evalIn(c, 'document.getElementById("close").click(); 1'), sleep(2500)])
      c.close()
    } catch {
      /* thẻ đã tự đóng */
    }
  }
  await sleep(600)
  await api(`setDnd('${A.id}', ${JSON.stringify(dndOn)})`)
  const unreadBeforeDnd = (await state()).unread[A.id]
  await evalIn(vc[hiddenIdx], `new Notification('Nam', { body: 'Trong DND' }); 1`)
  await sleep(1000)
  const toastsDuringDnd = (await targets()).filter((x) => x.type === 'page' && x.url.includes('toast.html'))
  check('trong khung DND: không hiện toast', toastsDuringDnd.length === 0, String(toastsDuringDnd.length))
  check('trong khung DND: badge vẫn đếm', (await state()).unread[A.id] === unreadBeforeDnd + 1, JSON.stringify((await state()).unread))
  await api(`setDnd('${A.id}', { enabled: false, from: '22:00', to: '07:00' })`)
  await evalIn(vc[hiddenIdx], `new Notification('Nam', { body: 'Hết DND' }); 1`)
  const toastBack = await waitFor(async () => (await targets()).some((x) => x.type === 'page' && x.url.includes('toast.html')), 6000, 'toast sau DND').catch(() => false)
  check('ngoài DND: toast hiện lại', toastBack === true)

  // ---------- khóa PIN ----------
  check('PIN không hợp lệ bị từ chối', (await api(`setPin('12')`)).error === 'invalid')
  check('đặt PIN 1234', (await api(`setPin('1234')`)).ok === true && (await state()).lock.enabled === true)
  await api('lockNow()')
  s = await state()
  check('khóa ngay: locked = true', s.lock.locked === true)
  const activeBefore = s.layout.activeAccountId
  await api(`selectAccount('${activeBefore === A.id ? B.id : A.id}')`)
  await api('toggleSplit()')
  s = await state()
  check('đang khóa: không đổi được account/layout', s.layout.activeAccountId === activeBefore && s.layout.mode === 'single')
  check('PIN sai không mở được', (await api(`unlock('0000')`)).ok === false && (await state()).lock.locked === true)
  const okUnlock = await api(`unlock('1234')`)
  check('PIN đúng mở khóa', okUnlock.ok === true && (await state()).lock.locked === false)
  await api('lockNow()')
  let last
  for (let i = 0; i < 6; i++) last = await api(`unlock('9999')`)
  check('sai 6 lần: bị bắt chờ', last.retryAfterMs > 0, JSON.stringify(last))
  const during = await api(`unlock('1234')`)
  check('đang bị chờ: PIN đúng cũng bị từ chối', during.ok === false && during.error === 'wait', JSON.stringify(during))
  await sleep(Math.min(during.retryAfterMs, 4000) + 300)
  check('hết thời gian chờ: PIN đúng mở được', (await api(`unlock('1234')`)).ok === true)
  check('đổi PIN cần PIN hiện tại', (await api(`setPin('5678', '0000')`)).ok === false)
  check('tắt khóa bằng PIN đúng', (await api(`removePin('1234')`)).ok === true && (await state()).lock.enabled === false)
  await sleep(800)
  const rawSettings = fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')
  check('settings.json không chứa PIN dạng rõ', !/1234|5678|9999/.test(rawSettings))

  // ---------- 5. split, layout, bounds thật ----------
  const contentSize = await evalIn(sh, `[window.innerWidth, window.innerHeight]`)
  s = await state()
  const viewByWidth = async () => {
    const out = []
    for (const c of vc) out.push(await evalIn(c, `[window.innerWidth, window.innerHeight, document.visibilityState]`))
    return out
  }
  console.log('INFO  cửa sổ (shell) =', contentSize, ' single frame =', JSON.stringify(s.frames.single))
  let dims = await viewByWidth()
  check(
    'chế độ đơn: view active rộng bằng phần còn lại sau sidebar',
    dims.some((d) => d[0] === contentSize[0] - 72 && d[1] === contentSize[1]),
    JSON.stringify(dims),
  )

  await api('toggleSplit()')
  s = await state()
  check('bật split: trái = account active cũ, phải = account kế tiếp', s.layout.mode === 'split' && s.layout.leftAccountId === B.id && s.layout.rightAccountId === A.id, JSON.stringify(s.layout))
  check('split: có 2 pane + thanh kéo', !!(s.frames.left && s.frames.right && s.divider))
  await sleep(500)
  dims = await viewByWidth()
  const expL = s.frames.left.width - 4
  const expR = s.frames.right.width - 4
  check('split: bounds thật của 2 view khớp layout (thu vào 2px mỗi cạnh)', dims.filter((d) => d[0] === expL || d[0] === expR).length === 2, `kỳ vọng ${expL}/${expR}, thực tế ${JSON.stringify(dims)}`)
  check('split: tổng pane + thanh kéo lấp kín phần còn lại', s.frames.left.width + s.divider.width + s.frames.right.width === contentSize[0] - 72)

  // kéo thanh chia
  await api('setDragging(true)')
  check('đang kéo: main chuyển sang trạng thái dragging (view Zalo tạm ẩn)', (await state()).dragging === true)
  await api(`dragSplit(${72 + Math.round((contentSize[0] - 72) * 0.2)})`)
  s = await state()
  check('kéo quá mép bị kẹp ở 0.3', s.layout.splitRatio === 0.3, String(s.layout.splitRatio))
  await api(`dragSplit(${72 + Math.round((contentSize[0] - 72) * 0.6)})`)
  s = await state()
  check('kéo tới 60%: ratio ≈ 0.6', Math.abs(s.layout.splitRatio - 0.6) < 0.02, String(s.layout.splitRatio))
  await api('setDragging(false)')
  await api('resetSplitRatio()')
  s = await state()
  check('double-click thanh kéo về 0.5', s.layout.splitRatio === 0.5)

  // kéo thanh chia bằng chuột thật (sự kiện chuột gửi vào shell): pointer capture + ẩn view khi kéo
  const mouse = (type, x, y, clickCount = 1) =>
    sh.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount })
  s = await state()
  const dx = s.divider.x + s.divider.width / 2
  await mouse('mousePressed', dx, 300)
  await sleep(300)
  check('nhấn chuột lên thanh kéo: bắt đầu dragging', (await state()).dragging === true)
  await mouse('mouseMoved', 72 + (contentSize[0] - 72) * 0.65, 300)
  await sleep(300)
  await mouse('mouseReleased', 72 + (contentSize[0] - 72) * 0.65, 300)
  await sleep(400)
  s = await state()
  check('thả chuột: dragging kết thúc, tỉ lệ ≈ 0.65', s.dragging === false && Math.abs(s.layout.splitRatio - 0.65) < 0.02, `dragging=${s.dragging} ratio=${s.layout.splitRatio}`)
  const dx2 = s.divider.x + s.divider.width / 2
  for (const n of [1, 2]) {
    await mouse('mousePressed', dx2, 300, n)
    await mouse('mouseReleased', dx2, 300, n)
  }
  await sleep(500)
  s = await state()
  check('double-click chuột lên thanh kéo về 0.5', s.layout.splitRatio === 0.5 && s.dragging === false, String(s.layout.splitRatio))

  // single instance: mở lần hai cùng thư mục dữ liệu thì thoát ngay, cửa sổ cũ vẫn còn
  const second = spawn(process.env.DUOCHAT_EXE || electronPath, process.env.DUOCHAT_EXE ? [] : [root], { env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, DUOCHAT_USER_DATA: userData }, stdio: 'ignore' })
  const secondCode = await Promise.race([new Promise((r) => second.once('exit', r)), sleep(15000).then(() => 'timeout')])
  if (secondCode === 'timeout') second.kill()
  check('single instance: tiến trình thứ hai tự thoát', secondCode !== 'timeout', `exit=${secondCode}`)
  check('single instance: cửa sổ đầu tiên vẫn chạy', !!(await shellTarget()))

  // click avatar ở split: pane focus nhận account; account ở pane kia thì đổi chỗ
  const leftBefore = s.layout.leftAccountId
  await api(`selectAccount('${s.layout.rightAccountId}')`)
  s = await state()
  check('click avatar account ở pane kia: hai pane đổi chỗ', s.layout.rightAccountId === leftBefore && s.layout.leftAccountId !== leftBefore)

  // ---------- 6. zoom ----------
  await api(`updatePrefs({ zoomFactor: 1.5 })`)
  await sleep(300)
  const dpr = await evalIn(vc[0], 'window.devicePixelRatio')
  const baseDpr = (await evalIn(sh, 'window.devicePixelRatio'))
  check('zoom 150% áp cho view Zalo, không áp cho sidebar', Math.abs(dpr / baseDpr - 1.5) < 0.01 && baseDpr === (await evalIn(sh, 'window.devicePixelRatio')), `${dpr} / ${baseDpr}`)
  await api(`updatePrefs({ zoomFactor: 9 })`)
  s = await state()
  check('zoom bị kẹp tối đa 2.0', s.prefs.zoomFactor === 2)
  await api(`updatePrefs({ zoomFactor: 1 })`)

  // ---------- RAM theo account, tự cập nhật ----------
  const mem = await api('getMemory()')
  check('RAM từng account đọc được (> 0 MB)', Object.keys(mem).length === 2 && Object.values(mem).every((v) => v > 0), JSON.stringify(mem))
  check('tự cập nhật mặc định TẮT (không kết nối ra ngoài)', (await state()).prefs.autoUpdate === false)

  // Phím tắt (before-input-event) KHÔNG kiểm ở đây: CDP Input.dispatchKeyEvent không đi qua đường đó.
  // Xem scripts/e2e-keys.mjs (gửi phím thật của hệ điều hành).

  // ---------- 8. lưu cấu hình ----------
  await api(`renameAccount('${A.id}', 'Cá nhân 2')`)
  await api(`reorderAccounts(['${B.id}', '${A.id}'])`)
  await api(`updatePrefs({ minimizeToTray: false })`)
  await sleep(800)
  const savedPath = path.join(userData, 'settings.json')
  check('settings.json đã được ghi', fs.existsSync(savedPath))
  sh.close()
  for (const c of vc) c.close()

  // ---------- 9. thoát mềm rồi mở lại: còn account và layout ----------
  await stop(app)
  const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'))
  check('sau khi thoát: schemaVersion 2, 2 account, đã đổi tên + sắp xếp', saved.schemaVersion === 2 && saved.accounts.length === 2 && saved.accounts[0].id === B.id && saved.accounts[1].name === 'Cá nhân 2')
  const logFile = path.join(userData, 'logs', 'duochat.log')
  const logText = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : ''
  check('có nhật ký kỹ thuật (app_start, locked…)', /app_start/.test(logText) && /locked/.test(logText), logFile)
  check('nhật ký không chứa nội dung tin/PIN', !/Xin chào|Tin tiếp|Trong DND|Hết DND|Nam|1234|9999/.test(logText))
  const partDir = path.join(userData, 'Partitions')
  const parts = fs.existsSync(partDir) ? fs.readdirSync(partDir) : []
  console.log('INFO  Partitions trên đĩa =', parts)
  check('thư mục partition đặt tên acc-<id> như spec', parts.includes(`acc-${A.id}`) && parts.includes(`acc-${B.id}`), parts.join(', '))

  // ---------- 10. cleanup partition mồ côi ----------
  const ghost = '99999999-9999-4999-8999-999999999999'
  fs.mkdirSync(path.join(partDir, `acc-${ghost}`, 'Local Storage'), { recursive: true })
  fs.writeFileSync(path.join(partDir, `acc-${ghost}`, 'Cookies'), 'x')
  saved.pendingPartitionCleanup = [ghost]
  fs.writeFileSync(savedPath, JSON.stringify(saved))
  app = launch()
  const shell2 = await waitFor(shellTarget, 30000, 'shell lần 2')
  const sh2 = await connect(shell2.webSocketDebuggerUrl)
  const s2 = await waitFor(() => evalIn(sh2, 'window.duochat.getState()'), 10000)
  check('mở lại: khôi phục 2 account đúng thứ tự', s2.accounts.length === 2 && s2.accounts[0].id === B.id)
  check('mở lại: partition của account mồ côi đã bị xóa hẳn', !fs.existsSync(path.join(partDir, `acc-${ghost}`)))
  check('mở lại: partition của account còn sống được giữ', fs.existsSync(path.join(partDir, `acc-${A.id}`)) && fs.existsSync(path.join(partDir, `acc-${B.id}`)))
  await sleep(1500)
  const after = JSON.parse(fs.readFileSync(savedPath, 'utf8'))
  check('mở lại: id đã dọn khỏi pendingPartitionCleanup', after.pendingPartitionCleanup.length === 0)

  // chụp màn hình để xem bằng mắt
  sh2.close()
  console.log('INFO  app đang chạy lần 2, chờ chụp màn hình…')
  await sleep(Number(process.env.E2E_HOLD_MS || 0))
} catch (e) {
  failures++
  console.log('FAIL  lỗi không mong đợi:', e.message)
  // Chẩn đoán: các đích CDP còn lại và nhật ký kỹ thuật (không chứa nội dung chat).
  try {
    console.log('INFO  đích CDP:', (await targets()).map((t) => `${t.type}:${t.url.slice(0, 50)}`).join(' | '))
    const lf = path.join(userData, 'logs', 'duochat.log')
    if (fs.existsSync(lf)) console.log('INFO  nhật ký:\n' + fs.readFileSync(lf, 'utf8'))
  } catch {
    /* app đã thoát */
  }
} finally {
  await stop(app).catch(() => undefined)
  fs.rmSync(userData, { recursive: true, force: true })
}
console.log(failures === 0 ? '\nTẤT CẢ ĐẠT' : `\n${failures} MỤC LỖI`)
process.exit(failures === 0 ? 0 : 1)
