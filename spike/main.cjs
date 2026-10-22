// Spike bước 0: 2 WebContentsView cạnh nhau, 2 partition, backgroundThrottling:false.
// Chỉ ghi: tên miền, title, tên cookie + loại (KHÔNG ghi giá trị), RAM.
const { app, BrowserWindow, WebContentsView, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const DURATION_MS = Number(process.env.SPIKE_MS || 90000)
const out = { startedAt: new Date().toISOString(), views: {}, memory: [], electron: process.versions.electron, chrome: process.versions.chrome }

function cleanUA(ua) {
  return ua.replace(/\s+Electron\/\S+/, '').replace(new RegExp(`\s+${app.getName()}/\S+`), '')
}

app.whenReady().then(async () => {
  app.setPath('userData', path.join(__dirname, 'output', 'userData'))
  const win = new BrowserWindow({ width: 1400, height: 800, show: true })
  const ids = ['spike-a', 'spike-b']
  ids.forEach((id, i) => {
    const partition = `persist:${id}`
    const ses = session.fromPartition(partition)
    const ua = cleanUA(ses.getUserAgent())
    ses.setUserAgent(ua)
    const rec = (out.views[id] = { ua, hosts: {}, titles: [], loadFailures: [], finalUrl: null, cookies: [] })
    ses.webRequest.onCompleted((d) => {
      try {
        const h = new URL(d.url).hostname
        rec.hosts[h] = (rec.hosts[h] || 0) + 1
      } catch {}
    })
    const view = new WebContentsView({
      webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false },
    })
    win.contentView.addChildView(view)
    view.setBounds({ x: i * 700, y: 0, width: 700, height: 800 })
    view.webContents.on('page-title-updated', (_e, t) => rec.titles.push(t))
    view.webContents.on('did-fail-load', (_e, code, desc, url) => rec.loadFailures.push({ code, desc, url }))
    view.webContents.on('did-navigate', (_e, url) => (rec.finalUrl = url))
    view.webContents.loadURL('https://chat.zalo.me')
    out.views[id].wcId = view.webContents.id
  })

  const sample = () => {
    const m = app.getAppMetrics().map((p) => ({ type: p.type, name: p.name, pid: p.pid, workingSetMB: Math.round(p.memory.workingSetSize / 1024) }))
    out.memory.push({ t: Math.round((Date.now() - Date.parse(out.startedAt)) / 1000), totalMB: m.reduce((a, b) => a + b.workingSetMB, 0), procs: m })
  }
  const timer = setInterval(sample, 15000)
  setTimeout(async () => {
    clearInterval(timer)
    sample()
    for (const id of ids) {
      const cookies = await session.fromPartition(`persist:${id}`).cookies.get({})
      out.views[id].cookies = cookies.map((c) => ({ name: c.name, domain: c.domain, kind: c.session ? 'session' : 'persistent' }))
    }
    fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true })
    fs.writeFileSync(path.join(__dirname, 'output', 'result.json'), JSON.stringify(out, null, 2))
    app.quit()
  }, DURATION_MS)
})
