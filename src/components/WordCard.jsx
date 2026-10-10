import { useEffect, useState } from 'react'
import { suggestSentence } from '../lib/ai.js'
import { canSpeak, speak } from '../lib/speak.js'
import { STATUS } from '../lib/words.js'
import Icon from './Icon.jsx'

export function StatusBadge({ status }) {
  const learned = status === STATUS.LEARNED
  return (
    <span className={`badge ${learned ? 'badge-ok' : 'badge-warn'}`}>
      {learned ? 'Learned' : 'Not learned'}
    </span>
  )
}

const SOURCE_NAMES = {
  dictionary: 'Free Dictionary',
  datamuse: 'Datamuse',
  wiktionary: 'Wiktionary',
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

  const askAi = async () => {
    setAi({ state: 'loading', text: '' })
    try {
      const first = meanings[0] ?? {}
      const text = await suggestSentence({ word: record.word, pos: first.pos, definition: first.definition })
      setAi({ state: 'done', text })
    } catch {
      setAi({ state: 'error', text: '' })
    }
  }

  const confirmRemove = () => {
    if (window.confirm(`Remove “${record.word}” from your history?`)) onRemove(record.word)
  }

  const isNewNotice = notice?.startsWith('Added')

  return (
    <article className="stack-tight">
      {notice && (
        <p className={`banner ${isNewNotice ? 'banner-ok' : 'banner-info'}`}>
          <Icon name={isNewNotice ? 'check' : 'refresh'} size={18} />
          {notice}
        </p>
      )}

      <div className="tile">
        <div className="word-head">
          {canSpeak(record) && (
            <button type="button" className="sound-btn" onClick={() => speak(record)} aria-label="Play pronunciation">
              <Icon name="speaker" size={26} />
            </button>
          )}
          <div className="word-title">
            <h2 className="word">{record.word}</h2>
            <div className="word-meta">
              {record.phonetic && <span className="phonetic">{record.phonetic}</span>}
              <StatusBadge status={record.status} />
            </div>
          </div>
        </div>

        <ol className="meanings">
          {visible.map((m, i) => (
            <li key={i} className="meaning">
              <span className="meaning-num" aria-hidden="true">{i + 1}</span>
              <div>
                {m.pos && <span className="pos">{m.pos}</span>}
                <span>{m.definition}</span>
                {m.example && <em className="example">“{m.example}”</em>}
              </div>
            </li>
          ))}
        </ol>
        {meanings.length > 3 && (
          <button type="button" className="link" onClick={() => setShowAll((v) => !v)} style={{ marginTop: 8 }}>
            {showAll ? 'Show less' : `Show ${meanings.length - 3} more`}
          </button>
        )}

        <div className="section">
          <label htmlFor="my-sentence" className="label-caps">My sentence</label>
          <textarea
            id="my-sentence"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Write a sentence with “${record.word}”`}
          />
          <div className="row">
            <button
              type="button"
              className="btn btn-green btn-small"
              disabled={!changed}
              onClick={() => onSaveSentence(record.word, draft)}
            >
              Save sentence
            </button>
            <button type="button" className="btn btn-small" onClick={askAi} disabled={ai.state === 'loading'}>
              <Icon name="sparkle" size={18} />
              {ai.state === 'loading' ? 'Thinking...' : 'Suggest a sentence'}
            </button>
            {!changed && savedSentence && <span className="saved-note">Saved</span>}
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
            <p className="muted small">AI suggestions are not available yet. See the README to turn them on.</p>
          )}
        </div>

        {record.source && SOURCE_NAMES[record.source] && (
          <p className="source-note">Definitions from {SOURCE_NAMES[record.source]}</p>
        )}
      </div>

      <button type="button" className="link link-quiet" onClick={confirmRemove}>
        Remove from history
      </button>
    </article>
  )
}
