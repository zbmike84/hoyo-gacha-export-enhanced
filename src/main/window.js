// The one application window, shared by every game's main modules.
const { BrowserWindow } = require('electron')
const windowStateKeeper = require('electron-window-state')
const debounce = require('lodash/debounce')

let win = null

function createWindow() {
  const state = windowStateKeeper({ defaultWidth: 1100, defaultHeight: 760 })
  win = new BrowserWindow({
    x: state.x, y: state.y, width: state.width, height: state.height,
    webPreferences: { contextIsolation: false, nodeIntegration: true },
  })
  const save = debounce(state.saveState, 500)
  win.on('resize', () => save(win))
  win.on('move', () => save(win))
  win.on('closed', () => { win = null })
  return win
}

module.exports = { createWindow, getWin: () => win }
