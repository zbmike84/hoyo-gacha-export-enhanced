// Classify every 5★ against the banner that was running when it was pulled.
//
// The rule is deliberately banner-based: a 5★ is a "win" when it is that banner's UP,
// otherwise a "lose". No list of standard characters is consulted, so a standard
// character running as UP (Mizuki) and retired limited characters in the lose pool
// are both handled without special cases.
//
// judge(result, bannerData, { lang, uid }) -> { pools, issues }
//   result: Map or [[gachaKey, records]] as stored by getData.js;
//           a record is [time, name, itemType, rank, gachaType, id]
//   bannerData: src/data/banners.json

const POOL_KIND = { '301': 'character', '302': 'weapon', '500': 'chronicled', '200': 'standard', '100': 'standard' }

// API lang code -> names table in banners.json
export function langKey(lang = 'zh-cn') {
  const l = lang.toLowerCase()
  if (l === 'zh-tw' || l === 'zh-hk') return 'tw'
  if (l.startsWith('zh')) return 'zh'
  return l.slice(0, 2)
}

// Server UTC offset in hours, from the first digit of the uid
export function serverOffset(uid = '') {
  const d = String(uid).replace(/^1(?=\d{9}$)/, '')[0]
  if (d === '6') return -5   // America
  if (d === '7') return 1    // Europe
  return 8                   // CN, Asia, TW/HK/MO
}

const toMs = t => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), +t.slice(11, 13), +t.slice(14, 16), +t.slice(17, 19))

function prepareBanners(bannerData, uid) {
  const shift = (serverOffset(uid) - 8) * 3600e3
  const byKind = { character: [], weapon: [], chronicled: [] }
  for (const b of bannerData.banners) {
    // tz=false: paimon writes the time in UTC+8; convert to the account's server time
    const s = toMs(b.start) + (b.tz ? 0 : shift), e = toMs(b.end) + (b.tz ? 0 : shift)
    byKind[b.kind]?.push({ ...b, s, e })
  }
  return byKind
}

// A loss and the guaranteed 5★ it paid for point at each other (they may sit on different banners)
const ref = f => ({ id: f.id, name: f.name, time: f.time, key: f.bannerKey, up: f.up })
function link(loss, guaranteed) {
  if (!loss || !guaranteed) return
  loss.guaranteeTo = ref(guaranteed)
  guaranteed.guaranteeFrom = ref(loss)
}

export function judge(result, bannerData, { lang = 'zh-cn', uid = '' } = {}) {
  const names = bannerData.names[langKey(lang)] || bannerData.names.en
  const nameOf = id => names[id] ?? id
  const idOf = new Map(Object.entries(names).map(([id, n]) => [n, id]))
  const banners = prepareBanners(bannerData, uid)
  const entries = result instanceof Map ? [...result] : result
  const pools = {}
  const issues = []

  for (const [key, records] of entries) {
    const kind = POOL_KIND[key]
    if (!kind) continue
    const recs = [...records].sort((a, b) => (a[5] && b[5]) ? (BigInt(a[5]) < BigInt(b[5]) ? -1 : 1) : (a[0] < b[0] ? -1 : 1))
    const fives = []
    let pity = 0, guaranteed = false, streak = 0
    let pendingLoss = null   // the lost 5★ whose guarantee hasn't been used yet
    for (const [time, name, , rank, gachaType, id] of recs) {
      pity++
      if (+rank !== 5) continue
      const f = { time, name, itemId: idOf.get(name) || null, pity, gachaType: String(gachaType), result: 'unknown', id }
      pity = 0
      fives.push(f)
      if (kind === 'standard') { f.result = 'standard'; continue }
      const t = toMs(time)
      const hit = banners[kind].filter(b => b.s <= t && t <= b.e)
      if (hit.length !== 1) {
        f.note = `${hit.length} banners match`; issues.push({ pool: key, ...f }); continue
      }
      const b = hit[0]
      f.banner = { version: b.version, name: b.name, start: b.start, end: b.end }
      // the 5★ history groups by this key; a loss and its guarantee can land in different groups
      f.bannerKey = `${b.start}|${f.gachaType}`
      if (kind === 'character') {
        const upId = f.gachaType === '400' ? b.up400 : b.up301
        if (!upId) { f.note = `no UP for gacha type ${f.gachaType}`; issues.push({ pool: key, ...f }); continue }
        f.up = [nameOf(upId)]
        const win = name === nameOf(upId)
        if (!win && b.up5.some(x => nameOf(x) === name)) {
          f.note = 'got the other dual-banner UP'; issues.push({ pool: key, ...f })
        }
        if (guaranteed) {
          f.result = 'guaranteed'
          if (!win) { f.note = 'lost a guaranteed pull'; issues.push({ pool: key, ...f }) }
          guaranteed = false
          link(pendingLoss, f); pendingLoss = null
        } else {
          f.streakBefore = streak
          if (win) { f.result = 'win'; streak = 0 } else { f.result = 'lose'; guaranteed = true; streak++; pendingLoss = f }
        }
      } else {
        // weapon / chronicled: the Epitomized Path target is not in the records
        f.up = b.up5.map(nameOf)
        const inUp = f.up.includes(name)
        f.result = inUp ? (guaranteed ? 'up_guaranteed' : 'up') : 'off'
        if (guaranteed && !inUp) { f.note = 'off-banner right after off-banner'; issues.push({ pool: key, ...f }) }
        if (guaranteed) { link(pendingLoss, f); pendingLoss = null }
        if (!inUp) pendingLoss = f
        guaranteed = !inUp
      }
    }
    pools[key] = { kind, total: recs.length, pity, guaranteed: kind === 'standard' ? false : guaranteed, streak, fives }
  }
  return { pools, issues }
}

// Win rate over 50/50s only, with a 95% Wilson interval
export function winRate(fives) {
  const w = fives.filter(f => f.result === 'win').length
  const n = w + fives.filter(f => f.result === 'lose').length
  if (!n) return { w, n, rate: null, lo: null, hi: null }
  const z = 1.96, p = w / n, den = 1 + z * z / n
  const c = (p + z * z / (2 * n)) / den, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
  return { w, n, rate: p, lo: c - h, hi: c + h }
}
