import { getAllRaw, getRaw, markClean, putSynced } from './db.js'
import { fromRow, needsUpload, pickWinner, toRow } from './syncLogic.js'

const PAGE = 1000

// 1. Download rows changed on the server since the last sync and keep the newer copy.
// 2. Upload words changed on this device.
// The "since" marker uses the server's clock, so device clocks don't matter.
export async function syncNow(client, userId) {
  const key = `lexi.syncCursor.${userId}`
  let cursor = readCursor(key)
  let pulled = 0

  for (;;) {
    const { data, error } = await client
      .from('words')
      .select('word, data, deleted, updated_at, synced_at')
      .gt('synced_at', cursor)
      .order('synced_at', { ascending: true })
      .limit(PAGE)
    if (error) throw explain(error)
    for (const row of data) {
      const local = await getRaw(row.word)
      if (pickWinner(local, row) === 'remote') {
        await putSynced(fromRow(row))
        pulled++
      }
      cursor = row.synced_at
    }
    if (data.length < PAGE) break
  }

  const pending = (await getAllRaw()).filter(needsUpload)
  for (let i = 0; i < pending.length; i += PAGE) {
    const batch = pending.slice(i, i + PAGE)
    const { error } = await client
      .from('words')
      .upsert(batch.map((r) => toRow(r, userId)), { onConflict: 'user_id,word' })
    if (error) throw explain(error)
    for (const rec of batch) await markClean(rec.word, rec.updated_at)
  }

  writeCursor(key, cursor)
  return { pulled, pushed: pending.length }
}

function readCursor(key) {
  try {
    return localStorage.getItem(key) || '1970-01-01T00:00:00Z'
  } catch {
    return '1970-01-01T00:00:00Z'
  }
}

function writeCursor(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Without storage we simply download everything next time.
  }
}

function explain(error) {
  // 42501: blocked by the security rules, e.g. an email that is not on the allow list.
  if (error.code === '42501') return new Error('This Google account is not allowed to sync.')
  if (error.code === '42P01' || error.code === 'PGRST205')
    return new Error('The database table is missing. Run supabase/setup.sql.')
  return new Error(error.message || 'Sync failed.')
}
