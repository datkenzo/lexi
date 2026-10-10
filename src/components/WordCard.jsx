import { useEffect, useState } from 'react'
import { suggestSentence } from '../lib/ai.js'
import { STATUS } from '../lib/words.js'
import Icon from './Icon.jsx'

export function StatusBadge({ status }) {
  const learned = status === STATUS.LEARNED
  return <span className={`badge ${learned ? 'badge-ok' : 'badge-warn'}`}>{learned ? 'Learned' : 'Not learned'}</span>
}

export default function WordCard({ record, notice, onSaveSentence, onRemove }) {
  const [showAll, setShowAll] = useState(false)
  const [draft, setDraft] = useState(record.my_sentence ?? '')
  const [ai, setAi] = useState({ state: 'idle', text: '' })

  useEffect(() => {
    setDraft(record.my_sentence ?? '')
    setShowAll(false)
    setAi({ state: 'idle', text: '' })
  }, [record.word])

  const meanings = record.meanings ?? []
  const visible = showAll ? meanings : meanings.slice(0, 3)
  const savedSentence = (record.my_sentence ?? '').trim()
  const changed = draft.trim() !== savedSentence

  const play = () => {
    if (record.audio) new Audio(record.audio).play().catch(() => {})
  }

  const askAi = async () => {
    setAi({ state: 'loading', text: '' })
    try {
      const first = meanings[0] ?? {}
      const text = await suggestSentence({
        word: record.word,
        pos: first.pos,
        definition: first.definition,
      })
      setAi({ state: 'done', text })
    } catch {
      setAi({ state: 'error', text: '' })
    }
  }

  const confirmRemove = () => {
    if (window.confirm(`Remove “${record.word}” from your history?`)) onRemove(record.word)
  }

  return (
    <article className="card word-card">
      {notice && <p className="notice">{notice}</p>}

      <div className="word-head">
        <div>
          <h2 className="word">{record.word}</h2>
          <p className="muted phonetic">{record.phonetic}</p>
        </div>
        <div className="word-actions">
          <StatusBadge status={record.status} />
          {record.audio && (
            <button type="button" className="icon-btn" onClick={play} aria-label="Play pronunciation">
              <Icon name="speaker" />
            </button>
          )}
        </div>
      </div>

      {record.partOfSpeech && <p className="pos-line">{record.partOfSpeech}</p>}

      <ol className="meanings">
        {visible.map((m, i) => (
          <li key={i}>
            <span className="pos">{m.pos}</span> {m.definition}
            {m.example && <em className="example">“{m.example}”</em>}
          </li>
        ))}
      </ol>
      {meanings.length > 3 && (
        <button type="button" className="link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : 'Show more'}
        </button>
      )}

      <div className="my-sentence">
        <label htmlFor="my-sentence">My sentence</label>
        <textarea
          id="my-sentence"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Write a sentence with “${record.word}” in your own words`}
        />
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-small"
            disabled={!changed}
            onClick={() => onSaveSentence(record.word, draft)}
          >
            Save sentence
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={askAi}
            disabled={ai.state === 'loading'}
          >
            <Icon name="sparkle" size={18} />
            {ai.state === 'loading' ? 'Thinking...' : 'Suggest a sentence'}
          </button>
          {!changed && savedSentence && <span className="muted saved-note">Saved</span>}
        </div>

        {ai.state === 'done' && (
          <div className="suggestion">
            <p>{ai.text}</p>
            <button type="button" className="link" onClick={() => setDraft(ai.text)}>
              Use as draft
            </button>
          </div>
        )}
        {ai.state === 'error' && (
          <p className="muted small">
            AI suggestions are not available yet. See the README to turn them on.
          </p>
        )}
      </div>

      <button type="button" className="link link-danger" onClick={confirmRemove}>
        Remove from history
      </button>
    </article>
  )
}
