import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getActivity, getAll, getAllRaw, getRaw, putSynced, putWord, deleteWord, recordCard } from '../src/lib/db.js'
import { openDB } from 'idb'
import { cardsOf } from '../src/lib/streak.js'
import { syncNow } from '../src/lib/sync.js'

// A tiny stand-in for the Supabase server: a `words` table and an `activity` table,
// with server timestamps. Set `missingActivity` to act like the activity table was never created.
function fakeServer({ missingActivity = false } = {}) {
  const rows = new Map() // words, by word
  const days = new Map() // activity, by day
  let clock = 0
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++clock * 1000).toISOString()
  const client = {
    rows,
    days,
    from(table) {
      const store = table === 'activity' ? days : rows
      const key = table === 'activity' ? 'day' : 'word'
      const missing = table === 'activity' && missingActivity
      let since = ''
      const q = {
        select: () => q,
        gt: (_col, v) => ((since = v), q),
        order: () => q,
        limit: async (n) =>
          missing
            ? { data: null, error: { code: 'PGRST205', message: 'missing' } }
            : {
                data: [...store.values()]
                  .filter((r) => r.synced_at > since)
                  .sort((a, b) => (a.synced_at < b.synced_at ? -1 : 1))
                  .slice(0, n),
                error: null,
              },
        upsert: async (list) => {
          for (const r of list) store.set(r[key], { ...r, synced_at: stamp() })
          return { error: null }
        },
      }
      return q
    },
  }
  client.serverWrite = (row) => rows.set(row.word, { ...row, synced_at: stamp() })
  client.serverWriteDay = (row) => days.set(row.day, { ...row, synced_at: stamp() })
  return client
}

beforeEach(async () => {
  await (await openDB('lexi', 2)).clear('activity')
  for (const w of await getAllRaw()) await putSynced({ word: w.word, deleted: true, updated_at: 0 })
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
})

describe('sync', () => {
  it('uploads words changed on this device', async () => {
    const server = fakeServer()
    await putWord({ word: 'calm', status: 'not_learned', last_searched: 1 })
    const r = await syncNow(server, 'u1')
    expect(r.pushed).toBe(1)
    expect(server.rows.get('calm').data.status).toBe('not_learned')
    expect((await getRaw('calm')).dirty).toBe(false)
  })

  it('downloads newer changes from another device and keeps newer local ones', async () => {
    const server = fakeServer()
    const mine = await putWord({ word: 'calm', status: 'not_learned', last_searched: 1 })
    await syncNow(server, 'u1')

    // Another device marks it Learned later, and adds a new word.
    server.serverWrite({ user_id: 'u1', word: 'calm', deleted: false, updated_at: mine.updated_at + 1000, data: { word: 'calm', status: 'learned', last_searched: 1 } })
    server.serverWrite({ user_id: 'u1', word: 'eager', deleted: false, updated_at: 10, data: { word: 'eager', status: 'not_learned', last_searched: 10 } })
    // An old change from another device must not overwrite a newer local one.
    const local = await putWord({ word: 'brave', status: 'learned', last_searched: 2 })
    server.serverWrite({ user_id: 'u1', word: 'brave', deleted: false, updated_at: local.updated_at - 1000, data: { word: 'brave', status: 'not_learned', last_searched: 2 } })

    const r = await syncNow(server, 'u1')
    expect(r.pulled).toBe(2)
    const words = Object.fromEntries((await getAll()).map((w) => [w.word, w.status]))
    expect(words).toEqual({ calm: 'learned', eager: 'not_learned', brave: 'learned' })
    // ...and the newer local one was uploaded.
    expect(server.rows.get('brave').data.status).toBe('learned')
  })

  it('a word removed on one device disappears on the other', async () => {
    const server = fakeServer()
    await putWord({ word: 'calm', status: 'not_learned', last_searched: 1 })
    await syncNow(server, 'u1')
    const before = await getRaw('calm')

    server.serverWrite({ user_id: 'u1', word: 'calm', deleted: true, updated_at: before.updated_at + 1000, data: null })
    await syncNow(server, 'u1')
    expect((await getAll()).map((w) => w.word)).not.toContain('calm')
  })

  it('a removal made here is uploaded', async () => {
    const server = fakeServer()
    await putWord({ word: 'calm', status: 'not_learned', last_searched: 1 })
    await syncNow(server, 'u1')
    await deleteWord('calm')
    await syncNow(server, 'u1')
    expect(server.rows.get('calm').deleted).toBe(true)
  })
  it('uploads the cards reviewed on this device', async () => {
    const server = fakeServer()
    await recordCard('phone', '2026-10-17')
    await recordCard('phone', '2026-10-17')
    await syncNow(server, 'u1')
    expect(server.days.get('2026-10-17').data.by).toEqual({ phone: 2 })
    expect((await getActivity()).find((r) => r.day === '2026-10-17').dirty).toBe(false)
  })

  it('adds up cards reviewed on two devices instead of one overwriting the other', async () => {
    const server = fakeServer()
    // The computer reviewed 3 cards and uploaded them earlier.
    server.serverWriteDay({ user_id: 'u1', day: '2026-10-17', data: { by: { computer: 3 } }, updated_at: 1 })
    // The phone, offline, reviewed 2 cards the same day.
    await recordCard('phone', '2026-10-17')
    await recordCard('phone', '2026-10-17')

    const r = await syncNow(server, 'u1')
    expect(r.activityPulled).toBe(1)
    const local = (await getActivity()).find((d) => d.day === '2026-10-17')
    expect(cardsOf(local)).toBe(5)
    // ...and the merged total went back to the server for the computer to see.
    expect(server.days.get('2026-10-17').data.by).toEqual({ computer: 3, phone: 2 })
  })

  it('a day only another device knows about is downloaded', async () => {
    const server = fakeServer()
    server.serverWriteDay({ user_id: 'u1', day: '2026-10-16', data: { by: { computer: 5 } }, updated_at: 1 })
    await syncNow(server, 'u1')
    expect(cardsOf((await getActivity()).find((d) => d.day === '2026-10-16'))).toBe(5)
  })

  it('words still sync when the activity table has not been created yet', async () => {
    const server = fakeServer({ missingActivity: true })
    await putWord({ word: 'calm', status: 'not_learned', last_searched: 1 })
    await recordCard('phone', '2026-10-17')
    const r = await syncNow(server, 'u1')
    expect(r.pushed).toBe(1)
    expect(r.activityMissing).toBe(true)
    expect(server.rows.get('calm')).toBeTruthy()
    // The day stays waiting to upload.
    expect((await getActivity()).find((d) => d.day === '2026-10-17').dirty).toBe(true)
  })
})
