// Run judge() over a real gacha-list JSON and print a summary.
// Personal data stays local: nothing here is committed except this script.
// usage: node scripts/genshin/regress-judge.mjs <gacha-list-UID.json> [expected.csv]
//   expected.csv (optional): columns pool,gacha_type,time,name,pity,result — compared row by row
import fs from 'node:fs'
import { judge, winRate } from '../../src/games/genshin/renderer/judge.js'

const [file, expected] = process.argv.slice(2)
if (!file) { console.error('usage: node scripts/genshin/regress-judge.mjs <gacha-list.json> [expected.csv]'); process.exit(2) }
const banners = JSON.parse(fs.readFileSync(new URL('../../src/games/genshin/data/banners.json', import.meta.url)))
const g = JSON.parse(fs.readFileSync(file, 'utf8'))
const { pools, issues } = judge(g.result, banners, { lang: g.lang, uid: g.uid })

for (const [k, p] of Object.entries(pools)) {
  const c = {}
  p.fives.forEach(f => { c[f.result] = (c[f.result] || 0) + 1 })
  const avg = p.fives.reduce((s, f) => s + f.pity, 0) / (p.fives.length || 1)
  let line = `${k} ${p.kind.padEnd(10)} pulls ${p.total}  5★ ${p.fives.length}  avg ${avg.toFixed(1)}  pity ${p.pity}  guaranteed ${p.guaranteed}  ${JSON.stringify(c)}`
  if (k === '301') { const w = winRate(p.fives); line += `  50/50 ${w.w}/${w.n} = ${(w.rate * 100).toFixed(1)}%  streak ${p.streak}` }
  console.log(line)
}
console.log(`issues: ${issues.length}`)
issues.slice(0, 20).forEach(i => console.log('  ', i.pool, i.gachaType, i.time, i.name, i.result, i.note))

if (expected) {
  const map = { win: 'win', lose: 'lose', guaranteed: 'guaranteed', in_up: 'up', 'in_up(fate)': 'up_guaranteed', off_list: 'off', 'off_list(fate)': 'off', standard: 'standard', unknown: 'unknown' }
  // minimal RFC 4180 parser: quoted fields may contain commas and doubled quotes
  const parseLine = l => {
    const out = []; let cur = '', q = false
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
      else if (ch === '"') q = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur); return out
  }
  const lines = fs.readFileSync(expected, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)
  const head = parseLine(lines.shift())
  const col = n => head.indexOf(n)
  const exp = lines.map(parseLine)
  const got = Object.entries(pools).flatMap(([k, p]) => p.fives.filter(() => k !== '100').map(f => ({ k, ...f })))
  const key = r => `${r[col('pool')]}|${r[col('time')]}|${r[col('name')]}`
  const gotBy = new Map()
  got.forEach(f => { const kk = `${f.k}|${f.time}|${f.name}`; gotBy.set(kk, [...(gotBy.get(kk) || []), f]) })
  let diff = 0
  for (const r of exp) {
    const f = (gotBy.get(key(r)) || []).shift()
    const want = map[r[col('result')]] ?? r[col('result')]
    if (!f || f.result !== want || f.pity !== +r[col('pity')]) {
      diff++
      if (diff <= 20) console.log('  DIFF', key(r), 'expected', want, r[col('pity')], 'got', f?.result, f?.pity)
    }
  }
  console.log(`compared ${exp.length} rows against ${expected}: ${diff} differences`)
  process.exitCode = diff ? 1 : 0
}
