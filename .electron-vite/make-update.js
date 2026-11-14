// Build the self-update package for a release (see src/main/update.js):
//   build/update/app-<version>.zip   resources/app of the Windows build
//   build/update/manifest.json       { version, from, electron, name, sha256, size }
// `from` is the oldest version that can apply it; `electron` must match the running app.
const fs = require('fs-extra')
const path = require('path')
const crypto = require('crypto')
const AdmZip = require('adm-zip')
const { version } = require('../package.json')
const electron = require('electron/package.json').version

// oldest app version with the updater (2.0.0 has none, so 2.0.1 is the first that can update)
const FROM = '2.0.1'

const appDir = path.resolve(__dirname, '../build/win-unpacked/resources/app')
const out = path.resolve(__dirname, '../build/update')
if (!fs.existsSync(path.join(appDir, 'package.json'))) throw new Error(`no app at ${appDir}; run the Windows build first`)
fs.emptyDirSync(out)

const name = `app-${version}.zip`
const zip = new AdmZip()
zip.addLocalFolder(appDir)
zip.writeZip(path.join(out, name))
const buf = fs.readFileSync(path.join(out, name))
const manifest = { version, from: FROM, electron, name, sha256: crypto.createHash('sha256').update(buf).digest('hex'), size: buf.length }
fs.outputJSONSync(path.join(out, 'manifest.json'), manifest, { spaces: 2 })
console.log(JSON.stringify(manifest))
