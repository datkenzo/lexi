import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getAll, getAllRaw, getRaw, putSynced, putWord, deleteWord } from '../src/lib/db.js'
import { syncNow } from '../src/lib/sync.js'

// A tiny stand-in for the Supabase server: one table, server timestamps.
function fakeServer() {
  const rows = new Map()
  let clock = 0
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++clock * 1000).toISOString()
  const client = {
    rows,
    from() {
      let since = ''
      const q = {
        select: () => q,
        gt: (_col, v) => ((since = v), q),
        order: () => q,
        limit: async (n) => ({
          data: [...rows.values()]
            .filter((r) => r.synced_at > since)
            .sort((a, b) => (a.synced_at < b.synced_at ? -1 : 1))
            .slice(0, n),
          error: null,
        }),
        upsert: async (list) => {
          for (const r of list) rows.set(r.word, { ...r, synced_at: stamp() })
          return { error: null }
        },
      }
      return q
    },
  }
  client.serverWrite = (row) => rows.set(row.word, { ...row, synced_at: stamp() })
  return client
}

beforeEach(async () => {
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
})
