// Generate src/data/banners.json from the paimon-moe repository (MIT).
// usage: node scripts/genshin/gen-banners.mjs [--ref main]
//
// Output shape:
//   banners: [{ kind: 'character'|'weapon'|'chronicled', name, short, version, start, end, tz,
//               up5: [id], up4: [id], up301?: id, up400?: id }]
//   items:   { id: { r: rarity, t: 'c'|'w' } }            (4★ and 5★ only)
//   names:   { lang: { id: localized name } }              (same ids as items)
// Times are as paimon-moe writes them: tz=true means server-local time, otherwise UTC+8.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ref = process.argv.includes('--ref') ? process.argv[process.argv.indexOf('--ref') + 1] : 'main'
const RAW = `https://raw.githubusercontent.com/MadeBaruna/paimon-moe/${ref}`
const LANGS = ['zh', 'tw', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'th', 'vi', 'id', 'pt', 'it', 'tr']

async function get(p, json = false) {
  const res = await fetch(`${RAW}/${p}`)
  if (!res.ok) throw new Error(`${res.status} fetching ${p}`)
  return json ? res.json() : res.text()
}

// top-level `  key: {` / `  'key-with-dash': {` blocks of characters.js / weaponList.js
function parseItems(text, t) {
  const out = {}
  const re = /^ {2}'?([\w-]+)'?: \{\n([\s\S]*?)^ {2}\},/gm
  for (const m of text.matchAll(re)) {
    const name = m[2].match(/^ {4}name: (['"])(.*?)\1,/m)
    const rarity = m[2].match(/^ {4}rarity: (\d)/m)
    if (name && rarity) out[m[1]] = { en: name[2].replace(/\\'/g, "'"), r: +rarity[1], t }
  }
  return out
}

function field(block, key) {
  const m = block.match(new RegExp(`^ {6}${key}: (['"])(.*?)\\1,`, 'm'))
  return m ? m[2].replace(/\\'/g, "'") : null
}
function idList(block, key) {
  const m = block.match(new RegExp(`${key}: \\[([\\s\\S]*?)\\]`))
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []
}

function parseBanners(text) {
  // drop commented-out entries (paimon keeps the 2nd half of dual banners as comments)
  text = text.split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  const out = []
  for (const [sec, kind] of [['characters', 'character'], ['weapons', 'weapon'], ['chronicled', 'chronicled']]) {
    const body = text.match(new RegExp(`^ {2}${sec}: \\[\\n([\\s\\S]*?)^ {2}\\],`, 'm'))
    if (!body) throw new Error(`section ${sec} not found`)
    for (const m of body[1].matchAll(/^ {4}\{\n([\s\S]*?)^ {4}\},/gm)) {
      const b = m[1]
      out.push({
        kind, name: field(b, 'name'), short: field(b, 'shortName'), version: field(b, 'version'),
        start: field(b, 'start'), end: field(b, 'end'), tz: /timezoneDependent: true/.test(b),
        up5: idList(b, 'featured'), up4: idList(b, 'featuredRare'),
      })
    }
  }
  return out
}

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

async function main() {
  const [bannersJs, charsJs, weapJs, overrides] = await Promise.all([
    get('src/data/banners.js'), get('src/data/characters.js'), get('src/data/weaponList.js'),
    fs.readFile(path.join(root, 'scripts/genshin/banner-overrides.json'), 'utf8').then(JSON.parse).catch(() => ({})),
  ])
  const items = { ...parseItems(charsJs, 'c'), ...parseItems(weapJs, 'w') }
  // paimon sometimes spells the same id with '_' and '-' (primordial_jade_winged-spear)
  const byNorm = new Map(Object.keys(items).map(id => [norm(id), id]))
  const fixId = id => items[id] ? id : (byNorm.get(norm(id)) || id)

  const problems = []
  const banners = parseBanners(bannersJs).map(b => {
    b.up5 = b.up5.map(fixId); b.up4 = b.up4.map(fixId)
    for (const id of [...b.up5, ...b.up4]) if (!items[id]) problems.push(`${b.version} ${b.name}: unknown id ${id}`)
    if (b.kind === 'character') {
      // featured order is NOT reliable for dual banners; shortName names the 301 UP
      const sn = norm(b.short)
      const hits = b.up5.filter(id => norm(id).includes(sn) || norm(items[id]?.en).includes(sn))
      const ov = overrides.dual?.[`${b.version}|${b.start}`]
      if (ov) { b.up301 = ov[0]; if (ov[1]) b.up400 = ov[1] }
      else if (b.up5.length === 1) b.up301 = b.up5[0]
      else if (hits.length === 1) { b.up301 = hits[0]; b.up400 = b.up5.find(id => id !== hits[0]) }
      else problems.push(`${b.version} ${b.name}: cannot tell 301 UP from shortName "${b.short}" among ${b.up5}`)
    }
    return b
  })
  for (const add of overrides.banners || []) banners.push(add)
  banners.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0)

  // 4★/5★ only; the Traveler can't come from a wish
  const keep = Object.fromEntries(Object.entries(items).filter(([id, v]) => v.r >= 4 && !id.startsWith('traveler')))
  const names = {}
  for (const lang of LANGS) {
    const table = lang === 'en' ? null : await get(`src/locales/items/${lang}.json`, true).catch(() => undefined)
    if (table === undefined) { problems.push(`locale ${lang} missing`); continue }
    names[lang] = {}
    for (const [id, v] of Object.entries(keep)) {
      const n = table ? table[v.en] : v.en
      if (n) names[lang][id] = n
    }
  }
  for (const [lang, m] of Object.entries(overrides.names || {})) Object.assign(names[lang] ||= {}, m)
  const missingZh = Object.keys(keep).filter(id => !names.zh?.[id] && keep[id].r === 5)
  if (missingZh.length) problems.push(`5★ without zh name: ${missingZh.join(', ')}`)

  const out = {
    source: `https://github.com/MadeBaruna/paimon-moe (${ref}, MIT)`,
    generated: new Date().toISOString(),
    banners,
    items: Object.fromEntries(Object.entries(keep).map(([id, v]) => [id, { r: v.r, t: v.t }])),
    names,
  }
  const file = path.join(root, 'src/games/genshin/data/banners.json')
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(out) + '\n')
  const count = k => banners.filter(b => b.kind === k).length
  console.log(`banners: ${count('character')} character, ${count('weapon')} weapon, ${count('chronicled')} chronicled; ` +
    `latest ${banners.at(-1).version} ${banners.at(-1).start}`)
  console.log(`items: ${Object.keys(out.items).length}, langs: ${Object.keys(names).join(' ')}`)
  console.log(`wrote ${path.relative(root, file)} (${((JSON.stringify(out).length) / 1024).toFixed(0)} KB)`)
  if (problems.length) {
    console.error(`\n${problems.length} problem(s) — fix upstream or add to scripts/genshin/banner-overrides.json:`)
    problems.forEach(p => console.error('  ' + p))
    process.exitCode = 1
  }
}
main().catch(e => { console.error(e); process.exit(1) })
