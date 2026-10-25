import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTranslation, translateWord, TranslateError } from '../src/lib/translate.js'

const ok = (text) => ({ responseStatus: 200, responseData: { translatedText: text } })

test('normalizeTranslation returns the Vietnamese text', () => {
  assert.equal(normalizeTranslation('calm', ok('  bình tĩnh ')), 'bình tĩnh')
})

test('normalizeTranslation rejects an answer that is the English word itself', () => {
  assert.throws(() => normalizeTranslation('Calm', ok('calm')), TranslateError)
})

test('normalizeTranslation rejects empty text and error statuses', () => {
  assert.throws(() => normalizeTranslation('calm', ok('')), TranslateError)
  assert.throws(() => normalizeTranslation('calm', { responseStatus: 429, responseData: { translatedText: 'x' } }), TranslateError)
  assert.throws(() => normalizeTranslation('calm', undefined), TranslateError)
})

test('normalizeTranslation reports the daily limit message as an error, not as a translation', () => {
  const limit = ok('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.')
  assert.throws(() => normalizeTranslation('calm', limit), /no more free translations/)
})

test('translateWord asks for English to Vietnamese and encodes the word', async () => {
  let seen = ''
  const fakeFetch = async (url) => {
    seen = String(url)
    return new Response(JSON.stringify(ok('bình tĩnh')), { headers: { 'content-type': 'application/json' } })
  }
  assert.equal(await translateWord('calm down', fakeFetch), 'bình tĩnh')
  assert.match(seen, /q=calm%20down/)
  assert.match(seen, /langpair=en\|vi/)
})

test('translateWord turns network and HTTP failures into TranslateError', async () => {
  await assert.rejects(translateWord('calm', async () => new Response('', { status: 500 })), TranslateError)
  await assert.rejects(
    translateWord('calm', async () => {
      throw new TypeError('Failed to fetch')
    }),
    /Could not reach/,
  )
})
