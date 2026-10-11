// The Google profile photo, or the first letter of the name if there is no photo.
export function userName(user) {
  return (user?.email || '').split('@')[0] || 'You'
}

export default function Avatar({ user, size = 'large' }) {
  const photo = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  const cls = `avatar avatar-${size}`
  if (photo) return <img className={cls} src={photo} alt="" referrerPolicy="no-referrer" />
  return (
    <span className={`${cls} avatar-letter`} aria-hidden="true">
      {userName(user).slice(0, 1).toUpperCase()}
    </span>
  )
}
