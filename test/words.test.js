import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyLookup,
  filterWords,
  getStats,
  normalizeWord,
  rangeBounds,
  shuffle,
  STATUS,
} from '../src/lib/words.js'

const entry = (word) => ({
  word,
  phonetic: '/x/',
  audio: '',
  partOfSpeech: 'noun',
  meanings: [{ pos: 'noun', definition: 'a thing', example: '' }],
})

// Saturday, 10 Oct 2026, 15:00 local time. The week started on Monday 5 Oct.
const NOW = new Date(2026, 9, 10, 15, 0).getTime()
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime()

test('normalizeWord trims, lowercases and collapses spaces', () => {
  assert.equal(normalizeWord('  Ice   Cream '), 'ice cream')
})

test('a new word is added once as Not learned', () => {
  const { record, isNew } = applyLookup(undefined, entry('Resilient'), 1000)
  assert.equal(isNew, true)
  assert.equal(record.word, 'resilient')
  assert.equal(record.status, STATUS.NOT_LEARNED)
  assert.equal(record.date_added, 1000)
  assert.equal(record.last_searched, 1000)
  assert.equal(record.my_sentence, '')
})

test('looking up a Learned word again resets it to Not learned and keeps the total', () => {
  const first = applyLookup(undefined, entry('calm'), 1000).record
  const learned = { ...first, status: STATUS.LEARNED, my_sentence: 'Stay calm.' }
  const library = [learned]

  const { record, isNew } = applyLookup(learned, entry('calm'), 5000)
  assert.equal(isNew, false)
  assert.equal(record.status, STATUS.NOT_LEARNED)
  assert.equal(record.date_added, 1000)
  assert.equal(record.last_searched, 5000)
  assert.equal(record.my_sentence, 'Stay calm.')

  const after = library.map((w) => (w.word === record.word ? record : w))
  assert.equal(getStats(after).total, 1)
  assert.equal(getStats(after).notLearned, 1)
})

test('getStats counts total, Not learned and Learned', () => {
  const words = [
    { word: 'a', status: STATUS.LEARNED },
    { word: 'b', status: STATUS.NOT_LEARNED },
    { word: 'c', status: STATUS.NOT_LEARNED },
  ]
  assert.deepEqual(getStats(words), { total: 3, notLearned: 2, learned: 1 })
})

test('time ranges use the last lookup date (week starts Monday)', () => {
  const words = [
    { word: 'today', status: STATUS.NOT_LEARNED, last_searched: at(2026, 10, 10, 9) },
    { word: 'tuesday', status: STATUS.NOT_LEARNED, last_searched: at(2026, 10, 6) },
    { word: 'sunday', status: STATUS.NOT_LEARNED, last_searched: at(2026, 10, 4) },
    { word: 'early', status: STATUS.NOT_LEARNED, last_searched: at(2026, 10, 1) },
    { word: 'old', status: STATUS.NOT_LEARNED, last_searched: at(2026, 9, 20) },
  ]
  const names = (range, custom) =>
    filterWords(words, { range, custom }, NOW)
      .map((w) => w.word)
      .sort()

  assert.deepEqual(names('today'), ['today'])
  assert.deepEqual(names('week'), ['today', 'tuesday'])
  assert.deepEqual(names('month'), ['early', 'sunday', 'today', 'tuesday'])
  assert.equal(names('all').length, 5)
  assert.deepEqual(names('custom', { from: '2026-10-01', to: '2026-10-06' }), [
    'early',
    'sunday',
    'tuesday',
  ])
  assert.deepEqual(names('custom', { from: '2026-10-06' }), ['today', 'tuesday'])
})

test('filterWords filters by status and text, newest first', () => {
  const words = [
    { word: 'apple', status: STATUS.LEARNED, last_searched: 1 },
    { word: 'apply', status: STATUS.NOT_LEARNED, last_searched: 3 },
    { word: 'banana', status: STATUS.NOT_LEARNED, last_searched: 2 },
  ]
  assert.deepEqual(
    filterWords(words, { status: 'not_learned' }).map((w) => w.word),
    ['apply', 'banana'],
  )
  assert.deepEqual(
    filterWords(words, { text: 'APP' }).map((w) => w.word),
    ['apply', 'apple'],
  )
})

test('rangeBounds with no range has no limits', () => {
  assert.deepEqual(rangeBounds('all', NOW), { from: null, to: null })
})

test('shuffle keeps all items and does not change the input', () => {
  const input = [1, 2, 3, 4, 5]
  const out = shuffle(input, () => 0.3)
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5])
  assert.deepEqual(input, [1, 2, 3, 4, 5])
})
