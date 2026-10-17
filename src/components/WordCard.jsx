import { useEffect, useState } from 'react'
import { canSpeak, speak } from '../lib/speak.js'
import { STATUS } from '../lib/words.js'
import Icon from './Icon.jsx'

export function StatusBadge({ status }) {
  const learned = status === STATUS.LEARNED
  return (
    <span className={`badge ${learned ? 'badge-ok' : 'badge-todo'}`}>
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
  const [showExamples, setShowExamples] = useState(false)

  useEffect(() => {
    setDraft(record.my_sentence ?? '')
    setShowAll(false)
    setShowExamples(false)
  }, [record.word])

  const meanings = record.meanings ?? []
  const visible = showAll ? meanings : meanings.slice(0, 3)
  const savedSentence = (record.my_sentence ?? '').trim()
  const changed = draft.trim() !== savedSentence

  // Example sentences that come with the dictionary entry.
  const examples = [...new Set(meanings.map((m) => m.example).filter(Boolean))].slice(0, 4)

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
            <button
              type="button"
              className="btn btn-small"
              aria-expanded={showExamples}
              onClick={() => setShowExamples((v) => !v)}
            >
              <Icon name="book" size={18} />
              {showExamples ? 'Hide examples' : 'Example sentences'}
            </button>
            {!changed && savedSentence && <span className="saved-note">Saved</span>}
          </div>

          {showExamples &&
            (examples.length > 0 ? (
              <ul className="examples">
                {examples.map((ex) => (
                  <li key={ex} className="suggestion">
                    <p>“{ex}”</p>
                    <button type="button" className="link" onClick={() => setDraft(ex)}>
                      Use as draft
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">
                This word has no example sentences in the dictionary. Try writing your own above.
              </p>
            ))}
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
