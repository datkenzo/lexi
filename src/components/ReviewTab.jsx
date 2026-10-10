import { useMemo, useState } from 'react'
import { filterWords, shuffle, STATUS } from '../lib/words.js'
import Icon from './Icon.jsx'

const MODES = [
  { id: 'not_learned', label: 'Not learned' },
  { id: 'all', label: 'All words' },
]

const RANGES = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
]

export default function ReviewTab({ words, onSetStatus }) {
  const [phase, setPhase] = useState('setup') // setup | session | done
  const [mode, setMode] = useState('not_learned')
  const [range, setRange] = useState('all')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState({ learned: 0, notLearned: 0 })

  const matches = useMemo(
    () => filterWords(words, { status: mode === 'all' ? 'all' : 'not_learned', range, custom }),
    [words, mode, range, custom],
  )

  const start = () => {
    setQueue(shuffle(matches))
    setIndex(0)
    setFlipped(false)
    setResults({ learned: 0, notLearned: 0 })
    setPhase('session')
  }

  const answer = (status) => {
    const card = queue[index]
    onSetStatus(card.word, status)
    setResults((r) =>
      status === STATUS.LEARNED
        ? { ...r, learned: r.learned + 1 }
        : { ...r, notLearned: r.notLearned + 1 },
    )
    if (index + 1 >= queue.length) {
      setPhase('done')
    } else {
      setIndex(index + 1)
      setFlipped(false)
    }
  }

  const play = (e, url) => {
    e.stopPropagation()
    if (url) new Audio(url).play().catch(() => {})
  }

  if (phase === 'session' && queue[index]) {
    const card = queue[index]
    const first = card.meanings?.[0]
    const example = card.meanings?.find((m) => m.example)?.example
    return (
      <div className="stack">
        <div className="session-bar">
          <button type="button" className="icon-btn" onClick={() => setPhase('setup')} aria-label="End review">
            <Icon name="close" />
          </button>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={queue.length}
            aria-valuenow={index}
          >
            <div className="progress-fill" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
          <span className="muted small">
            {index + 1} / {queue.length}
          </span>
        </div>

        <button
          type="button"
          className={`flash ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Show the word' : 'Show the meaning'}
        >
          <div className="flash-inner">
            <div className="face front" aria-hidden={flipped}>
              <h2 className="flash-word">{card.word}</h2>
              <p className="muted">{card.phonetic}</p>
              {card.audio && (
                <span
                  role="button"
                  tabIndex={0}
                  className="icon-btn"
                  onClick={(e) => play(e, card.audio)}
                  onKeyDown={(e) => e.key === 'Enter' && play(e, card.audio)}
                  aria-label="Play pronunciation"
                >
                  <Icon name="speaker" />
                </span>
              )}
              <p className="hint">Tap to reveal the meaning</p>
            </div>
            <div className="face back" aria-hidden={!flipped}>
              <p className="pos-line">{card.partOfSpeech}</p>
              <p className="flash-meaning">{first?.definition}</p>
              {example && <p className="example">“{example}”</p>}
              {card.my_sentence && (
                <p className="my-line">
                  <span className="label">My sentence</span>
                  {card.my_sentence}
                </p>
              )}
            </div>
          </div>
        </button>

        {flipped ? (
          <div className="answer-row">
            <button type="button" className="btn btn-ghost btn-wide" onClick={() => answer(STATUS.NOT_LEARNED)}>
              Not learned
            </button>
            <button type="button" className="btn btn-primary btn-wide" onClick={() => answer(STATUS.LEARNED)}>
              <Icon name="check" size={20} />
              Learned
            </button>
          </div>
        ) : (
          <p className="muted center small">Tap the card, then mark it.</p>
        )}
      </div>
    )
  }

  if (phase === 'done') {
    const total = results.learned + results.notLearned
    return (
      <div className="stack center">
        <header>
          <h1 className="title">Session complete</h1>
          <p className="muted">
            You reviewed {total} {total === 1 ? 'word' : 'words'}.
          </p>
        </header>
        <section className="stats">
          <div className="stat">
            <span className="stat-value">{results.learned}</span>
            <span className="stat-label">Learned</span>
          </div>
          <div className="stat stat-accent">
            <span className="stat-value">{results.notLearned}</span>
            <span className="stat-label">Not learned</span>
          </div>
        </section>
        <button type="button" className="btn btn-primary btn-wide" onClick={() => setPhase('setup')}>
          Back to review
        </button>
      </div>
    )
  }

  return (
    <div className="stack">
      <header>
        <h1 className="title">Review</h1>
        <p className="muted">Flip each card, then mark it Learned or Not learned.</p>
      </header>

      {words.length === 0 ? (
        <p className="empty">No words yet. Look one up to get started.</p>
      ) : (
        <>
          <section className="card stack-tight">
            <h2 className="section-title">Which words</h2>
            <div className="seg" role="group" aria-label="Which words">
              {MODES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={mode === o.id ? 'active' : ''}
                  aria-pressed={mode === o.id}
                  onClick={() => setMode(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <h2 className="section-title">Time range</h2>
            <div className="chips" role="group" aria-label="Time range">
              {RANGES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`chip ${range === o.id ? 'active' : ''}`}
                  aria-pressed={range === o.id}
                  onClick={() => setRange(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {range === 'custom' && (
              <div className="dates">
                <label>
                  From
                  <input
                    className="field"
                    type="date"
                    value={custom.from}
                    onChange={(e) => setCustom({ ...custom, from: e.target.value })}
                  />
                </label>
                <label>
                  To
                  <input
                    className="field"
                    type="date"
                    value={custom.to}
                    onChange={(e) => setCustom({ ...custom, to: e.target.value })}
                  />
                </label>
              </div>
            )}
            <p className="muted small">Time ranges use the date you last looked a word up.</p>
          </section>

          <button type="button" className="btn btn-primary btn-wide" onClick={start} disabled={matches.length === 0}>
            {matches.length === 0
              ? 'No words match'
              : `Start review (${matches.length} ${matches.length === 1 ? 'word' : 'words'})`}
          </button>
        </>
      )}
    </div>
  )
}
