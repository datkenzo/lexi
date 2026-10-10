// Free Dictionary API (no key): https://dictionaryapi.dev
// Datamuse is used only to suggest spellings when a word is not found.

// First try our own domain (Vercel / Vite forwards it), which avoids cross-site
// problems in the browser. If that does not work, call the dictionary directly.
const DICTIONARY_URLS = ['/dictionary/', 'https://api.dictionaryapi.dev/api/v2/entries/en/']
const ATTEMPT_TIMEOUT_MS = 8000
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

async function attempt(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchEntry(word) {
  let res = null
  let lastDetail = ''
  for (const base of DICTIONARY_URLS) {
    try {
      const r = await attempt(base + encodeURIComponent(word))
      // A page that is not JSON means this route does not exist here: try the next one.
      if (!isJson(r) && r.status !== 200) {
        lastDetail = `HTTP ${r.status} from ${base}`
        continue
      }
      res = r
      break
    } catch (err) {
      lastDetail =
        err?.name === 'AbortError'
          ? `Timed out after ${ATTEMPT_TIMEOUT_MS / 1000} seconds`
          : `${err?.name ?? 'Error'}: ${err?.message ?? ''}`
    }
  }

  if (!res) {
    // Only "offline" when the device says so. Otherwise the dictionary could not be
    // reached (blocked, timeout, DNS, server down).
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    throw offline
      ? new LookupError('offline', 'No internet connection.', lastDetail)
      : new LookupError('unreachable', 'Could not reach the dictionary.', lastDetail)
  }
  if (res.status === 404) throw new LookupError('notfound', 'No definitions found.')
  if (!res.ok) throw new LookupError('error', 'The dictionary is not responding.', `HTTP ${res.status}`)
  try {
    return normalizeEntry(word, await res.json())
  } catch {
    throw new LookupError('error', 'The dictionary is not responding.', 'Unreadable response')
  }
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
