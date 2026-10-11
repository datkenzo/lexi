import { openDB } from 'idb'

// Words live on this device in IndexedDB, so the app works offline. When you sign in,
// sync.js copies changes to and from Supabase.
//
// Extra fields used by sync (not shown in the app):
//   updated_at  time of the last change on any device (ms)
//   dirty       true when this device has a change that is not uploaded yet
//   deleted     true when the word was removed (kept so other devices learn about it)
const dbPromise = openDB('lexi', 1, {
  upgrade(db) {
    const store = db.createObjectStore('words', { keyPath: 'word' })
    store.createIndex('last_searched', 'last_searched')
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

// Lets the app start a sync shortly after any local change.
const listeners = new Set()
export function onLocalChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function notifyChange() {
  for (const fn of listeners) fn()
}
