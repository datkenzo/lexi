import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDatamuse, normalizeEntry, normalizeWiktionary } from '../src/lib/dictionary.js'

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

test('normalizeWiktionary strips HTML and keeps parts of speech and examples', () => {
  const data = {
    en: [
      {
        partOfSpeech: 'Noun',
        definitions: [
          { definition: '<span>A state of <a href="x">peace</a>.</span>', parsedExamples: [{ example: '<i>Find your calm.</i>' }] },
          { definition: '' },
        ],
      },
      { partOfSpeech: 'Verb', definitions: [{ definition: 'To make calm.' }] },
    ],
    de: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'ignored' }] }],
  }
  const out = normalizeWiktionary('calm', data)
  assert.equal(out.meanings.length, 2)
  assert.equal(out.meanings[0].definition, 'A state of peace.')
  assert.equal(out.meanings[0].example, 'Find your calm.')
  assert.equal(out.partOfSpeech, 'noun, verb')
  assert.equal(out.audio, '')
})

test('normalizeDatamuse reads definitions, parts of speech and IPA', () => {
  const data = [
    {
      word: 'calm',
      score: 1,
      defs: ['adj\tPeaceful and free from anger.', 'n\tA period without wind.', 'v\t'],
      tags: ['pron:K AA1 M ', 'ipa_pron:kˈɑm'],
    },
  ]
  const out = normalizeDatamuse('calm', data)
  assert.equal(out.meanings.length, 2)
  assert.deepEqual(out.meanings[0], { pos: 'adjective', definition: 'Peaceful and free from anger.', example: '' })
  assert.equal(out.partOfSpeech, 'adjective, noun')
  assert.equal(out.phonetic, '/kˈɑm/')
})

test('normalizeDatamuse ignores a different word', () => {
  assert.equal(normalizeDatamuse('zzzz', [{ word: 'calms', defs: ['n\tx'] }]).meanings.length, 0)
})
