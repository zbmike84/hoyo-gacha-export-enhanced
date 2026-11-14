// electron-builder afterPack: drop Chromium UI locales the app never shows. Only the
// languages the three games' UIs support are kept (53 -> 16 files, about 6 MB).
const fs = require('fs')
const path = require('path')

const KEEP = new Set(['en-US', 'zh-CN', 'zh-TW', 'ja', 'ko', 'de', 'es', 'es-419', 'fr', 'id', 'it', 'pt-BR', 'pt-PT', 'ru', 'th', 'tr', 'vi'])

exports.default = async function afterPack(context) {
  const dir = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(dir)) return
  let removed = 0
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.pak') && !KEEP.has(f.slice(0, -4))) { fs.unlinkSync(path.join(dir, f)); removed++ }
  }
  console.log(`  • after-pack: removed ${removed} unused Chromium locales`)
}
