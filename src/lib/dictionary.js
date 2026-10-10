// Word lookup with three free sources, tried in order. The first one that has the
// word wins, so the app keeps working when one service is down.
//
// 1. Free Dictionary API, through our own domain (/dictionary/, forwarded by
//    vercel.json in production and by Vite while developing). Has phonetics,
//    audio and examples. It is sometimes down (Cloudflare error 522).
// 2. Datamuse. Fast and reliable. Definitions and IPA, no examples or audio.
// 3. Wiktionary. Last resort, may have examples.
//
// Datamuse also suggests spellings when no source has the word.

const SOURCES = {
  dictionary: { url: '/dictionary/', timeout: 4000 },
  datamuse: { url: 'https://api.datamuse.com/words?md=dr&ipa=1&max=1&sp=', timeout: 6000 },
  wiktionary: { url: 'https://en.wiktionary.org/api/rest_v1/page/definition/', timeout: 6000 },
}
const SUGGEST_URL = 'https://api.datamuse.com/sug?max=5&s='
const MAX_MEANINGS = 12

export class LookupError extends Error {
  constructor(type, message, detail = '') {
    super(message)
    this.type = type // 'offline' | 'unreachable' | 'notfound' | 'error'
    this.detail = detail // technical reason, shown in small text
  }
}

// ---------- Normalizers: every source becomes the same shape ----------

function fixUrl(url) {
  if (!url) return ''
  return url.startsWith('//') ? `https:${url}` : url
}

function summarize(word, meanings, extra = {}) {
  const partOfSpeech = [...new Set(meanings.map((m) => m.pos).filter(Boolean))].join(', ')
  return {
    word,
    phonetic: '',
    audio: '',
    ...extra,
    partOfSpeech,
    meanings: meanings.slice(0, MAX_MEANINGS),
  }
}

// Free Dictionary API: [{ phonetic, phonetics: [{ text, audio }], meanings: [{ partOfSpeech, definitions }] }]
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
        if (!def.definition) continue
        meanings.push({
          pos: meaning.partOfSpeech ?? '',
          definition: def.definition,
          example: def.example ?? '',
        })
      }
    }
  }
  return summarize(word, meanings, { phonetic, audio })
}

const DATAMUSE_POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', u: '' }

// Datamuse: [{ word, defs: ["adj\tPeaceful...", ...], tags: ["ipa_pron:kˈɑm", ...] }]
export function normalizeDatamuse(word, data) {
  const item = (Array.isArray(data) ? data : []).find(
    (x) => (x.word ?? '').toLowerCase() === word.toLowerCase(),
  )
  if (!item) return summarize(word, [])
  const meanings = (item.defs ?? [])
    .map((line) => {
      const tab = line.indexOf('\t')
      const code = tab === -1 ? '' : line.slice(0, tab)
      const definition = (tab === -1 ? line : line.slice(tab + 1)).trim()
      return { pos: DATAMUSE_POS[code] ?? code, definition, example: '' }
    })
    .filter((m) => m.definition)
  const ipa = (item.tags ?? []).find((t) => t.startsWith('ipa_pron:'))?.slice(9).trim()
  return summarize(word, meanings, { phonetic: ipa ? `/${ipa}/` : '' })
}

function stripHtml(html = '') {
  if (typeof DOMParser !== 'undefined') {
    return (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim()
  }
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
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
  return summarize(word, meanings)
}

// ---------- Fetching ----------

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

// Each source returns an entry with meanings, or null for "I don't have this word".
// It throws when it cannot answer at all (down, timeout, blocked).
const fetchers = {
  async dictionary(word) {
    const { url, timeout } = SOURCES.dictionary
    const res = await timedFetch(url + encodeURIComponent(word), timeout)
    if (res.status === 404 && isJson(res)) return null
    if (!res.ok || !isJson(res)) throw new Error(`HTTP ${res.status}`)
    return normalizeEntry(word, await res.json())
  },
  async datamuse(word) {
    const { url, timeout } = SOURCES.datamuse
    const res = await timedFetch(url + encodeURIComponent(word), timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return normalizeDatamuse(word, await res.json())
  },
  async wiktionary(word) {
    const { url, timeout } = SOURCES.wiktionary
    const res = await timedFetch(url + encodeURIComponent(word), timeout)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return normalizeWiktionary(word, await res.json())
  },
}

function describe(name, err) {
  const why =
    err?.name === 'AbortError'
      ? `timed out after ${SOURCES[name].timeout / 1000}s`
      : err?.message || err?.name || 'failed'
  return `${name}: ${why}`
}

export async function fetchEntry(word) {
  const notes = []
  let someoneAnswered = false

  for (const name of Object.keys(fetchers)) {
    try {
      const entry = await fetchers[name](word)
      if (entry && entry.meanings.length) return { ...entry, source: name }
      someoneAnswered = true
    } catch (err) {
      notes.push(describe(name, err))
    }
  }

  if (someoneAnswered) throw new LookupError('notfound', 'No definitions found.')

  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const detail = notes.join(' · ')
  throw offline
    ? new LookupError('offline', 'No internet connection.', detail)
    : new LookupError('unreachable', 'Could not reach the dictionary.', detail)
}

export async function suggestSpellings(word) {
  try {
    const res = await timedFetch(SUGGEST_URL + encodeURIComponent(word), 5000)
    if (!res.ok) return []
    const list = await res.json()
    return list.map((x) => x.word).filter((w) => w !== word)
  } catch {
    return []
  }
}
