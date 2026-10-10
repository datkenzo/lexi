import { openDB } from 'idb'

// Everything is stored on this device in IndexedDB. There is no sync in version 1.
const dbPromise = openDB('lexi', 1, {
  upgrade(db) {
    const store = db.createObjectStore('words', { keyPath: 'word' })
    store.createIndex('last_searched', 'last_searched')
  },
})

export async function getAll() {
  return (await dbPromise).getAll('words')
}

export async function getWord(word) {
  return (await dbPromise).get('words', word)
}

export async function putWord(record) {
  return (await dbPromise).put('words', record)
}

export async function deleteWord(word) {
  return (await dbPromise).delete('words', word)
}
