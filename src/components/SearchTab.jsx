import { useEffect, useState } from 'react'
import WordCard from './WordCard.jsx'
import Icon from './Icon.jsx'

export default function SearchTab({
  stats,
  current,
  loading,
  error,
  onLookup,
  onSaveSentence,
  onRemove,
  onReview,
}) {
  const [query, setQuery] = useState('')

  // When a word is opened from History, show it in the search bar.
  useEffect(() => {
    if (current) setQuery(current.record.word)
  }, [current?.record.word])

  const submit = (e) => {
    e.preventDefault()
    onLookup(query)
  }

  return (
    <div className="stack">
      <header>
        <h1 className="brand">Lexi</h1>
      </header>

      <form className="searchbar" onSubmit={submit} role="search">
        <Icon name="search" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Look up an English word"
          aria-label="Look up an English word"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="search"
        />
        <button className="btn btn-primary btn-small" type="submit" disabled={loading || !query.trim()}>
          {loading ? '...' : 'Look up'}
        </button>
      </form>

      <section className="stats" aria-label="Your progress">
        <div className="stat">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total words</span>
        </div>
        <div className="stat stat-accent">
          <span className="stat-value">{stats.notLearned}</span>
          <span className="stat-label">Not learned</span>
        </div>
      </section>

      <button
        type="button"
        className="btn btn-primary btn-wide"
        onClick={onReview}
        disabled={stats.total === 0}
      >
        <Icon name="cards" />
        {stats.notLearned > 0 ? `Review ${stats.notLearned} not learned` : 'Review'}
      </button>

      {error && (
        <div className="card notice-error" role="alert">
          {error.type === 'notfound' && (
            <>
              <strong>No result for “{error.word}”.</strong>
              {error.suggestions.length > 0 && (
                <p className="suggest">
                  Did you mean{' '}
                  {error.suggestions.map((s, i) => (
                    <span key={s}>
                      {i > 0 && ', '}
                      <button type="button" className="link" onClick={() => onLookup(s)}>
                        {s}
                      </button>
                    </span>
                  ))}
                  ?
                </p>
              )}
            </>
          )}
          {error.type === 'offline' && (
            <>
              <strong>You are offline.</strong>
              <p className="muted">Saved words and review still work. New words need internet.</p>
            </>
          )}
          {error.type === 'error' && (
            <>
              <strong>The dictionary is not responding.</strong>
              <p className="muted">Try again in a moment.</p>
            </>
          )}
        </div>
      )}

      {current && (
        <WordCard
          record={current.record}
          notice={current.notice}
          onSaveSentence={onSaveSentence}
          onRemove={onRemove}
        />
      )}

      {!current && !error && stats.total === 0 && (
        <p className="empty">No words yet. Look one up to get started.</p>
      )}
    </div>
  )
}
