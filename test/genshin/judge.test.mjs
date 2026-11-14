// node --test test/
import test from 'node:test'
import assert from 'node:assert/strict'
import { judge, winRate, serverOffset, langKey } from '../../src/games/genshin/renderer/judge.js'

const data = {
  banners: [
    // dual banner where featured order is the "wrong" way round; generator already resolved up301/up400
    { kind: 'character', name: 'A', version: '1.0', start: '2024-01-01 06:00:00', end: '2024-01-20 17:59:59', tz: false,
      up5: ['tartaglia', 'zhongli'], up301: 'zhongli', up400: 'tartaglia', up4: [] },
    // a standard character as UP (Mizuki-style)
    { kind: 'character', name: 'B', version: '1.1', start: '2024-01-21 18:00:00', end: '2024-02-10 14:59:59', tz: true,
      up5: ['mizuki'], up301: 'mizuki', up4: [] },
    { kind: 'character', name: 'C', version: '1.2', start: '2024-02-11 06:00:00', end: '2024-03-01 17:59:59', tz: false,
      up5: ['furina'], up301: 'furina', up4: [] },
    { kind: 'weapon', name: 'W', version: '1.0', start: '2024-01-01 06:00:00', end: '2024-01-20 17:59:59', tz: false,
      up5: ['polar', 'vortex'], up4: [] },
  ],
  names: {
    zh: { zhongli: '钟离', tartaglia: '达达利亚', mizuki: '梦见月瑞希', furina: '芙宁娜', diluc: '迪卢克', polar: '若水', vortex: '贯虹之槊', skyward: '天空之翼' },
    en: { zhongli: 'Zhongli', tartaglia: 'Tartaglia', mizuki: 'Yumemizuki Mizuki', furina: 'Furina', diluc: 'Diluc' },
  },
}

let seq = 1000
const rec = (time, name, rank, gt) => [time, name, rank === 5 ? '角色' : '武器', rank, gt, String(seq++)]
const filler = (time, n, gt) => Array.from({ length: n }, () => rec(time, '黎明神剑', 3, gt))

test('dual banner: 301 and 400 are judged against their own UP', () => {
  const r = new Map([['301', [
    ...filler('2024-01-02 10:00:00', 9, '301'), rec('2024-01-02 10:00:00', '钟离', 5, '301'),
    ...filler('2024-01-03 10:00:00', 4, '400'), rec('2024-01-03 10:00:00', '达达利亚', 5, '400'),
  ]]])
  const { pools, issues } = judge(r, data, { uid: '861346531' })
  assert.deepEqual(pools['301'].fives.map(f => [f.result, f.pity, f.up[0]]), [['win', 10, '钟离'], ['win', 5, '达达利亚']])
  assert.equal(issues.length, 0)
})

test('standard character as UP counts as a win on its own banner, a loss elsewhere', () => {
  const r = new Map([['301', [
    rec('2024-01-22 10:00:00', '梦见月瑞希', 5, '301'),   // her banner: win
    rec('2024-02-12 10:00:00', '梦见月瑞希', 5, '301'),   // Furina banner: lose
    rec('2024-02-13 10:00:00', '芙宁娜', 5, '301'),       // guaranteed
  ]]])
  const { pools } = judge(r, data, { uid: '861346531' })
  assert.deepEqual(pools['301'].fives.map(f => f.result), ['win', 'lose', 'guaranteed'])
})

test('guarantee carries across banners and between 301/400; loss streak spans guarantees', () => {
  const r = new Map([['301', [
    rec('2024-01-05 10:00:00', '迪卢克', 5, '400'),      // lose on 400
    rec('2024-01-25 10:00:00', '梦见月瑞希', 5, '301'),  // guaranteed on the next banner
    rec('2024-02-12 10:00:00', '迪卢克', 5, '301'),      // lose again: streak 1 before it
    rec('2024-02-12 11:00:00', '芙宁娜', 5, '301'),      // guaranteed
    rec('2024-02-13 10:00:00', '芙宁娜', 5, '301'),      // win, 2 losses in a row before it
  ]]])
  const p = judge(r, data, { uid: '861346531' }).pools['301']
  assert.deepEqual(p.fives.map(f => f.result), ['lose', 'guaranteed', 'lose', 'guaranteed', 'win'])
  assert.deepEqual(p.fives.map(f => f.streakBefore), [0, undefined, 1, undefined, 2])
  assert.equal(p.streak, 0)
  assert.equal(p.guaranteed, false)
})

test('a 5★ outside any banner is unknown and reported, not guessed', () => {
  const r = new Map([['301', [rec('2023-12-31 10:00:00', '钟离', 5, '301')]]])
  const { pools, issues } = judge(r, data, { uid: '861346531' })
  assert.equal(pools['301'].fives[0].result, 'unknown')
  assert.equal(issues.length, 1)
})

test('weapon banner: off-banner then guaranteed UP; pity and state at the end', () => {
  const r = new Map([['302', [
    ...filler('2024-01-02 10:00:00', 59, '302'), rec('2024-01-02 10:00:00', '天空之翼', 5, '302'),
    rec('2024-01-03 10:00:00', '若水', 5, '302'), ...filler('2024-01-03 10:00:00', 3, '302'),
  ]]])
  const p = judge(r, data, { uid: '861346531' }).pools['302']
  assert.deepEqual(p.fives.map(f => [f.result, f.pity]), [['off', 60], ['up_guaranteed', 1]])
  assert.equal(p.pity, 3)
  assert.equal(p.guaranteed, false)
})

test('America server: UTC+8 banner times are shifted to server time', () => {
  // 2024-02-11 06:00 UTC+8 == 2024-02-10 17:00 UTC-5; banner B (tz=true) ends 2024-02-10 14:59:59 local
  const r = new Map([['301', [rec('2024-02-10 17:30:00', 'Furina', 5, '301')]]])
  assert.equal(judge(r, data, { uid: '612345678', lang: 'en-us' }).pools['301'].fives[0].result, 'win')
  assert.equal(judge(r, data, { uid: '812345678', lang: 'en-us' }).pools['301'].fives[0].result, 'unknown')
})

test('helpers', () => {
  assert.equal(serverOffset('612345678'), -5)
  assert.equal(serverOffset('712345678'), 1)
  assert.equal(serverOffset('112345678'), 8)
  assert.equal(serverOffset('1812345678'), 8)
  assert.equal(langKey('zh-tw'), 'tw')
  assert.equal(langKey('ja-jp'), 'ja')
  const w = winRate([{ result: 'win' }, { result: 'lose' }, { result: 'guaranteed' }, { result: 'win' }])
  assert.equal(w.n, 3)
  assert.ok(w.lo < w.rate && w.rate < w.hi)
})

test('a loss and the guarantee it paid for are linked across banners', () => {
  const r = new Map([['301', [
    rec('2024-01-05 10:00:00', '迪卢克', 5, '400'),      // lose on the 400 banner
    rec('2024-01-06 10:00:00', '钟离', 5, '301'),        // guarantee used on the 301 banner
    rec('2024-01-07 10:00:00', '迪卢克', 5, '301'),      // lose, guarantee not used yet
  ]]])
  const [lose, guar, open] = judge(r, data, { uid: '861346531' }).pools['301'].fives
  assert.equal(lose.guaranteeTo.name, '钟离')
  assert.equal(guar.guaranteeFrom.name, '迪卢克')
  assert.notEqual(lose.bannerKey, guar.bannerKey)
  assert.equal(open.guaranteeTo, undefined)
})
