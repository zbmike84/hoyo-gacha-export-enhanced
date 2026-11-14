// Per-game IPC namespace. The three games' main modules register the same channel names
// (FETCH_DATA, READ_DATA, ...); prefixing them with the game id lets them live in one
// process. The renderer side is src/games/<game>/renderer/ipc.js.
//
// This file and that one are the whole contract between the UI and the backend, so a
// different backend (e.g. a Go/Wails rewrite) only has to provide the same channels.
const { ipcMain } = require('electron')

module.exports = game => ({
  handle: (channel, fn) => ipcMain.handle(`${game}:${channel}`, fn),
  on: (channel, fn) => ipcMain.on(`${game}:${channel}`, fn),
  removeHandler: channel => ipcMain.removeHandler(`${game}:${channel}`),
})
