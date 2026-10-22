// Kiểm tra UA thật sự gửi đi: header HTTP của request đầu tiên và navigator.userAgent của document đầu tiên.
// Chạy: npx electron spike/ua-check.cjs
const { app, BrowserWindow, WebContentsView, session } = require('electron')

app.whenReady().then(async () => {
  const clean = session.defaultSession
    .getUserAgent()
    .replace(/\s+Electron\/\S+/, '')
    .replace(new RegExp(`\\s+${app.getName()}/\\S+`), '')
  const ses = session.fromPartition('persist:ua-check')
  ses.setUserAgent(clean)
  const headers = []
  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    if (/zalo\.me/.test(d.url)) headers.push(`${d.resourceType} ${new URL(d.url).host}: ${d.requestHeaders['User-Agent']}`)
    cb({ requestHeaders: d.requestHeaders })
  })
  const win = new BrowserWindow({ show: false })
  const view = new WebContentsView({ webPreferences: { partition: 'persist:ua-check', sandbox: true } })
  win.contentView.addChildView(view)
  view.webContents.setUserAgent(clean)
  let first = null
  view.webContents.on('did-start-navigation', () => {})
  view.webContents.on('dom-ready', async () => {
    if (first === null) first = await view.webContents.executeJavaScript('navigator.userAgent')
  })
  await view.webContents.loadURL('https://chat.zalo.me').catch(() => {})
  await new Promise((r) => setTimeout(r, 4000))
  const bad = headers.filter((h) => /Electron|ua-check/i.test(h))
  console.log('request đầu tiên:', headers[0])
  console.log('số request tới zalo:', headers.length, '| request có Electron trong UA:', bad.length)
  console.log('navigator.userAgent ở dom-ready đầu tiên:', first)
  app.exit(bad.length === 0 && first && !/Electron/.test(first) ? 0 : 1)
})
