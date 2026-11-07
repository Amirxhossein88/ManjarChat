const { app, BrowserWindow, Menu, dialog, shell, session, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')

const PORT = 37421
const isDev = !app.isPackaged
const RESOURCES = isDev ? path.join(__dirname) : process.resourcesPath
const SERVER_DIR = isDev ? path.join(__dirname, '..', 'server-dist') : path.join(RESOURCES, 'server')

let serverProc = null
let win = null

// ── config helpers ──
function configPath() {
  return path.join(app.getPath('userData'), 'config.json')
}
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'))
  } catch {
    return {}
  }
}
function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2))
}

// ── bundled local server (Next.js standalone) ──
function startLocalServer() {
  return new Promise((resolve, reject) => {
    const serverJs = path.join(SERVER_DIR, 'server.js')
    if (!fs.existsSync(serverJs)) return reject(new Error('NO_BUNDLED_SERVER'))

    const userData = app.getPath('userData')
    const dataDir = path.join(userData, 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.mkdirSync(path.dirname(SERVER_DIR), { recursive: true })

    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: 'file:' + path.join(userData, 'manjarchat.db'),
      MANJAR_DATA_DIR: dataDir,
    }
    serverProc = spawn(process.execPath, [serverJs], { cwd: SERVER_DIR, env, windowsHide: true })
    serverProc.on('error', reject)
    serverProc.stderr.on('data', () => {})

    const t0 = Date.now()
    const poll = () => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 2000 }, (res) => {
        res.resume()
        if (res.statusCode === 200) return resolve()
        retry()
      })
      req.on('error', retry)
      req.on('timeout', () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - t0 > 45000) return reject(new Error('SERVER_TIMEOUT'))
      setTimeout(poll, 600)
    }
    poll()
  })
}

// ── connect-to-server page (client mode) ──
function connectPage() {
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
  <style>
    body{font-family:Tahoma,sans-serif;background:#122b29;color:#e8f5f3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .box{background:#1a3a37;padding:2.2rem;border-radius:18px;width:min(420px,90vw);box-shadow:0 10px 40px #0008;text-align:center}
    h1{font-size:1.3rem;margin:0 0 .4rem}p{font-size:.85rem;color:#9fc7c1;margin:0 0 1.4rem}
    input{width:100%;box-sizing:border-box;padding:.8rem;border-radius:12px;border:1px solid #2c5a55;background:#0f2523;color:#fff;font-size:.95rem;direction:ltr;text-align:left}
    button{margin-top:1rem;width:100%;padding:.85rem;border:none;border-radius:12px;background:#14b8a6;color:#062824;font-weight:bold;font-size:1rem;cursor:pointer}
    .logo{font-size:2.4rem}
  </style></head><body><div class="box">
    <div class="logo">🪙</div><h1>اتصال به سرور منجرچت</h1>
    <p>آدرس سرور (هاست) خود را وارد کنید — مثال:<br>https://chat.example.com</p>
    <input id="u" placeholder="https://..." />
    <button onclick="save()">اتصال</button>
    <script>
      async function save(){
        const url = document.getElementById('u').value.trim().replace(/\\/+$/,'')
        if(!url.startsWith('http')) return alert('آدرس باید با http یا https شروع شود')
        await window.manjarConnect.save(url)
      }
    </script>
  </div></body></html>`
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

function createWindow(targetUrl) {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 420,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: '#122b29',
    title: 'منجرچت — ManjarChat',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadURL(targetUrl)
  win.on('closed', () => {
    win = null
  })
}

// allow microphone (voice messages)
function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'clipboard-read' || permission === 'fullscreen')
  })
}

function buildMenu() {
  const template = [
    {
      label: 'منجرچت',
      submenu: [
        {
          label: '🔌 اتصال به سرور…',
          click: () => {
            writeConfig({})
            win?.close()
            connectPage()
          },
        },
        {
          label: '🏠 سرور داخلی (Local)',
          click: () => {
            const cfg = readConfig()
            delete cfg.serverUrl
            writeConfig(cfg)
            app.relaunch()
            app.exit(0)
          },
        },
        { type: 'separator' },
        { role: 'reload', label: 'بارگذاری مجدد' },
        { role: 'toggleDevTools', label: 'ابزار توسعه' },
        { type: 'separator' },
        { role: 'quit', label: 'خروج' },
      ],
    },
    {
      label: 'نمایش',
      submenu: [{ role: 'zoomIn', label: 'بزرگ‌نمایی' }, { role: 'zoomOut', label: 'کوچک‌نمایی' }, { role: 'togglefullscreen', label: 'تمام‌صفحه' }],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    setupPermissions()
    buildMenu()

    ipcMain.handle('set-server-url', (_e, url) => {
      const clean = String(url || '').trim().replace(/\/+$/, '')
      if (!/^https?:\/\//.test(clean)) return { ok: false }
      writeConfig({ serverUrl: clean })
      createWindow(clean)
      return { ok: true }
    })

    const cfg = readConfig()
    if (cfg.serverUrl) {
      createWindow(cfg.serverUrl)
      return
    }

    try {
      await startLocalServer()
      createWindow(`http://127.0.0.1:${PORT}`)
    } catch (err) {
      dialog
        .showMessageBox({
          type: 'info',
          title: 'منجرچت',
          message: 'سرور داخلی یافت نشد',
          detail: 'می‌توانید آدرس سرور منجرچت روی هاست خود را وارد کنید.',
          buttons: ['باشه'],
        })
        .then(() => connectPage())
      if (isDev) console.error(err)
    }
  })

  app.on('window-all-closed', () => {
    if (serverProc) {
      try {
        serverProc.kill()
      } catch {}
    }
    app.quit()
  })
}
