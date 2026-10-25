// Vietnamese meaning of a word, from MyMemory (free, no key, works from the browser).
// Anonymous use allows about 5,000 characters a day, which is plenty for single words.
//
// Everything that talks to the service lives in translateWord(), so the source can be
// swapped later (for example for a richer one with several meanings) without touching the UI.

const ENDPOINT = 'https://api.mymemory.translated.net/get'
const TIMEOUT = 6000

export class TranslateError extends Error {
  constructor(message, detail = '') {
    super(message)
    this.detail = detail
  }
}

// MyMemory answers { responseStatus, responseData: { translatedText } }.
// It reports problems inside a normal-looking answer, so check the text too.
export function normalizeTranslation(word, data) {
  const status = Number(data?.responseStatus)
  const text = String(data?.responseData?.translatedText ?? '').trim()
  if (status !== 200) throw new TranslateError('The translation service refused the request.', `status ${status || '?'}`)
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(text)) {
    throw new TranslateError('The translation service has no more free translations today.', text.slice(0, 80))
  }
  if (!text) throw new TranslateError('No translation found.')
  // An answer identical to the English word means "I could not translate this".
  if (text.toLowerCase() === word.toLowerCase()) throw new TranslateError('No translation found.')
  return text
}

export async function translateWord(word, fetchImpl = fetch) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetchImpl(`${ENDPOINT}?q=${encodeURIComponent(word)}&langpair=en|vi`, { signal: ctrl.signal })
    if (!res.ok) throw new TranslateError('The translation service is not responding.', `HTTP ${res.status}`)
    return normalizeTranslation(word, await res.json())
  } catch (err) {
    if (err instanceof TranslateError) throw err
    throw new TranslateError(
      err?.name === 'AbortError' ? 'The translation service took too long.' : 'Could not reach the translation service.',
      err?.message || err?.name || '',
    )
  } finally {
    clearTimeout(timer)
  }
}
