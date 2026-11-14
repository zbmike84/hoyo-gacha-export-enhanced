import test from 'node:test'
import assert from 'node:assert/strict'
import {
  speedLuck, bannerSpeed, bannerEfficiency, fiftyLuck, fullPityLuck, bannerExtremes, upCosts,
  tierOf, radianceWinRate, upAverage, expectedUpAverage, costDist, pityDist,
} from '../../src/games/genshin/renderer/luck.js'
import { pityModel } from '../../src/games/genshin/renderer/analysis.js'

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`)
const OLD = '2023-01-01 00:00:00'   // before Capturing Radiance: plain 50/50
const five = (pity, result, time = OLD) => ({ pity, result, time, id: String(Math.random()), name: 'x' })

test('distributions are normalised', () => {
  close(pityDist('character').reduce((a, b) => a + b, 0), 1, 1e-9, 'pity')
  close(costDist('character', 0.5).reduce((a, b) => a + b, 0), 1, 1e-9, 'cost')
  close(costDist('weapon', 0.75).reduce((a, b) => a + b, 0), 1, 1e-9, 'weapon cost')
})

test('lifetime speed: average sits in the middle, extremes at the ends, dry pulls count', () => {
  const { mean } = pityModel('character')
  close(speedLuck('character', 100, Math.round(100 * mean)).top, 0.5, 0.08, 'average')
  assert.ok(speedLuck('character', 100, 5000).top < 0.01)
  assert.ok(speedLuck('character', 100, 8000).top > 0.99)
  assert.ok(speedLuck('character', 10, 705).top > speedLuck('character', 10, 620).top)
})

test('banner speed is a completed run: one 5★ at pity 89 is the worst case', () => {
  assert.ok(bannerSpeed('character', [five(89, 'win')]).top > 0.99, 'pity 89')
  assert.ok(bannerSpeed('character', [five(10, 'win')]).top < 0.1, 'pity 10')
  close(bannerSpeed('character', [five(76, 'win')]).top, 0.5, 0.1, 'pity 76 ~ median')
})

test('banner efficiency counts the losses at the end as an open run', () => {
  const ended = bannerEfficiency('character', [five(70, 'win')])
  const thenLost = bannerEfficiency('character', [five(70, 'win'), five(80, 'lose')])
  assert.equal(ended.U, 1)
  assert.equal(thenLost.T, 150)
  assert.ok(thenLost.top > ended.top, 'a trailing loss makes the banner look worse')
  // starting on a carried-over guarantee: the first rate-up only needs one 5★
  const carried = bannerEfficiency('character', [five(70, 'guaranteed')])
  close(carried.top, bannerSpeed('character', [five(70, 'guaranteed')]).top, 1e-9, 'guaranteed start = one 5★')
})

test('pulls per rate-up and full pity', () => {
  const fives = [five(80, 'lose'), five(78, 'guaranteed'), five(10, 'win'), five(75, 'win')]
  assert.deepEqual(upCosts(fives).costs.map(c => c.cost), [158, 10, 75])
  const fp = fullPityLuck('character', fives)
  assert.equal(fp.k, 1)
  assert.equal(fp.n, 3)
  assert.equal(fullPityLuck('character', []), null)
})

test('50/50 luck: fair coin, Radiance certainty, weapon 75/25', () => {
  close(fiftyLuck([five(70, 'win'), five(70, 'lose')]).top, 0.5, 1e-12, 'one of two')
  close(fiftyLuck([{ result: 'win', time: '2025-01-01', streakBefore: 3 }]).top, 0.5, 1e-12, 'certain win')
  const w = fiftyLuck([five(60, 'up'), five(60, 'off'), five(60, 'up_guaranteed')], 'weapon')
  assert.deepEqual([w.w, w.n], [1, 2])
  close(w.expected, 1.5, 1e-12, 'weapon expected')
})

test('tiers and expectations', () => {
  assert.equal(tierOf(0.01), 'blessed')
  assert.equal(tierOf(0.2), 'lucky')
  assert.equal(tierOf(0.5), 'average')
  assert.equal(tierOf(0.9), 'unlucky')
  assert.equal(tierOf(0.99), 'cursed')
  close(radianceWinRate(), 16 / 29, 1e-12, 'stationary win rate')
  close(expectedUpAverage('character').pre, 93.4, 0.2, 'pre-5.0')
  close(expectedUpAverage('character').post, 90.2, 0.2, 'post-5.0')
  close(expectedUpAverage('weapon').post, 66.6, 0.2, 'weapon')
  const u = upAverage({ fives: [five(80, 'lose'), five(20, 'guaranteed'), five(50, 'win')] })
  assert.deepEqual([u.ups, u.pulls, u.avg], [2, 150, 75])
})

test('worst/best banner are ranked by excess pulls, not by percentile', () => {
  const b = (key, pity, result) => ({ ...five(pity, result), bannerKey: key })
  const fives = [
    // small banner: a carried guarantee landing late (one slow 5★, little money)
    b('small', 85, 'guaranteed'),
    // big banner: 4 losses, 4 guarantees, 1 win -> 5 rate-ups in ~680 pulls (expected ~467)
    ...[80, 75, 78, 76, 79, 77, 74, 80].map((p, i) => b('big', p, i % 2 ? 'guaranteed' : 'lose')), b('big', 60, 'win'),
    // lucky banner: three quick wins
    b('lucky', 20, 'win'), b('lucky', 30, 'win'), b('lucky', 25, 'win'),
  ]
  const ex = bannerExtremes('character', fives)
  assert.equal(ex.n, 3)
  assert.equal(ex.worst.first.bannerKey, 'big')
  assert.ok(ex.worst.excess > 150, `excess ${ex.worst.excess}`)
  assert.equal(ex.best.first.bannerKey, 'lucky')
  assert.ok(ex.best.excess < -150)
  assert.ok(ex.worst.top > 0.75, 'worst banner is at least unlucky on its own')
})
