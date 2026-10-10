import { useMemo, useState } from 'react'
import { filterWords } from '../lib/words.js'
import { StatusBadge } from './WordCard.jsx'

const STATUS_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'not_learned', label: 'Not learned' },
  { id: 'learned', label: 'Learned' },
]

const RANGE_OPTIONS = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

export default function HistoryTab({ words, onOpen }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState('all')

  const list = useMemo(
    () => filterWords(words, { text, status, range }),
    [words, text, status, range],
  )

  return (
    <div className="stack">
      <header>
        <h1 className="title">History</h1>
        <p className="muted">Words you looked up, newest first.</p>
      </header>

      <input
        className="field"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search your words"
        aria-label="Search your words"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
      />

      <div className="filters">
        <div className="seg" role="group" aria-label="Status">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={status === o.id ? 'active' : ''}
              aria-pressed={status === o.id}
              onClick={() => setStatus(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <select
          className="field select"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          aria-label="Date"
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {words.length === 0 ? (
        <p className="empty">No words yet. Look one up to get started.</p>
      ) : list.length === 0 ? (
        <p className="empty">No words match these filters.</p>
      ) : (
        <ul className="history">
          {list.map((w) => (
            <li key={w.word}>
              <button type="button" className="history-item" onClick={() => onOpen(w)}>
                <div className="history-main">
                  <span className="history-word">{w.word}</span>
                  <span className="history-meaning">{w.meanings?.[0]?.definition ?? ''}</span>
                  <span className="history-date">
                    Last looked up {new Date(w.last_searched).toLocaleDateString()}
                  </span>
                </div>
                <StatusBadge status={w.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
