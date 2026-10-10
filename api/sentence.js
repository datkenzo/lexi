// Vercel serverless function: POST /api/sentence
// Set ANTHROPIC_API_KEY in the Vercel project settings (Environment Variables).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' })
  }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set' })
  }

  const clean = (value, max) =>
    typeof value === 'string' ? value.replace(/["\n\r]/g, ' ').trim().slice(0, max) : ''
  const word = clean(req.body?.word, 60)
  const pos = clean(req.body?.pos, 30)
  const definition = clean(req.body?.definition, 200)
  if (!word) {
    return res.status(400).json({ error: 'word is required' })
  }

  const prompt =
    `Write one natural example sentence (at most 20 words) that uses the English word "${word}"` +
    (pos ? ` as a ${pos}` : '') +
    (definition ? `, meaning: ${definition}` : '') +
    '. Reply with the sentence only.'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok) {
      return res.status(502).json({ error: 'The AI service returned an error' })
    }
    const data = await response.json()
    const sentence = data.content?.[0]?.text?.trim()
    return res.status(200).json({ sentence })
  } catch {
    return res.status(502).json({ error: 'Could not reach the AI service' })
  }
}
