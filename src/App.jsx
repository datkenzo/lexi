import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyLookup, getStats, normalizeWord, STATUS } from './lib/words.js'
import { fetchEntry, suggestSpellings } from './lib/dictionary.js'
import { deleteWord, getAll, getWord, onLocalChange, putWord } from './lib/db.js'
import { supabase, syncConfigured } from './lib/supabase.js'
import { syncNow } from './lib/sync.js'
import SearchTab from './components/SearchTab.jsx'
import HistoryTab from './components/HistoryTab.jsx'
import ReviewTab from './components/ReviewTab.jsx'
import ProfileTab from './components/ProfileTab.jsx'
import Icon from './components/Icon.jsx'

const TABS = [
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'history', label: 'History', icon: 'list' },
  { id: 'review', label: 'Review', icon: 'cards' },
  { id: 'profile', label: 'Profile', icon: 'user' },
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
  const [focus, setFocus] = useState(false) // true during a review session

  const stats = useMemo(() => getStats(words), [words])

  useEffect(() => {
    getAll()
      .then(setWords)
      .finally(() => setReady(true))
    // Ask the browser to keep our data (helps on iPhone).
    navigator.storage?.persist?.()
  }, [])

  // ---------- Sign in and sync ----------
  const [session, setSession] = useState(null)
  const [sync, setSync] = useState({ state: 'idle', at: null, error: null })
  const syncing = useRef(false)
  const again = useRef(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  const runSync = useCallback(async () => {
    if (!supabase || !userId) return
    if (syncing.current) {
      again.current = true
      return
    }
    syncing.current = true
    setSync((s) => ({ ...s, state: 'syncing' }))
    try {
      const { pulled } = await syncNow(supabase, userId)
      if (pulled > 0) {
        const all = await getAll()
        setWords(all)
        // Refresh the open word card if another device changed or removed it.
        setCurrent((c) => {
          if (!c) return c
          const r = all.find((w) => w.word === c.record.word)
          return r ? { ...c, record: r } : null
        })
      }
      setSync({ state: 'ok', at: Date.now(), error: null })
    } catch (e) {
      setSync({ state: 'error', at: Date.now(), error: e.message || 'Sync failed.' })
    } finally {
      syncing.current = false
      if (again.current) {
        again.current = false
        runSync()
      }
    }
  }, [userId])

  // Sync when you sign in or open the app, shortly after a change, when you come
  // back to the app, and when the internet comes back.
  useEffect(() => {
    if (!userId) return
    runSync()
    let timer
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(runSync, 1500)
    }
    const offChange = onLocalChange(soon)
    const onVisible = () => document.visibilityState === 'visible' && runSync()
    window.addEventListener('online', runSync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      offChange()
      window.removeEventListener('online', runSync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, runSync])

  const signIn = useCallback(async () => {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (err) setSync((s) => ({ ...s, state: 'error', error: err.message }))
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSync({ state: 'idle', at: null, error: null })
  }, [])

  // ---------- Words ----------
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
        const saved = await putWord(record)
        upsert(saved)

        let notice
        if (isNew) notice = 'Added to your history.'
        else if (existing.status === STATUS.LEARNED)
          notice = 'Already in your history. Moved back to Not learned. Total unchanged.'
        else notice = 'Already in your history. Total unchanged.'
        setCurrent({ record: saved, notice })
      } catch (e) {
        setCurrent(null)
        const failure = {
          type: e.type ?? 'error',
          message: e.message,
          detail: e.detail || String(e),
          word,
          suggestions: [],
        }
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
      const next = await putWord({ ...record, my_sentence: text.trim() })
      upsert(next)
      setCurrent((c) => (c && c.record.word === word ? { ...c, record: next } : c))
    },
    [upsert],
  )

  const setStatus = useCallback(
    async (word, status) => {
      const record = await getWord(word)
      if (!record) return
      const next = await putWord({ ...record, status })
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
      <main className={`screen ${focus ? 'focus' : ''}`}>
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
              />
            )}
            {tab === 'history' && <HistoryTab words={words} onOpen={openSaved} />}
            {tab === 'review' && <ReviewTab words={words} onSetStatus={setStatus} onFocusMode={setFocus} />}
            {tab === 'profile' && (
              <ProfileTab
                configured={syncConfigured}
                session={session}
                sync={sync}
                stats={stats}
                onSignIn={signIn}
                onSignOut={signOut}
                onSyncNow={runSync}
              />
            )}
          </>
        )}
      </main>

      {!focus && (
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
      )}
    </div>
  )
}
