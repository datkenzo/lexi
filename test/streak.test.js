import test from 'node:test'
import assert from 'node:assert/strict'
import { cardsOf, computeStreak, dayKey, GOAL, mergeBy, sameCounts } from '../src/lib/streak.js'

// 2026-10-17 is a Saturday.
const TODAY = '2026-10-17'
const day = (day, n) => ({ day, by: { a: n } })

test('dayKey uses the local calendar day', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
  assert.equal(dayKey(new Date(2026, 11, 31, 0, 1)), '2026-12-31')
})

test('the goal is 5 cards', () => {
  assert.equal(GOAL, 5)
})

test('cards add up across devices', () => {
  assert.equal(cardsOf({ day: TODAY, by: { a: 3, b: 2 } }), 5)
  assert.equal(cardsOf(undefined), 0)
})

test('no activity means no streak', () => {
  const s = computeStreak([], TODAY)
  assert.equal(s.current, 0)
  assert.equal(s.best, 0)
  assert.equal(s.todayDone, false)
  assert.equal(s.todayCards, 0)
})

test('4 cards is not enough, 5 is', () => {
  assert.equal(computeStreak([day(TODAY, 4)], TODAY).todayDone, false)
  assert.equal(computeStreak([day(TODAY, 5)], TODAY).todayDone, true)
  assert.equal(computeStreak([day(TODAY, 4)], TODAY).todayCards, 4)
})

test('today not done yet: the streak counts back from yesterday and is still alive', () => {
  const s = computeStreak([day('2026-10-16', 5), day('2026-10-15', 6), day(TODAY, 3)], TODAY)
  assert.equal(s.current, 2)
  assert.equal(s.todayDone, false)
})

test('today done adds one more day', () => {
  const s = computeStreak([day('2026-10-16', 5), day('2026-10-15', 6), day(TODAY, 5)], TODAY)
  assert.equal(s.current, 3)
})

test('a missed yesterday breaks the streak, even if earlier days were done', () => {
  const s = computeStreak([day('2026-10-14', 5), day('2026-10-13', 5), day(TODAY, 5)], TODAY)
  assert.equal(s.current, 1)
  assert.equal(s.best, 2)
})

test('best is the longest run ever', () => {
  const records = [
    day('2026-09-01', 5), day('2026-09-02', 5), day('2026-09-03', 5), day('2026-09-04', 5),
    day('2026-10-16', 5), day('2026-10-15', 5),
  ]
  const s = computeStreak(records, TODAY)
  assert.equal(s.best, 4)
  assert.equal(s.current, 2)
})

test('a streak counts across a month and a year end', () => {
  const s = computeStreak([day('2026-12-31', 5), day('2027-01-01', 5), day('2026-12-30', 5)], '2027-01-01')
  assert.equal(s.current, 3)
})

test('the week runs Monday to Sunday and marks each day', () => {
  const s = computeStreak([day('2026-10-12', 5), day('2026-10-13', 5), day('2026-10-15', 5), day('2026-10-16', 5), day(TODAY, 2)], TODAY)
  assert.deepEqual(s.week.map((d) => d.day), [
    '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
  ])
  assert.deepEqual(s.week.map((d) => d.label), ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  assert.deepEqual(s.week.map((d) => d.state), ['done', 'done', 'missed', 'done', 'done', 'today', 'future'])
})

test('on a Sunday the week still starts on the Monday before', () => {
  const s = computeStreak([], '2026-10-18')
  assert.equal(s.week[0].day, '2026-10-12')
  assert.equal(s.week[6].state, 'today')
})

test('merging two devices keeps the higher count per device and never loses cards', () => {
  const merged = mergeBy({ a: 3 }, { a: 2, b: 4 })
  assert.deepEqual(merged, { a: 3, b: 4 })
  assert.equal(cardsOf({ by: merged }), 7)
})

test('sameCounts compares counts and ignores order and zeros', () => {
  assert.equal(sameCounts({ a: 1, b: 2 }, { b: 2, a: 1 }), true)
  assert.equal(sameCounts({ a: 1 }, { a: 1, b: 0 }), true)
  assert.equal(sameCounts({ a: 1 }, { a: 2 }), false)
})
