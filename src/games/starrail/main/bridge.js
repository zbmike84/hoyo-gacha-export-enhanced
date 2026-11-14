const ipcNs = require('../../../main/ipc')('starrail')
const { clipboard } = require('electron')
const { getUrl, deleteData } = require('./getData')

ipcNs.handle('COPY_URL', async () => {
  const url = await getUrl()
  if (url) {
    clipboard.writeText(url)
    return true
  }
  return false
})

ipcNs.handle('DELETE_DATA', async (event, uid, action) => {
  await deleteData(uid, action)
})