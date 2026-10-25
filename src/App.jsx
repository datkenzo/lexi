import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyLookup, getStats, normalizeWord, STATUS } from './lib/words.js'
import { fetchEntry, suggestSpellings } from './lib/dictionary.js'
import { translateWord } from './lib/translate.js'
import { deleteWord, getActivity, getAll, getWord, onLocalChange, putWord, recordCard } from './lib/db.js'
import { computeStreak, dayKey } from './lib/streak.js'
import { deviceId } from './lib/device.js'
import { supabase, syncConfigured } from './lib/supabase.js'
import { syncNow } from './lib/sync.js'
import SearchTab from './components/SearchTab.jsx'
import HistoryTab from './components/HistoryTab.jsx'
import ReviewTab from './components/ReviewTab.jsx'
import ProfileTab from './components/ProfileTab.jsx'
import StreakScreen from './components/StreakScreen.jsx'
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
  const [showStreak, setShowStreak] = useState(false)
  const [activity, setActivity] = useState([])
  const [today, setToday] = useState(dayKey())
  const [translation, setTranslation] = useState(null) // { word, status: 'loading' | 'error' }

  const stats = useMemo(() => getStats(words), [words])
  const streak = useMemo(() => computeStreak(activity, today), [activity, today])

  // A new day starts at midnight: refresh when you come back to the app.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && setToday(dayKey())
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  useEffect(() => {
    getAll()
      .then(setWords)
      .finally(() => setReady(true))
    getActivity().then(setActivity)
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
    const params = new URLSearchParams(window.location.hash.slice(1) + '&' + window.location.search.slice(1))
    const authError = params.get('error_description') || params.get('error')
    if (authError) {
      setSync({ state: 'error', at: null, error: `Sign-in failed: ${authError.replace(/\+/g, ' ')}` })
      setTab('profile')
      window.history.replaceState(null, '', window.location.pathname)
    }
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
      const { pulled, activityPulled } = await syncNow(supabase, userId)
      if (activityPulled > 0) setActivity(await getActivity())
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

  // The Vietnamese meaning is fetched once per word and saved with it.
  const translate = useCallback(
    async (word) => {
      setTranslation({ word, status: 'loading' })
      try {
        const vi = await translateWord(word)
        const record = await getWord(word)
        if (!record) return setTranslation((t) => (t?.word === word ? null : t))
        const next = await putWord({ ...record, vi })
        upsert(next)
        setCurrent((c) => (c && c.record.word === word ? { ...c, record: next } : c))
        setTranslation((t) => (t?.word === word ? null : t))
      } catch {
        setTranslation((t) => (t?.word === word || !t ? { word, status: 'error' } : t))
      }
    },
    [upsert],
  )

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
        if (!saved.vi) translate(word)
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
    [upsert, translate],
  )

  const openSaved = useCallback(
    (record) => {
      setError(null)
      setCurrent({ record, notice: null })
      setTab('search')
      if (!record.vi) translate(record.word)
    },
    [translate],
  )

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

  // One more card reviewed on this device: it counts toward today's goal.
  const cardReviewed = useCallback(async () => {
    const day = dayKey()
    const record = await recordCard(deviceId(), day)
    setToday(day)
    setActivity((prev) => [...prev.filter((r) => r.day !== record.day), record])
  }, [])

  const remove = useCallback(async (word) => {
    await deleteWord(word)
    setWords((prev) => prev.filter((w) => w.word !== word))
    setCurrent(null)
  }, [])

  return (
    <div className="app">
      <main className={`screen ${focus || showStreak ? 'focus' : ''}`}>
        {!ready ? (
          <p className="muted center">Loading...</p>
        ) : showStreak ? (
          <StreakScreen
            streak={streak}
            onClose={() => setShowStreak(false)}
            onReview={() => {
              setShowStreak(false)
              setTab('review')
            }}
          />
        ) : (
          <>
            {tab === 'search' && (
              <SearchTab
                stats={stats}
                streak={streak}
                onOpenStreak={() => setShowStreak(true)}
                current={current}
                loading={loading}
                error={error}
                onLookup={lookup}
                translation={translation}
                onRetryTranslate={translate}
                onSaveSentence={saveSentence}
                onRemove={remove}
                user={session?.user}
                onOpenProfile={() => setTab('profile')}
              />
            )}
            {tab === 'history' && <HistoryTab words={words} onOpen={openSaved} />}
            {tab === 'review' && <ReviewTab words={words} onSetStatus={setStatus} onFocusMode={setFocus} onCardReviewed={cardReviewed} />}
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

      {!focus && !showStreak && (
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
