// Snapshot PolyxiaBannerData's Star Rail banner data (CC0) into the app, so it works offline
// on first start. The app still refreshes it at runtime (src/games/starrail/main/banners.js).
// usage: node scripts/starrail/update-banners.mjs
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const URL_ = 'https://raw.githubusercontent.com/sirarikako/PolyxiaBannerData/main/public/v1/starrail.json'
const res = await fetch(URL_)
if (!res.ok) throw new Error(`${res.status} ${URL_}`)
const raw = await res.json()
if (raw.schemaVersion !== 1 || !Array.isArray(raw.banners)) throw new Error('unexpected banner data format')
const missing = raw.banners.filter(b => b.poolType !== 'standard' && b.poolType !== 'beginner' && !b.gachaIds?.length)
const file = path.join(root, 'src/games/starrail/data/polyxia-starrail.json')
// upstream regenerates often; only take a new snapshot when the banners themselves changed
const strip = o => JSON.stringify({ ...o, generatedAt: undefined })
const old = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => null)
if (old && strip(old) === strip(raw)) console.log('banner data unchanged')
else await fs.writeFile(file, JSON.stringify(raw) + '\n')
console.log(`${raw.banners.length} banners, generated ${raw.generatedAt}; wrote ${path.relative(root, file)}`)
if (missing.length) console.warn(`${missing.length} banner(s) without gachaIds yet: ${missing.map(b => b.names?.['zh-CN']).join(', ')}`)
