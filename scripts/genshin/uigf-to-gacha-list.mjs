// Convert a minimal UIGF v4 Genshin export (Snap Hutao writes only uigf_gacha_type,
// gacha_type, item_id, time, id) into this app's gacha-list-<uid>.json.
//
// usage: node scripts/genshin/uigf-to-gacha-list.mjs <uigf.json> <name-dict.json> <out-dir>
//   name-dict.json: { "<name>": item_id } in the language to write (UIGF dictionary, e.g. chs)
//
// Names come from the dictionary; type from the id (8-digit = character, 5-digit = weapon);
// weapon ids are 1 + weapon class + rarity + serial (15304 = bow, 3★); character rarity comes
// from the bundled banner data.
//
// Times: the export's `timezone` can't be trusted (one file mixed UTC with a local time
// zone that observed DST). Every record id starts with a Unix timestamp that the real pull
// time follows by -6..+54 minutes, and time zones shift whole hours, so each record's hour is
// re-derived from its id (minutes and seconds are kept) and written in server time.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [src, dictFile, outDir] = process.argv.slice(2)
if (!outDir) { console.error('usage: uigf-to-gacha-list.mjs <uigf.json> <name-dict.json> <out-dir>'); process.exit(2) }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const banners = JSON.parse(fs.readFileSync(path.join(root, 'src/games/genshin/data/banners.json'), 'utf8'))
const uigf = JSON.parse(fs.readFileSync(src, 'utf8'))
const dict = JSON.parse(fs.readFileSync(dictFile, 'utf8'))
const idToName = new Map(Object.entries(dict).map(([name, id]) => [String(id), name]))

// zh name -> rarity for characters, from paimon-moe data shipped with the app
const zhRarity = new Map()
for (const [pid, item] of Object.entries(banners.items)) if (item.t === 'c' && banners.names.zh[pid]) zhRarity.set(banners.names.zh[pid], item.r)

// in the app's order; an array, since an object would sort these integer-like keys
const TYPES = [['301', '角色活动祈愿'], ['302', '武器活动祈愿'], ['200', '常驻祈愿'], ['500', '集录祈愿'], ['100', '新手祈愿']]
const TYPE_NAMES = Object.fromEntries(TYPES)
const serverOffset = uid => (/^(1\d{9}|[1-5]\d{8})$/.test(uid) ? 8 : uid[0] === '6' ? -5 : uid[0] === '7' ? 1 : 8)
const pad = n => String(n).padStart(2, '0')
const fmtUtc = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` }
const naiveMs = t => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), +t.slice(11, 13), +t.slice(14, 16), +t.slice(17, 19))

fs.mkdirSync(outDir, { recursive: true })
for (const account of uigf.hk4e || []) {
  const uid = String(account.uid)
  const offset = serverOffset(uid) * 3600e3
  const problems = []
  const result = new Map(TYPES.map(([k]) => [k, []]))
  const list = [...account.list].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
  for (const r of list) {
    const name = r.name || idToName.get(String(r.item_id))
    if (!name) { problems.push(`no name for item_id ${r.item_id}`); continue }
    const id = String(r.item_id)
    const isChar = id.length === 8
    const rank = r.rank_type ? Number(r.rank_type) : isChar ? zhRarity.get(name) : Number(id[2])
    if (!rank) { problems.push(`no rarity for ${name} (${id})`); continue }
    // the hour that puts the pull within the id timestamp's window
    const idSec = Number(String(r.id).slice(0, 10))
    const t = naiveMs(r.time)
    let real = null
    for (let k = -14; k <= 14; k++) {
      const c = t - k * 3600e3
      if (c >= (idSec - 360) * 1e3 && c < (idSec + 3240) * 1e3) { real = c; break }
    }
    if (real === null) { problems.push(`time ${r.time} doesn't fit id ${r.id}`); continue }
    const key = r.uigf_gacha_type || (r.gacha_type === '400' ? '301' : r.gacha_type)
    if (!result.has(key)) { problems.push(`unknown gacha type ${key}`); continue }
    result.get(key).push([fmtUtc(real + offset), name, isChar ? '角色' : '武器', rank, String(r.gacha_type), String(r.id)])
  }
  const out = {
    result: [...result].filter(([, v]) => v.length),
    time: Date.now(),
    typeMap: TYPES,
    uid,
    lang: 'zh-cn',
  }
  const file = path.join(outDir, `gacha-list-${uid}.json`)
  fs.writeFileSync(file, JSON.stringify(out))
  console.log(`${uid}: ${list.length - problems.length}/${list.length} records -> ${file}`)
  for (const [k, v] of out.result) console.log(`  ${k} ${TYPE_NAMES[k]}: ${v.length}, 5★ ${v.filter(x => x[3] === 5).length}`)
  if (problems.length) { console.error(`  ${problems.length} problem(s):`); [...new Set(problems)].slice(0, 20).forEach(p => console.error('   ', p)); process.exitCode = 1 }
}
