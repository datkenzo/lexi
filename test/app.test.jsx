import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App.jsx'
import { openDB } from 'idb'
import { deleteWord, getAll, putWord } from '../src/lib/db.js'

const calm = [
  {
    word: 'calm',
    phonetic: '/kɑːm/',
    phonetics: [],
    meanings: [
      {
        partOfSpeech: 'adjective',
        definitions: [{ definition: 'not excited or angry', example: 'Stay calm.' }],
      },
    ],
  },
]

let myMemory = { responseStatus: 200, responseData: { translatedText: 'bình tĩnh' } }

function fakeFetch(url) {
  const u = String(url)
  const json = { headers: { 'content-type': 'application/json' } }
  if (u.includes('mymemory')) return Promise.resolve(new Response(JSON.stringify(myMemory), json))
  if (u.includes('/dictionary/calm')) return Promise.resolve(new Response(JSON.stringify(calm), json))
  if (u.includes('/dictionary/')) return Promise.resolve(new Response('{}', { status: 404, ...json }))
  if (u.includes('wiktionary')) return Promise.resolve(new Response('{}', { status: 404, ...json }))
  if (u.includes('datamuse')) return Promise.resolve(new Response(JSON.stringify([{ word: 'calms' }])))
  return Promise.resolve(new Response('{}', { status: 500 }))
}

const stat = (label) =>
  within(screen.getByLabelText('Your progress')).getByText(label).parentElement

beforeEach(async () => {
  myMemory = { responseStatus: 200, responseData: { translatedText: 'bình tĩnh' } }
  // Empty the word list and the streak so every test starts fresh.
  for (const w of await getAll()) await deleteWord(w.word)
  await (await openDB('lexi', 2)).clear('activity')
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Lexi', () => {
  it('falls back to Datamuse when the main dictionary is down', async () => {
    const muse = [{ word: 'calm', defs: ['adj\tNot excited or angry.'], tags: ['ipa_pron:kˈɑm'] }]
    vi.stubGlobal(
      'fetch',
      vi.fn((url) =>
        String(url).includes('datamuse.com/words')
          ? Promise.resolve(new Response(JSON.stringify(muse), { headers: { 'content-type': 'application/json' } }))
          : Promise.resolve(new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } })),
      ),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Look up an English word'), 'calm')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByRole('heading', { name: 'calm' })).toBeTruthy()
    expect(await screen.findByText('Not excited or angry.')).toBeTruthy()
    expect(screen.getByText('/kˈɑm/')).toBeTruthy()
  })

  it('says "could not reach" (not "offline") when the request fails but the device is online', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Look up an English word'), 'start-up')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByText('Could not reach the dictionary.')).toBeTruthy()
    expect(screen.queryByText('You are offline.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('shows a not-found message with spelling suggestions', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Look up an English word'), 'zzzz')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByText(/No result for/)).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'calms' })).toBeTruthy()
  })

  it('shows the dictionary example sentences and copies one into My sentence', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Look up an English word'), 'calm')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    await screen.findByRole('heading', { name: 'calm' })
    await user.click(screen.getByRole('button', { name: 'Example sentences' }))
    await user.click(await screen.findByRole('button', { name: 'Use as draft' }))
    expect(screen.getByLabelText('My sentence').value).toBe('Stay calm.')
  })

  it('counts a word once, resets it to Not learned on re-lookup, and runs a review', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = await screen.findByLabelText('Look up an English word')

    // First lookup adds the word.
    await user.type(input, 'calm')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByRole('heading', { name: 'calm' })).toBeTruthy()
    expect(screen.getByText('Added to your history.')).toBeTruthy()
    expect(stat('Day streak').textContent).toContain('0')
    expect(stat('Not learned').textContent).toContain('1')

    // Review: mark it Learned.
    await user.click(screen.getByRole('button', { name: 'Review' }))
    await user.click(await screen.findByRole('button', { name: /Start review \(1 word\)/ }))
    await user.click(screen.getByRole('button', { name: 'Show the meaning' }))
    await user.click(screen.getByRole('button', { name: /^Learned$/ }))
    expect(await screen.findByText('Session complete')).toBeTruthy()

    // Learned words are skipped in "Not learned" mode.
    await user.click(screen.getByRole('button', { name: 'Back to review' }))
    expect(await screen.findByRole('button', { name: 'No words match' })).toBeTruthy()

    // "All words" still finds it.
    await user.click(screen.getByRole('button', { name: 'All words' }))
    expect(screen.getByRole('button', { name: /Start review \(1 word\)/ })).toBeTruthy()

    // Back on Search: Not learned is 0. One card is not enough for a streak day.
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(stat('Day streak').textContent).toContain('0')
    expect(stat('Not learned').textContent).toContain('0')

    // Looking it up again: total stays 1, word goes back to Not learned.
    const input2 = screen.getByLabelText('Look up an English word')
    await user.clear(input2)
    await user.type(input2, 'Calm')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByText(/Moved back to Not learned/)).toBeTruthy()
    expect(stat('Not learned').textContent).toContain('1')

    // History lists it once.
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getAllByText('calm')).toHaveLength(1)
  })
  it('five reviewed cards in a day make a streak, and the Streak screen shows it', async () => {
    for (const w of ['alpha', 'bravo', 'charlie', 'delta', 'echo'])
      await putWord({ word: w, status: 'not_learned', last_searched: Date.now(), meanings: [{ definition: `${w} meaning` }] })
    const user = userEvent.setup()
    render(<App />)

    // Before reviewing: no streak, and the screen explains how to start one.
    await user.click(await screen.findByRole('button', { name: /Streak: 0 days/ }))
    expect(screen.getByRole('heading', { name: 'Streak' })).toBeTruthy()
    expect(screen.getByText('Review 5 cards in a day to start your streak.')).toBeTruthy()
    expect(screen.getByText('0 / 5')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Start reviewing' }))

    // The button leads straight to Review. Review all five cards.
    await user.click(await screen.findByRole('button', { name: /Start review \(5 words\)/ }))
    for (let i = 0; i < 5; i++) {
      await user.click(await screen.findByRole('button', { name: 'Show the meaning' }))
      await user.click(screen.getByRole('button', { name: /^Learned$/ }))
    }
    expect(await screen.findByText('Session complete')).toBeTruthy()

    // Back on Search the chip shows 1 day, and the screen says the goal is reached.
    await user.click(screen.getByRole('button', { name: 'Back to review' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(await screen.findByRole('button', { name: /Streak: 1 day\./ }))
    expect(screen.getByText('5 / 5')).toBeTruthy()
    expect(screen.getByText(/You reached today’s goal/)).toBeTruthy()

    // The close button returns to Search.
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByLabelText('Look up an English word')).toBeTruthy()
  })

  it('shows the Vietnamese meaning after a lookup and saves it with the word', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Look up an English word'), 'calm')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByText('bình tĩnh')).toBeTruthy()
    expect(screen.getByText('Vietnamese')).toBeTruthy()
    expect(screen.getByText(/Vietnamese from MyMemory/)).toBeTruthy()
    expect((await getAll()).find((w) => w.word === 'calm').vi).toBe('bình tĩnh')
  })

  it('says the Vietnamese meaning is not available and retries with Try again', async () => {
    myMemory = { responseStatus: 429, responseData: { translatedText: '' } }
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Look up an English word'), 'calm')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByText(/Could not get the Vietnamese meaning/)).toBeTruthy()
    // The English definition still shows.
    expect(screen.getByText('not excited or angry')).toBeTruthy()

    myMemory = { responseStatus: 200, responseData: { translatedText: 'điềm tĩnh' } }
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('điềm tĩnh')).toBeTruthy()
    expect(screen.queryByText(/Could not get the Vietnamese meaning/)).toBeNull()
  })

  it('translates an older saved word when it is opened from History, and the flashcard back shows Vietnamese first', async () => {
    await putWord({ word: 'brave', status: 'not_learned', last_searched: Date.now(), meanings: [{ pos: 'adjective', definition: 'ready to face danger' }] })
    myMemory = { responseStatus: 200, responseData: { translatedText: 'dũng cảm' } }
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'History' }))
    await user.click(await screen.findByText('brave'))
    expect(await screen.findByText('dũng cảm')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Review' }))
    await user.click(await screen.findByRole('button', { name: /Start review \(1 word\)/ }))
    await user.click(screen.getByRole('button', { name: 'Show the meaning' }))
    const vi = screen.getByText('dũng cảm')
    const en = screen.getByText('ready to face danger')
    // Vietnamese comes before the English definition on the back of the card.
    expect(vi.compareDocumentPosition(en) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('four reviewed cards are not enough: the goal shows what is left', async () => {
    for (const w of ['alpha', 'bravo', 'charlie', 'delta'])
      await putWord({ word: w, status: 'not_learned', last_searched: Date.now(), meanings: [{ definition: `${w} meaning` }] })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Review' }))
    await user.click(await screen.findByRole('button', { name: /Start review \(4 words\)/ }))
    for (let i = 0; i < 4; i++) {
      await user.click(await screen.findByRole('button', { name: 'Show the meaning' }))
      await user.click(screen.getByRole('button', { name: /^Learned$/ }))
    }
    await user.click(await screen.findByRole('button', { name: 'Back to review' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(await screen.findByRole('button', { name: /Streak: 0 days/ }))
    expect(screen.getByText('4 / 5')).toBeTruthy()
    expect(screen.getByText('Review 1 more card today to start your streak.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Review 1 more card' })).toBeTruthy()
  })
})
