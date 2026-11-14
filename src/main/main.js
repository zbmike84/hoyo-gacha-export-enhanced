// HoYo Gacha Export: one window, three games. Each game's main modules live in
// src/games/<game>/main and talk to their UI over '<game>:'-prefixed IPC channels.
const { app, ipcMain } = require('electron')

// Chromium's sandboxed child processes can't start from a network location
// (\\server\share or a mapped drive), so the app fails when kept on a NAS unless it
// is launched with --no-sandbox. The sandbox adds little here: the window runs with
// nodeIntegration and only loads the bundled pages. (Windows only: on Linux the zygote
// starts before this runs.)
app.commandLine.appendSwitch('no-sandbox')

// must run before the games' modules load (they create their userData folders), so it is
// the first require: the bundler hoists requires in source order
require('./migrate')

const games = {
  genshin: require('../games/genshin/main'),
  starrail: require('../games/starrail/main'),
  zzz: require('../games/zzz/main'),
}
const { createWindow, getWin } = require('./window')
const updater = require('./update')

function openWindow() {
  const win = createWindow()
  win.setMenuBarVisibility(false)
  const isDev = !app.isPackaged
  isDev ? win.loadURL(`http://localhost:${process.env.PORT}`) : win.loadFile('dist/electron/renderer/index.html')
  if (isDev) win.webContents.openDevTools({ mode: 'undocked', activate: true })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getWin()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  app.whenReady().then(openWindow)

  for (const game of Object.keys(games)) {
    ipcMain.handle(`${game}:RELAUNCH`, async () => {
      app.relaunch()
      app.exit(0)
    })
  }

  const stopProxies = () => {
    for (const g of Object.values(games)) if (g.proxyStatus?.started) g.disableProxy()
  }
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
  app.on('activate', () => { if (!getWin()) openWindow() })
  app.on('will-quit', e => {
    stopProxies()
    // don't quit halfway through swapping in an update
    if (updater.isBusy()) {
      e.preventDefault()
      setTimeout(() => app.quit(), 3000)
    }
  })
  app.on('quit', stopProxies)
}
