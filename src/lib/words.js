// Pure logic for words: no browser APIs, so it can be tested with `npm test`.

export const STATUS = { LEARNED: 'learned', NOT_LEARNED: 'not_learned' }

export function normalizeWord(w) {
  return (w ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Looking a word up always records it in history.
 * - New word: added once, status Not learned.
 * - Known word: total stays the same, last_searched is refreshed,
 *   and the status goes back to Not learned (even if it was Learned).
 */
export function applyLookup(existing, entry, now = Date.now()) {
  const word = normalizeWord(entry.word)
  const base = { phonetic: '', audio: '', partOfSpeech: '', meanings: [], ...entry, word }
  if (!existing) {
    return {
      isNew: true,
      record: {
        ...base,
        my_sentence: '',
        date_added: now,
        last_searched: now,
        status: STATUS.NOT_LEARNED,
      },
    }
  }
  return {
    isNew: false,
    record: {
      ...existing,
      ...base,
      my_sentence: existing.my_sentence ?? '',
      date_added: existing.date_added,
      last_searched: now,
      status: STATUS.NOT_LEARNED,
    },
  }
}

export function getStats(words) {
  const notLearned = words.filter((w) => w.status === STATUS.NOT_LEARNED).length
  return { total: words.length, notLearned, learned: words.length - notLearned }
}

function parseLocalDate(value, endOfDay = false) {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
    : new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

/** Time ranges use the last lookup date. The week starts on Monday. */
export function rangeBounds(range, now = Date.now(), custom = {}) {
  const d = new Date(now)
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  switch (range) {
    case 'today':
      return { from: new Date(y, m, day).getTime(), to: null }
    case 'week': {
      const sinceMonday = (d.getDay() + 6) % 7
      return { from: new Date(y, m, day - sinceMonday).getTime(), to: null }
    }
    case 'month':
      return { from: new Date(y, m, 1).getTime(), to: null }
    case 'custom':
      return {
        from: custom.from ? parseLocalDate(custom.from) : null,
        to: custom.to ? parseLocalDate(custom.to, true) : null,
      }
    default:
      return { from: null, to: null }
  }
}

/**
 * options: { status: 'all' | 'not_learned' | 'learned', range, custom, text }
 * Newest lookups first.
 */
export function filterWords(words, options = {}, now = Date.now()) {
  const { status = 'all', range = 'all', custom = {}, text = '' } = options
  const { from, to } = rangeBounds(range, now, custom)
  const needle = normalizeWord(text)
  return words
    .filter((w) => status === 'all' || w.status === status)
    .filter((w) => from === null || w.last_searched >= from)
    .filter((w) => to === null || w.last_searched <= to)
    .filter((w) => !needle || w.word.includes(needle))
    .sort((a, b) => b.last_searched - a.last_searched)
}

export function shuffle(items, random = Math.random) {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
