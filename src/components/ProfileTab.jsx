import Icon from './Icon.jsx'
import Avatar, { userName } from './Avatar.jsx'

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

  return (
    <div className="stack">
      <header>
        <h1 className="title">Profile</h1>
      </header>

      <div className="profile-card">
        <Avatar user={user} />
        <p className="profile-name">{userName(user)}</p>
        <div className="sync-line" aria-live="polite">
          <span className={`sync-dot ${sync.state}`} aria-hidden="true" />
          <span>
            {sync.state === 'syncing' && 'Syncing...'}
            {sync.state === 'ok' && `Synced ${timeAgo(sync.at)}`}
            {sync.state === 'error' && 'Not synced'}
            {sync.state === 'idle' && 'Waiting to sync'}
          </span>
          <button
            type="button"
            className="link"
            onClick={onSyncNow}
            disabled={sync.state === 'syncing'}
          >
            Sync now
          </button>
        </div>
      </div>

      {sync.error && <SyncError message={sync.error} />}

      <button type="button" className="btn btn-danger btn-wide" onClick={onSignOut}>
        <Icon name="logout" size={20} />
        Log out
      </button>
      <p className="muted small center">Logging out keeps the words on this device.</p>
    </div>
  )
}

function SyncError({ message }) {
  return (
    <div className="alert">
      <strong>{message.startsWith('Sign-in') ? 'Sign-in problem' : 'Sync problem'}</strong>
      <span className="details">{message}</span>
    </div>
  )
}
