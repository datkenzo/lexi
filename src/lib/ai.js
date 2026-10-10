// Asks the small serverless function in /api/sentence (it holds the API key).
// The key is never in the browser.
export async function suggestSentence({ word, pos, definition }) {
  const res = await fetch('/api/sentence', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ word, pos, definition }),
  })
  if (!res.ok) throw new Error('unavailable')
  const data = await res.json()
  if (!data.sentence) throw new Error('empty')
  return data.sentence
}
