// App-level IPC (updates, relaunch), not tied to a game. See src/main/update.js.
const { ipcRenderer } = require('electron')

export default {
  invoke: (channel, ...args) => ipcRenderer.invoke(`app:${channel}`, ...args),
  on: (channel, fn) => ipcRenderer.on(`app:${channel}`, fn),
}
