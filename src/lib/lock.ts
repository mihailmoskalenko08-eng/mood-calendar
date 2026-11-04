// Код-пароль. Хранится отдельно от данных (в копии не попадает): соль и PBKDF2-хеш четырёх цифр.
// Это защита от случайного взгляда на открытый телефон, а не шифрование: сами отметки лежат как есть.

const KEY = 'ottenki:lock:v1'
const ITERATIONS = 150_000

export interface LockRecord {
  salt: string
  hash: string
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

export async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256)
  return toHex(bits)
}

export function lockAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

export function readLock(): LockRecord | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const r = JSON.parse(raw)
    return typeof r?.salt === 'string' && typeof r?.hash === 'string' ? r : null
  } catch {
    return null
  }
}

export async function setPin(pin: string): Promise<void> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const hash = await hashPin(pin, salt)
  localStorage.setItem(KEY, JSON.stringify({ salt, hash }))
}

export async function checkPin(pin: string): Promise<boolean> {
  const r = readLock()
  if (!r) return true
  return (await hashPin(pin, r.salt)) === r.hash
}

export function clearLock() {
  try { localStorage.removeItem(KEY) } catch { /* */ }
}
