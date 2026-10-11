import test from 'node:test'
import assert from 'node:assert/strict'
import { fromRow, localTime, needsUpload, pickWinner, toRow } from '../src/lib/syncLogic.js'

test('the newer change wins', () => {
  assert.equal(pickWinner(undefined, { updated_at: 1 }), 'remote')
  assert.equal(pickWinner({ updated_at: 5 }, { updated_at: 9 }), 'remote')
  assert.equal(pickWinner({ updated_at: 9 }, { updated_at: 5 }), 'local')
  assert.equal(pickWinner({ updated_at: 5 }, { updated_at: '5' }), 'local')
})

test('words saved before sync existed are uploaded once and use their last lookup time', () => {
  const legacy = { word: 'calm', last_searched: 42 }
  assert.equal(needsUpload(legacy), true)
  assert.equal(localTime(legacy), 42)
  assert.equal(needsUpload({ word: 'x', dirty: false }), false)
})

test('toRow and fromRow keep the word and drop sync-only fields', () => {
  const rec = { word: 'calm', status: 'learned', my_sentence: 'Stay calm.', updated_at: 7, dirty: true }
  const row = toRow(rec, 'u1')
  assert.deepEqual(row, {
    user_id: 'u1',
    word: 'calm',
    deleted: false,
    updated_at: 7,
    data: { word: 'calm', status: 'learned', my_sentence: 'Stay calm.' },
  })
  assert.deepEqual(fromRow({ ...row, updated_at: '7' }), { word: 'calm', status: 'learned', my_sentence: 'Stay calm.', updated_at: 7 })
})

test('a removed word travels as a small marker', () => {
  const row = toRow({ word: 'calm', deleted: true, updated_at: 9, dirty: true }, 'u1')
  assert.equal(row.deleted, true)
  assert.equal(row.data, null)
  assert.deepEqual(fromRow(row), { word: 'calm', deleted: true, updated_at: 9 })
})
