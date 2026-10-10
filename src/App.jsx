import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyLookup, getStats, normalizeWord, STATUS } from './lib/words.js'
import { fetchEntry, suggestSpellings } from './lib/dictionary.js'
import { deleteWord, getAll, getWord, putWord } from './lib/db.js'
import SearchTab from './components/SearchTab.jsx'
import HistoryTab from './components/HistoryTab.jsx'
import ReviewTab from './components/ReviewTab.jsx'
import Icon from './components/Icon.jsx'

const TABS = [
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'history', label: 'History', icon: 'list' },
  { id: 'review', label: 'Review', icon: 'cards' },
]

function dictionaryFields(record) {
  const { word, phonetic, audio, partOfSpeech, meanings } = record
  return { word, phonetic, audio, partOfSpeech, meanings }
}

export default function App() {
  const [tab, setTab] = useState('search')
  const [words, setWords] = useState([])
  const [ready, setReady] = useState(false)
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const stats = useMemo(() => getStats(words), [words])

  useEffect(() => {
    getAll()
      .then(setWords)
      .finally(() => setReady(true))
    // Ask the browser to keep our data (helps on iPhone).
    navigator.storage?.persist?.()
  }, [])

  const upsert = useCallback((record) => {
    setWords((prev) => {
      const i = prev.findIndex((w) => w.word === record.word)
      if (i === -1) return [...prev, record]
      const next = prev.slice()
      next[i] = record
      return next
    })
  }, [])

  const lookup = useCallback(
    async (raw) => {
      const word = normalizeWord(raw)
      if (!word) return
      setLoading(true)
      setError(null)
      try {
        const existing = await getWord(word)
        let entry
        try {
          entry = await fetchEntry(word)
        } catch (e) {
          // Cannot reach the dictionary but already saved: use the saved copy.
          if ((e.type === 'offline' || e.type === 'unreachable') && existing) entry = dictionaryFields(existing)
          else throw e
        }
        const { record, isNew } = applyLookup(existing, entry)
        await putWord(record)
        upsert(record)

        let notice
        if (isNew) notice = 'Added to your history.'
        else if (existing.status === STATUS.LEARNED)
          notice = 'Already in your history. Moved back to Not learned. Total unchanged.'
        else notice = 'Already in your history. Total unchanged.'
        setCurrent({ record, notice })
      } catch (e) {
        setCurrent(null)
        const failure = { type: e.type ?? 'error', message: e.message, detail: e.detail || String(e), word, suggestions: [] }
        setError(failure)
        if (e.type === 'notfound') {
          suggestSpellings(word).then((suggestions) =>
            setError((prev) => (prev && prev.word === word ? { ...prev, suggestions } : prev)),
          )
        }
      } finally {
        setLoading(false)
      }
    },
    [upsert],
  )

  const openSaved = useCallback((record) => {
    setError(null)
    setCurrent({ record, notice: null })
    setTab('search')
  }, [])

  const saveSentence = useCallback(
    async (word, text) => {
      const record = await getWord(word)
      if (!record) return
      const next = { ...record, my_sentence: text.trim() }
      await putWord(next)
      upsert(next)
      setCurrent((c) => (c && c.record.word === word ? { ...c, record: next } : c))
    },
    [upsert],
  )

  const setStatus = useCallback(
    async (word, status) => {
      const record = await getWord(word)
      if (!record) return
      const next = { ...record, status }
      await putWord(next)
      upsert(next)
      setCurrent((c) => (c && c.record.word === word ? { ...c, record: next } : c))
    },
    [upsert],
  )

  const remove = useCallback(async (word) => {
    await deleteWord(word)
    setWords((prev) => prev.filter((w) => w.word !== word))
    setCurrent(null)
  }, [])

  return (
    <div className="app">
      <main className="screen">
        {!ready ? (
          <p className="muted center">Loading...</p>
        ) : (
          <>
            {tab === 'search' && (
              <SearchTab
                stats={stats}
                current={current}
                loading={loading}
                error={error}
                onLookup={lookup}
                onSaveSentence={saveSentence}
                onRemove={remove}
                onReview={() => setTab('review')}
              />
            )}
            {tab === 'history' && <HistoryTab words={words} onOpen={openSaved} />}
            {tab === 'review' && <ReviewTab words={words} onSetStatus={setStatus} />}
          </>
        )}
      </main>

      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
