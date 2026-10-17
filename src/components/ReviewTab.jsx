import { useEffect, useMemo, useState } from 'react'
import { filterWords, shuffle, STATUS } from '../lib/words.js'
import { canSpeak, speak } from '../lib/speak.js'
import Icon from './Icon.jsx'

const MODES = [
  { id: 'not_learned', label: 'Not learned', note: 'Words still to learn' },
  { id: 'all', label: 'All words', note: 'Everything you saved' },
]

const RANGES = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
]

export default function ReviewTab({ words, onSetStatus, onFocusMode, onCardReviewed }) {
  const [phase, setPhase] = useState('setup') // setup | session | done
  const [mode, setMode] = useState('not_learned')
  const [range, setRange] = useState('all')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState({ learned: 0, notLearned: 0 })

  // Hide the tab bar during a session, like a lesson.
  useEffect(() => {
    onFocusMode?.(phase === 'session')
    return () => onFocusMode?.(false)
  }, [phase, onFocusMode])

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
    onCardReviewed?.()
    setResults((r) =>
      status === STATUS.LEARNED ? { ...r, learned: r.learned + 1 } : { ...r, notLearned: r.notLearned + 1 },
    )
    if (index + 1 >= queue.length) {
      setPhase('done')
    } else {
      setIndex(index + 1)
      setFlipped(false)
    }
  }

  if (phase === 'session' && queue[index]) {
    const card = queue[index]
    const first = card.meanings?.[0]
    const example = card.meanings?.find((m) => m.example)?.example
    const left = queue.length - index
    return (
      <div className="session">
        <div className="session-bar">
          <button type="button" className="icon-btn" onClick={() => setPhase('setup')} aria-label="End review">
            <Icon name="close" size={28} />
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
          <span className="counter">
            {index + 1}/{queue.length}
          </span>
        </div>

        <div className={`deck ${left <= 1 ? 'single' : ''}`}>
          <button
            type="button"
            className={`flash ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? 'Show the word' : 'Show the meaning'}
          >
            <div className="flash-inner">
              <div className="face front" aria-hidden={flipped}>
                <h2 className="flash-word">{card.word}</h2>
                {card.phonetic && <p className="phonetic">{card.phonetic}</p>}
                {canSpeak(card) && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="sound-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      speak(card)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        speak(card)
                      }
                    }}
                    aria-label="Play pronunciation"
                  >
                    <Icon name="speaker" size={26} />
                  </span>
                )}
                <p className="hint label-caps">Tap to flip</p>
              </div>
              <div className="face back" aria-hidden={!flipped}>
                {first?.pos && <p className="label-caps">{first.pos}</p>}
                <p className="flash-meaning">{first?.definition}</p>
                {example && <p className="example">“{example}”</p>}
                {card.my_sentence && (
                  <div className="my-line">
                    <span className="label-caps">My sentence</span>
                    <p>{card.my_sentence}</p>
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        {flipped ? (
          <div className="session-actions">
            <button type="button" className="btn" onClick={() => answer(STATUS.NOT_LEARNED)}>
              Not learned
            </button>
            <button type="button" className="btn btn-green" onClick={() => answer(STATUS.LEARNED)}>
              <Icon name="check" size={20} />
              Learned
            </button>
          </div>
        ) : (
          <div className="session-actions one">
            <button type="button" className="btn btn-primary" onClick={() => setFlipped(true)}>
              Flip card
            </button>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'done') {
    const total = results.learned + results.notLearned
    return (
      <div className="stack center">
        <div className="done-art" aria-hidden="true">🎉</div>
        <header>
          <h1 className="done-title">Session complete</h1>
          <p className="muted">
            You reviewed {total} {total === 1 ? 'word' : 'words'}.
          </p>
        </header>
        <section className="result-tiles">
          <div className="result green">
            <div className="result-head">Learned</div>
            <div className="result-body">{results.learned}</div>
          </div>
          <div className="result todo">
            <div className="result-head">Not learned</div>
            <div className="result-body">{results.notLearned}</div>
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
        <p className="subtitle">Flip each card, then mark it Learned or Not learned.</p>
      </header>

      {words.length === 0 ? (
        <div className="empty">
          <div className="empty-art" aria-hidden="true">🃏</div>
          <p>No words yet. Look one up to get started.</p>
        </div>
      ) : (
        <>
          <section className="stack-tight">
            <h2 className="label-caps">Which words</h2>
            <div className="choices" role="group" aria-label="Which words">
              {MODES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`choice ${mode === o.id ? 'active' : ''}`}
                  aria-pressed={mode === o.id}
                  onClick={() => setMode(o.id)}
                >
                  {o.label}
                  <small aria-hidden="true">{o.note}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="stack-tight">
            <h2 className="label-caps">Time range</h2>
            <div className="chips" role="group" aria-label="Time range">
              {RANGES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`choice ${range === o.id ? 'active' : ''}`}
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
