import Icon from './Icon.jsx'

function timeAgo(ms) {
  if (!ms) return ''
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s} seconds ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`
  return new Date(ms).toLocaleString()
}

export default function ProfileTab({ configured, session, sync, stats, onSignIn, onSignOut, onSyncNow }) {
  if (!configured) {
    return (
      <div className="stack">
        <header>
          <h1 className="title">Profile</h1>
        </header>
        <div className="tile stack-tight">
          <p className="hero-title">Sync is not set up yet</p>
          <p className="muted">
            Your words are saved on this device only. To use the same words on your phone and computer, follow
            SETUP-SYNC.md in the project.
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="stack">
        <header>
          <h1 className="title">Profile</h1>
        </header>
        <div className="hero">
          <div className="hero-art" aria-hidden="true">☁️</div>
          <p className="hero-title">Sync your words</p>
          <p className="muted">Sign in to see the same words on your phone and your computer.</p>
        </div>
        <button type="button" className="btn btn-primary btn-wide" onClick={onSignIn}>
          Sign in with Google
        </button>
        <p className="muted small center">
          You type your password on Google&apos;s own page. Lexi never sees it.{stats.total > 0 &&
            ` The ${stats.total} ${stats.total === 1 ? 'word' : 'words'} on this device will be uploaded the first time you sign in.`}
        </p>
        {sync.error && <SyncError message={sync.error} />}
      </div>
    )
  }

  const user = session.user
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email
  const avatar = user.user_metadata?.avatar_url

  return (
    <div className="stack">
      <header>
        <h1 className="title">Profile</h1>
      </header>

      <div className="tile profile">
        {avatar ? (
          <img className="avatar" src={avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar avatar-letter" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="profile-text">
          <p className="history-word">{name}</p>
          <p className="muted small">{user.email}</p>
        </div>
      </div>

      <div className="tile stack-tight" aria-live="polite">
        <span className="label-caps">Sync</span>
        <div className="sync-line">
          <span className={`sync-dot ${sync.state}`} aria-hidden="true" />
          <span>
            {sync.state === 'syncing' && 'Syncing...'}
            {sync.state === 'ok' && `Synced ${timeAgo(sync.at)}`}
            {sync.state === 'error' && 'Not synced'}
            {sync.state === 'idle' && 'Waiting to sync'}
          </span>
        </div>
        {sync.error && <SyncError message={sync.error} />}
        <button
          type="button"
          className="btn btn-small"
          onClick={onSyncNow}
          disabled={sync.state === 'syncing'}
          style={{ alignSelf: 'flex-start' }}
        >
          <Icon name="refresh" size={18} />
          Sync now
        </button>
        <p className="muted small">Changes sync by themselves when you are online.</p>
      </div>

      <button type="button" className="link link-quiet" onClick={onSignOut}>
        Sign out
      </button>
      <p className="muted small">Signing out keeps the words on this device.</p>
    </div>
  )
}

function SyncError({ message }) {
  return (
    <div className="alert">
      <strong>Sync problem</strong>
      <span className="details">{message}</span>
    </div>
  )
}
