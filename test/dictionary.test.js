import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEntry } from '../src/lib/dictionary.js'

const sample = [
  {
    word: 'run',
    phonetic: '/rʌn/',
    phonetics: [{ text: '/rʌn/', audio: '' }, { audio: '//ssl.example.com/run.mp3' }],
    meanings: [
      {
        partOfSpeech: 'verb',
        definitions: [
          { definition: 'to move fast on foot', example: 'I run every morning.' },
          { definition: 'to operate' },
        ],
      },
      { partOfSpeech: 'noun', definitions: [{ definition: 'an act of running' }] },
    ],
  },
]

test('normalizeEntry reads phonetic, audio, meanings and parts of speech', () => {
  const out = normalizeEntry('run', sample)
  assert.equal(out.word, 'run')
  assert.equal(out.phonetic, '/rʌn/')
  assert.equal(out.audio, 'https://ssl.example.com/run.mp3')
  assert.equal(out.partOfSpeech, 'verb, noun')
  assert.equal(out.meanings.length, 3)
  assert.equal(out.meanings[0].example, 'I run every morning.')
  assert.equal(out.meanings[1].example, '')
})

test('normalizeEntry limits the number of meanings', () => {
  const many = [
    {
      meanings: [
        { partOfSpeech: 'noun', definitions: Array.from({ length: 20 }, (_, i) => ({ definition: `d${i}` })) },
      ],
    },
  ]
  assert.equal(normalizeEntry('x', many).meanings.length, 12)
})

test('normalizeEntry copes with empty data', () => {
  const out = normalizeEntry('x', [])
  assert.deepEqual(out.meanings, [])
  assert.equal(out.phonetic, '')
  assert.equal(out.audio, '')
})
