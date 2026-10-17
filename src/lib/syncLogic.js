// Pure rules for sync, kept separate so they can be tested without a database.
// Rule: for each word, the most recent change wins (by updated_at).

const SYNC_ONLY = ['dirty', 'deleted', 'updated_at']

// Records saved before sync existed have no updated_at: use their last lookup.
export function localTime(rec) {
  return rec?.updated_at ?? rec?.last_searched ?? rec?.date_added ?? 0
}

// Records saved before sync existed have no dirty flag: upload them once.
export function needsUpload(rec) {
  return rec.dirty !== false
}

// remote: a row from Supabase { word, data, deleted, updated_at }
export function pickWinner(local, remote) {
  if (!local) return 'remote'
  return Number(remote.updated_at) > localTime(local) ? 'remote' : 'local'
}

export function toRow(rec, userId) {
  const data = { ...rec }
  for (const k of SYNC_ONLY) delete data[k]
  return {
    user_id: userId,
    word: rec.word,
    deleted: Boolean(rec.deleted),
    updated_at: localTime(rec),
    data: rec.deleted ? null : data,
  }
}

// Streak days: the row keeps the per-device counts in `data.by`.
export function activityToRow(rec, userId) {
  return { user_id: userId, day: rec.day, data: { by: rec.by }, updated_at: rec.updated_at ?? 0 }
}

export function activityFromRow(row) {
  return { day: row.day, by: row.data?.by ?? {} }
}

export function fromRow(row) {
  const updated_at = Number(row.updated_at)
  if (row.deleted) return { word: row.word, deleted: true, updated_at }
  return { ...row.data, word: row.word, updated_at }
}
