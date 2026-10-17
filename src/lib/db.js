import { openDB } from 'idb'
import { dayKey, mergeBy, sameCounts } from './streak.js'

// Words live on this device in IndexedDB, so the app works offline. When you sign in,
// sync.js copies changes to and from Supabase.
//
// Extra fields used by sync (not shown in the app):
//   updated_at  time of the last change on any device (ms)
//   dirty       true when this device has a change that is not uploaded yet
//   deleted     true when the word was removed (kept so other devices learn about it)
//
// The `activity` store holds one record per day for the streak:
//   { day: 'YYYY-MM-DD', by: { <device id>: cards reviewed }, updated_at, dirty }
const dbPromise = openDB('lexi', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const store = db.createObjectStore('words', { keyPath: 'word' })
      store.createIndex('last_searched', 'last_searched')
    }
    if (oldVersion < 2) {
      db.createObjectStore('activity', { keyPath: 'day' })
    }
  },
})

// Words to show in the app (removed words are hidden).
export async function getAll() {
  const all = await (await dbPromise).getAll('words')
  return all.filter((w) => !w.deleted)
}

// Every record, including removed ones. Used by sync.
export async function getAllRaw() {
  return (await dbPromise).getAll('words')
}

export async function getWord(word) {
  const record = await (await dbPromise).get('words', word)
  return record && !record.deleted ? record : undefined
}

export async function getRaw(word) {
  return (await dbPromise).get('words', word)
}

// A change made on this device: stamp it and mark it for upload.
export async function putWord(record) {
  const { deleted, ...rest } = record
  const next = { ...rest, updated_at: Date.now(), dirty: true }
  await (await dbPromise).put('words', next)
  notifyChange()
  return next
}

// Removing keeps a small marker so the removal reaches your other devices.
export async function deleteWord(word) {
  const db = await dbPromise
  await db.put('words', { word, deleted: true, updated_at: Date.now(), dirty: true })
  notifyChange()
}

// Writes that come from sync: stored as they are, not marked for upload.
export async function putSynced(record) {
  return (await dbPromise).put('words', { ...record, dirty: false })
}

// After an upload: clear the flag, unless the word changed again meanwhile.
export async function markClean(word, updatedAt) {
  const db = await dbPromise
  const current = await db.get('words', word)
  if (current && current.updated_at === updatedAt) {
    const stamp = current.updated_at ?? current.last_searched ?? current.date_added ?? 0
    await db.put('words', { ...current, updated_at: stamp, dirty: false })
  }
}

// ---------- Streak activity ----------

export async function getActivity() {
  return (await dbPromise).getAll('activity')
}

// A card was reviewed on this device: add one to today's count for this device.
export async function recordCard(device, day = dayKey()) {
  const db = await dbPromise
  const tx = db.transaction('activity', 'readwrite')
  const current = await tx.store.get(day)
  const by = { ...(current?.by ?? {}) }
  by[device] = (by[device] ?? 0) + 1
  const next = { day, by, updated_at: Date.now(), dirty: true }
  await tx.store.put(next)
  await tx.done
  notifyChange()
  return next
}

// A day downloaded from sync: merge it with what is here. Returns true when this
// device learned something new. The merged day is uploaded again if this device
// has reviews the server does not know about.
export async function applyRemoteActivity(day, remoteBy) {
  const db = await dbPromise
  const tx = db.transaction('activity', 'readwrite')
  const local = await tx.store.get(day)
  const by = mergeBy(local?.by, remoteBy)
  await tx.store.put({
    day,
    by,
    updated_at: local?.updated_at ?? 0,
    dirty: !sameCounts(by, remoteBy),
  })
  await tx.done
  return !local || !sameCounts(local.by, by)
}

// After an upload: clear the flag, unless the day changed again meanwhile.
export async function markActivityClean(day, updatedAt) {
  const db = await dbPromise
  const tx = db.transaction('activity', 'readwrite')
  const current = await tx.store.get(day)
  if (current && current.updated_at === updatedAt) await tx.store.put({ ...current, dirty: false })
  await tx.done
}

// Lets the app start a sync shortly after any local change.
const listeners = new Set()
export function onLocalChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function notifyChange() {
  for (const fn of listeners) fn()
}
