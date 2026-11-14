// Everything the analysis UI needs, derived from one account's records.
import { judge, winRate, langKey } from './judge.js'
import { buildCollection } from './luck.js'

// Official rates as modelled by the community: flat base rate, then +step per pull from `soft`, hard pity at `cap`
const MODELS = {
  character: { base: 0.006, soft: 74, step: 0.06, cap: 90 },
  weapon: { base: 0.007, soft: 63, step: 0.07, cap: 80 },
}
MODELS.chronicled = MODELS.character
MODELS.standard = MODELS.character

export function pityModel(kind) {
  const m = MODELS[kind] || MODELS.character
  const pmf = []
  let survive = 1
  for (let n = 1; n <= m.cap; n++) {
    const p = n === m.cap ? 1 : n < m.soft ? m.base : Math.min(1, m.base + m.step * (n - m.soft + 1))
    pmf.push(survive * p)
    survive *= 1 - p
  }
  const mean = pmf.reduce((s, p, i) => s + (i + 1) * p, 0)
  const pastSoft = pmf.slice(m.soft - 1).reduce((a, b) => a + b, 0)
  return { ...m, pmf, mean, pastSoft }
}

// Capturing Radiance shipped with 5.0
export const RADIANCE_SINCE = '2024-08-28'

function versionIndex(bannerData) {
  const first = new Map()
  for (const b of bannerData.banners) {
    if (b.kind !== 'character' || !b.version) continue
    if (!first.has(b.version) || b.start < first.get(b.version)) first.set(b.version, b.start)
  }
  return [...first].sort((a, b) => (a[1] < b[1] ? -1 : 1))
}

export function analyse(account, bannerData, { extras = {} } = {}) {
  const { pools, issues } = judge(account.result, bannerData, { lang: account.lang, uid: account.uid })

  // pulls and 5★ per game version (records between banners count toward the previous version)
  const versions = versionIndex(bannerData)
  const versionOf = t => {
    let v = null
    for (const [ver, start] of versions) { if (start <= t) v = ver; else break }
    return v
  }
  const perVersion = new Map()
  const entries = account.result instanceof Map ? [...account.result] : account.result
  for (const [key, recs] of entries) {
    for (const r of recs) {
      const v = versionOf(r[0])
      if (!v) continue
      if (!perVersion.has(v)) perVersion.set(v, { version: v, total: 0, pools: {}, fives: [] })
      const e = perVersion.get(v)
      e.total++
      e.pools[key] = (e.pools[key] || 0) + 1
    }
  }
  for (const [key, p] of Object.entries(pools)) {
    if (key === '100') continue
    for (const f of p.fives) perVersion.get(versionOf(f.time))?.fives.push(f)
  }

  const character = pools['301']
  let rate = null, radiance = null
  if (character) {
    rate = winRate(character.fives)
    const post = character.fives.filter(f => f.time >= RADIANCE_SINCE && (f.result === 'win' || f.result === 'lose'))
    radiance = [0, 1, 2, 3].map(s => {
      const g = post.filter(f => (s === 3 ? f.streakBefore >= 3 : f.streakBefore === s))
      return { streak: s, win: g.filter(f => f.result === 'win').length, lose: g.filter(f => f.result === 'lose').length }
    })
  }

  const order = new Map(versions.map(([v], i) => [v, i]))
  const perVersionSorted = [...perVersion.values()].sort((a, b) => order.get(a.version) - order.get(b.version))
  for (const v of perVersionSorted) v.fives.sort((a, b) => (a.time < b.time ? -1 : 1))
  const limited = new Set(bannerData.banners.filter(b => b.kind === 'character').flatMap(b => b.up5))
  // every 5★ character, in the account's language, for adding copies obtained outside wishes
  const names = bannerData.names[langKey(account.lang)] || bannerData.names.en
  const characters = Object.entries(bannerData.items).filter(([, v]) => v.r === 5 && v.t === 'c')
    .map(([id]) => ({ id, name: names[id] || bannerData.names.en[id] || id }))
  const nameOf = id => characters.find(c => c.id === id)?.name
  const collection = buildCollection(pools, f => limited.has(f.itemId), extras, nameOf)
  return { pools, issues, rate, radiance, versions: perVersionSorted, collection, characters }
}
