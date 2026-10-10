// Plays the dictionary recording when there is one. Otherwise the device reads the
// word aloud (Web Speech API), so every word can be heard.
export function canSpeak(record) {
  return Boolean(record?.audio) || (typeof window !== 'undefined' && 'speechSynthesis' in window)
}

export function speak(record) {
  if (!record) return
  if (record.audio) {
    new Audio(record.audio).play().catch(() => speakText(record.word))
    return
  }
  speakText(record.word)
}

function speakText(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.9
  window.speechSynthesis.speak(u)
}
