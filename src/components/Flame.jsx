// The streak flame. Colored once today's goal is reached, grey until then.
// `size` is the height; the flame is a little narrower than it is tall.
export default function Flame({ size = 24, active = true, label }) {
  return (
    <svg
      className={`flame ${active ? '' : 'off'}`}
      width={Math.round((size * 5) / 6)}
      height={size}
      viewBox="0 0 100 120"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <path
        className="f1"
        d="M52 4C58 24 84 40 84 74C84 99 68 116 50 116C32 116 16 99 16 74C16 56 26 46 32 34C36 44 40 48 46 50C44 34 46 16 52 4Z"
      />
      <path
        className="f2"
        d="M50 46C54 60 70 68 70 86C70 100 62 108 50 108C38 108 30 100 30 86C30 74 38 70 42 60C45 66 47 67 50 66C49 58 49 52 50 46Z"
      />
      <path
        className="f3"
        d="M50 78C53 84 60 88 60 95C60 102 56 106 50 106C44 106 40 102 40 95C40 89 46 86 50 78Z"
      />
    </svg>
  )
}
