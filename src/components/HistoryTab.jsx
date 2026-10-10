import { useMemo, useState } from 'react'
import { filterWords } from '../lib/words.js'
import { StatusBadge } from './WordCard.jsx'
import Icon from './Icon.jsx'

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

  const list = useMemo(() => filterWords(words, { text, status, range }), [words, text, status, range])

  return (
    <div className="stack">
      <header className="topbar">
        <h1 className="title">History</h1>
        <span className="label-caps">{words.length} {words.length === 1 ? 'word' : 'words'}</span>
      </header>

      <div className="input-wrap">
        <Icon name="search" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search your words"
          aria-label="Search your words"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
      </div>

      <div className="chips" role="group" aria-label="Status">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`choice ${status === o.id ? 'active' : ''}`}
            aria-pressed={status === o.id}
            onClick={() => setStatus(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Date">
        {RANGE_OPTIONS.map((o) => (
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

      {words.length === 0 ? (
        <div className="empty">
          <div className="empty-art" aria-hidden="true">🗂️</div>
          <p>No words yet. Look one up to get started.</p>
        </div>
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
