import { useEffect, useState } from 'react'
import WordCard from './WordCard.jsx'
import Icon from './Icon.jsx'
import Avatar from './Avatar.jsx'
import Flame from './Flame.jsx'

export default function SearchTab({
  stats,
  streak,
  onOpenStreak,
  current,
  loading,
  error,
  onLookup,
  translation,
  onRetryTranslate,
  onSaveSentence,
  onRemove,
  user,
  onOpenProfile,
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

  // Enter looks up the word (Shift + Enter is ignored: a word has no new lines).
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (query.trim() && !loading) onLookup(query)
    }
  }

  return (
    <div className="stack">
      {/* Top bar: like the streak and gems row in Duolingo */}
      <header className={`topbar ${user ? 'has-avatar' : ''}`}>
        <h1 className="brand">Lexi</h1>
        <section className="stat-chips" aria-label="Your progress">
          <button
            type="button"
            className="stat-chip stat-chip-link"
            onClick={onOpenStreak}
            aria-label={`Streak: ${streak.current} ${streak.current === 1 ? 'day' : 'days'}. Open streak`}
          >
            <Flame size={24} active={streak.todayDone} />
            <div className="stat-text">
              <span className="stat-value">{streak.current}</span>
              <span className="stat-label">Day streak</span>
            </div>
          </button>
          <div className="stat-chip" title="Not learned">
            <Icon name="target" size={24} />
            <div className="stat-text">
              <span className="stat-value">{stats.notLearned}</span>
              <span className="stat-label">Not learned</span>
            </div>
          </div>
        </section>
        {user && (
          <button type="button" className="topbar-avatar" onClick={onOpenProfile} aria-label="Open your profile">
            <Avatar user={user} size="small" />
          </button>
        )}
      </header>

      <form className="searchbar" onSubmit={submit} role="search">
        <div className="input-wrap">
          <Icon name="search" size={26} />
          <textarea
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/\n/g, ''))}
            onKeyDown={onKeyDown}
            placeholder="Type a word"
            aria-label="Look up an English word"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="search"
          />
        </div>
        <button className="btn btn-primary btn-wide" type="submit" disabled={loading || !query.trim()} aria-label="Look up">
          {loading ? '...' : 'Look up'}
        </button>
      </form>

      {error && <LookupAlert error={error} onLookup={onLookup} />}

      {current && (
        <WordCard
          record={current.record}
          notice={current.notice}
          translation={translation}
          onRetryTranslate={onRetryTranslate}
          onSaveSentence={onSaveSentence}
          onRemove={onRemove}
        />
      )}

      {!current && !error && (
        <div className="hero">
          <div className="hero-art" aria-hidden="true">📖</div>
          <p className="hero-title">
            {stats.total === 0 ? 'Look up your first word' : 'What word are you curious about?'}
          </p>
          <p className="muted">Every word you look up is saved for review.</p>
        </div>
      )}

    </div>
  )
}

function LookupAlert({ error, onLookup }) {
  if (error.type === 'notfound') {
    return (
      <div className="alert neutral" role="alert">
        <strong>No result for “{error.word}”.</strong>
        {error.suggestions.length > 0 ? (
          <>
            <span className="muted">Did you mean</span>
            <div className="suggest-chips">
              {error.suggestions.map((s) => (
                <button key={s} type="button" className="btn btn-small btn-word" onClick={() => onLookup(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          <span className="muted">Check the spelling and try again.</span>
        )}
      </div>
    )
  }

  const copy = {
    offline: ['You are offline.', 'Saved words and review still work. New words need internet.'],
    unreachable: ['Could not reach the dictionary.', 'The dictionary services did not answer. Try again in a moment.'],
    error: ['The dictionary is not responding.', 'Try again in a moment.'],
  }[error.type] ?? ['Something went wrong.', 'Try again in a moment.']

  return (
    <div className="alert" role="alert">
      <strong>{copy[0]}</strong>
      <span className="muted">{copy[1]}</span>
      <button type="button" className="btn btn-small" onClick={() => onLookup(error.word)}>
        <Icon name="refresh" size={18} />
        Try again
      </button>
      {error.detail && <span className="details">Details: {error.detail}</span>}
    </div>
  )
}
