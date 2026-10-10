import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App.jsx'

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

function fakeFetch(url) {
  const u = String(url)
  if (u.includes('/entries/en/calm')) return Promise.resolve(new Response(JSON.stringify(calm)))
  if (u.includes('/entries/en/')) return Promise.resolve(new Response('{}', { status: 404 }))
  if (u.includes('datamuse')) return Promise.resolve(new Response(JSON.stringify([{ word: 'calms' }])))
  return Promise.resolve(new Response('{}', { status: 500 }))
}

const stat = (label) =>
  within(screen.getByLabelText('Your progress')).getByText(label).parentElement

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Lexi', () => {
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

  it('counts a word once, resets it to Not learned on re-lookup, and runs a review', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = await screen.findByLabelText('Look up an English word')

    // First lookup adds the word.
    await user.type(input, 'calm')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByRole('heading', { name: 'calm' })).toBeTruthy()
    expect(screen.getByText('Added to your history.')).toBeTruthy()
    expect(stat('Total words').textContent).toContain('1')
    expect(stat('Not learned').textContent).toContain('1')

    // Review: mark it Learned.
    await user.click(screen.getByRole('button', { name: /Review 1 not learned/ }))
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

    // Back on Search: Not learned is 0, total is 1.
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(stat('Total words').textContent).toContain('1')
    expect(stat('Not learned').textContent).toContain('0')

    // Looking it up again: total stays 1, word goes back to Not learned.
    const input2 = screen.getByLabelText('Look up an English word')
    await user.clear(input2)
    await user.type(input2, 'Calm')
    await user.click(screen.getByRole('button', { name: 'Look up' }))
    expect(await screen.findByText(/Moved back to Not learned/)).toBeTruthy()
    expect(stat('Total words').textContent).toContain('1')
    expect(stat('Not learned').textContent).toContain('1')

    // History lists it once.
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getAllByText('calm')).toHaveLength(1)
  })
})
