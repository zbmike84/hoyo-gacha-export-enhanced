// First start: copy each game's data from the old single-game app sitting next to this one
// (portable layout, e.g. GachaExports/Genshin-Wish-Export/userData). The old folders are
// left untouched. Runs on require, before any game module creates its userData folder.
const { app } = require('electron')
const path = require('path')
const fs = require('fs-extra')

const isDev = !app.isPackaged
const appRoot = isDev ? path.resolve(__dirname, '..', '..') : path.resolve(app.getAppPath(), '..', '..')

const LEGACY = {
  genshin: ['Genshin-Wish-Export', 'Genshin Wish Export', 'genshin-wish-export'],
  starrail: ['StarRailWarpExport', 'star-rail-warp-export'],
  zzz: ['ZzzSignalSearchExport', 'zzz-signal-search-export'],
}
const hasRecords = dir => fs.existsSync(dir) && fs.readdirSync(dir).some(f => f.startsWith('gacha-list-'))

const log = []
for (const [game, names] of Object.entries(LEGACY)) {
  const dest = path.join(appRoot, 'userData', game)
  if (hasRecords(dest)) continue
  for (const name of names) {
    const src = path.join(appRoot, '..', name, 'userData')
    try {
      if (!hasRecords(src)) continue
      fs.copySync(src, dest, { overwrite: false })
      log.push(`${new Date().toISOString()} ${game}: copied ${src}`)
      break
    } catch (e) {
      log.push(`${new Date().toISOString()} ${game}: failed to copy ${src}: ${e.message}`)
    }
  }
}
if (log.length) fs.appendFileSync(path.join(appRoot, 'userData', 'migration.log'), log.join('\n') + '\n')
