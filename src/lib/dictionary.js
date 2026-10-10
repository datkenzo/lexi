// Free Dictionary API (no key): https://dictionaryapi.dev
// Datamuse is used only to suggest spellings when a word is not found.

// Source 1: Free Dictionary API, through our own domain (Vercel / Vite forwards it).
// Source 2: Wiktionary, used when source 1 is down or has no entry.
const DICTIONARY_URL = '/dictionary/'
const WIKTIONARY_URL = 'https://en.wiktionary.org/api/rest_v1/page/definition/'
const DICTIONARY_TIMEOUT_MS = 5000
const WIKTIONARY_TIMEOUT_MS = 8000
// Datamuse suggests spellings when a word is not found.
const SUGGEST_URL = 'https://api.datamuse.com/sug?max=5&s='

export class LookupError extends Error {
  constructor(type, message, detail = '') {
    super(message)
    this.detail = detail // technical reason, shown in small text
    this.type = type // 'offline' | 'unreachable' | 'notfound' | 'error'
  }
}

function fixUrl(url) {
  if (!url) return ''
  return url.startsWith('//') ? `https:${url}` : url
}

export function normalizeEntry(word, data) {
  const entries = Array.isArray(data) ? data : []
  const phonetics = entries.flatMap((e) => e.phonetics ?? [])
  const phonetic =
    entries.find((e) => e.phonetic)?.phonetic ?? phonetics.find((p) => p.text)?.text ?? ''
  const audio = fixUrl(phonetics.find((p) => p.audio)?.audio)

  const meanings = []
  for (const entry of entries) {
    for (const meaning of entry.meanings ?? []) {
      for (const def of meaning.definitions ?? []) {
        meanings.push({
          pos: meaning.partOfSpeech ?? '',
          definition: def.definition ?? '',
          example: def.example ?? '',
        })
      }
    }
  }
  const partOfSpeech = [...new Set(meanings.map((m) => m.pos).filter(Boolean))].join(', ')
  return { word, phonetic, audio, partOfSpeech, meanings: meanings.slice(0, 12) }
}

const isJson = (res) => (res.headers.get('content-type') || '').includes('json')

async function timedFetch(url, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

function stripHtml(html = '') {
  if (typeof DOMParser !== 'undefined') {
    return (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim()
  }
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
}

// Wiktionary: { en: [{ partOfSpeech, definitions: [{ definition, parsedExamples }] }] }
export function normalizeWiktionary(word, data) {
  const meanings = []
  for (const group of data?.en ?? []) {
    for (const def of group.definitions ?? []) {
      const definition = stripHtml(def.definition)
      if (!definition) continue
      const example = stripHtml(def.parsedExamples?.[0]?.example ?? def.examples?.[0] ?? '')
      meanings.push({ pos: (group.partOfSpeech ?? '').toLowerCase(), definition, example })
    }
  }
  const partOfSpeech = [...new Set(meanings.map((m) => m.pos).filter(Boolean))].join(', ')
  return { word, phonetic: '', audio: '', partOfSpeech, meanings: meanings.slice(0, 12) }
}

function failureDetail(err, label, ms) {
  const why = err?.name === 'AbortError' ? `timed out after ${ms / 1000}s` : `${err?.name ?? 'Error'}: ${err?.message ?? ''}`
  return `${label}: ${why}`
}

// Returns an entry, null when the source says "no such word", or throws when it cannot answer.
async function fromDictionaryApi(word) {
  const res = await timedFetch(DICTIONARY_URL + encodeURIComponent(word), DICTIONARY_TIMEOUT_MS)
  if (res.status === 404 && isJson(res)) return null
  if (!res.ok || !isJson(res)) throw new Error(`HTTP ${res.status}`)
  return normalizeEntry(word, await res.json())
}

async function fromWiktionary(word) {
  const res = await timedFetch(WIKTIONARY_URL + encodeURIComponent(word), WIKTIONARY_TIMEOUT_MS)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const entry = normalizeWiktionary(word, await res.json())
  return entry.meanings.length ? entry : null
}

export async function fetchEntry(word) {
  const notes = []
  let answered = false // at least one source replied "no such word"

  try {
    const entry = await fromDictionaryApi(word)
    if (entry && entry.meanings.length) return entry
    answered = true
  } catch (err) {
    notes.push(failureDetail(err, 'Dictionary', DICTIONARY_TIMEOUT_MS))
  }

  try {
    const entry = await fromWiktionary(word)
    if (entry) return entry
    answered = true
  } catch (err) {
    notes.push(failureDetail(err, 'Wiktionary', WIKTIONARY_TIMEOUT_MS))
  }

  if (answered) throw new LookupError('notfound', 'No definitions found.')

  // Only "offline" when the device says so. Otherwise the sources could not be reached.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const detail = notes.join(' · ')
  throw offline
    ? new LookupError('offline', 'No internet connection.', detail)
    : new LookupError('unreachable', 'Could not reach the dictionary.', detail)
}

export async function suggestSpellings(word) {
  try {
    const res = await fetch(SUGGEST_URL + encodeURIComponent(word))
    if (!res.ok) return []
    const list = await res.json()
    return list.map((x) => x.word).filter((w) => w !== word)
  } catch {
    return []
  }
}
