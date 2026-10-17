// A short random id for this browser. Streak counts are kept per device so that two
// devices that review offline add up correctly when they sync.
let memory = null

export function deviceId() {
  try {
    let id = localStorage.getItem('lexi.deviceId')
    if (!id) {
      id = randomId()
      localStorage.setItem('lexi.deviceId', id)
    }
    return id
  } catch {
    // Without storage this device gets a new id each time the app opens.
    return (memory ||= randomId())
  }
}

function randomId() {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
