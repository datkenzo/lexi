// Streak rules, kept pure so they can be tested without a database.
//
// A day counts toward the streak when you review at least GOAL cards that day.
// Days are the device's calendar days ("YYYY-MM-DD"). Today does not break the streak
// until midnight: if today is not done yet, the streak counts back from yesterday.
//
// An activity record is { day, by } where `by` maps a device id to the number of cards
// reviewed on that device that day. Keeping a count per device lets two devices that
// were offline add up correctly when they sync (see mergeBy).

export const GOAL = 5

const DAY_MS = 86400000
const pad = (n) => String(n).padStart(2, '0')

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

function keyFromNumber(n) {
  const dt = new Date(n * DAY_MS)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function cardsOf(rec) {
  return Object.values(rec?.by ?? {}).reduce((sum, n) => sum + n, 0)
}

// Per device, the higher count wins. Counts only ever go up, so this never loses a review.
export function mergeBy(a = {}, b = {}) {
  const out = { ...a }
  for (const [device, n] of Object.entries(b)) out[device] = Math.max(out[device] ?? 0, n)
  return out
}

export function sameCounts(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false
  return true
}

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// records: [{ day, by }]. Returns everything the Streak screen and the top bar need.
export function computeStreak(records, today = dayKey()) {
  const done = new Set(records.filter((r) => cardsOf(r) >= GOAL).map((r) => r.day))
  const t = dayNumber(today)
  const todayCards = cardsOf(records.find((r) => r.day === today))
  const todayDone = done.has(today)

  let current = 0
  for (let n = todayDone ? t : t - 1; done.has(keyFromNumber(n)); n--) current++

  let best = 0
  let run = 0
  let prev = null
  for (const n of [...done].map(dayNumber).sort((a, b) => a - b)) {
    run = prev !== null && n === prev + 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = n
  }

  // Monday to Sunday of the current week.
  const monday = t - ((new Date(t * DAY_MS).getUTCDay() + 6) % 7)
  const week = LABELS.map((label, i) => {
    const n = monday + i
    const day = keyFromNumber(n)
    let state = 'missed'
    if (done.has(day)) state = 'done'
    else if (n === t) state = 'today'
    else if (n > t) state = 'future'
    return { day, label, state }
  })

  return { current, best, todayCards, todayDone, goal: GOAL, week }
}
