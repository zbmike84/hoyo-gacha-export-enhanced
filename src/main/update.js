// Self-update of the app code (resources/app, a few MB) from GitHub Releases, like the
// upstream apps' "直接更新": the Electron runtime stays, only the bundled code and data
// (including banner data) are replaced, and a restart picks them up.
//
// Each release carries manifest.json { version, from, electron, name, sha256, size } and
// the app zip it names (.electron-vite/make-update.js). An update applies when it is newer,
// this version is >= `from`, and the Electron version matches; otherwise the UI points to
// the full download.
const { app, ipcMain, shell } = require('electron')
const fetch = require('electron-fetch').default
const semver = require('semver')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs-extra')
const extract = require('./vendor/extract-zip')
const { version } = require('../../package.json')
const { getWin } = require('./window')

const REPO = 'zbmike84/hoyo-gacha-export-enhanced'
const RELEASES = `https://github.com/${REPO}/releases`
const isDev = !app.isPackaged

// Test hooks (development only): point at a local manifest and a scratch app folder.
const TEST = isDev && process.env.HOYO_UPDATE_TEST_DIR
const appPath = TEST ? path.join(TEST, 'app') : app.getAppPath()
const appRoot = TEST ? TEST : path.resolve(appPath, '..', '..')
const updateDir = path.join(appRoot, 'update')
const manifestUrl = (TEST && process.env.HOYO_UPDATE_MANIFEST) || `${RELEASES}/latest/download/manifest.json`
const settingsFile = path.join(appRoot, 'userData', 'app.json')

const state = { status: 'idle', current: version, latest: null, error: null, releaseUrl: RELEASES }
const send = () => getWin()?.webContents.send('app:UPDATE', { ...state })
const set = patch => { Object.assign(state, patch); send() }

const readSettings = () => { try { return { autoUpdate: true, ...fs.readJSONSync(settingsFile) } } catch (e) { return { autoUpdate: true } } }
const writeSettings = s => fs.outputJSONSync(settingsFile, s, { spaces: 2 })

async function download(url, file) {
  const res = await fetch(url, { timeout: 120000 })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await fs.outputFile(file, await res.buffer())
}

// Several PCs may run the same copy from a NAS: only one of them updates at a time.
const lockFile = path.join(updateDir, '.lock')
function takeLock() {
  try {
    const stat = fs.statSync(lockFile)
    if (Date.now() - stat.mtimeMs < 10 * 60e3) return false   // someone else is on it
    fs.removeSync(lockFile)                                    // stale
  } catch (e) { /* no lock */ }
  try {
    fs.ensureDirSync(updateDir)
    fs.writeFileSync(lockFile, `${process.pid} ${new Date().toISOString()}`, { flag: 'wx' })
    return true
  } catch (e) { return false }
}

// Swap in the new app folder by renaming, so a failure leaves the old one intact.
async function swapIn(newApp) {
  const old = `${appPath}.old`
  await fs.remove(old)
  try {
    await fs.rename(appPath, old)
  } catch (e) {
    // could not move the running copy aside (locked share?): overwrite in place instead
    await fs.copy(newApp, appPath, { overwrite: true })
    return
  }
  try {
    await fs.rename(newApp, appPath)
  } catch (e) {
    await fs.rename(old, appPath)   // put the old one back
    throw e
  }
}

let manifest = null
async function check() {
  if (isDev && !TEST) return
  set({ status: 'checking', error: null })
  try {
    const res = await fetch(`${manifestUrl}?t=${Math.floor(Date.now() / 600e3)}`, { timeout: 20000 })
    if (!res.ok) throw new Error(`${res.status} manifest`)
    manifest = await res.json()
    state.latest = manifest.version
    if (!semver.valid(manifest.version) || !semver.gt(manifest.version, version)) return set({ status: 'current' })
    if (manifest.electron !== process.versions.electron || (manifest.from && semver.lt(version, manifest.from))) {
      return set({ status: 'manual', releaseUrl: `${RELEASES}/tag/v${manifest.version}` })
    }
    if (!readSettings().autoUpdate) return set({ status: 'available' })
    await install()
  } catch (e) {
    set({ status: 'failed', error: String(e.message || e) })
  }
}

async function install() {
  if (!manifest) return
  if (!takeLock()) return set({ status: 'busy' })
  try {
    set({ status: 'downloading' })
    const zip = path.join(updateDir, manifest.name)
    const url = (TEST && process.env.HOYO_UPDATE_MANIFEST)
      ? new URL(manifest.name, process.env.HOYO_UPDATE_MANIFEST).href
      : `${RELEASES}/download/v${manifest.version}/${manifest.name}`
    await download(url, zip)
    const sha256 = crypto.createHash('sha256').update(await fs.readFile(zip)).digest('hex')
    if (sha256 !== manifest.sha256) throw new Error('checksum mismatch')
    const staged = path.join(updateDir, 'app')
    await fs.remove(staged)
    await extract(zip, { dir: staged })
    if (!fs.existsSync(path.join(staged, 'package.json'))) throw new Error('update package has no package.json')
    set({ status: 'installing' })
    await swapIn(staged)
    await fs.remove(zip)
    set({ status: 'ready' })
  } catch (e) {
    set({ status: 'failed', error: String(e.message || e) })
  } finally {
    fs.removeSync(lockFile)
  }
}

ipcMain.handle('app:UPDATE_STATE', () => ({ ...state, autoUpdate: readSettings().autoUpdate }))
ipcMain.handle('app:CHECK_UPDATE', () => check())
ipcMain.handle('app:INSTALL_UPDATE', () => install())
ipcMain.handle('app:SET_AUTO_UPDATE', (event, on) => { writeSettings({ ...readSettings(), autoUpdate: !!on }); return !!on })
ipcMain.handle('app:OPEN_RELEASES', () => shell.openExternal(state.releaseUrl))
ipcMain.handle('app:RELAUNCH', () => { app.relaunch(); app.exit(0) })

// a previous update leaves the old copy behind; it is no longer needed once we run
app.whenReady().then(() => {
  fs.remove(`${appPath}.old`).catch(() => {})
  setTimeout(check, 3000)
})

module.exports = { isBusy: () => state.status === 'installing' }
