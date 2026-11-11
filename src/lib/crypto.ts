// Шифрование данных приложения: AES-GCM 256 со случайным ключом; копия ключа — под кодом (PBKDF2).
// Работает на WebCrypto (есть и в WKWebView на iPhone, и в Node для тестов).

const enc = new TextEncoder()
const dec = new TextDecoder()

export const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
export const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

export interface Sealed {
  v: 1
  iv: string
  ct: string
}

export interface WrappedKey extends Sealed {
  salt: string
  iterations: number
}

/** Новый случайный ключ данных (в base64). */
export function newDataKey(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32)))
}

async function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function seal(plain: string, keyB64: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(unb64(keyB64)), enc.encode(plain))
  return { v: 1, iv: b64(iv), ct: b64(ct) }
}

/** Бросает ошибку, если ключ не тот или данные повреждены. */
export async function open(box: Sealed, keyB64: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) as BufferSource }, await aesKey(unb64(keyB64)), unb64(box.ct) as BufferSource)
  return dec.decode(pt)
}

async function pinKey(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, 256)
  return b64(bits)
}

/** Спрятать ключ данных под код. */
export async function wrapKey(dataKey: string, pin: string, iterations = 210_000): Promise<WrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const box = await seal(dataKey, await pinKey(pin, salt, iterations))
  return { ...box, salt: b64(salt), iterations }
}

/** Достать ключ данных кодом. Бросает ошибку при неверном коде. */
export async function unwrapKey(w: WrappedKey, pin: string): Promise<string> {
  return open(w, await pinKey(pin, unb64(w.salt), w.iterations))
}
