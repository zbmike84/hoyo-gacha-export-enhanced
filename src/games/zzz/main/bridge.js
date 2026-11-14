const ipcNs = require('../../../main/ipc')('zzz')
const { clipboard } = require('electron')
const { getUrl, deleteData, getApiUrl } = require('./getData')

ipcNs.handle('COPY_URL', async () => {
  const url = await getUrl()
  if (url) {
    clipboard.writeText(url)
    return true
  }
  return false
})

ipcNs.handle('COPY_API_URL', async () => {
  const apiUrl = await getApiUrl()
  if (apiUrl) {
    clipboard.writeText(apiUrl)
    return true
  }
  return false
})

ipcNs.handle('DELETE_DATA', async (event, uid, action) => {
  await deleteData(uid, action)
})