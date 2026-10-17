import {
  applyRemoteActivity,
  getActivity,
  getAllRaw,
  getRaw,
  markActivityClean,
  markClean,
  putSynced,
} from './db.js'
import { activityFromRow, activityToRow, fromRow, needsUpload, pickWinner, toRow } from './syncLogic.js'

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

  const activity = await syncActivity(client, userId)
  return { pulled, pushed: pending.length, activityPulled: activity.pulled, activityMissing: activity.missing }
}

// Streak days work like words, but two devices add their counts together instead of
// one change winning (see mergeBy in streak.js). If the `activity` table has not been
// created yet, words still sync and the streak just stays on this device.
async function syncActivity(client, userId) {
  const key = `lexi.activityCursor.${userId}`
  let cursor = readCursor(key)
  let pulled = 0
  try {
    for (;;) {
      const { data, error } = await client
        .from('activity')
        .select('day, data, updated_at, synced_at')
        .gt('synced_at', cursor)
        .order('synced_at', { ascending: true })
        .limit(PAGE)
      if (error) throw error
      for (const row of data) {
        const remote = activityFromRow(row)
        if (await applyRemoteActivity(remote.day, remote.by)) pulled++
        cursor = row.synced_at
      }
      if (data.length < PAGE) break
    }

    const pending = (await getActivity()).filter((r) => r.dirty)
    for (let i = 0; i < pending.length; i += PAGE) {
      const batch = pending.slice(i, i + PAGE)
      const { error } = await client
        .from('activity')
        .upsert(batch.map((r) => activityToRow(r, userId)), { onConflict: 'user_id,day' })
      if (error) throw error
      for (const rec of batch) await markActivityClean(rec.day, rec.updated_at)
    }

    writeCursor(key, cursor)
    return { pulled, missing: false }
  } catch (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return { pulled, missing: true }
    throw explain(error)
  }
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
