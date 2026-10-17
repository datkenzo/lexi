import Icon from './Icon.jsx'
import Flame from './Flame.jsx'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const STATE_TEXT = {
  done: 'goal reached',
  today: 'today, not done yet',
  missed: 'missed',
  future: 'coming up',
}

function message(streak) {
  const { current, goal } = streak
  if (current >= 2) return `You reviewed ${goal} cards or more ${current} days in a row.`
  if (current === 1) return `You reviewed ${goal} cards in a day. Keep it going.`
  return `Review ${goal} cards in a day to start your streak.`
}

function caption(streak, left) {
  if (streak.todayDone) return 'You reached today’s goal. Come back tomorrow to keep your streak.'
  const cards = `${left}${streak.todayCards > 0 ? ' more' : ''} ${left === 1 ? 'card' : 'cards'}`
  return streak.current > 0
    ? `Review ${cards} today to keep your streak.`
    : `Review ${cards} today to start your streak.`
}

export default function StreakScreen({ streak, onClose, onReview }) {
  const { current, todayCards, todayDone, goal, week } = streak
  const left = Math.max(goal - todayCards, 0)
  const percent = (Math.min(todayCards, goal) / goal) * 100
  const buttonLabel = todayDone
    ? 'Review more cards'
    : todayCards > 0
      ? `Review ${left} more ${left === 1 ? 'card' : 'cards'}`
      : 'Start reviewing'

  return (
    <div className="stack streak">
      <header className="topbar">
        <h1 className="title">Streak</h1>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="close" size={28} />
        </button>
      </header>

      <section className="streak-hero" aria-label="Current streak">
        <Flame size={158} active={current > 0} label="Flame" />
        <p className="streak-number">{current}</p>
        <p className="hero-title">day streak</p>
        <p className="muted center">{message(streak)}</p>
      </section>

      <section className="tile stack-tight" aria-label="This week">
        <p className="label-caps">This week</p>
        <div className="week">
          {week.map((d, i) => (
            <div className="week-day" key={d.day}>
              <div className={`dot ${d.state}`} role="img" aria-label={`${DAY_NAMES[i]}: ${STATE_TEXT[d.state]}`}>
                {d.state === 'done' && <Icon name="check" size={20} />}
              </div>
              <span className={`week-label ${d.state === 'today' ? 'today' : ''}`} aria-hidden="true">
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="streak-foot">
        <div className="goal-row">
          <div
            className="progress"
            role="progressbar"
            aria-label="Cards reviewed today"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(todayCards, goal)}
          >
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="label-caps">
            {Math.min(todayCards, goal)} / {goal}
          </span>
        </div>
        <p className="muted small center">{caption(streak, left)}</p>
        <button type="button" className="btn btn-primary btn-wide" onClick={onReview}>
          {buttonLabel}
        </button>
      </section>
    </div>
  )
}
