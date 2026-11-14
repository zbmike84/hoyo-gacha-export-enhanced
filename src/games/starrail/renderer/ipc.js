// This game's side of the per-game IPC namespace (see src/main/ipc.js). Same shape as
// Electron's ipcRenderer for the calls the UI makes, so components keep their code.
const electron = require('electron')
const GAME = 'starrail'

export default {
  invoke: (channel, ...args) => electron.ipcRenderer.invoke(`${GAME}:${channel}`, ...args),
  on: (channel, fn) => electron.ipcRenderer.on(`${GAME}:${channel}`, fn),
  removeAllListeners: channel => electron.ipcRenderer.removeAllListeners(`${GAME}:${channel}`),
}
// opening links isn't game-specific
export const shell = electron.shell
